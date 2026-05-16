from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi import Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import sqlite3
import random
import secrets
import os
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

KST = timezone(timedelta(hours=9))

def now_kst() -> str:
    return datetime.now(KST).strftime('%Y-%m-%d %H:%M:%S')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

from upload_router import router as upload_router
from edit_router import router as edit_router
from learning_router import router as learning_router
os.makedirs(os.path.join(BASE_DIR, "images"), exist_ok=True)


app = FastAPI()

# ─── Basic Auth ───────────────────────────────────────────────────────────

security = HTTPBasic()

AUTH_USER = os.getenv("AUTH_USER", "admin")
AUTH_PASS = os.getenv("AUTH_PASS", "changeme")
AUTH_ENABLED = os.getenv("AUTH_ENABLED", "true").lower() == "true"

def verify(request: Request, credentials: HTTPBasicCredentials = Depends(HTTPBasic(auto_error=False))):
    if not AUTH_ENABLED:
        return "dev"
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers={"WWW-Authenticate": "Basic"},
        )
    ok_user = secrets.compare_digest(credentials.username.encode(), AUTH_USER.encode())
    ok_pass = secrets.compare_digest(credentials.password.encode(), AUTH_PASS.encode())
    if not (ok_user and ok_pass):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username

app.include_router(upload_router)
app.include_router(edit_router)
app.include_router(learning_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8008"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(BASE_DIR, "exam_g.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ─── 문제 ───────────────────────────────────────────

@app.get("/subjects", dependencies=[Depends(verify)])
def get_subjects():
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT e.subject, COUNT(q.id) as count
        FROM questions q
        JOIN exams e ON q.exam_id = e.id
        WHERE e.subject IS NOT NULL AND e.subject != ''
        GROUP BY e.subject
        ORDER BY e.subject
    """)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

@app.get("/questions", dependencies=[Depends(verify)])
def get_questions(exam_id: Optional[int] = None, subject: Optional[str] = None):
    conn = get_db()
    c = conn.cursor()

    query = """
        SELECT q.*, e.year, e.month, e.day, e.subject, e.grade
        FROM questions q
        JOIN exams e ON q.exam_id = e.id
        WHERE 1=1
    """
    params = []

    if exam_id:
        query += " AND q.exam_id = ?"
        params.append(exam_id)
    if subject:
        query += " AND e.subject = ?"
        params.append(subject)

    query += " ORDER BY q.exam_id, q.number"
    c.execute(query, params)
    questions = [dict(row) for row in c.fetchall()]

    for q in questions:
        c.execute("SELECT * FROM choices WHERE question_id = ? ORDER BY number", (q["id"],))
        q["choices"] = [dict(r) for r in c.fetchall()]

    conn.close()
    return questions


@app.get("/questions/random", dependencies=[Depends(verify)])
def get_random_questions(
    count: int = 20,
    subject: Optional[str] = None,
    source: Optional[str] = None,
    exam_ids: Optional[str] = None,
):
    conn = get_db()
    c = conn.cursor()

    query = """
        SELECT q.id FROM questions q
        JOIN exams e ON q.exam_id = e.id
        WHERE 1=1
    """
    params = []

    if subject:
        query += " AND e.subject = ?"
        params.append(subject)

    if exam_ids:
        id_list = [int(i) for i in exam_ids.split(",") if i.strip().isdigit()]
        if id_list:
            query += f" AND q.exam_id IN ({','.join(['?'] * len(id_list))})"
            params.extend(id_list)

    if source == "wrong":
        query += " AND q.id IN (SELECT question_id FROM wrong_notes WHERE is_dismissed = 0)"
    elif source == "scrap":
        query += " AND q.id IN (SELECT question_id FROM scraps)"

    c.execute(query, params)
    all_ids = [row["id"] for row in c.fetchall()]

    if not all_ids:
        conn.close()
        return []

    selected_ids = random.sample(all_ids, min(count, len(all_ids)))

    questions = []
    for qid in selected_ids:
        c.execute("""
            SELECT q.*, e.year, e.month, e.day, e.subject, e.grade
            FROM questions q
            JOIN exams e ON q.exam_id = e.id
            WHERE q.id = ?
        """, (qid,))
        q = dict(c.fetchone())
        c.execute("SELECT * FROM choices WHERE question_id = ? ORDER BY number", (qid,))
        q["choices"] = [dict(r) for r in c.fetchall()]
        questions.append(q)

    conn.close()
    return questions


@app.get("/questions/exam-mode", dependencies=[Depends(verify)])
def get_exam_mode_questions(subjects: str, question_mode: str = "random"):
    subject_list = [s.strip() for s in subjects.split(",") if s.strip()]
    conn = get_db()
    c = conn.cursor()
    all_questions = []

    if question_mode == "by_exam":
        used_exams = {}
        for subject in subject_list:
            used = used_exams.setdefault(subject, [])
            if used:
                ph = ','.join(['?'] * len(used))
                c.execute(f"SELECT id FROM exams WHERE subject=? AND id NOT IN ({ph})", [subject] + used)
            else:
                c.execute("SELECT id FROM exams WHERE subject=?", (subject,))
            rows = c.fetchall()
            if not rows:
                c.execute("SELECT id FROM exams WHERE subject=?", (subject,))
                rows = c.fetchall()
            if not rows:
                continue
            exam_id = random.choice(rows)["id"]
            used.append(exam_id)
            c.execute("""
                SELECT q.*, e.year, e.month, e.day, e.subject, e.grade
                FROM questions q JOIN exams e ON q.exam_id = e.id
                WHERE q.exam_id = ? ORDER BY q.number
            """, (exam_id,))
            qs = [dict(r) for r in c.fetchall()]
            for q in qs:
                c.execute("SELECT * FROM choices WHERE question_id = ? ORDER BY number", (q["id"],))
                q["choices"] = [dict(r) for r in c.fetchall()]
            all_questions.extend(qs)
    else:
        for subject in subject_list:
            c.execute("""
                SELECT q.id FROM questions q
                JOIN exams e ON q.exam_id = e.id WHERE e.subject = ?
            """, (subject,))
            ids = [r["id"] for r in c.fetchall()]
            if not ids:
                continue
            for qid in random.sample(ids, min(20, len(ids))):
                c.execute("""
                    SELECT q.*, e.year, e.month, e.day, e.subject, e.grade
                    FROM questions q JOIN exams e ON q.exam_id = e.id WHERE q.id = ?
                """, (qid,))
                q = dict(c.fetchone())
                c.execute("SELECT * FROM choices WHERE question_id = ? ORDER BY number", (qid,))
                q["choices"] = [dict(r) for r in c.fetchall()]
                all_questions.append(q)

    conn.close()
    return all_questions


@app.get("/questions/by_ids", dependencies=[Depends(verify)])
def get_questions_by_ids(ids: str):
    id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
    if not id_list:
        return []
    conn = get_db()
    c = conn.cursor()
    questions = []
    for qid in id_list:
        c.execute("""
            SELECT q.*, e.year, e.month, e.day, e.subject, e.grade
            FROM questions q
            JOIN exams e ON q.exam_id = e.id
            WHERE q.id = ?
        """, (qid,))
        row = c.fetchone()
        if row:
            q = dict(row)
            c.execute("SELECT * FROM choices WHERE question_id = ? ORDER BY number", (qid,))
            q["choices"] = [dict(r) for r in c.fetchall()]
            questions.append(q)
    conn.close()
    return questions


@app.get("/questions/{question_id}", dependencies=[Depends(verify)])
def get_question(question_id: int):
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        SELECT q.*, e.year, e.month, e.day, e.subject, e.grade
        FROM questions q
        JOIN exams e ON q.exam_id = e.id
        WHERE q.id = ?
    """, (question_id,))
    row = c.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Question not found")

    q = dict(row)
    c.execute("SELECT * FROM choices WHERE question_id = ? ORDER BY number", (question_id,))
    q["choices"] = [dict(r) for r in c.fetchall()]

    conn.close()
    return q


