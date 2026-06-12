import sys
import os

# Vercel entrypoint(pyproject.toml)로 직접 로드될 때 sibling 모듈 경로 보장
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import random
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

KST = timezone(timedelta(hours=9))

def now_kst() -> str:
    return datetime.now(KST).isoformat()

BASE_DIR = _BACKEND_DIR
load_dotenv(os.path.join(BASE_DIR, ".env"))

from supabase import create_client as _create_supabase_client
from db import get_supabase
from auth import get_current_user

def _new_auth_client():
    """로그인/회원가입 전용 클라이언트 - 싱글톤 오염 방지"""
    return _create_supabase_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY"))
from edit_router import router as edit_router
from vocab_router import router as vocab_router

_IS_VERCEL = bool(os.getenv("VERCEL"))

if not _IS_VERCEL:
    from upload_router import router as upload_router
    try:
        os.makedirs(os.path.join(BASE_DIR, "images"), exist_ok=True)
    except OSError:
        pass

app = FastAPI()
api_router = APIRouter()

if not _IS_VERCEL:
    app.include_router(upload_router, prefix="/api")
app.include_router(edit_router, prefix="/api")
app.include_router(vocab_router, prefix="/api")

_cors_origins = (
    ["*"] if _IS_VERCEL
    else ["http://localhost:5173", "http://localhost:8008", "http://192.168.50.102:8008"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=not _IS_VERCEL,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── 인증 ────────────────────────────────────────────

class AuthRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class RefreshRequest(BaseModel):
    refresh_token: str

class UpdatePasswordRequest(BaseModel):
    password: str


def validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 해요")
    if not any(c.isalpha() for c in password):
        raise HTTPException(status_code=400, detail="비밀번호에 영문자가 포함되어야 해요")
    if not any(c.isdigit() for c in password):
        raise HTTPException(status_code=400, detail="비밀번호에 숫자가 포함되어야 해요")


@api_router.post("/auth/signup")
def signup(req: AuthRequest):
    validate_password(req.password)
    sb = _new_auth_client()
    try:
        res = sb.auth.sign_up({"email": req.email, "password": req.password})
        if not res.user:
            raise HTTPException(status_code=400, detail="회원가입 실패")
        return {"message": "회원가입 완료", "user_id": str(res.user.id)}
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e).lower()
        if "already registered" in msg or "already been registered" in msg:
            raise HTTPException(status_code=409, detail="이미 가입된 이메일이에요. 로그인해주세요.")
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/auth/login")
def login(req: AuthRequest):
    sb = _new_auth_client()
    try:
        res = sb.auth.sign_in_with_password({"email": req.email, "password": req.password})
        if not res.session:
            raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸어요")
        return {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
            "user_id": str(res.user.id),
            "email": res.user.email,
        }
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e).lower()
        if "email not confirmed" in msg or "not confirmed" in msg:
            raise HTTPException(status_code=401, detail="이메일 인증이 필요해요. 받은편지함을 확인해주세요.")
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 틀렸어요")


@api_router.post("/auth/refresh")
def refresh_token(req: RefreshRequest):
    sb = _new_auth_client()
    try:
        res = sb.auth.refresh_session(req.refresh_token)
        if not res.session:
            raise HTTPException(status_code=401, detail="세션 갱신 실패")
        return {
            "access_token": res.session.access_token,
            "refresh_token": res.session.refresh_token,
        }
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e).lower()
        if "invalid" in msg or "expired" in msg or "not found" in msg:
            raise HTTPException(status_code=401, detail="세션 갱신 실패")
        raise HTTPException(status_code=503, detail="인증 서버 연결 실패")


