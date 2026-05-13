import fitz  # pymupdf
import anthropic
import json
import sqlite3
import os
import base64
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

DB_PATH = "exam.db"


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS exams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER,
            month INTEGER,
            day INTEGER,
            subject TEXT,
            grade TEXT
        );

        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_id INTEGER,
            number INTEGER,
            question_text TEXT,
            question_image BLOB,
            explanation TEXT,
            FOREIGN KEY (exam_id) REFERENCES exams(id)
        );

        CREATE TABLE IF NOT EXISTS choices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER,
            number INTEGER,
            text TEXT,
            is_correct INTEGER DEFAULT 0,
            FOREIGN KEY (question_id) REFERENCES questions(id)
        );

        CREATE TABLE IF NOT EXISTS solve_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER,
            selected_choice INTEGER,
            is_correct INTEGER,
            solved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (question_id) REFERENCES questions(id)
        );

        CREATE TABLE IF NOT EXISTS wrong_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER UNIQUE,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_dismissed INTEGER DEFAULT 0,
            FOREIGN KEY (question_id) REFERENCES questions(id)
        );

        CREATE TABLE IF NOT EXISTS scraps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            memo TEXT,
            FOREIGN KEY (question_id) REFERENCES questions(id)
        );

        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            auto_remove_wrong INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        INSERT OR IGNORE INTO settings (id, auto_remove_wrong) VALUES (1, 0);
    """)

    conn.commit()
    conn.close()
    print("DB initialized!")


def extract_pdf_data(pdf_path):
    """PDF에서 페이지별 텍스트와 이미지를 추출"""
    doc = fitz.open(pdf_path)
    pages = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text()

        # 페이지를 이미지로 렌더링 (Claude에게 보낼 용도)
        mat = fitz.Matrix(2, 2)  # 2x 해상도
        pix = page.get_pixmap(matrix=mat)
        img_bytes = pix.tobytes("png")
        img_base64 = base64.standard_b64encode(img_bytes).decode()

        pages.append({
            "page_num": page_num + 1,
            "text": text,
            "image_base64": img_base64
        })

    doc.close()
    return pages


def parse_with_claude(pages, exam_info):
    """Claude API로 문제 파싱 및 해설 생성"""

    # 모든 페이지 이미지를 Claude에게 전달
    content = []
    for page in pages:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": page["image_base64"]
            }
        })

    content.append({
        "type": "text",
        "text": """이 시험지 이미지들을 분석해서 모든 문제를 파싱해주세요.

다음 JSON 형식으로 반환해주세요. JSON만 반환하고 다른 텍스트는 넣지 마세요:

{
  "questions": [
    {
      "number": 1,
      "question_text": "문제 전체 텍스트 (지문 포함)",
      "choices": [
        {"number": 1, "text": "선지 내용", "is_correct": false},
        {"number": 2, "text": "선지 내용", "is_correct": true},
        {"number": 3, "text": "선지 내용", "is_correct": false},
        {"number": 4, "text": "선지 내용", "is_correct": false}
      ],
      "explanation": "정답에 대한 상세 해설. 왜 정답인지, 각 오답은 왜 틀렸는지 설명"
    }
  ]
}

주의사항:
- 정답은 ❶❷❸❹ 또는 굵게 표시된 선지입니다
- 문제 지문이 박스 안에 있으면 그 내용도 question_text에 포함해주세요
- 해설은 한국사 전문가 수준으로 상세하게 작성해주세요
- 각 오답 선지가 왜 틀렸는지도 설명해주세요"""
    })

    print("Claude API 호출 중... (시간이 좀 걸려요)")

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=16000,
        messages=[{"role": "user", "content": content}]
    )

    raw = response.content[0].text.strip()

    # JSON 파싱
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    return json.loads(raw)


def save_to_db(exam_info, questions_data):
    """파싱된 데이터를 DB에 저장"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # 시험 정보 저장
    c.execute(
        "INSERT INTO exams (year, month, day, subject, grade) VALUES (?, ?, ?, ?, ?)",
        (exam_info["year"], exam_info["month"], exam_info["day"],
         exam_info["subject"], exam_info["grade"])
    )
    exam_id = c.lastrowid

    # 문제 저장
    for q in questions_data["questions"]:
        c.execute(
            "INSERT INTO questions (exam_id, number, question_text, explanation) VALUES (?, ?, ?, ?)",
            (exam_id, q["number"], q["question_text"], q["explanation"])
        )
        question_id = c.lastrowid

        # 선지 저장
        for choice in q["choices"]:
            c.execute(
                "INSERT INTO choices (question_id, number, text, is_correct) VALUES (?, ?, ?, ?)",
                (question_id, choice["number"], choice["text"], 1 if choice["is_correct"] else 0)
            )

    conn.commit()
    conn.close()
    print(f"저장 완료! {len(questions_data['questions'])}문제 저장됨")


def process_pdf(pdf_path, exam_info):
    """PDF 처리 메인 함수"""
    print(f"PDF 파싱 시작: {pdf_path}")

    pages = extract_pdf_data(pdf_path)
    print(f"{len(pages)}페이지 추출 완료")

    questions_data = parse_with_claude(pages, exam_info)
    print(f"{len(questions_data['questions'])}문제 파싱 완료")

    save_to_db(exam_info, questions_data)


if __name__ == "__main__":
    init_db()

    # PDF 파일 정보 입력
    exam_info = {
        "year": 2022,
        "month": 6,
        "day": 18,
        "subject": "한국사",
        "grade": "9급"
    }

    pdf_path = "../pdfs/9급지방직_한국사_2022_0618.pdf"

    process_pdf(pdf_path, exam_info)