# ─── 풀이 기록 ───────────────────────────────────────

class SolveRequest(BaseModel):
    question_id: int
    selected_choice: int
    time_taken: Optional[int] = 0
    session_id: Optional[int] = None


@app.post("/solve", dependencies=[Depends(verify)])
def submit_solve(req: SolveRequest):
    conn = get_db()
    c = conn.cursor()

    # 정답 확인
    c.execute("SELECT is_correct FROM choices WHERE question_id = ? AND number = ?",
              (req.question_id, req.selected_choice))
    row = c.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Choice not found")

    is_correct = row["is_correct"]

    # 풀이 기록 저장
    c.execute("""
        INSERT INTO solve_history (question_id, selected_choice, is_correct, time_taken, session_id)
        VALUES (?, ?, ?, ?, ?)
    """, (req.question_id, req.selected_choice, is_correct, req.time_taken, req.session_id))

    # 오답이면 오답노트 추가
    if not is_correct:
        c.execute("""
            INSERT OR IGNORE INTO wrong_notes (question_id, is_dismissed)
            VALUES (?, 0)
        """, (req.question_id,))
        # 이미 있으면 dismissed 해제
        c.execute("""
            UPDATE wrong_notes SET is_dismissed = 0 WHERE question_id = ?
        """, (req.question_id,))
    else:
        # 정답이면 auto_remove 설정 확인
        c.execute("SELECT auto_remove_wrong FROM settings WHERE id = 1")
        settings = c.fetchone()
        if settings and settings["auto_remove_wrong"]:
            c.execute("DELETE FROM wrong_notes WHERE question_id = ?", (req.question_id,))

    conn.commit()
    conn.close()

    return {"is_correct": bool(is_correct)}


