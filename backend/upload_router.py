import os
import re
import json
import sqlite3
import time
import threading
import base64
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from google import genai
from google.genai import types
import anthropic
import fitz
from dotenv import load_dotenv

KST = timezone(timedelta(hours=9))

def now_kst() -> str:
    return datetime.now(KST).strftime('%Y-%m-%d %H:%M:%S')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

router = APIRouter(prefix="/upload", tags=["upload"])

gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
claude_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL_ID = "gemini-3-flash-preview"
DB_PATH = os.path.join(BASE_DIR, "exam_g.db")
PDF_TEMP_DIR = os.path.join(BASE_DIR, "pdfs", "temp")

os.makedirs(PDF_TEMP_DIR, exist_ok=True)


# ── DB 초기화 (upload_logs 테이블 추가) ──────────────────────────────────────

def ensure_upload_logs_table():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executescript("""
        ALTER TABLE exams ADD COLUMN source_file TEXT;
    """ if not column_exists(conn, "exams", "source_file") else "SELECT 1;")

    c.execute("""
        CREATE TABLE IF NOT EXISTS upload_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_file TEXT NOT NULL,
            status TEXT DEFAULT 'pending',  -- pending | processing | done | failed
            error_msg TEXT,
            exam_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def column_exists(conn, table, column):
    c = conn.cursor()
    c.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in c.fetchall())


def init_upload_schema():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # source_file, region 컬럼 추가 (없으면)
    if not column_exists(conn, "exams", "source_file"):
        c.execute("ALTER TABLE exams ADD COLUMN source_file TEXT")
    if not column_exists(conn, "exams", "region"):
        c.execute("ALTER TABLE exams ADD COLUMN region TEXT")

    c.execute("""
        CREATE TABLE IF NOT EXISTS upload_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_file TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            error_msg TEXT,
            exam_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


# ── 파일명 파싱 ────────────────────────────────────────────────────────────

SUBJECT_KEYWORDS = [
    "한국사", "국어", "영어", "수학", "행정법총론", "행정학개론",
    "사회", "과학", "컴퓨터일반", "정보보호론", "세법개론", "회계학",
    "행정법", "행정학", "경제학", "사회복지학", "교육학", "심리학",
    "물리", "화학", "생물", "지구과학", "지리", "윤리", "정치",
    "전기", "기계", "토목", "건축", "화공", "통신", "전자",
]

GRADE_KEYWORDS = ["5급", "7급", "9급", "경위", "소방", "교육행정"]

REGION_KEYWORDS = [
    "국가직", "지방직", "서울시", "경기도", "부산", "대구", "인천",
    "광주", "대전", "울산", "세종", "강원", "충북", "충남",
    "전북", "전남", "경북", "경남", "제주", "소방직", "교행직",
]


def parse_filename(filename: str) -> dict:
    """파일명에서 시험 정보 추출"""
    name = filename.replace(".pdf", "").replace("(교사용)", "").replace("(학생용)", "")

    # 날짜 추출: YYYYMMDD 또는 YYYY_MMDD 형식
    date_match = re.search(r'(\d{4})(\d{2})(\d{2})', name)
    year, month, day = None, None, None
    if date_match:
        year = int(date_match.group(1))
        month = int(date_match.group(2))
        day = int(date_match.group(3))

    # 등급 추출
    grade = None
    for kw in GRADE_KEYWORDS:
        if kw in name:
            grade = kw
            break

    # 지역/종류 추출
    region = None
    for kw in REGION_KEYWORDS:
        if kw in name:
            region = kw
            break

    # 과목 추출
    subject = None
    for kw in SUBJECT_KEYWORDS:
        if kw in name:
            subject = kw
            break

    return {
        "year": year,
        "month": month,
        "day": day,
        "grade": grade or "",
        "region": region or "",
        "subject": subject or "",
    }


def is_duplicate(filename: str) -> bool:
    """이미 DB에 있는 파일인지 확인"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT id FROM exams WHERE source_file = ?", (filename,))
    result = c.fetchone()
    conn.close()
    return result is not None


# ── Gemini 파싱 (parse_pdf_g.py 로직 재사용) ──────────────────────────────

PARSE_PROMPT = """이 시험지를 분석해서 모든 문제를 파싱해주세요.
반드시 다음 JSON 구조를 지켜야 하며, 다른 텍스트는 포함하지 마세요.
지문/사료/표/코드 등 문제에 포함된 모든 내용은 생략 없이 전문을 포함해야 합니다.

{
  "questions": [
    {
      "number": 1,
      "question_text": "문제 전체 텍스트 (지문, 사료, 코드, 표 등 포함)",
      "choices": [
        {"number": 1, "text": "선지1", "is_correct": false},
        {"number": 2, "text": "선지2", "is_correct": true},
        {"number": 3, "text": "선지3", "is_correct": false},
        {"number": 4, "text": "선지4", "is_correct": false}
      ],
      "explanation": "정답과 오답에 대한 상세 해설"
    }
  ]
}

주의사항:
- 정답은 ❶❷❸❹ 기호, 굵게 표시, 또는 답안표 등 시험지마다 표시 방식이 다를 수 있으니 정확히 파악해주세요
- 과목에 맞는 전문 지식을 활용해 해설을 작성해주세요 (한국사, 영어, 컴퓨터일반, 정보보호론, 국어 등)
- 해설은 전문가 수준으로 상세하게 작성해주세요
- 각 오답 선지가 왜 틀렸는지도 전문가 수준으로 설명해주세요
"""


def parse_with_claude(pdf_bytes: bytes) -> dict:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    content = []
    for page in doc:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img_b64 = base64.standard_b64encode(pix.tobytes("png")).decode()
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/png", "data": img_b64}
        })
    doc.close()
    content.append({"type": "text", "text": PARSE_PROMPT})

    response = claude_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=16000,
        messages=[{"role": "user", "content": content}]
    )
    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def parse_with_gemini(pdf_bytes: bytes) -> dict:
    prompt = PARSE_PROMPT

    max_retries = 5
    retry_delay = 10

    for attempt in range(max_retries):
        try:
            response = gemini_client.models.generate_content(
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
            if response.text is None:
                finish_reason = None
                if response.candidates:
                    finish_reason = response.candidates[0].finish_reason
                raise Exception(f"모델 응답 없음 (finish_reason: {finish_reason})")
            return json.loads(response.text)
        except Exception as e:
            # 에러 메시지나 객체 속성에서 429(할당량 초과) 또는 503(서버 부하) 확인
            error_msg = str(e).lower()
            is_quota_error = "429" in error_msg or "quota" in error_msg or "too many requests" in error_msg
            is_server_error = "503" in error_msg or "high demand" in error_msg or "unavailable" in error_msg

            if is_quota_error or is_server_error:
                reason = "할당량 초과(429)" if is_quota_error else "서버 부하(503)"
                print(f"[{attempt+1}/{max_retries}] {reason}, {retry_delay}초 후 재시도...")
                
                time.sleep(retry_delay)
                retry_delay *= 2  # 지수 백오프(Exponential Backoff) 적용
            else:
                # 그 외의 에러(인증 실패, 400 Bad Request 등)는 즉시 중단
                raise e

    raise Exception(f"{max_retries}번 시도 실패")


def save_to_db(exam_info: dict, data: dict, source_file: str) -> int:
    conn = sqlite3.connect(DB_PATH, timeout=30)
    c = conn.cursor()

    c.execute(
        "INSERT INTO exams (year, month, day, subject, grade, region, source_file) VALUES (?,?,?,?,?,?,?)",
        (exam_info['year'], exam_info['month'], exam_info['day'],
         exam_info['subject'], exam_info['grade'], exam_info.get('region', ''), source_file)
    )
    exam_id = c.lastrowid

    questions_list = data.get('questions', data) if isinstance(data, dict) else data

    for i, q in enumerate(questions_list):
        # Gemini가 키 이름을 다르게 반환하는 경우 방어
        number = q.get('number') or q.get('question_number') or q.get('no') or (i + 1)
        question_text = q.get('question_text') or q.get('question') or q.get('text') or ''
        explanation = q.get('explanation') or q.get('해설') or ''

        c.execute(
            "INSERT INTO questions (exam_id, number, question_text, explanation) VALUES (?,?,?,?)",
            (exam_id, number, question_text, explanation)
        )
        q_id = c.lastrowid
        for j, choice in enumerate(q.get('choices', [])):
            choice_num = choice.get('number') or choice.get('no') or (j + 1)
            choice_text = choice.get('text') or choice.get('choice_text') or ''
            is_correct = choice.get('is_correct') or choice.get('correct') or False
            c.execute(
                "INSERT INTO choices (question_id, number, text, is_correct) VALUES (?,?,?,?)",
                (q_id, choice_num, choice_text, 1 if is_correct else 0)
            )

    conn.commit()
    conn.close()
    return exam_id


def update_log(log_id: int, status: str, error_msg: str = None, exam_id: int = None):
    conn = sqlite3.connect(DB_PATH, timeout=30)
    c = conn.cursor()
    c.execute(
        "UPDATE upload_logs SET status=?, error_msg=?, exam_id=?, updated_at=? WHERE id=?",
        (status, error_msg, exam_id, now_kst(), log_id)
    )
    conn.commit()
    conn.close()


def background_parse(log_id: int, pdf_path: str, exam_info: dict, source_file: str, parser: str = "claude"):
    """백그라운드 스레드에서 실행"""
    try:
        update_log(log_id, "processing")
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        if parser == "gemini":
            data = parse_with_gemini(pdf_bytes)
        else:
            data = parse_with_claude(pdf_bytes)
        exam_id = save_to_db(exam_info, data, source_file)
        update_log(log_id, "done", exam_id=exam_id)
        os.remove(pdf_path)
    except Exception as e:
        update_log(log_id, "failed", error_msg=str(e))
        if os.path.exists(pdf_path):
            os.remove(pdf_path)


# ── API 엔드포인트 ──────────────────────────────────────────────────────────

class ExamInfo(BaseModel):
    year: Optional[int] = None
    month: Optional[int] = None
    day: Optional[int] = None
    grade: str = ""
    region: str = ""
    subject: str = ""


class ConfirmItem(BaseModel):
    filename: str
    exam_info: ExamInfo
    parser: str = "claude"


class ConfirmRequest(BaseModel):
    items: List[ConfirmItem]


@router.post("/analyze")
async def analyze_files(files: List[UploadFile] = File(...)):
    """파일 업로드 → 파일명 분석 → 중복 확인 후 결과 반환"""
    init_upload_schema()
    results = []

    for file in files:
        filename = file.filename
        is_dup = is_duplicate(filename)
        parsed = parse_filename(filename)

        # 임시 저장
        temp_path = os.path.join(PDF_TEMP_DIR, filename)
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)

        results.append({
            "filename": filename,
            "is_duplicate": is_dup,
            "parsed": parsed,
        })

    return {"files": results}


@router.post("/confirm")
async def confirm_upload(req: ConfirmRequest):
    """사용자가 확인/수정한 정보로 백그라운드 파싱 시작"""
    init_upload_schema()
    started = []

    for item in req.items:
        filename = item.filename
        temp_path = os.path.join(PDF_TEMP_DIR, filename)

        if not os.path.exists(temp_path):
            raise HTTPException(status_code=400, detail=f"{filename} 임시 파일 없음. 다시 업로드해주세요.")

        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute(
            "INSERT INTO upload_logs (source_file, status, created_at, updated_at) VALUES (?, 'pending', ?, ?)",
            (filename, now_kst(), now_kst())
        )
        log_id = c.lastrowid
        conn.commit()
        conn.close()

        exam_info = item.exam_info.dict()
        started.append({"filename": filename, "log_id": log_id, "temp_path": temp_path, "exam_info": exam_info, "parser": item.parser})

    def run_sequential(jobs):
        for i, job in enumerate(jobs):
            if i > 0:
                time.sleep(15)
            background_parse(job["log_id"], job["temp_path"], job["exam_info"], job["filename"], job["parser"])

    def run_parallel(jobs):
        threads = [
            threading.Thread(
                target=background_parse,
                args=(job["log_id"], job["temp_path"], job["exam_info"], job["filename"], job["parser"]),
                daemon=True
            )
            for job in jobs
        ]
        for t in threads:
            t.start()

    use_gemini = any(job["parser"] == "gemini" for job in started)
    if use_gemini:
        threading.Thread(target=run_sequential, args=(started,), daemon=True).start()
    else:
        run_parallel(started)

    return {"started": [{"filename": s["filename"], "log_id": s["log_id"]} for s in started]}


@router.get("/logs")
async def get_logs():
    """업로드 로그 목록 조회"""
    init_upload_schema()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("""
        SELECT ul.*, e.subject, e.year, e.month, e.day, e.region, e.grade
        FROM upload_logs ul
        LEFT JOIN exams e ON ul.exam_id = e.id
        ORDER BY ul.created_at DESC
        LIMIT 100
    """)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return {"logs": rows}
