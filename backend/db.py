import os
import time
import httpx
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

_sb: Client = None

# 유휴 keep-alive 커넥션을 짧게 만료시킨다.
# 긴 파싱 작업 뒤 싱글톤이 들고 있던 커넥션을 Supabase가 먼저 끊어놓은 상태에서
# 재사용하면 httpx.RemoteProtocolError("Server disconnected")가 난다.
_KEEPALIVE_EXPIRY = 5.0


def _make_httpx_client() -> httpx.Client:
    return httpx.Client(
        limits=httpx.Limits(
            max_connections=100,
            max_keepalive_connections=10,
            keepalive_expiry=_KEEPALIVE_EXPIRY,
        ),
        timeout=httpx.Timeout(30.0),
        follow_redirects=True,
    )


def get_supabase() -> Client:
    global _sb
    if _sb is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")
        _sb = create_client(url, key, options=ClientOptions(httpx_client=_make_httpx_client()))
    return _sb


def db_exec(query, attempts: int = 4):
    """postgrest 쿼리 실행 — 전송 계층 오류 시 재시도.

    postgrest 내장 재시도(`send_with_retry`)는 GET/HEAD가 503/520 '응답'을 받은
    경우만 다룬다. 커넥션이 끊겨 응답 자체가 없는 httpx.TransportError는
    재시도되지 않으므로 여기서 처리한다.

    사용: db_exec(sb.table("x").insert(...))  ← .execute() 붙이지 말 것
    """
    for i in range(attempts):
        try:
            return query.execute()
        except httpx.TransportError:
            if i == attempts - 1:
                raise
            time.sleep(2 ** i)
