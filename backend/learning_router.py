import json
import sqlite3
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/learn", tags=["learn"])

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "exam_g.db"
DATA_DIR = BASE_DIR / "data"

# ── JSON 로딩 (앱 시작 시 메모리에 캐시) ──────────────────────────────────

_notes_cache: dict = {}


def _load_notes():
    for file in DATA_DIR.glob("*.json"):
        try:
            data = json.loads(file.read_text(encoding="utf-8"))
            subject = (data.get("meta") or data.get("exam_info") or {}).get("subject", file.stem)
            _notes_cache[subject] = data
        except Exception as e:
            print(f"[learn] JSON 로드 실패: {file} — {e}")


_load_notes()

def _area_order(notes: dict) -> list[str]:
    """area_details의 JSON 키 순서를 그대로 사용"""
    return list(notes.get("area_details", {}).keys())


def _name_to_key(notes: dict) -> dict:
    """area_details.name → key 역매핑 (과목 무관)"""
    return {v.get("name", ""): k for k, v in notes.get("area_details", {}).items()}


def _get_notes(subject: str = "국어") -> dict:
    if subject not in _notes_cache:
        raise HTTPException(status_code=404, detail=f"과목 없음: {subject}")
    return _notes_cache[subject]


# ── DB 마이그레이션 ───────────────────────────────────────────────────────