# ─── 오답노트 ─────────────────────────────────────────

@app.get("/wrong-notes", dependencies=[Depends(verify)])
def get_wrong_notes():
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        SELECT q.*, e.year, e.month, e.day, e.subject, e.grade, wn.added_at, wn.memo
        FROM wrong_notes wn
        JOIN questions q ON wn.question_id = q.id
        JOIN exams e ON q.exam_id = e.id
        WHERE wn.is_dismissed = 0
        ORDER BY wn.added_at DESC
    """)
    questions = [dict(row) for row in c.fetchall()]

    for q in questions:
        c.execute("SELECT * FROM choices WHERE question_id = ? ORDER BY number", (q["id"],))
        q["choices"] = [dict(r) for r in c.fetchall()]

    conn.close()
    return questions


@app.delete("/wrong-notes/{question_id}", dependencies=[Depends(verify)])
def remove_wrong_note(question_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE wrong_notes SET is_dismissed = 1 WHERE question_id = ?", (question_id,))
    conn.commit()
    conn.close()
    return {"success": True}


class WrongNoteMemoRequest(BaseModel):
    memo: str = ""


@app.put("/wrong-notes/{question_id}/memo", dependencies=[Depends(verify)])
def update_wrong_note_memo(question_id: int, req: WrongNoteMemoRequest):
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE wrong_notes SET memo = ? WHERE question_id = ?", (req.memo, question_id))
    conn.commit()
    conn.close()
    return {"success": True}


# ─── 스크랩 ──────────────────────────────────────────

class ScrapRequest(BaseModel):
    memo: Optional[str] = ""


@app.get("/scraps", dependencies=[Depends(verify)])
def get_scraps():
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        SELECT q.*, e.year, e.month, e.day, e.subject, e.grade, s.memo, s.created_at
        FROM scraps s
        JOIN questions q ON s.question_id = q.id
        JOIN exams e ON q.exam_id = e.id
        ORDER BY s.created_at DESC
    """)
    questions = [dict(row) for row in c.fetchall()]

    for q in questions:
        c.execute("SELECT * FROM choices WHERE question_id = ? ORDER BY number", (q["id"],))
        q["choices"] = [dict(r) for r in c.fetchall()]

    conn.close()
    return questions


