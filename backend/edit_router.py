import os
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import List
from db import get_supabase
from auth import get_current_user

router = APIRouter(prefix="/questions", tags=["edit"])

BUCKET = "question-images"


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
    q_res = sb.table("exam_questions").select("id").eq("id", question_id).execute()
    if not q_res.data:
        raise HTTPException(status_code=404, detail="문제를 찾을 수 없어요")

    ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    filename = f"q_{question_id}{ext}"
    content = await file.read()

    sb.storage.from_(BUCKET).upload(
        path=filename,
        file=content,
        file_options={"content-type": "image/jpeg", "upsert": "true"},
    )
    public_url = sb.storage.from_(BUCKET).get_public_url(filename)
    sb.table("exam_questions").update({"question_image": public_url}).eq("id", question_id).execute()
    return {"url": public_url}


@router.delete("/{question_id}/image")
def delete_image(question_id: int, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    q_res = sb.table("exam_questions").select("question_image").eq("id", question_id).execute()
    if q_res.data and q_res.data[0].get("question_image"):
        filename = f"q_{question_id}.jpg"
        try:
            sb.storage.from_(BUCKET).remove([filename])
        except Exception:
            pass
        sb.table("exam_questions").update({"question_image": None}).eq("id", question_id).execute()
    return {"success": True}


@router.get("/{question_id}/image")
def get_image(question_id: int):
    sb = get_supabase()
    q_res = sb.table("exam_questions").select("question_image").eq("id", question_id).execute()
    if not q_res.data or not q_res.data[0].get("question_image"):
        raise HTTPException(status_code=404, detail="이미지 없음")
    return RedirectResponse(url=q_res.data[0]["question_image"])


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
