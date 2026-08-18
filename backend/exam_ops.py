"""회차(exam) 공용 조작 — main.py의 삭제 엔드포인트와 업로드 실패 롤백이 함께 쓴다."""

from db import get_supabase, db_exec


def delete_exam_cascade(exam_id: int, delete_logs: bool = False) -> int:
    """회차와 딸린 문제·선지·유저 기록을 모두 삭제한다. 지운 문제 수를 반환.

    delete_logs=False면 exam_upload_logs 행은 남긴다 — 업로드 실패 롤백에서는
    실패 기록 자체가 남아야 하기 때문.
    """
    sb = get_supabase()

    q_res = db_exec(sb.table("exam_questions").select("id").eq("exam_id", exam_id))
    q_ids = [q["id"] for q in q_res.data]

    if q_ids:
        for table in ("exam_solve_history", "exam_wrong_notes", "exam_scraps", "exam_reports"):
            db_exec(sb.table(table).delete().in_("question_id", q_ids))
        db_exec(sb.table("exam_choices").delete().in_("question_id", q_ids))
        db_exec(sb.table("exam_questions").delete().in_("id", q_ids))

    db_exec(sb.table("exam_sessions").delete().eq("exam_id", exam_id))
    if delete_logs:
        db_exec(sb.table("exam_upload_logs").delete().eq("exam_id", exam_id))
    db_exec(sb.table("exam_exams").delete().eq("id", exam_id))
    return len(q_ids)
