"""단어장 '기출 N회' — 실제 영어 기출(exam_exams.is_official)에서 단어가 등장한 회차 수.

원형으로 묶어 센다 (simplemma 표제어: diluted→dilute, imposing→impose, pensions→pension).
-ly/-tion 같은 파생어는 표제어가 달라 묶이지 않는다.
공통지문이 여러 문제에 복제돼 있어 문제 수가 아닌 '회차 수'로 센다.
"""
import re
import time
import simplemma
from db import get_supabase, db_exec, db_fetch_all

_TTL = 600  # 새 회차 업로드 반영 주기 (초)
_cache = {"at": 0.0, "exams": []}  # exams: 회차별 " lemma lemma ... " 문자열
_TOKEN = re.compile(r"[A-Za-z]+")


def _lemmas(text: str) -> list[str]:
    return [simplemma.lemmatize(t.lower(), lang="en") for t in _TOKEN.findall(text or "")]


def _load() -> list[str]:
    sb = get_supabase()
    exams = db_exec(sb.table("exam_exams").select("id").eq("subject", "영어").eq("is_official", True)).data
    exam_ids = [e["id"] for e in exams]
    if not exam_ids:
        return []
    rows = db_fetch_all(lambda: sb.table("exam_questions")
                        .select("exam_id, question_text, exam_choices(text)")
                        .in_("exam_id", exam_ids))
    texts: dict[int, list[str]] = {}
    for r in rows:
        parts = texts.setdefault(r["exam_id"], [])
        parts.append(r.get("question_text") or "")
        parts.extend(c.get("text") or "" for c in r.get("exam_choices") or [])
    return [" " + " ".join(_lemmas(" ".join(p))) + " " for p in texts.values()]


def _corpus() -> list[str]:
    now = time.time()
    if now - _cache["at"] > _TTL:
        _cache["exams"] = _load()
        _cache["at"] = now
    return _cache["exams"]


def exam_freq(word: str) -> int:
    """word(단어 또는 숙어)가 등장한 실제 기출 회차 수."""
    key = " ".join(_lemmas(word))
    if not key:
        return 0
    needle = f" {key} "
    return sum(needle in e for e in _corpus())
