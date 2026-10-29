import os
import json
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from google import genai
from dotenv import load_dotenv
from db import get_supabase, db_exec, db_fetch_all
from auth import get_current_user
from exam_freq import exam_freq

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
- root_form: 입력 단어가 파생어(과거분사·현재분사가 형용사로 쓰인 경우, -ly 부사, -tion/-ness 등 명사화)일 때 원형 동사/형용사. 원형과 동일하거나 숙어이면 null. 예) "diluted"→"dilute", "running"→"run", "carefully"→"careful", "pollution"→"pollute", "happiness"→"happy", "dilute"→null

응답 형식:
{{
  "word": "정규화된 단어 또는 숙어",
  "type": "word" or "phrase",
  "pos": "품사",
  "meaning": "한국어 해석",
  "example": "영어 예문",
  "example_translation": "예문 한국어 번역",
  "synonyms": ["동의어1", "동의어2"],
  "root_form": "원형 단어" or null
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
    root_form: Optional[str] = None
    root_data: Optional[dict] = None


class QuizResultRequest(BaseModel):
    correct: bool


def _analyze_text(text: str) -> dict:
    client = _get_gemini()
    prompt = ANALYZE_PROMPT.format(text=text)
    response = client.models.generate_content(model="gemini-3.1-flash-lite", contents=prompt)
    raw = response.text.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0]
    return json.loads(raw)


def _upsert_vocab(sb, user_id: str, data: dict):
    word = data["word"]
    existing = sb.table("exam_vocab").select("id").eq("user_id", user_id).eq("word", word).execute()
    row = {
        "type": data.get("type", "word"),
        "pos": data.get("pos"),
        "meaning": data.get("meaning", ""),
        "example": data.get("example"),
        "example_translation": data.get("example_translation"),
        "synonyms": data.get("synonyms") or [],
        "is_high_freq": data.get("is_high_freq", False),
        "source_text": data.get("source_text"),
    }
    if existing.data:
        sb.table("exam_vocab").update(row).eq("user_id", user_id).eq("word", word).execute()
        return existing.data[0]["id"], False
    res = sb.table("exam_vocab").insert({"user_id": user_id, "word": word, **row}).execute()
    return res.data[0]["id"], True


def _attach_freq(items):
    """exam_freq 필드 부착 — 기출 코퍼스 로드 실패해도 본 응답은 살린다."""
    try:
        for it in items:
            if it:
                it["exam_freq"] = exam_freq(it.get("word") or "")
    except Exception as e:
        print(f"[exam_freq] {e}")
    return items


@router.post("/analyze")
def analyze_vocab(req: AnalyzeRequest, user_id: str = Depends(get_current_user)):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="텍스트를 선택해주세요")
    if len(text) > 200:
        raise HTTPException(status_code=400, detail="선택 텍스트가 너무 길어요 (200자 이하)")

    try:
        data = _analyze_text(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="AI 분석 실패 — 다시 시도해주세요")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini 오류: {str(e)}")

    root_data = None
    root_form = data.get("root_form")
    if root_form and root_form.lower() != data["word"].lower():
        try:
            root_data = _analyze_text(root_form)
        except Exception:
            pass

    _attach_freq([data, root_data])
    return {**data, "source_text": text, "root_data": root_data}


@router.post("")
def save_vocab(req: SaveVocabRequest, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    vocab_id, created = _upsert_vocab(sb, user_id, req.model_dump())

    root_saved = None
    if req.root_data and req.root_data.get("word", "").lower() != req.word.lower():
        try:
            _upsert_vocab(sb, user_id, {**req.root_data, "source_text": None})
            root_saved = req.root_data["word"]
        except Exception:
            pass

    return {"created": created, "id": vocab_id, "root_saved": root_saved}


@router.get("")
def list_vocab(
    after: Optional[str] = None,
    user_id: str = Depends(get_current_user),
):
    sb = get_supabase()

    def build():
        q = sb.table("exam_vocab").select("*").eq("user_id", user_id)
        if after:
            q = q.gt("created_at", after)
        return q.order("created_at", desc=False)

    return _attach_freq(db_fetch_all(build))


@router.post("/{vocab_id}/quiz")
def record_quiz(vocab_id: int, req: QuizResultRequest, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    res = db_exec(sb.rpc("exam_vocab_quiz_record", {
        "p_id": vocab_id, "p_user": user_id, "p_correct": req.correct,
    }))
    if not res.data:
        raise HTTPException(status_code=404, detail="단어를 찾을 수 없어요")
    return res.data[0]


@router.delete("/{vocab_id}")
def delete_vocab(vocab_id: int, user_id: str = Depends(get_current_user)):
    sb = get_supabase()
    sb.table("exam_vocab").delete().eq("id", vocab_id).eq("user_id", user_id).execute()
    return {"success": True}