@api_router.post("/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    sb = get_supabase()
    try:
        sb.auth.reset_password_for_email(
            req.email,
            options={"redirect_to": "http://192.168.50.102:8008/reset-password"}
        )
        return {"message": "비밀번호 재설정 이메일을 보냈어요"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/auth/update-password")
def update_password(req: UpdatePasswordRequest, user_id: str = Depends(get_current_user)):
    validate_password(req.password)
    sb = get_supabase()
    try:
        sb.auth.admin.update_user_by_id(user_id, {"password": req.password})
        return {"message": "비밀번호가 변경됐어요"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/auth/me")
def me(user_id: str = Depends(get_current_user)):
    return {"user_id": user_id}


# ─── 헬퍼 ─────────────────────────────────────────────

def flatten_question(q: dict) -> dict:
    exam = q.pop("exam_exams", None) or {}
    choices = q.pop("exam_choices", None) or []
    q.update(exam)
    q["choices"] = sorted(choices, key=lambda c: c["number"])
    return q


def fetch_questions_by_ids(sb, ids: list) -> list:
    if not ids:
        return []
    res = sb.table("exam_questions").select(
        "*, exam_exams!inner(year, month, day, subject, grade), exam_choices(id, number, text, is_correct)"
    ).in_("id", ids).execute()
    return [flatten_question(q) for q in res.data]


# ─── 과목 ────────────────────────────────────────────

@api_router.get("/subjects")
def get_subjects(user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("exam_questions").select("id, exam_exams!inner(subject)").execute()
    counts = {}
    for q in res.data:
        subj = (q.get("exam_exams") or {}).get("subject", "")
        if subj:
            counts[subj] = counts.get(subj, 0) + 1
    return [{"subject": s, "count": c} for s, c in sorted(counts.items())]


# ─── 문제 ────────────────────────────────────────────

@api_router.get("/questions/random")
def get_random_questions(
    count: int = 20,
    subject: Optional[str] = None,
    source: Optional[str] = None,
    exam_ids: Optional[str] = None,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    query = sb.table("exam_questions").select("id, exam_exams!inner(subject)")

    if subject:
        query = query.eq("exam_exams.subject", subject)
    if exam_ids:
        id_list = [int(i) for i in exam_ids.split(",") if i.strip().isdigit()]
        if id_list:
            query = query.in_("exam_id", id_list)

    all_res = query.execute()
    all_ids = [q["id"] for q in all_res.data]

    if source == "wrong":
        wrong_res = sb.table("exam_wrong_notes").select("question_id").eq("user_id", user_id).eq("is_dismissed", 0).execute()
        wrong_ids = set(w["question_id"] for w in wrong_res.data)
        all_ids = [i for i in all_ids if i in wrong_ids]
    elif source == "scrap":
        scrap_res = sb.table("exam_scraps").select("question_id").eq("user_id", user_id).execute()
        scrap_ids = set(s["question_id"] for s in scrap_res.data)
        all_ids = [i for i in all_ids if i in scrap_ids]

    if not all_ids:
        return []

    selected = random.sample(all_ids, min(count, len(all_ids)))
    questions = fetch_questions_by_ids(sb, selected)
    random.shuffle(questions)
    return questions


@api_router.get("/questions/exam-mode")
def get_exam_mode_questions(
    subjects: str,
    question_mode: str = "random",
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    subject_list = [s.strip() for s in subjects.split(",") if s.strip()]
    all_questions = []

    if question_mode == "by_exam":
        used_exams: dict[str, list] = {}
        for subject in subject_list:
            used = used_exams.setdefault(subject, [])
            exams_q = sb.table("exam_exams").select("id").eq("subject", subject)
            if used:
                exams_q = exams_q.not_.in_("id", used)
            exams_res = exams_q.execute()
            rows = exams_res.data
            if not rows:
                exams_res = sb.table("exam_exams").select("id").eq("subject", subject).execute()
                rows = exams_res.data
            if not rows:
                continue
            exam_id = random.choice(rows)["id"]
            used.append(exam_id)
            ids_res = sb.table("exam_questions").select("id").eq("exam_id", exam_id).order("number").execute()
            qs = fetch_questions_by_ids(sb, [r["id"] for r in ids_res.data])
            all_questions.extend(qs)
    else:
        for subject in subject_list:
            ids_res = sb.table("exam_questions").select("id, exam_exams!inner(subject)").eq("exam_exams.subject", subject).execute()
            ids = [r["id"] for r in ids_res.data]
            if not ids:
                continue
            selected = random.sample(ids, min(20, len(ids)))
            all_questions.extend(fetch_questions_by_ids(sb, selected))

    return all_questions


@api_router.get("/questions/by_ids")
def get_questions_by_ids(ids: str, user_id: str = Depends(get_current_user)):
    id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
    return fetch_questions_by_ids(get_supabase(), id_list)


@api_router.get("/questions/deeplink")
def get_question_by_deeplink(
    year: int,
    exam_type: str,
    question_no: int,
    subject: str,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    exams_res = sb.table("exam_exams").select("id").eq("year", year).eq("region", exam_type).eq("subject", subject).order("month").order("day").execute()
    if not exams_res.data:
        raise HTTPException(status_code=404, detail="Question not found")
    exam_id = exams_res.data[0]["id"]
    q_res = sb.table("exam_questions").select(
        "*, exam_exams!inner(year, month, day, subject, grade), exam_choices(id, number, text, is_correct)"
    ).eq("exam_id", exam_id).eq("number", question_no).execute()
    if not q_res.data:
        raise HTTPException(status_code=404, detail="Question not found")
    return flatten_question(q_res.data[0])


@api_router.get("/questions/{question_id}")
def get_question(question_id: int, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("exam_questions").select(
        "*, exam_exams!inner(year, month, day, subject, grade), exam_choices(id, number, text, is_correct)"
    ).eq("id", question_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Question not found")
    return flatten_question(res.data[0])


@api_router.get("/questions")
def get_questions(
    exam_id: Optional[int] = None,
    subject: Optional[str] = None,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    query = sb.table("exam_questions").select(
        "*, exam_exams!inner(year, month, day, subject, grade), exam_choices(id, number, text, is_correct)"
    )
    if exam_id:
        query = query.eq("exam_id", exam_id)
    if subject:
        query = query.eq("exam_exams.subject", subject)
    res = query.order("exam_id").order("number").execute()
    return [flatten_question(q) for q in res.data]


# ─── 풀이 기록 ────────────────────────────────────────

class SolveRequest(BaseModel):
    question_id: int
    selected_choice: int
    time_taken: Optional[int] = 0
    session_id: Optional[int] = None


class SolveBatchItem(BaseModel):
    question_id: int
    selected_choice: int
    time_taken: Optional[int] = 0


class SolveBatchRequest(BaseModel):
    answers: list[SolveBatchItem]
    session_id: Optional[int] = None


def _wrong_counts(sb, user_id: str, question_ids: list) -> dict:
    """문제별 누적 오답 횟수 {question_id: count}"""
    if not question_ids:
        return {}
    # is_correct는 integer 컬럼 — False로 비교하면 postgrest가 22P02를 뱉는다
    res = sb.table("exam_solve_history").select("question_id").eq("user_id", user_id).eq("is_correct", 0).in_("question_id", question_ids).execute()
    counts: dict = {}
    for r in res.data:
        counts[r["question_id"]] = counts.get(r["question_id"], 0) + 1
    return counts


def _record_solves(sb, user_id: str, answers: list[dict], session_id: Optional[int]) -> list:
    """답안 목록을 일괄 채점·기록. answers: [{question_id, selected_choice, time_taken}]"""
    q_ids = [a["question_id"] for a in answers]
    ch_res = sb.table("exam_choices").select("question_id, number, is_correct").in_("question_id", q_ids).execute()
    correct_map = {(c["question_id"], c["number"]): c["is_correct"] for c in ch_res.data}

    rows, results = [], []
    for a in answers:
        key = (a["question_id"], a["selected_choice"])
        if key not in correct_map:
            continue
        is_correct = correct_map[key]
        rows.append({
            "user_id": user_id,
            "question_id": a["question_id"],
            "selected_choice": a["selected_choice"],
            "is_correct": is_correct,
            "time_taken": a.get("time_taken") or 0,
            "session_id": session_id,
        })
        results.append({"question_id": a["question_id"], "is_correct": bool(is_correct)})

    if rows:
        sb.table("exam_solve_history").insert(rows).execute()

    wrong_ids = [r["question_id"] for r in results if not r["is_correct"]]
    correct_ids = [r["question_id"] for r in results if r["is_correct"]]

    if wrong_ids:
        # 누적 오답 횟수 (방금 insert한 이번 오답 포함)
        counts = _wrong_counts(sb, user_id, wrong_ids)
        for r in results:
            if not r["is_correct"]:
                r["wrong_count"] = counts.get(r["question_id"], 1)

        existing = sb.table("exam_wrong_notes").select("question_id").eq("user_id", user_id).in_("question_id", wrong_ids).execute()
        existing_ids = {e["question_id"] for e in existing.data}
        new_notes = [{"user_id": user_id, "question_id": qid, "is_dismissed": 0} for qid in wrong_ids if qid not in existing_ids]
        if new_notes:
            sb.table("exam_wrong_notes").insert(new_notes).execute()
        if existing_ids:
            sb.table("exam_wrong_notes").update({"is_dismissed": 0}).eq("user_id", user_id).in_("question_id", list(existing_ids)).execute()

    if correct_ids:
        settings_res = sb.table("exam_settings").select("auto_remove_wrong").eq("user_id", user_id).execute()
        if settings_res.data and settings_res.data[0].get("auto_remove_wrong"):
            sb.table("exam_wrong_notes").delete().eq("user_id", user_id).in_("question_id", correct_ids).execute()

    return results


@api_router.post("/solve")
def submit_solve(req: SolveRequest, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    results = _record_solves(sb, user_id, [{
        "question_id": req.question_id,
        "selected_choice": req.selected_choice,
        "time_taken": req.time_taken,
    }], req.session_id)
    if not results:
        raise HTTPException(status_code=404, detail="Choice not found")
    return {"is_correct": results[0]["is_correct"], "wrong_count": results[0].get("wrong_count")}


@api_router.post("/solve/batch")
def submit_solve_batch(req: SolveBatchRequest, user_id: str = Depends(get_current_user)):
    if not req.answers:
        return {"results": []}
    sb = get_supabase()
    results = _record_solves(sb, user_id, [a.model_dump() for a in req.answers], req.session_id)
    return {"results": results}


# ─── 오답노트 ─────────────────────────────────────────

@api_router.get("/wrong-notes")
def get_wrong_notes(user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    wn_res = sb.table("exam_wrong_notes").select("question_id, added_at, memo").eq("user_id", user_id).eq("is_dismissed", 0).order("added_at", desc=True).execute()
    if not wn_res.data:
        return []
    q_ids = [w["question_id"] for w in wn_res.data]
    meta = {w["question_id"]: {"added_at": w["added_at"], "memo": w["memo"]} for w in wn_res.data}
    questions = fetch_questions_by_ids(sb, q_ids)
    counts = _wrong_counts(sb, user_id, q_ids)
    for q in questions:
        q.update(meta.get(q["id"], {}))
        q["wrong_count"] = counts.get(q["id"], 0)
    questions.sort(key=lambda q: meta.get(q["id"], {}).get("added_at", ""), reverse=True)
    return questions


@api_router.delete("/wrong-notes/{question_id}")
def remove_wrong_note(question_id: int, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    sb.table("exam_wrong_notes").update({"is_dismissed": 1}).eq("user_id", user_id).eq("question_id", question_id).execute()
    return {"success": True}


class WrongNoteMemoRequest(BaseModel):
    memo: str = ""


@api_router.put("/wrong-notes/{question_id}/memo")
def update_wrong_note_memo(question_id: int, req: WrongNoteMemoRequest, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    sb.table("exam_wrong_notes").update({"memo": req.memo}).eq("user_id", user_id).eq("question_id", question_id).execute()
    return {"success": True}


# ─── 스크랩 ──────────────────────────────────────────

class ScrapRequest(BaseModel):
    memo: Optional[str] = ""


@api_router.get("/scraps")
def get_scraps(user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    sc_res = sb.table("exam_scraps").select("question_id, memo, created_at").eq("user_id", user_id).order("created_at", desc=True).execute()
    if not sc_res.data:
        return []
    q_ids = [s["question_id"] for s in sc_res.data]
    meta = {s["question_id"]: {"memo": s["memo"], "created_at": s["created_at"]} for s in sc_res.data}
    questions = fetch_questions_by_ids(sb, q_ids)
    for q in questions:
        q.update(meta.get(q["id"], {}))
    questions.sort(key=lambda q: meta.get(q["id"], {}).get("created_at", ""), reverse=True)
    return questions


@api_router.get("/scraps/ids")
def get_scrap_ids(user_id: str = Depends(get_current_user)):
    """스크랩한 question_id 목록만 — Quiz의 별표 표시용 경량 조회"""
    sb = get_supabase()
    res = sb.table("exam_scraps").select("question_id").eq("user_id", user_id).execute()
    return [r["question_id"] for r in res.data]


@api_router.post("/scraps/{question_id}")
def add_scrap(question_id: int, req: ScrapRequest, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("exam_scraps").select("id").eq("user_id", user_id).eq("question_id", question_id).execute()
    if existing.data:
        sb.table("exam_scraps").update({"memo": req.memo}).eq("user_id", user_id).eq("question_id", question_id).execute()
    else:
        sb.table("exam_scraps").insert({"user_id": user_id, "question_id": question_id, "memo": req.memo or ""}).execute()
    return {"success": True}


@api_router.delete("/scraps/{question_id}")
def remove_scrap(question_id: int, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    sb.table("exam_scraps").delete().eq("user_id", user_id).eq("question_id", question_id).execute()
    return {"success": True}


# ─── 신고 ────────────────────────────────────────────

@api_router.post("/reports/{question_id}")
def add_report(question_id: int, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("exam_reports").select("id").eq("user_id", user_id).eq("question_id", question_id).execute()
    if not existing.data:
        sb.table("exam_reports").insert({"user_id": user_id, "question_id": question_id}).execute()
    return {"success": True}


@api_router.delete("/reports/{question_id}")
def remove_report(question_id: int, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    sb.table("exam_reports").delete().eq("user_id", user_id).eq("question_id", question_id).execute()
    return {"success": True}


@api_router.get("/reports")
def get_reports(user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("exam_reports").select(
        "id, user_id, question_id, created_at, exam_questions(number, question_text, exam_exams(year, month, subject))"
    ).order("created_at", desc=True).execute()
    rows = []
    for r in res.data:
        q = r.pop("exam_questions") or {}
        exam = (q.pop("exam_exams", None) or {})
        r["question_number"] = q.get("number")
        r["question_text"] = (q.get("question_text") or "")[:80]
        r["year"] = exam.get("year")
        r["month"] = exam.get("month")
        r["subject"] = exam.get("subject")
        r["is_mine"] = r["user_id"] == user_id
        rows.append(r)
    return rows


# ─── 설정 ────────────────────────────────────────────

class SettingsRequest(BaseModel):
    auto_remove_wrong: bool


@api_router.get("/settings")
def get_settings(user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("exam_settings").select("*").eq("user_id", user_id).execute()
    if not res.data:
        sb.table("exam_settings").insert({"user_id": user_id, "auto_remove_wrong": 0}).execute()
        return {"auto_remove_wrong": 0}
    return res.data[0]


@api_router.put("/settings")
def update_settings(req: SettingsRequest, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    sb.table("exam_settings").update({
        "auto_remove_wrong": 1 if req.auto_remove_wrong else 0,
        "updated_at": now_kst(),
    }).eq("user_id", user_id).execute()
    return {"success": True}


# ─── 시험 목록 ────────────────────────────────────────

@api_router.get("/exams")
def get_exams(user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    exams_res = sb.table("exam_exams").select("*").order("year", desc=True).order("month", desc=True).order("day", desc=True).execute()
    exam_ids = [e["id"] for e in exams_res.data]
    if not exam_ids:
        return []
    counts_res = sb.table("exam_questions").select("exam_id").in_("exam_id", exam_ids).execute()
    count_map = {}
    for q in counts_res.data:
        count_map[q["exam_id"]] = count_map.get(q["exam_id"], 0) + 1
    for exam in exams_res.data:
        exam["question_count"] = count_map.get(exam["id"], 0)
    return exams_res.data


@api_router.delete("/exams/{exam_id}")
def delete_exam(exam_id: int, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    exam_res = sb.table("exam_exams").select("id").eq("id", exam_id).execute()
    if not exam_res.data:
        raise HTTPException(status_code=404, detail="Exam not found")

    q_res = sb.table("exam_questions").select("id").eq("exam_id", exam_id).execute()
    q_ids = [q["id"] for q in q_res.data]

    if q_ids:
        sb.table("exam_solve_history").delete().in_("question_id", q_ids).execute()
        sb.table("exam_wrong_notes").delete().in_("question_id", q_ids).execute()
        sb.table("exam_scraps").delete().in_("question_id", q_ids).execute()
        sb.table("exam_choices").delete().in_("question_id", q_ids).execute()
        sb.table("exam_questions").delete().in_("id", q_ids).execute()

    sb.table("exam_sessions").delete().eq("exam_id", exam_id).execute()
    sb.table("exam_upload_logs").delete().eq("exam_id", exam_id).execute()
    sb.table("exam_exams").delete().eq("id", exam_id).execute()
    return {"ok": True}


# ─── 세션 ────────────────────────────────────────────

class SessionStartRequest(BaseModel):
    mode: Optional[str] = "all"
    subject: Optional[str] = None
    exam_id: Optional[int] = None
    total_count: int = 0


class SessionEndRequest(BaseModel):
    correct_count: int
    skipped_count: int
    duration: int


@api_router.post("/sessions")
def start_session(req: SessionStartRequest, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("exam_sessions").insert({
        "user_id": user_id,
        "mode": req.mode,
        "subject": req.subject,
        "exam_id": req.exam_id,
        "total_count": req.total_count,
    }).execute()
    session_id = res.data[0]["id"]
    return {"session_id": session_id}


@api_router.put("/sessions/{session_id}/end")
def end_session(session_id: int, req: SessionEndRequest, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    sb.table("exam_sessions").update({
        "correct_count": req.correct_count,
        "skipped_count": req.skipped_count,
        "duration": req.duration,
        "ended_at": now_kst(),
    }).eq("id", session_id).eq("user_id", user_id).execute()
    return {"success": True}


def _flatten_session(s: dict) -> dict:
    exam_info = s.pop("exam_exams", None) or {}
    s["exam_year"] = exam_info.get("year")
    s["exam_month"] = exam_info.get("month")
    s["exam_day"] = exam_info.get("day")
    return s


@api_router.get("/sessions/{session_id}/detail")
def get_session_detail(session_id: int, user_id: str = Depends(get_current_user)):
    """풀이 회차 리뷰 — 세션 정보 + 문제별 풀이 결과"""
    sb = get_supabase()
    s_res = sb.table("exam_sessions").select("*, exam_exams(year, month, day)").eq("id", session_id).eq("user_id", user_id).execute()
    if not s_res.data:
        raise HTTPException(status_code=404, detail="Session not found")
    session = _flatten_session(s_res.data[0])

    sh_res = sb.table("exam_solve_history").select("question_id, selected_choice, is_correct, time_taken").eq("user_id", user_id).eq("session_id", session_id).order("id").execute()
    q_map = {q["id"]: q for q in fetch_questions_by_ids(sb, [r["question_id"] for r in sh_res.data])}
    wrong_q_ids = [r["question_id"] for r in sh_res.data if not r["is_correct"]]
    counts = _wrong_counts(sb, user_id, wrong_q_ids)
    items = [
        {
            "question": q_map[r["question_id"]],
            "selected_choice": r["selected_choice"],
            # DB는 1/0 정수 — 프론트가 true/false/null(미답변)을 구분하므로 bool로 정규화
            "is_correct": bool(r["is_correct"]),
            "time_taken": r["time_taken"],
            "wrong_count": counts.get(r["question_id"], 0),
        }
        for r in sh_res.data if r["question_id"] in q_map
    ]
    return {"session": session, "items": items}


# ─── 통계 ────────────────────────────────────────────

@api_router.get("/stats/wrong-counts")
def get_wrong_counts(limit: int = 30, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    res = sb.table("exam_solve_history").select("question_id").eq("user_id", user_id).eq("is_correct", 0).execute()
    count_map = {}
    for row in res.data:
        qid = row["question_id"]
        count_map[qid] = count_map.get(qid, 0) + 1
    if not count_map:
        return []
    sorted_ids = sorted(count_map.keys(), key=lambda x: count_map[x], reverse=True)[:limit]
    questions = fetch_questions_by_ids(sb, sorted_ids)
    for q in questions:
        q["wrong_count"] = count_map.get(q["id"], 0)
    questions.sort(key=lambda q: q["wrong_count"], reverse=True)
    return questions


@api_router.get("/stats/counts")
def get_stats_counts(user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    total = sb.table("exam_questions").select("id", count="exact").execute().count or 0
    wrong = sb.table("exam_wrong_notes").select("id", count="exact").eq("user_id", user_id).eq("is_dismissed", 0).execute().count or 0
    scrap = sb.table("exam_scraps").select("id", count="exact").eq("user_id", user_id).execute().count or 0
    return {"total": total, "wrong": wrong, "scrap": scrap}


@api_router.get("/stats/overview")
def get_stats_overview(user_id: str = Depends(get_current_user)):
    sb = get_supabase()

    total_q_res = sb.table("exam_questions").select("id", count="exact").execute()
    total_questions = total_q_res.count or 0

    excluded_res = sb.table("exam_sessions").select("id").eq("user_id", user_id).in_("mode", ["wrong", "scrap"]).execute()
    excluded_ids = {s["id"] for s in excluded_res.data}

    sh_res = sb.table("exam_solve_history").select("id, question_id, is_correct, time_taken, session_id").eq("user_id", user_id).execute()
    solve_history = [
        sh for sh in sh_res.data
        if sh.get("session_id") is None or sh["session_id"] not in excluded_ids
    ]

    total_solved = len(solve_history)
    total_correct = sum(1 for s in solve_history if s["is_correct"])

    q_ids = list({sh["question_id"] for sh in solve_history})
    subject_map = {}
    if q_ids:
        q_res = sb.table("exam_questions").select("id, exam_exams!inner(subject)").in_("id", q_ids).execute()
        for q in q_res.data:
            subject_map[q["id"]] = (q.get("exam_exams") or {}).get("subject", "")

    by_subject_map: dict = {}
    for sh in solve_history:
        subj = subject_map.get(sh["question_id"], "")
        if subj not in by_subject_map:
            by_subject_map[subj] = {"subject": subj, "solved": 0, "correct": 0, "total_time": 0}
        by_subject_map[subj]["solved"] += 1
        by_subject_map[subj]["correct"] += sh["is_correct"] or 0
        by_subject_map[subj]["total_time"] += sh["time_taken"] or 0

    by_subject = []
    for s in sorted(by_subject_map.values(), key=lambda x: x["subject"]):
        s["avg_time"] = round(s["total_time"] / s["solved"], 1) if s["solved"] else 0
        s["accuracy"] = round(s["correct"] / s["solved"] * 100, 1) if s["solved"] else 0
        del s["total_time"]
        by_subject.append(s)

    sessions_res = sb.table("exam_sessions").select("*, exam_exams(year, month, day)").eq("user_id", user_id).not_.is_("ended_at", "null").not_.in_("mode", ["wrong", "scrap"]).order("started_at", desc=True).execute()
    all_sessions = [_flatten_session(s) for s in sessions_res.data]
    recent_sessions = all_sessions[:20]

    by_date_map: dict = {}
    for s in all_sessions:
        if not s.get("started_at"):
            continue
        date = s["started_at"][:10]
        if date not in by_date_map:
            by_date_map[date] = {"date": date, "correct": 0, "answered": 0, "session_count": 0, "sessions": []}
        by_date_map[date]["correct"] += s.get("correct_count", 0) or 0
        answered = (s.get("total_count", 0) or 0) - (s.get("skipped_count", 0) or 0)
        by_date_map[date]["answered"] += answered
        by_date_map[date]["session_count"] += 1
        by_date_map[date]["sessions"].append(s)

    by_date = []
    for date, data in sorted(by_date_map.items(), reverse=True)[:30]:
        data["accuracy"] = round(data["correct"] / max(data["answered"], 1) * 100, 1)
        by_date.append(data)

    return {
        "total_questions": total_questions,
        "total_solved": total_solved,
        "total_correct": total_correct,
        "overall_accuracy": round(total_correct / total_solved * 100, 1) if total_solved else 0,
        "by_subject": by_subject,
        "recent_sessions": recent_sessions,
        "by_date": by_date,
    }


# ─── API 라우터 등록 ─────────────────────────────────

app.include_router(api_router, prefix="/api")

# ─── 정적 파일 서빙 ──────────────────────────────────

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    _NO_CACHE = {"Cache-Control": "no-cache, no-store, must-revalidate"}

    @app.get("/")
    def serve_root():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"), headers=_NO_CACHE)

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"), headers=_NO_CACHE)

if __name__ == "__main__":
    # 로컬 개발 편의용 진입점(파일 변경 자동 반영). on-demand 수동 실행 전용이며
    # systemd 등으로 부팅 시 상시 구동하지 말 것 — reload=True가 매 재시작마다 전체
    # import로 CPU를 태운다. 자세한 배경은 루트 CLAUDE.md '실행' 섹션 참고.
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8008, reload=True)
