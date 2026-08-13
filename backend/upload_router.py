import os
import re
import json
import time
import threading
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, model_validator
from typing import List, Optional
from google import genai
from google.genai import types
import anthropic
import fitz
from dotenv import load_dotenv
from db import get_supabase
from auth import get_current_user

KST = timezone(timedelta(hours=9))

def now_kst() -> str:
    return datetime.now(KST).isoformat()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

router = APIRouter(prefix="/upload", tags=["upload"])

gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
claude_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL_ID = "gemini-3-flash-preview"
PDF_TEMP_DIR = os.path.join(BASE_DIR, "pdfs", "temp")
os.makedirs(PDF_TEMP_DIR, exist_ok=True)


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
    name = filename.replace(".pdf", "").replace("(교사용)", "").replace("(학생용)", "")
    date_match = re.search(r'(\d{4})(\d{2})(\d{2})', name)
    year, month, day = None, None, None
    if date_match:
        year = int(date_match.group(1))
        month = int(date_match.group(2))
        day = int(date_match.group(3))
    grade = next((kw for kw in GRADE_KEYWORDS if kw in name), None)
    region = next((kw for kw in REGION_KEYWORDS if kw in name), None)
    subject = next((kw for kw in SUBJECT_KEYWORDS if kw in name), None)
    return {
        "year": year, "month": month, "day": day,
        "grade": grade or "", "region": region or "", "subject": subject or "",
    }


def is_duplicate(filename: str) -> bool:
    sb = get_supabase()
    res = sb.table("exam_exams").select("id").eq("source_file", filename).execute()
    return len(res.data) > 0


PARSE_PROMPT = """이 시험지를 분석해서 모든 문제를 파싱해주세요.
반드시 다음 JSON 구조를 지켜야 하며, 다른 텍스트는 포함하지 마세요.
지문/사료/표/코드 등 문제에 포함된 모든 내용은 생략 없이 전문을 포함해야 합니다.

{
  "exam": {
    "year": 2025,
    "month": 3,
    "day": null,
    "subject": "국어",
    "grade": "9급",
    "region": "",
    "source_file": "2025년 3월 국어 9급"
  },
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
- 과목에 맞는 전문 지식을 활용해 해설을 작성해주세요
- 해설은 전문가 수준으로 상세하게 작성해주세요
- 각 오답 선지가 왜 틀렸는지도 전문가 수준으로 설명해주세요
"""

CLAUDE_CHUNK_SIZE = 20  # 한 번의 요청에서 파싱할 문제 수


