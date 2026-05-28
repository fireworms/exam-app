import os
from fastapi import HTTPException, Header
import jwt as pyjwt
from jwt import PyJWKClient

SUPABASE_URL = os.environ.get('SUPABASE_URL')
_jwks_client = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", cache_keys=True)

def get_current_user(authorization: str = Header(...)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증 토큰이 없어요")
    token = authorization[7:]
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = pyjwt.decode(
            token, signing_key.key,
            algorithms=["ES256", "HS256"],
            audience="authenticated"
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰")
        return user_id
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="토큰이 만료됐어요")
    except pyjwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰")
    except Exception as e:
        raise HTTPException(status_code=503, detail="인증 서버 연결 실패")