@app.post("/scraps/{question_id}", dependencies=[Depends(verify)])
def add_scrap(question_id: int, req: ScrapRequest):
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        INSERT OR REPLACE INTO scraps (question_id, memo)
        VALUES (?, ?)
    """, (question_id, req.memo))
    conn.commit()
    conn.close()
    return {"success": True}


@app.delete("/scraps/{question_id}", dependencies=[Depends(verify)])
def remove_scrap(question_id: int):
    conn = get_db()
    c = conn.cursor()
    c.execute("DELETE FROM scraps WHERE question_id = ?", (question_id,))
    conn.commit()
    conn.close()
    return {"success": True}


# ─── 설정 ────────────────────────────────────────────

class SettingsRequest(BaseModel):
    auto_remove_wrong: bool


@app.get("/settings", dependencies=[Depends(verify)])
def get_settings():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM settings WHERE id = 1")
    row = c.fetchone()
    conn.close()
    return dict(row)


@app.put("/settings", dependencies=[Depends(verify)])
def update_settings(req: SettingsRequest):
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        UPDATE settings SET auto_remove_wrong = ?, updated_at = ?
        WHERE id = 1
    """, (1 if req.auto_remove_wrong else 0, now_kst()))
    conn.commit()
    conn.close()
    return {"success": True}


# ─── 시험 목록 ────────────────────────────────────────

@app.get("/exams", dependencies=[Depends(verify)])
def get_exams():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM exams ORDER BY year DESC, month DESC, day DESC")
    exams = [dict(row) for row in c.fetchall()]
    conn.close()
    return exams



# ─── DB 마이그레이션 ──────────────────────────────────────────────────────

def migrate_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS exams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            year INTEGER, month INTEGER, day INTEGER,
            subject TEXT, grade TEXT, region TEXT, source_file TEXT
        );
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exam_id INTEGER, number INTEGER,
            question_text TEXT, question_image TEXT, explanation TEXT,
            FOREIGN KEY (exam_id) REFERENCES exams(id)
        );
        CREATE TABLE IF NOT EXISTS choices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER, number INTEGER,
            text TEXT, is_correct INTEGER DEFAULT 0,
            FOREIGN KEY (question_id) REFERENCES questions(id)
        );
        CREATE TABLE IF NOT EXISTS solve_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER, selected_choice INTEGER,
            is_correct INTEGER, time_taken INTEGER DEFAULT 0,
            session_id INTEGER,
            solved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (question_id) REFERENCES questions(id)
        );
        CREATE TABLE IF NOT EXISTS wrong_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER UNIQUE, is_dismissed INTEGER DEFAULT 0,
            memo TEXT DEFAULT '', added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (question_id) REFERENCES questions(id)
        );
        CREATE TABLE IF NOT EXISTS scraps (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER UNIQUE, memo TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (question_id) REFERENCES questions(id)
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mode TEXT, subject TEXT, exam_id INTEGER,
            total_count INTEGER DEFAULT 0, correct_count INTEGER DEFAULT 0,
            skipped_count INTEGER DEFAULT 0, duration INTEGER DEFAULT 0,
            started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ended_at TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY DEFAULT 1,
            auto_remove_wrong INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        INSERT OR IGNORE INTO settings (id, auto_remove_wrong) VALUES (1, 0);
    """)
    existing_sh = [row[1] for row in c.execute("PRAGMA table_info(solve_history)")]
    if "time_taken" not in existing_sh:
        c.execute("ALTER TABLE solve_history ADD COLUMN time_taken INTEGER DEFAULT 0")
    if "session_id" not in existing_sh:
        c.execute("ALTER TABLE solve_history ADD COLUMN session_id INTEGER")
    existing_wn = [row[1] for row in c.execute("PRAGMA table_info(wrong_notes)")]
    if "memo" not in existing_wn:
        c.execute("ALTER TABLE wrong_notes ADD COLUMN memo TEXT DEFAULT ''")
    if "added_at" not in existing_wn:
        c.execute("ALTER TABLE wrong_notes ADD COLUMN added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
    conn.commit()
    conn.close()

migrate_db()


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


@app.post("/sessions", dependencies=[Depends(verify)])
def start_session(req: SessionStartRequest):
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        INSERT INTO sessions (mode, subject, exam_id, total_count)
        VALUES (?, ?, ?, ?)
    """, (req.mode, req.subject, req.exam_id, req.total_count))
    session_id = c.lastrowid
    conn.commit()
    conn.close()
    return {"session_id": session_id}