def _render_pdf_images(pdf_bytes: bytes) -> list:
    """PDF 각 페이지를 2x PNG로 렌더링해 content 블록 리스트로 반환.
    청크마다 재사용하므로 렌더링은 파일당 1회만 수행한다."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    for page in doc:
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        img_b64 = base64.standard_b64encode(pix.tobytes("png")).decode()
        images.append({"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_b64}})
    doc.close()
    return images


def _extract_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def _claude_chunk(images: list, start: int, end: int) -> dict:
    """시험지 전체 이미지를 보여주되 start~end번 문제만 파싱하도록 요청."""
    prompt = (
        PARSE_PROMPT
        + f"\n\n**이번 요청에서는 {start}번부터 {end}번까지의 문제만 파싱하세요.**\n"
        "- 그 범위 밖 문제는 questions 배열에 넣지 마세요 (지문 참조용으로만 보세요)\n"
        f"- {start}번보다 앞 번호 문제의 공통지문을 참조해야 하면 해당 지문을 question_text에 그대로 포함하세요\n"
        "- exam 객체에 이 시험지의 전체 문제 수를 total_questions 정수로 반드시 포함하세요\n"
        "- 해당 범위에 문제가 없으면 questions를 빈 배열로 반환하세요\n"
    )
    content = images + [{"type": "text", "text": prompt}]
    # max_tokens가 크면 non-streaming은 HTTP 타임아웃에 걸리므로 반드시 스트리밍 사용
    with claude_client.messages.stream(
        model="claude-sonnet-4-6", max_tokens=32000,
        messages=[{"role": "user", "content": content}]
    ) as stream:
        response = stream.get_final_message()
    if response.stop_reason == "max_tokens":
        raise Exception(
            f"{start}~{end}번 응답이 max_tokens에서 잘림 "
            f"(출력 {response.usage.output_tokens} 토큰). CLAUDE_CHUNK_SIZE를 줄이세요."
        )
    return _extract_json(next(b.text for b in response.content if b.type == "text"))


def parse_with_claude(pdf_bytes: bytes) -> dict:
    """문제를 CLAUDE_CHUNK_SIZE개씩 나눠 파싱한 뒤 병합.
    한 번에 60문제+해설을 뽑으면 출력 한도에 걸려 JSON이 잘리므로 분할한다."""
    images = _render_pdf_images(pdf_bytes)

    # 1차 청크에서 exam 메타데이터와 전체 문제 수를 함께 얻는다
    first = _claude_chunk(images, 1, CLAUDE_CHUNK_SIZE)
    exam = first.get("exam") or {}
    questions = list(first.get("questions") or [])
    total = exam.pop("total_questions", None)
    if not isinstance(total, int) or total <= 0:
        total = len(questions)

    # 나머지 청크는 병렬 처리
    ranges = [
        (s, min(s + CLAUDE_CHUNK_SIZE - 1, total))
        for s in range(CLAUDE_CHUNK_SIZE + 1, total + 1, CLAUDE_CHUNK_SIZE)
    ]
    if ranges:
        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = [pool.submit(_claude_chunk, images, s, e) for s, e in ranges]
            for fut in futures:
                chunk = fut.result()  # 청크 하나라도 실패하면 전체 실패
                questions.extend(chunk.get("questions") or [])

    # 번호 기준 중복 제거 후 정렬 (청크 경계에서 중복 파싱될 수 있음)
    merged = {}
    for q in questions:
        num = q.get("number")
        if num is not None and num not in merged:
            merged[num] = q
    questions = [merged[n] for n in sorted(merged)]

    if total and len(questions) < total:
        missing = sorted(set(range(1, total + 1)) - set(merged))
        raise Exception(f"문제 누락: {total}문제 중 {len(questions)}개만 파싱됨 (누락 번호: {missing})")

    return {"exam": exam, "questions": questions}


def parse_with_gemini(pdf_bytes: bytes) -> dict:
    max_retries = 5
    retry_delay = 10
    for attempt in range(max_retries):
        try:
            response = gemini_client.models.generate_content(
                model=MODEL_ID,
                contents=[types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"), PARSE_PROMPT],
                config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0.1)
            )
            if response.text is None:
                finish_reason = response.candidates[0].finish_reason if response.candidates else None
                raise Exception(f"모델 응답 없음 (finish_reason: {finish_reason})")
            return json.loads(response.text)
        except Exception as e:
            error_msg = str(e).lower()
            is_quota = "429" in error_msg or "quota" in error_msg or "too many requests" in error_msg
            is_server = "503" in error_msg or "high demand" in error_msg or "unavailable" in error_msg
            if is_quota or is_server:
                print(f"[{attempt+1}/{max_retries}] 재시도 {retry_delay}초 후...")
                time.sleep(retry_delay)
                retry_delay *= 2
            else:
                raise
    raise Exception(f"{max_retries}번 시도 실패")


def _extract_passage(question_text: str) -> str:
    """[N~M] 공통지문 문제에서 지문 부분만 추출 (마지막 질문 라인 제외)."""
    parts = question_text.split('\n\n')
    if len(parts) <= 1:
        return question_text
    return '\n\n'.join(parts[:-1])


def _resolve_shared_passages(questions: list) -> list:
    """(N번 공통지문 문제) 패턴의 문제에 N번 문제의 지문을 삽입."""
    num_to_text = {q.get('number'): q.get('question_text', '') for q in questions}
    result = []
    for q in questions:
        text = q.get('question_text', '')
        match = re.search(r'\((\d+)번 공통지문 문제\)', text)
        if match:
            ref_num = int(match.group(1))
            ref_text = num_to_text.get(ref_num, '')
            if ref_text:
                passage = _extract_passage(ref_text)
                clean_text = re.sub(r'\s*\(\d+번 공통지문 문제\)', '', text).strip()
                q = dict(q)
                q['question_text'] = passage + '\n\n' + clean_text
        result.append(q)
    return result


def save_to_db(exam_info: dict, data: dict, source_file: str) -> int:
    sb = get_supabase()
    exam_res = sb.table("exam_exams").insert({
        "year": exam_info["year"], "month": exam_info["month"], "day": exam_info["day"],
        "subject": exam_info["subject"], "grade": exam_info["grade"],
        "region": exam_info.get("region", ""), "source_file": source_file,
    }).execute()
    exam_id = exam_res.data[0]["id"]

    questions_list = data.get("questions", data) if isinstance(data, dict) else data
    questions_list = _resolve_shared_passages(questions_list)
    for i, q in enumerate(questions_list):
        number = q.get("number") or q.get("question_number") or q.get("no") or (i + 1)
        question_text = q.get("question_text") or q.get("question") or q.get("text") or ""
        explanation = q.get("explanation") or q.get("해설") or ""
        q_res = sb.table("exam_questions").insert({
            "exam_id": exam_id, "number": number,
            "question_text": question_text, "explanation": explanation,
        }).execute()
        q_id = q_res.data[0]["id"]
        choices = []
        for j, choice in enumerate(q.get("choices", [])):
            choices.append({
                "question_id": q_id,
                "number": choice.get("number") or choice.get("no") or (j + 1),
                "text": choice.get("text") or choice.get("choice_text") or "",
                "is_correct": 1 if (choice.get("is_correct") or choice.get("correct")) else 0,
            })
        if choices:
            sb.table("exam_choices").insert(choices).execute()

    return exam_id


def update_log(log_id: int, status: str, error_msg: str = None, exam_id: int = None):
    sb = get_supabase()
    sb.table("exam_upload_logs").update({
        "status": status, "error_msg": error_msg,
        "exam_id": exam_id, "updated_at": now_kst(),
    }).eq("id", log_id).execute()


def background_parse(log_id: int, pdf_path: str, exam_info: dict, source_file: str, parser: str = "claude"):
    try:
        update_log(log_id, "processing")
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        data = parse_with_gemini(pdf_bytes) if parser == "gemini" else parse_with_claude(pdf_bytes)
        exam_id = save_to_db(exam_info, data, source_file)
        update_log(log_id, "done", exam_id=exam_id)
        os.remove(pdf_path)
    except Exception as e:
        # 실패 시 임시 PDF는 남겨둔다 — 재업로드 없이 재파싱 가능하도록
        update_log(log_id, "failed", error_msg=str(e))


# ── 모델 ─────────────────────────────────────────────

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


class ChoiceItem(BaseModel):
    number: int
    text: str
    is_correct: bool = False


class QuestionItem(BaseModel):
    number: int
    question_text: str
    choices: List[ChoiceItem]
    explanation: Optional[str] = ""

    @model_validator(mode="before")
    @classmethod
    def _normalize(cls, data):
        """대체 형식 변환: id→number, passage+question→question_text.
        category·answer 등 불필요 필드는 extra=ignore로 자동 무시."""
        if not isinstance(data, dict):
            return data
        data = dict(data)
        if "number" not in data and "id" in data:
            data["number"] = data["id"]
        if "question_text" not in data:
            passage = (data.get("passage") or "").strip()
            question = (data.get("question") or "").strip()
            if passage or question:
                data["question_text"] = f"{passage}\n\n{question}".strip()
        return data


class ExamMeta(BaseModel):
    year: Optional[int] = None
    month: Optional[int] = None
    day: Optional[int] = None
    subject: str = ""
    grade: str = ""
    region: str = ""
    source_file: str = "AI예상문제"


class JsonImportRequest(BaseModel):
    exam: ExamMeta
    questions: List[QuestionItem]


# ── 엔드포인트 ─────────────────────────────────────────

@router.post("/analyze")
async def analyze_files(files: List[UploadFile] = File(...), user_id: str = Depends(get_current_user)):
    results = []
    for file in files:
        filename = file.filename
        is_dup = is_duplicate(filename)
        parsed = parse_filename(filename)
        temp_path = os.path.join(PDF_TEMP_DIR, filename)
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)
        results.append({"filename": filename, "is_duplicate": is_dup, "parsed": parsed})
    return {"files": results}


@router.post("/confirm")
async def confirm_upload(req: ConfirmRequest, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    started = []
    for item in req.items:
        filename = item.filename
        temp_path = os.path.join(PDF_TEMP_DIR, filename)
        if not os.path.exists(temp_path):
            raise HTTPException(status_code=400, detail=f"{filename} 임시 파일 없음. 다시 업로드해주세요.")
        log_res = sb.table("exam_upload_logs").insert({
            "source_file": filename, "status": "pending",
            "created_at": now_kst(), "updated_at": now_kst(),
        }).execute()
        log_id = log_res.data[0]["id"]
        exam_info = item.exam_info.dict()
        started.append({"filename": filename, "log_id": log_id, "temp_path": temp_path, "exam_info": exam_info, "parser": item.parser})

    def run_sequential(jobs):
        for i, job in enumerate(jobs):
            if i > 0:
                time.sleep(15)
            background_parse(job["log_id"], job["temp_path"], job["exam_info"], job["filename"], job["parser"])

    def run_parallel(jobs):
        threads = [
            threading.Thread(target=background_parse, args=(j["log_id"], j["temp_path"], j["exam_info"], j["filename"], j["parser"]), daemon=True)
            for j in jobs
        ]
        for t in threads:
            t.start()

    use_gemini = any(job["parser"] == "gemini" for job in started)
    if use_gemini:
        threading.Thread(target=run_sequential, args=(started,), daemon=True).start()
    else:
        run_parallel(started)

    return {"started": [{"filename": s["filename"], "log_id": s["log_id"]} for s in started]}


@router.post("/json")
async def import_json(req: JsonImportRequest, user_id: str = Depends(get_current_user)):
    exam_info = req.exam.dict()
    source_file = exam_info.get("source_file") or "AI예상문제"
    if is_duplicate(source_file):
        raise HTTPException(status_code=409, detail=f"이미 존재하는 source_file: {source_file}")
    data = {"questions": [q.dict() for q in req.questions]}
    try:
        exam_id = save_to_db(exam_info, data, source_file)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB 저장 실패: {e}")
    sb = get_supabase()
    sb.table("exam_upload_logs").insert({
        "source_file": source_file, "status": "done", "exam_id": exam_id,
        "created_at": now_kst(), "updated_at": now_kst(),
    }).execute()
    return {"exam_id": exam_id, "question_count": len(req.questions)}


@router.get("/logs")
async def get_logs(user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    logs_res = sb.table("exam_upload_logs").select("*").order("created_at", desc=True).limit(100).execute()
    logs = logs_res.data
    exam_ids = [l["exam_id"] for l in logs if l.get("exam_id")]
    if exam_ids:
        exams_res = sb.table("exam_exams").select("id, subject, year, month, day, region, grade").in_("id", exam_ids).execute()
        exams_map = {e["id"]: e for e in exams_res.data}
        for log in logs:
            if log.get("exam_id") and log["exam_id"] in exams_map:
                log.update(exams_map[log["exam_id"]])
    return {"logs": logs}
