import os
from fastapi import HTTPException, Header
import jwt as pyjwt

JWT_SECRET = os.environ.get('SUPABASE_JWT_SECRET')

def get_current_user(authorization: str = Header(...)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증 토큰이 없어요")
    token = authorization[7:]
    try:
        payload = pyjwt.decode(
            token, JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰")
        return user_id
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="토큰이 만료됐어요")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰")
