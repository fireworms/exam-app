"""
웹 에이전트 서비스 진입점 — 8008 백엔드와 별도 프로세스 (systemd exam-agent, :8009).
폰에서 서버의 Claude Code와 대화한다. trading_system 웹 에이전트(trading-agent)와 같은 구조.

- **main.py를 import하지 않는다**: main이 load_dotenv로 `ANTHROPIC_API_KEY`를 os.environ에 올리면
  CLI 자식이 그 키를 물려받아 구독 로그인 대신 API 과금으로 붙는다. 셸 권한 에이전트에 서비스키를
  환경변수로 노출하지 않는 의미도 있다. .env에서는 공개값(SUPABASE_URL)과 에이전트 설정만 읽는다.
- 자체 SPA 서빙: prod(Vercel, https) 페이지에선 로컬 ws:// 연결이 mixed content로 막힌다.
  그래서 이 서비스가 frontend/dist를 직접 서빙하고 폰은 http://<tailscale-ip>:8009/agent 로 접속.
  로그인은 /agent 페이지가 supabase-js로 직접 한다 (/api는 여기 없음).
- 인증: Supabase JWT + 이메일이 AGENT_OWNER_EMAIL과 일치할 때만. 토큰은 URL이 아니라 첫 WS 메시지로
  (액세스 로그에 쿼리스트링이 남는다). AGENT_ENABLED=true가 아니면 거부 (공개 레포 클론 보호).

실행: cd backend && venv/bin/uvicorn agent_main:app --host <tailscale-ip> --port 8009
"""
import asyncio
import logging
import os

from dotenv import dotenv_values
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
_ENV = dotenv_values(os.path.join(_BACKEND_DIR, ".env"))
# auth.py가 import 시점에 SUPABASE_URL로 JWKS 클라이언트를 만든다 — 공개값만 환경변수로
os.environ.setdefault("SUPABASE_URL", _ENV.get("SUPABASE_URL") or "")

from auth import verify_token  # noqa: E402
from agent.session import get_hub, list_project_sessions  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("exam-agent")

AGENT_ENABLED = (_ENV.get("AGENT_ENABLED") or "").lower() == "true"
OWNER_EMAIL = (_ENV.get("AGENT_OWNER_EMAIL") or "").strip().lower()

app = FastAPI(title="exam-agent", docs_url=None, redoc_url=None, openapi_url=None)


def _authorized(token: str) -> bool:
    if not OWNER_EMAIL or not token:
        return False
    try:
        payload = verify_token(token)
    except Exception:
        return False
    return (payload.get("email") or "").lower() == OWNER_EMAIL


@app.websocket("/ws/agent")
async def agent_ws(ws: WebSocket):
    await ws.accept()
    if not AGENT_ENABLED:
        await ws.send_json({"type": "error", "message": "AGENT_ENABLED=false (backend/.env)"})
        await ws.close(code=4404)
        return
    try:
        first = await ws.receive_json()
    except Exception:
        await ws.close(code=4400)
        return
    if first.get("type") != "auth" or not _authorized(first.get("token", "")):
        await ws.send_json({"type": "error", "message": "인증 실패 (AGENT_OWNER_EMAIL 계정 전용)"})
        await ws.close(code=4401)
        return

    hub = get_hub()
    await hub.attach(ws)
    try:
        while True:
            msg = await ws.receive_json()
            t = msg.get("type")
            if t == "start":
                await hub.start(msg.get("session_id") or None)
            elif t == "message":
                text = str(msg.get("text", "")).strip()
                if text:
                    await hub.send(text)
            elif t == "permission":
                hub.resolve(str(msg.get("id")), bool(msg.get("allow")))
            elif t == "interrupt":
                await hub.interrupt()
            elif t == "close":
                await hub.close()
            elif t == "restart":
                # 셀프 재시작: 종료 코드 1로 나가면 systemd(Restart=on-failure)가 다시 띄운다 — sudo 불필요.
                # 모바일엔 터미널이 없어 agent 코드 수정 후 반영할 방법이 이것뿐
                if await hub.prepare_restart():
                    await ws.send_json({"type": "restarting"})
                    logger.info("self-restart requested from web")
                    asyncio.get_running_loop().call_later(0.5, os._exit, 1)
                else:
                    await ws.send_json({"type": "error", "message": "응답 진행 중 — 끝나거나 중단한 뒤 재시작하세요"})
            elif t == "sessions":
                # REST 대신 WS로 — 인증을 한 곳(첫 메시지)에만 둔다
                await ws.send_json({"type": "sessions", "items": list_project_sessions(limit=20)})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.warning("agent ws error: %s", e)
    finally:
        hub.detach(ws)


# ─── SPA 서빙 (/agent 페이지용) ──────────────────────────
# dist는 디스크에서 바로 읽으므로 npm run build 결과가 재시작 없이 반영된다
FRONTEND_DIST = os.path.join(_BACKEND_DIR, "..", "frontend", "dist")
_NO_CACHE = {"Cache-Control": "no-cache, no-store, must-revalidate"}

if os.path.isdir(os.path.join(FRONTEND_DIST, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        # 이 서비스엔 앱 API가 없다 — 에이전트 페이지 외에는 8008/prod를 쓸 것
        raise HTTPException(status_code=404, detail="exam-agent: /api 없음 (에이전트 전용 서비스)")
    file_path = os.path.realpath(os.path.join(FRONTEND_DIST, full_path))
    if file_path.startswith(os.path.realpath(FRONTEND_DIST) + os.sep) and os.path.isfile(file_path):
        return FileResponse(file_path)
    index = os.path.join(FRONTEND_DIST, "index.html")
    if not os.path.isfile(index):
        raise HTTPException(status_code=503, detail="frontend/dist 없음 — npm run build 먼저")
    return FileResponse(index, headers=_NO_CACHE)
