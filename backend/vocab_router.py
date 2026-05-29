import os
import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from google import genai
from dotenv import load_dotenv
from db import get_supabase
from auth import get_current_user

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

router = APIRouter(prefix="/vocab", tags=["vocab"])

_gemini_client = None

def _get_gemini():
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _gemini_client


ANALYZE_PROMPT = """당신은 9급 공무원 영어 시험 전문 어휘 분석가입니다.

다음 텍스트를 분석하여 JSON으로만 응답하세요 (다른 설명 없이).

텍스트: "{text}"

분석 기준:
- 단어 하나면 type: "word", 2개 이상 묶인 숙어/구면 type: "phrase"
- pos(품사): n.(명사) / v.(동사) / adj.(형용사) / adv.(부사) / prep.(전치사) / conj.(접속사) / phrase(구) 중 하나
- meaning: 9급 공무원 영어 시험 기준 핵심 해석. 자동사는 "~하다", 타동사는 "~을/를 하다" 형식으로 구분. 둘 다 되면 가장 시험에 자주 나오는 해석 우선.
- example: 9급 수준의 짧은 예문 (영어)
- example_translation: 예문 한국어 번역
- synonyms: 9급 시험에서 동의어로 출제 가능한 단어/구 2~3개 (영어). 없으면 빈 배열.
- is_high_freq: 9급 공무원 영어 시험에서 고빈도로 출제되는 어휘이면 true

응답 형식:
{{
  "word": "정규화된 단어 또는 숙어",
  "type": "word" or "phrase",
  "pos": "품사",
  "meaning": "한국어 해석",
  "example": "영어 예문",
  "example_translation": "예문 한국어 번역",
  "synonyms": ["동의어1", "동의어2"],
  "is_high_freq": true or false
}}"""


class AnalyzeRequest(BaseModel):
    text: str


class SaveVocabRequest(BaseModel):
    word: str
    type: str
    pos: Optional[str] = None
    meaning: str
    example: Optional[str] = None
    example_translation: Optional[str] = None
    synonyms: Optional[list] = None
    is_high_freq: bool = False
    source_text: Optional[str] = None


@router.post("/analyze")
def analyze_vocab(req: AnalyzeRequest, user_id: str = Depends(get_current_user)):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="텍스트를 선택해주세요")
    if len(text) > 200:
        raise HTTPException(status_code=400, detail="선택 텍스트가 너무 길어요 (200자 이하)")

    client = _get_gemini()
    prompt = ANALYZE_PROMPT.format(text=text)

    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt,
        )
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            raw = raw.rsplit("```", 1)[0]
        data = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI 분석 실패 — 다시 시도해주세요")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini 오류: {str(e)}")

    return {**data, "source_text": text}


@router.post("")
def save_vocab(req: SaveVocabRequest, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("exam_vocab").select("id").eq("user_id", user_id).eq("word", req.word).execute()
    if existing.data:
        # 이미 있으면 업데이트
        sb.table("exam_vocab").update({
            "type": req.type,
            "pos": req.pos,
            "meaning": req.meaning,
            "example": req.example,
            "example_translation": req.example_translation,
            "synonyms": req.synonyms or [],
            "is_high_freq": req.is_high_freq,
            "source_text": req.source_text,
        }).eq("user_id", user_id).eq("word", req.word).execute()
        return {"updated": True, "id": existing.data[0]["id"]}

    res = sb.table("exam_vocab").insert({
        "user_id": user_id,
        "word": req.word,
        "type": req.type,
        "pos": req.pos,
        "meaning": req.meaning,
        "example": req.example,
        "example_translation": req.example_translation,
        "synonyms": req.synonyms or [],
        "is_high_freq": req.is_high_freq,
        "source_text": req.source_text,
    }).execute()

    return {"created": True, "id": res.data[0]["id"]}


@router.get("")
def list_vocab(
    pos: Optional[str] = None,
    high_freq: Optional[bool] = None,
    sort: str = "created_desc",
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()
    q = sb.table("exam_vocab").select("*").eq("user_id", user_id)

    if pos:
        q = q.eq("pos", pos)
    if high_freq is not None:
        q = q.eq("is_high_freq", high_freq)

    if sort == "alpha":
        q = q.order("word", desc=False)
    else:
        q = q.order("created_at", desc=True)

    res = q.execute()
    return res.data


@router.delete("/{vocab_id}")
def delete_vocab(vocab_id: int, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    sb.table("exam_vocab").delete().eq("id", vocab_id).eq("user_id", user_id).execute()
    return {"success": True}