@app.put("/sessions/{session_id}/end", dependencies=[Depends(verify)])
def end_session(session_id: int, req: SessionEndRequest):
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        UPDATE sessions SET correct_count=?, skipped_count=?, duration=?, ended_at=?
        WHERE id=?
    """, (req.correct_count, req.skipped_count, req.duration, now_kst(), session_id))
    conn.commit()
    conn.close()
    return {"success": True}


# ─── 통계 ────────────────────────────────────────────

@app.get("/stats/overview", dependencies=[Depends(verify)])
def get_stats_overview():
    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT COUNT(*) as cnt FROM questions")
    total_questions = c.fetchone()["cnt"]

    # 오답/스크랩 세션 제외
    c.execute("""
        SELECT COUNT(*) as cnt, SUM(sh.is_correct) as correct
        FROM solve_history sh
        LEFT JOIN sessions s ON sh.session_id = s.id
        WHERE (sh.session_id IS NULL OR s.mode NOT IN ('wrong', 'scrap'))
    """)
    row = c.fetchone()
    total_solved = row["cnt"] or 0
    total_correct = int(row["correct"] or 0)

    c.execute("""
        SELECT e.subject,
               COUNT(sh.id) as solved,
               SUM(sh.is_correct) as correct,
               AVG(sh.time_taken) as avg_time
        FROM solve_history sh
        JOIN questions q ON sh.question_id = q.id
        JOIN exams e ON q.exam_id = e.id
        LEFT JOIN sessions s ON sh.session_id = s.id
        WHERE (sh.session_id IS NULL OR s.mode NOT IN ('wrong', 'scrap'))
        GROUP BY e.subject
        ORDER BY e.subject
    """)
    by_subject = [dict(r) for r in c.fetchall()]
    for s in by_subject:
        s["correct"] = int(s["correct"] or 0)
        s["avg_time"] = round(s["avg_time"] or 0, 1)
        s["accuracy"] = round(s["correct"] / s["solved"] * 100, 1) if s["solved"] else 0

    c.execute("""
        SELECT s.*, e.year AS exam_year, e.month AS exam_month, e.day AS exam_day
        FROM sessions s
        LEFT JOIN exams e ON s.exam_id = e.id
        WHERE s.ended_at IS NOT NULL AND s.mode NOT IN ('wrong', 'scrap')
        ORDER BY s.started_at DESC
        LIMIT 20
    """)
    recent_sessions = [dict(r) for r in c.fetchall()]

    # 날짜별 집계 (최근 30일치, 오답/스크랩 제외)
    c.execute("""
        SELECT DATE(s.started_at) as date,
               SUM(s.correct_count) as correct,
               SUM(s.total_count - s.skipped_count) as answered,
               COUNT(*) as session_count
        FROM sessions s
        WHERE s.ended_at IS NOT NULL AND s.mode NOT IN ('wrong', 'scrap')
        GROUP BY DATE(s.started_at)
        ORDER BY date DESC
        LIMIT 30
    """)
    date_rows = [dict(r) for r in c.fetchall()]

    by_date = []
    for dr in date_rows:
        answered = dr["answered"] or 1
        dr["accuracy"] = round(int(dr["correct"] or 0) / answered * 100, 1)
        # 해당 날짜의 세션 목록
        c.execute("""
            SELECT s.*, e.year AS exam_year, e.month AS exam_month, e.day AS exam_day
            FROM sessions s
            LEFT JOIN exams e ON s.exam_id = e.id
            WHERE s.ended_at IS NOT NULL
              AND s.mode NOT IN ('wrong', 'scrap')
              AND DATE(s.started_at) = ?
            ORDER BY s.started_at DESC
        """, (dr["date"],))
        dr["sessions"] = [dict(r) for r in c.fetchall()]
        by_date.append(dr)

    conn.close()
    return {
        "total_questions": total_questions,
        "total_solved": total_solved,
        "total_correct": total_correct,
        "overall_accuracy": round(total_correct / total_solved * 100, 1) if total_solved else 0,
        "by_subject": by_subject,
        "recent_sessions": recent_sessions,
        "by_date": by_date,
    }

# ─── 정적 파일 서빙 (빌드된 프론트) ─────────────────────────────────────

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/", dependencies=[Depends(verify)])
    def serve_root():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

    @app.get("/{full_path:path}", dependencies=[Depends(verify)])
    def serve_spa(full_path: str):
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8008, reload=True)