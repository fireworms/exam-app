import os
import json
import sqlite3
import time
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# 1. 초기 설정
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL_ID = "gemini-3-flash-preview" # 현재 가장 빠르고 효율적인 모델
DB_PATH = "exam_g.db"

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


def parse_with_gemini(pdf_path):
    """제미나이 API 호출 및 503 에러 시 자동 재시도 로직 포함"""
    print(f"Gemini API 호출 중: {pdf_path}")
    
    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    prompt = """이 시험지 PDF를 분석해서 모든 문제를 파싱해주세요.
    반드시 다음 JSON 구조를 지켜야 하며, 다른 텍스트는 포함하지 마세요.
    사료와 지문은 생략(중략) 없이 전문을 다 포함해야 합니다.

    {
      "questions": [
        {
          "number": 1,
          "question_text": "문제와 사료 전문",
          "choices": [
            {"number": 1, "text": "선지1", "is_correct": false},
            {"number": 2, "text": "선지2", "is_correct": true},
            {"number": 3, "text": "선지3", "is_correct": false},
            {"number": 4, "text": "선지4", "is_correct": false}
          ],
          "explanation": "정답에 대한 상세 해설. 왜 정답인지, 각 오답은 왜 틀렸는지 설명"
        }
      ]
    }
    
    해설(explanation) 작성 가이드라인 (반드시 준수):
    - 해설은 전문가 수준으로 상세하게 작성해주세요
    - 각 오답 선지가 왜 틀렸는지도 전문가 수준으로 설명해주세요
    """

    max_retries = 5  # 최대 5번까지 다시 시도
    retry_delay = 10 # 에러 발생 시 10초 대기

    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=MODEL_ID,
                contents=[
                    types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )
            # 성공하면 결과 반환
            return json.loads(response.text)

        except Exception as e:
            # 503 에러나 일시적인 API 오류 감지
            if "503" in str(e) or "high demand" in str(e).lower():
                print(f"[{attempt + 1}/{max_retries}] 서버 부하 발생! {retry_delay}초 후 다시 시도합니다...")
                time.sleep(retry_delay)
                # 재시도 할 때마다 대기 시간을 조금씩 늘려주면 더 안정적이야 (Exponential Backoff)
                retry_delay *= 2 
            else:
                # 503 이외의 다른 심각한 에러(키 오류 등)는 바로 중단
                print(f"알 수 없는 에러 발생: {e}")
                raise e

    raise Exception(f"{max_retries}번 시도했지만 서버가 응답하지 않습니다. 나중에 다시 실행해 주세요.")

def save_to_db(exam_info, data):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # 시험 정보 저장
    c.execute("INSERT INTO exams (year, month, day, subject, grade) VALUES (?,?,?,?,?)",
              (exam_info['year'], exam_info['month'], exam_info['day'], exam_info['subject'], exam_info['grade']))
    exam_id = c.lastrowid

    # 2. 데이터 형식 정규화 (핵심!)
    # data가 딕셔너리면 'questions' 키를 찾고, 없거나 이미 리스트면 data 자체를 사용
    if isinstance(data, dict) and 'questions' in data:
        questions_list = data['questions']
    else:
        questions_list = data

    for q in questions_list:
        c.execute("INSERT INTO questions (exam_id, number, question_text, explanation) VALUES (?,?,?,?)",
                  (exam_id, q['number'], q['question_text'], q['explanation']))
        q_id = c.lastrowid
        for choice in q['choices']:
            c.execute("INSERT INTO choices (question_id, number, text, is_correct) VALUES (?,?,?,?)",
                      (q_id, choice['number'], choice['text'], 1 if choice['is_correct'] else 0))
    
    conn.commit()
    conn.close()
    print(f"완료: {len(questions_list)}문제 저장됨.")

if __name__ == "__main__":
    init_db()
    info = {"year": 2022, "month": 6, "day": 18, "subject": "한국사", "grade": "9급"}
    # 파일 경로만 오빠 컴퓨터 상황에 맞춰줘!
    pdf_path = "../pdfs/9급지방직_한국사_2022_0618.pdf"
    result = parse_with_gemini(pdf_path)
    save_to_db(info, result)