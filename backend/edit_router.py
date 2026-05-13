import os
import sqlite3
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/questions", tags=["edit"])

DB_PATH = "exam_g.db"
IMAGE_DIR = "images"
os.makedirs(IMAGE_DIR, exist_ok=True)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ── 모델 ──────────────────────────────────────────────────────────────────

class ChoiceUpdate(BaseModel):
    id: int
    text: str
    is_correct: bool


class QuestionUpdate(BaseModel):
    question_text: str
    explanation: str
    choices: List[ChoiceUpdate]


# ── 이미지 ────────────────────────────────────────────────────────────────

@router.post("/{question_id}/image")
async def upload_image(question_id: int, file: UploadFile = File(...)):
    """문제 이미지 업로드"""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id FROM questions WHERE id = ?", (question_id,))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없어요")

    # 기존 이미지 삭제
    c.execute("SELECT question_image FROM questions WHERE id = ?", (question_id,))
    row = c.fetchone()
    if row and row["question_image"]:
        old_path = row["question_image"]
        if os.path.exists(old_path):
            os.remove(old_path)

    # 새 이미지 저장
    ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    filename = f"q_{question_id}{ext}"
    filepath = os.path.join(IMAGE_DIR, filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    # DB 업데이트
    c.execute("UPDATE questions SET question_image = ? WHERE id = ?", (filepath, question_id))
    conn.commit()
    conn.close()

    return {"image_path": filepath, "url": f"/questions/{question_id}/image"}


@router.delete("/{question_id}/image")
def delete_image(question_id: int):
    """문제 이미지 삭제"""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT question_image FROM questions WHERE id = ?", (question_id,))
    row = c.fetchone()
    if row and row["question_image"]:
        if os.path.exists(row["question_image"]):
            os.remove(row["question_image"])
        c.execute("UPDATE questions SET question_image = NULL WHERE id = ?", (question_id,))
        conn.commit()
    conn.close()
    return {"success": True}


@router.get("/{question_id}/image")
def get_image(question_id: int):
    """이미지 파일 서빙"""
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT question_image FROM questions WHERE id = ?", (question_id,))
    row = c.fetchone()
    conn.close()

    if not row or not row["question_image"]:
        raise HTTPException(status_code=404, detail="이미지 없음")
    if not os.path.exists(row["question_image"]):
        raise HTTPException(status_code=404, detail="이미지 파일 없음")

    return FileResponse(row["question_image"])


# ── 문제 편집 ──────────────────────────────────────────────────────────────

@router.put("/{question_id}")
def update_question(question_id: int, req: QuestionUpdate):
    """문제 텍스트 / 선지 / 해설 수정"""
    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT id FROM questions WHERE id = ?", (question_id,))
    if not c.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없어요")

    c.execute(
        "UPDATE questions SET question_text = ?, explanation = ? WHERE id = ?",
        (req.question_text, req.explanation, question_id)
    )

    for choice in req.choices:
        c.execute(
            "UPDATE choices SET text = ?, is_correct = ? WHERE id = ? AND question_id = ?",
            (choice.text, 1 if choice.is_correct else 0, choice.id, question_id)
        )

    conn.commit()
    conn.close()
    return {"success": True}
