"""
SQLite → Supabase 마이그레이션 스크립트
exams / questions / choices 만 이전 (로그 데이터는 초기화)

실행: python migrate_to_supabase.py
"""
import sqlite3
import os
from dotenv import load_dotenv
from supabase import create_client

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

SQLITE_DB = os.path.join(BASE_DIR, "exam_g.db")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def migrate():
    conn = sqlite3.connect(SQLITE_DB)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    # ── exams ─────────────────────────────────────────
    c.execute("SELECT * FROM exams ORDER BY id")
    exams = [dict(r) for r in c.fetchall()]
    print(f"[exam] {len(exams)}개 이전 시작...")

    id_map = {}  # old_id → new_id
    for exam in exams:
        old_id = exam.pop("id")
        res = sb.table("exam_exams").insert(exam).execute()
        new_id = res.data[0]["id"]
        id_map[old_id] = new_id

    print(f"[exam] 완료")

    # ── questions ─────────────────────────────────────
    c.execute("SELECT * FROM questions ORDER BY id")
    questions = [dict(r) for r in c.fetchall()]
    print(f"[question] {len(questions)}개 이전 시작...")

    q_id_map = {}
    batch = []
    for q in questions:
        old_id = q.pop("id")
        q["exam_id"] = id_map.get(q["exam_id"])
        batch.append(q)
        if len(batch) >= 50:
            res = sb.table("exam_questions").insert(batch).execute()
            for orig, inserted in zip(batch, res.data):
                pass
            batch = []

    # 남은 거
    if batch:
        sb.table("exam_questions").insert(batch).execute()

    # question ID 매핑을 위해 다시 조회
    q_res = sb.table("exam_questions").select("id, exam_id, number").execute()
    # SQLite question을 새 ID로 매핑 (exam_id + number로 식별)
    new_q_map = {}
    for q in q_res.data:
        new_q_map[(q["exam_id"], q["number"])] = q["id"]

    old_q_map = {}
    for q in questions:
        new_exam_id = q["exam_id"]
        old_q_map[(new_exam_id, q["number"])] = new_q_map.get((new_exam_id, q["number"]))

    print(f"[question] 완료")

    # ── choices ───────────────────────────────────────
    c.execute("SELECT * FROM choices ORDER BY id")
    choices_raw = [dict(r) for r in c.fetchall()]
    print(f"[choice] {len(choices_raw)}개 이전 시작...")

    # 기존 question_id → 새 question_id 매핑 필요
    c.execute("SELECT id, exam_id, number FROM questions")
    old_questions = {r["id"]: (id_map.get(r["exam_id"]), r["number"]) for r in c.fetchall()}

    batch = []
    for ch in choices_raw:
        ch.pop("id")
        old_qid = ch["question_id"]
        key = old_questions.get(old_qid)
        if key:
            new_qid = new_q_map.get(key)
            if new_qid:
                ch["question_id"] = new_qid
                batch.append(ch)
        if len(batch) >= 100:
            sb.table("exam_choices").insert(batch).execute()
            batch = []

    if batch:
        sb.table("exam_choices").insert(batch).execute()

    print(f"[choice] 완료")
    conn.close()
    print("\n✅ 마이그레이션 완료!")
    print(f"  exams: {len(exams)}개")
    print(f"  questions: {len(questions)}개")
    print(f"  choices: {len(choices_raw)}개")


if __name__ == "__main__":
    migrate()
