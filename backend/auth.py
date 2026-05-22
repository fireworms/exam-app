from fastapi import HTTPException, Header
from db import get_supabase

def get_current_user(authorization: str = Header(...)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증 토큰이 없어요")
    token = authorization[7:]
    try:
        sb = get_supabase()
        response = sb.auth.get_user(token)
        if not response.user:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰")
        return str(response.user.id)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰")
