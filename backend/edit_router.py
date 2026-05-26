import os
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List
from db import get_supabase
from auth import get_current_user

router = APIRouter(prefix="/questions", tags=["edit"])

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGE_DIR = os.path.join(BASE_DIR, "images")
os.makedirs(IMAGE_DIR, exist_ok=True)


def _resolve_path(path: str) -> str:
    """백슬래시 및 상대경로를 절대경로로 정규화."""
    path = path.replace("\\", "/")
    if not os.path.isabs(path):
        path = os.path.join(BASE_DIR, path)
    return path


class ChoiceUpdate(BaseModel):
    id: int
    text: str
    is_correct: bool


class QuestionUpdate(BaseModel):
    question_text: str
    explanation: str
    choices: List[ChoiceUpdate]


@router.post("/{question_id}/image")
async def upload_image(question_id: int, file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    q_res = sb.table("exam_questions").select("id, question_image").eq("id", question_id).execute()
    if not q_res.data:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없어요")

    old_path = q_res.data[0].get("question_image")
    if old_path:
        old_path = _resolve_path(old_path)
        if os.path.exists(old_path):
            os.remove(old_path)

    ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    filename = f"q_{question_id}{ext}"
    filepath = os.path.join(IMAGE_DIR, filename)
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    sb.table("exam_questions").update({"question_image": filepath}).eq("id", question_id).execute()
    return {"image_path": filepath, "url": f"/questions/{question_id}/image"}


@router.delete("/{question_id}/image")
def delete_image(question_id: int, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    q_res = sb.table("exam_questions").select("question_image").eq("id", question_id).execute()
    if q_res.data and q_res.data[0].get("question_image"):
        path = _resolve_path(q_res.data[0]["question_image"])
        if os.path.exists(path):
            os.remove(path)
        sb.table("exam_questions").update({"question_image": None}).eq("id", question_id).execute()
    return {"success": True}


@router.get("/{question_id}/image")
def get_image(question_id: int):
    sb = get_supabase()
    q_res = sb.table("exam_questions").select("question_image").eq("id", question_id).execute()
    if not q_res.data or not q_res.data[0].get("question_image"):
        raise HTTPException(status_code=404, detail="이미지 없음")
    path = _resolve_path(q_res.data[0]["question_image"])
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="이미지 파일 없음")
    return FileResponse(path)


@router.put("/{question_id}")
def update_question(question_id: int, req: QuestionUpdate, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    q_res = sb.table("exam_questions").select("id").eq("id", question_id).execute()
    if not q_res.data:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없어요")

    sb.table("exam_questions").update({
        "question_text": req.question_text,
        "explanation": req.explanation,
    }).eq("id", question_id).execute()

    for choice in req.choices:
        sb.table("exam_choices").update({
            "text": choice.text,
            "is_correct": 1 if choice.is_correct else 0,
        }).eq("id", choice.id).eq("question_id", question_id).execute()

    return {"success": True}
