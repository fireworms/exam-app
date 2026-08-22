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


def db_fetch_all(build, page: int = 1000, attempts: int = 4) -> list:
    """1000행 제한을 넘겨 전수 조회.

    PostgREST는 서버 설정(db-max-rows=1000)으로 .range() 없는 단발 조회를
    1000행에서 조용히 자른다. 에러도 경고도 '더 있음' 표시도 없어, 테이블이
    커지는 순간부터 소리 없이 틀린 값이 나온다.

    build는 매 페이지마다 '새' 쿼리를 만들어 돌려주는 함수여야 한다. 같은
    빌더에 range()를 반복 호출하면 offset/limit 파라미터가 누적된다
    (offset=0&offset=1000&limit=1000&limit=1000).

    사용: db_fetch_all(lambda: sb.table("x").select("y").eq("a", b))
    """
    rows: list = []
    start = 0
    while True:
        batch = db_exec(build().range(start, start + page - 1), attempts).data
        rows.extend(batch)
        if len(batch) < page:
            return rows
        start += page