def _migrate():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS area_views (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT NOT NULL DEFAULT '국어',
            area_key TEXT NOT NULL,
            viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(subject, area_key)
        );
        CREATE TABLE IF NOT EXISTS checklist_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT NOT NULL DEFAULT '국어',
            item_id TEXT NOT NULL,
            checked INTEGER DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(subject, item_id)
        );
        CREATE TABLE IF NOT EXISTS learn_bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT NOT NULL DEFAULT '국어',
            type TEXT NOT NULL,
            key TEXT NOT NULL,
            label TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(subject, type, key)
        );
    """)
    conn.commit()
    conn.close()


_migrate()


def _db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ── 데이터 조회 API ───────────────────────────────────────────────────────

@router.get("/meta")
def get_meta(subject: str = "국어"):
    notes = _get_notes(subject)
    return notes.get("meta", {})


@router.get("/top-areas")
def get_top_areas(subject: str = "국어"):
    notes = _get_notes(subject)
    areas = notes.get("top_10_areas", [])
    n2k = _name_to_key(notes)
    result = []
    for area in areas:
        key = n2k.get(area.get("name", ""))
        result.append({**area, "area_key": key})
    return result


@router.get("/areas")
def list_areas(subject: str = "국어"):
    notes = _get_notes(subject)
    details = notes.get("area_details", {})
    conn = _db()
    c = conn.cursor()
    c.execute("SELECT area_key FROM area_views WHERE subject=?", (subject,))
    viewed = {r["area_key"] for r in c.fetchall()}
    conn.close()

    return [
        {
            "key": key,
            "name": area.get("name", key),
            "position": area.get("出題_position", ""),
            "viewed": key in viewed,
        }
        for key, area in details.items()
    ]


@router.get("/areas/{area_key}")
def get_area(area_key: str, subject: str = "국어"):
    notes = _get_notes(subject)
    details = notes.get("area_details", {})
    if area_key not in details:
        raise HTTPException(status_code=404, detail=f"영역 없음: {area_key}")

    ordered = _area_order(notes)
    idx = ordered.index(area_key) if area_key in ordered else -1
    prev_key = ordered[idx - 1] if idx > 0 else None
    next_key = ordered[idx + 1] if 0 <= idx < len(ordered) - 1 else None

    conn = _db()
    conn.execute(
        "INSERT OR IGNORE INTO area_views (subject, area_key) VALUES (?,?)",
        (subject, area_key)
    )
    conn.commit()
    c = conn.cursor()
    c.execute("SELECT id FROM learn_bookmarks WHERE subject=? AND type='area' AND key=?", (subject, area_key))
    bookmarked = c.fetchone() is not None
    conn.close()

    return {
        **details[area_key],
        "area_key": area_key,
        "bookmarked": bookmarked,
        "prev_key": prev_key,
        "next_key": next_key,
        "prev_name": details[prev_key]["name"] if prev_key and prev_key in details else None,
        "next_name": details[next_key]["name"] if next_key and next_key in details else None,
    }


@router.get("/traps")
def get_traps(subject: str = "국어"):
    notes = _get_notes(subject)
    return notes.get("top_15_traps", [])


@router.get("/grammar")
def get_grammar(subject: str = "국어"):
    notes = _get_notes(subject)
    return notes.get("grammar_basics") or notes.get("korean_grammar_basics", {})


@router.get("/paradigm-shift")
def get_paradigm_shift(subject: str = "국어"):
    notes = _get_notes(subject)
    return notes.get("paradigm_shift", {})


@router.get("/exam-mapping")
def get_exam_mapping(subject: str = "국어"):
    notes = _get_notes(subject)
    return notes.get("exam_round_mapping", {})


@router.get("/priority")
def get_priority(subject: str = "국어"):
    notes = _get_notes(subject)
    return notes.get("study_priority_guide", {})


@router.get("/checklist")
def get_checklist(subject: str = "국어"):
    notes = _get_notes(subject)
    checklist = notes.get("final_checklist", {})

    conn = _db()
    c = conn.cursor()
    c.execute("SELECT item_id, checked FROM checklist_progress WHERE subject=?", (subject,))
    progress = {r["item_id"]: bool(r["checked"]) for r in c.fetchall()}
    conn.close()

    return {"checklist": checklist, "progress": progress}


@router.get("/search")
def search(q: str, subject: str = "국어"):
    if not q or len(q) < 2:
        return []
    notes = _get_notes(subject)
    results = []
    keyword = q.lower()

    def _search(obj, path: list, category: str):
        if isinstance(obj, dict):
            for k, v in obj.items():
                _search(v, path + [k], category)
        elif isinstance(obj, list):
            for item in obj:
                _search(item, path, category)
        elif isinstance(obj, str) and keyword in obj.lower():
            results.append({
                "category": category,
                "path": " > ".join(path),
                "snippet": obj[:150],
            })

    _search(notes.get("area_details", {}), [], "영역 상세")
    _search(notes.get("top_15_traps", []), [], "함정 모음")
    _search(notes.get("korean_grammar_basics", {}), [], "문법 기초")
    _search(notes.get("final_checklist", {}), [], "체크리스트")

    return results[:50]


@router.get("/motto")
def get_motto(subject: str = "국어"):
    notes = _get_notes(subject)
    return {"motto": notes.get("final_motto", "")}


@router.get("/subjects")
def get_subjects():
    result = []
    for k, v in _notes_cache.items():
        meta = v.get("meta") or v.get("exam_info") or {}
        subject_type = "english" if "vocabulary_essentials" in v else "korean"
        result.append({
            "subject": k,
            "title": meta.get("title") or meta.get("target_exam") or k,
            "type": subject_type,
        })
    return result


# ── 영어 전용 엔드포인트 ─────────────────────────────────────────────────

@router.get("/vocabulary")
def get_vocabulary(subject: str = "영어"):
    notes = _get_notes(subject)
    return notes.get("vocabulary_essentials", {})


@router.get("/grammar-patterns")
def get_grammar_patterns(subject: str = "영어"):
    notes = _get_notes(subject)
    return notes.get("grammar_patterns", [])


@router.get("/idioms")
def get_idioms(subject: str = "영어"):
    notes = _get_notes(subject)
    return notes.get("idioms_and_phrases", {})


@router.get("/business-english")
def get_business_english(subject: str = "영어"):
    notes = _get_notes(subject)
    return notes.get("business_english", {})


@router.get("/time-strategy")
def get_time_strategy(subject: str = "영어"):
    notes = _get_notes(subject)
    return notes.get("time_allocation_strategy", {})


@router.get("/mindset")
def get_mindset(subject: str = "영어"):
    notes = _get_notes(subject)
    return notes.get("winning_mindset", [])


@router.get("/paradigm")
def get_paradigm(subject: str = "영어"):
    notes = _get_notes(subject)
    return notes.get("paradigm_shift_2025") or notes.get("paradigm_shift", {})


# ── 사용자 상태 API ───────────────────────────────────────────────────────

@router.get("/progress")
def get_progress(subject: str = "국어"):
    conn = _db()
    c = conn.cursor()
    c.execute("SELECT area_key FROM area_views WHERE subject=?", (subject,))
    viewed = [r["area_key"] for r in c.fetchall()]
    c.execute("SELECT COUNT(*) as total, SUM(checked) as done FROM checklist_progress WHERE subject=?", (subject,))
    row = c.fetchone()
    conn.close()
    return {
        "viewed_areas": viewed,
        "checklist_total": row["total"] or 0,
        "checklist_done": int(row["done"] or 0),
    }


class ChecklistToggle(BaseModel):
    item_id: str
    checked: bool
    subject: str = "국어"


@router.post("/progress/checklist")
def toggle_checklist(req: ChecklistToggle):
    conn = _db()
    conn.execute(
        "INSERT OR REPLACE INTO checklist_progress (subject, item_id, checked, updated_at) VALUES (?,?,?,datetime('now'))",
        (req.subject, req.item_id, 1 if req.checked else 0)
    )
    conn.commit()
    conn.close()
    return {"success": True}


@router.post("/progress/checklist/reset")
def reset_checklist(subject: str = "국어"):
    conn = _db()
    conn.execute("DELETE FROM checklist_progress WHERE subject=?", (subject,))
    conn.commit()
    conn.close()
    return {"success": True}


class BookmarkRequest(BaseModel):
    type: str
    key: str
    label: str = ""
    subject: str = "국어"


@router.get("/bookmarks")
def get_bookmarks(subject: str = "국어"):
    conn = _db()
    c = conn.cursor()
    c.execute("SELECT * FROM learn_bookmarks WHERE subject=? ORDER BY created_at DESC", (subject,))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows


@router.post("/bookmarks")
def add_bookmark(req: BookmarkRequest):
    conn = _db()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO learn_bookmarks (subject, type, key, label) VALUES (?,?,?,?)",
            (req.subject, req.type, req.key, req.label)
        )
        conn.commit()
    finally:
        conn.close()
    return {"success": True}


@router.delete("/bookmarks/{bookmark_id}")
def remove_bookmark(bookmark_id: int):
    conn = _db()
    conn.execute("DELETE FROM learn_bookmarks WHERE id=?", (bookmark_id,))
    conn.commit()
    conn.close()
    return {"success": True}


@router.delete("/bookmarks/by-key/{type}/{key}")
def remove_bookmark_by_key(type: str, key: str, subject: str = "국어"):
    conn = _db()
    conn.execute("DELETE FROM learn_bookmarks WHERE subject=? AND type=? AND key=?", (subject, type, key))
    conn.commit()
    conn.close()
    return {"success": True}
