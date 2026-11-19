"""
웹 UI ↔ Claude Code 세션 허브 (claude-agent-sdk). trading_system 웹 에이전트에서 이식.

설계 요점:
- **허브는 WebSocket보다 오래 산다** — 폰 화면이 꺼지면 WS가 끊기지만 진행 중인 턴과
  승인 대기는 그대로 둔다. 다시 붙으면 이벤트 로그 + 대기 중 승인 요청을 재전송.
- **세션은 한 번에 하나** — 같은 세션을 터미널과 웹에서 동시에 이어 쓰면 기록이 꼬인다.
  허브는 단일 클라이언트만 유지하고, 다른 세션을 시작하면 기존 것을 닫는다.
- **권한은 두 겹**: guard.check_tool(PreToolUse 훅, 항상 거부) → can_use_tool(웹 승인 버튼).
- 승인 요청은 10분 무응답이면 거부 (폰을 두고 간 사이 영원히 매달리지 않게).
- 30분 유휴면 CLI 프로세스를 내린다. 세션 기록은 디스크(~/.claude/projects)에 남아 resume 가능.

8008 백엔드와 **별도 프로세스(exam-agent, :8009)** 로 돈다 — 에이전트가 8008을 kill/재기동해도
자기 자신은 안 죽게. 진입점은 backend/agent_main.py.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import shutil
import sys
import time
import uuid
from pathlib import Path
from typing import Any

from agent.guard import check_tool

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[2]   # backend/agent/session.py → exam-app
# CLI 세션 기록 위치: <config>/projects/<cwd의 영숫자 외 문자를 '-'로>
SESSIONS_DIR = (Path(os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude")
                / "projects" / re.sub(r"[^a-zA-Z0-9]", "-", str(PROJECT_ROOT)))

_PERMISSION_TIMEOUT_S = 600
_IDLE_DISCONNECT_S = 30 * 60
_LOG_CAP = 400
# 자동 셀프 재시작 전후로 이어 쓸 세션 ID — 재시작 후 같은 대화로 resume
_LAST_SESSION_FILE = Path.home() / ".cache" / "exam-agent" / "last_session"

# 이 서비스 자신이 import하는 코드 — 턴 중에 바뀌면 턴 종료 후 자동 재시작해 반영한다.
# (Edit 도구뿐 아니라 sed·git pull 등 어떤 경로로 바뀌어도 잡히도록 mtime 비교)
_BACKEND = PROJECT_ROOT / "backend"


def _watched_files() -> list[Path]:
    files = [_BACKEND / "agent_main.py", _BACKEND / "auth.py", _BACKEND / "requirements.txt"]
    files += sorted((_BACKEND / "agent").glob("*.py"))
    return files


def _snapshot() -> dict[str, float]:
    out = {}
    for f in _watched_files():
        try:
            out[str(f)] = f.stat().st_mtime
        except OSError:
            pass
    return out


_BOOT_SNAPSHOT = _snapshot()
_DEFER_POLL_S = 30


def _service_procs() -> list[tuple[int, int, str]] | None:
    """이 서비스 cgroup의 프로세스 (pid, ppid, cmdline). systemd 서비스로 돌 때만 — 수동 실행이면
    cgroup이 사용자 세션 전체라 무관한 프로세스가 섞이므로 None (검사 생략)."""
    try:
        path = Path("/proc/self/cgroup").read_text().strip().split("::", 1)[1]
    except (OSError, IndexError):
        return None
    if not path.endswith("/exam-agent.service"):
        return None
    try:
        pids = Path(f"/sys/fs/cgroup{path}/cgroup.procs").read_text().split()
    except OSError:
        return None
    out = []
    for p in pids:
        try:
            stat = Path(f"/proc/{p}/stat").read_text()
            ppid = int(stat.rsplit(")", 1)[1].split()[1])
            cmd = Path(f"/proc/{p}/cmdline").read_bytes().replace(b"\0", b" ").decode(errors="ignore").strip()
            out.append((int(p), ppid, cmd))
        except (OSError, ValueError, IndexError):
            pass
    return out


def _background_jobs() -> tuple[list[str], bool]:
    """재시작하면 같이 죽을 프로세스 → (막는 작업 목록, 8008 개발 서버 실행 여부).

    유휴 CLI는 자식이 없다(실측) — 그래서 자기 자신과 CLI를 뺀 나머지는 에이전트가 남긴 작업이다.
    8008 uvicorn은 상주 서버라 막지 않고 재시작 후 다시 띄운다 (안 그러면 영원히 미뤄진다).
    """
    procs = _service_procs()
    if procs is None:
        return [], False
    me = os.getpid()
    parent = {pid: ppid for pid, ppid, _ in procs}
    ancestors, cur = set(), me
    while cur in parent:            # 자기 자신 + 같은 cgroup 안의 조상 (래퍼 프로세스)
        ancestors.add(cur)
        cur = parent[cur]
    blocking, dev_server = [], False
    for pid, ppid, cmd in procs:
        if pid in ancestors or (ppid == me and "claude" in cmd):
            continue
        if "uvicorn" in cmd and "8008" in cmd:
            dev_server = True
            continue
        if "bash -c source" in cmd and "shell-snapshots" in cmd:
            continue   # 백그라운드 명령을 감싼 셸 — 실제 작업(자식)으로 판단
        blocking.append(cmd[:80])
    return blocking, dev_server
_PREVIEW_CHARS = 1500

_APPEND_PROMPT = (
    "이 세션은 모바일 웹 UI(exam-agent, :8009)를 통해 진행된다. 대화형 터미널이 없다.\n"
    "- AskUserQuestion 도구는 쓸 수 없다. 선택이 필요하면 본문에 번호 목록으로 묻는다.\n"
    "- 화면이 좁다. 답변은 짧게, 표는 3열 이하로.\n"
    "- exam-agent(이 서비스) 코드(backend/agent_main.py·agent/*.py·auth.py·requirements.txt)를 고치면 이 턴이 끝난 뒤 import 검사를 거쳐 자동 재시작되고 같은 세션으로 이어진다. 직접 재시작하지 말 것 (systemctl·8009 kill·`pkill uvicorn`은 차단). 재시작 시 이 세션에서 띄운 8008도 함께 꺼진다.\n"
    "- 8008 로컬 백엔드 재기동(`scripts/dev-server-stop.sh` → `scripts/dev-server-start.sh`)은 이 세션에 영향이 없다.\n"
    "- SessionStart/End 훅(settings.local.json)은 이 세션에선 돌지 않는다 — 8008이 필요하면 직접 띄운다.\n"
    "- prod 반영은 커밋 후 `git push origin master` (Vercel 자동배포). 수동 vercel --prod는 차단돼 있다."
)


def _cli_path() -> str | None:
    """터미널과 같은 CLI(같은 버전·로그인)를 쓴다. 없으면 SDK 번들 CLI."""
    found = shutil.which("claude") or str(Path.home() / ".local/bin/claude")
    return found if Path(found).exists() else None


def _summarize_input(name: str, inp: dict[str, Any]) -> str:
    if name == "Bash":
        return str(inp.get("command", ""))
    for key in ("file_path", "path", "notebook_path", "pattern", "url", "query", "description"):
        if inp.get(key):
            return f"{key}: {inp[key]}"
    s = json.dumps(inp, ensure_ascii=False)
    return s[:300]


def _preview(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        text = content
    elif isinstance(content, list):
        parts = []
        for c in content:
            if isinstance(c, dict) and c.get("type") == "text":
                parts.append(c.get("text", ""))
            elif isinstance(c, dict):
                parts.append(f"[{c.get('type', 'block')}]")
        text = "\n".join(parts)
    else:
        text = str(content)
    return text if len(text) <= _PREVIEW_CHARS else text[:_PREVIEW_CHARS] + f"\n… ({len(text)}자 중 일부)"


def blocks_to_events(role: str, content: Any) -> list[dict[str, Any]]:
    """API 메시지 content → UI 이벤트. 라이브 스트림과 과거 기록 렌더링이 공유."""
    events: list[dict[str, Any]] = []
    if isinstance(content, str):
        if content.strip():
            events.append({"type": "user" if role == "user" else "text", "text": content})
        return events
    for b in content or []:
        if not isinstance(b, dict):
            continue
        t = b.get("type")
        if t == "text" and b.get("text", "").strip():
            events.append({"type": "user" if role == "user" else "text", "text": b["text"]})
        elif t == "tool_use":
            events.append({
                "type": "tool_use", "id": b.get("id"), "name": b.get("name"),
                "summary": _summarize_input(b.get("name", ""), b.get("input") or {}),
            })
        elif t == "tool_result":
            events.append({
                "type": "tool_result", "id": b.get("tool_use_id"),
                "is_error": bool(b.get("is_error")), "preview": _preview(b.get("content")),
            })
    return events


class AgentHub:
    def __init__(self) -> None:
        self._client = None
        self.session_id: str | None = None
        self.state = "disconnected"          # disconnected / idle / running
        self._sockets: set[Any] = set()
        self._log: list[dict[str, Any]] = []
        self._pending: dict[str, dict[str, Any]] = {}   # id → {future, event}
        self._turn_task: asyncio.Task | None = None
        self._reader_task: asyncio.Task | None = None
        self._lock = asyncio.Lock()
        self._last_activity = time.monotonic()
        self._reaper: asyncio.Task | None = None
        self._defer_task: asyncio.Task | None = None

    # ------------------------------------------------------------ 소켓
    async def attach(self, ws) -> None:
        self._sockets.add(ws)
        self._ensure_reaper()
        await self._send(ws, self._status())
        for ev in self._log:
            await self._send(ws, ev)
        for p in self._pending.values():
            await self._send(ws, p["event"])

    def detach(self, ws) -> None:
        self._sockets.discard(ws)

    async def _send(self, ws, ev: dict[str, Any]) -> None:
        try:
            await ws.send_json(ev)
        except Exception:
            self._sockets.discard(ws)

    async def _emit(self, ev: dict[str, Any], *, log: bool = True) -> None:
        if log:
            self._log.append(ev)
            if len(self._log) > _LOG_CAP:
                self._log = self._log[-_LOG_CAP:]
        for ws in list(self._sockets):
            await self._send(ws, ev)

    def _status(self) -> dict[str, Any]:
        return {
            "type": "status", "state": self.state, "session_id": self.session_id,
            "pending": len(self._pending),
        }

    async def _set_state(self, state: str) -> None:
        self.state = state
        await self._emit(self._status(), log=False)

    # ------------------------------------------------------------ 세션 수명
    async def start(self, resume: str | None) -> None:
        """resume=None이면 새 세션. 같은 세션이 이미 붙어 있으면 그대로 둔다."""
        async with self._lock:
            if self._client is not None and resume and resume == self.session_id:
                return
            await self._close_locked()
            from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient, HookMatcher

            options = ClaudeAgentOptions(
                cwd=str(PROJECT_ROOT),
                resume=resume,
                permission_mode="default",
                can_use_tool=self._can_use_tool,
                hooks={"PreToolUse": [HookMatcher(matcher=None, hooks=[self._guard_hook])]},
                disallowed_tools=["AskUserQuestion"],
                # settings.local.json(터미널에서 "항상 허용"으로 쌓인 규칙)은 웹에서 안 읽는다.
                # `python *`·`.venv/bin/python *` 같은 넓은 규칙이 웹에선 승인 없는 임의 코드
                # 실행이 되고, guard는 Bash 문자열만 보므로 스크립트 안의 .env 읽기를 못 막는다.
                # user/project 설정·CLAUDE.md·메모리는 그대로 (읽기 전용 명령은 CLI가 원래 안 묻는다)
                setting_sources=["user", "project"],
                system_prompt={"type": "preset", "preset": "claude_code", "append": _APPEND_PROMPT},
                cli_path=_cli_path(),
                stderr=lambda line: logger.debug("claude cli: %s", line),
            )
            client = ClaudeSDKClient(options=options)
            await client.connect()
            self._client = client
            self.session_id = resume
            self._log = []
            if resume:
                self._log = load_history_events(resume)
            self._touch()
            await self._set_state("idle")
            for ws in list(self._sockets):     # 히스토리 재동기화
                await self._send(ws, {"type": "reset"})
                for ev in self._log:
                    await self._send(ws, ev)

    async def prepare_restart(self, relaunch_dev_server: bool = False) -> bool:
        """셀프 재시작 직전 정리 — CLI를 내리고 이어 쓸 상태를 디스크에 남긴다. 응답 중이면 거부."""
        if self.state == "running":
            return False
        sid = self.session_id
        await self.close()
        try:
            _LAST_SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
            _LAST_SESSION_FILE.write_text(json.dumps({"session_id": sid, "relaunch_8008": relaunch_dev_server}))
        except OSError as e:
            logger.warning("last session save failed: %s", e)
        return True

    def restore_last_session(self) -> None:
        """재시작 후 첫 허브 생성 시 — 직전 세션을 대기 상태로 복원 (다음 메시지에서 resume),
        재시작 때 같이 죽은 8008 개발 서버는 다시 띄운다."""
        try:
            data = json.loads(_LAST_SESSION_FILE.read_text())
            _LAST_SESSION_FILE.unlink()
        except (OSError, ValueError):
            return
        sid = data.get("session_id")
        if sid:
            self.session_id = sid
            self._log = load_history_events(sid)
        if data.get("relaunch_8008"):
            try:
                import subprocess
                subprocess.Popen([str(PROJECT_ROOT / "scripts" / "dev-server-start.sh")],
                                 stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                self._log.append({"type": "notice", "text": "재시작 전에 떠 있던 8008 백엔드를 다시 띄웠습니다"})
            except OSError as e:
                logger.warning("8008 relaunch failed: %s", e)

    async def close(self) -> None:
        async with self._lock:
            await self._close_locked()
        await self._set_state("disconnected")

    async def _close_locked(self) -> None:
        for p in self._pending.values():
            if not p["future"].done():
                p["future"].set_result(False)
        self._pending.clear()
        if self._turn_task and not self._turn_task.done():
            self._turn_task.cancel()
        if self._client is not None:
            try:
                await self._client.disconnect()
            except Exception as e:
                logger.warning("agent disconnect failed: %s", e)
        self._client = None
        self.state = "disconnected"

    # ------------------------------------------------------------ 대화
    async def send(self, text: str) -> None:
        if self._client is None:
            await self.start(self.session_id)
        if self.state == "running":
            await self._emit({"type": "error", "message": "응답 진행 중 — 끝나거나 중단한 뒤 보내세요"}, log=False)
            return
        self._touch()
        await self._emit({"type": "user", "text": text})
        await self._set_state("running")
        self._turn_task = asyncio.create_task(self._run_turn(text))

    async def interrupt(self) -> None:
        if self._client is not None and self.state == "running":
            for p in self._pending.values():
                if not p["future"].done():
                    p["future"].set_result(False)
            try:
                await self._client.interrupt()
            except Exception as e:
                logger.warning("interrupt failed: %s", e)

    async def _run_turn(self, text: str) -> None:
        from claude_agent_sdk import AssistantMessage, ResultMessage, SystemMessage, UserMessage
        try:
            await self._client.query(text)
            async for msg in self._client.receive_response():
                self._touch()
                if isinstance(msg, SystemMessage):
                    if msg.subtype == "init" and msg.data.get("session_id"):
                        self.session_id = msg.data["session_id"]
                        await self._emit(self._status(), log=False)
                elif isinstance(msg, AssistantMessage):
                    if msg.parent_tool_use_id:      # 서브에이전트 내부는 생략
                        continue
                    content = [_block_to_dict(b) for b in msg.content]
                    for ev in blocks_to_events("assistant", content):
                        await self._emit(ev)
                    if msg.error:
                        await self._emit({"type": "error", "message": f"API 오류: {msg.error}"})
                elif isinstance(msg, UserMessage):
                    if msg.parent_tool_use_id or isinstance(msg.content, str):
                        continue
                    content = [_block_to_dict(b) for b in msg.content]
                    for ev in blocks_to_events("user", content):
                        if ev["type"] == "tool_result":
                            await self._emit(ev)
                elif isinstance(msg, ResultMessage):
                    self.session_id = msg.session_id or self.session_id
                    await self._emit({
                        "type": "result", "is_error": msg.is_error,
                        "duration_ms": msg.duration_ms, "cost_usd": msg.total_cost_usd,
                        "terminal_reason": msg.terminal_reason,
                    })
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.exception("agent turn failed")
            await self._emit({"type": "error", "message": f"{type(e).__name__}: {e}"})
            # CLI가 죽었으면 다음 send에서 같은 세션으로 다시 붙는다
            self._client = None
        finally:
            await self._set_state("idle" if self._client is not None else "disconnected")
            # 별도 태스크로 — close()가 _turn_task(지금 이 태스크)를 cancel하므로 안에서 돌면 재시작 전에 끊긴다
            asyncio.create_task(self._maybe_auto_restart())

    async def _wait_jobs_then_restart(self) -> None:
        """백그라운드 작업이 끝날 때까지 폴링 — 다음 턴이 없어도 재시작되게."""
        while True:
            await asyncio.sleep(_DEFER_POLL_S)
            if self.state != "running" and not self._pending and not _background_jobs()[0]:
                break
        await self._maybe_auto_restart()

    async def _maybe_auto_restart(self) -> None:
        """턴 동안 에이전트 자신의 코드가 바뀌었으면 import 검사 후 셀프 재시작.

        exit(1) → systemd Restart=on-failure가 재기동 (sudo 불필요). 깨진 코드로 재시작하면
        크래시 루프에 빠져 모바일에선 복구할 길이 없으므로, 새 프로세스로 import가 되는지 먼저 본다.
        실패하면 재시작하지 않고 남겨 둔다 (다음 턴 종료 때 다시 검사 — 고치면 그때 반영).
        """
        global _BOOT_SNAPSHOT
        now = _snapshot()
        changed = [Path(f).name for f in now if now[f] != _BOOT_SNAPSHOT.get(f)]
        if not changed or self.state == "running" or self._pending:
            return
        blocking, dev_server = _background_jobs()
        if blocking:
            # 백그라운드 작업(백테스트·마이그레이션 등)이 재시작에 같이 죽지 않게 미룬다
            if self._defer_task is None or self._defer_task.done():
                await self._emit({"type": "notice", "text":
                                  f"에이전트 코드 변경 — 백그라운드 작업 {len(blocking)}개가 끝나면 재시작합니다: "
                                  + " / ".join(blocking[:3])})
                self._defer_task = asyncio.create_task(self._wait_jobs_then_restart())
            return
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "-c", "import agent_main",
            cwd=str(_BACKEND), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        )
        try:
            out, _ = await asyncio.wait_for(proc.communicate(), timeout=60)
        except asyncio.TimeoutError:
            proc.kill()
            out = b"import check timeout (60s)"
        if proc.returncode != 0:
            tail = out.decode(errors="ignore").strip().splitlines()[-6:]
            await self._emit({"type": "error", "message":
                              f"에이전트 코드 변경({', '.join(changed)}) — import 실패로 자동 재시작 보류. "
                              "고치면 다음 턴 끝에 재시작됩니다.\n" + "\n".join(tail)})
            _BOOT_SNAPSHOT = now   # 같은 실패를 매 턴 반복 보고하지 않게. 다시 고치면 mtime이 또 바뀐다
            return
        if self.state == "running" or self._pending:   # import 검사 사이에 새 메시지가 들어와 응답 중
            return                                     # 스냅샷은 그대로 → 그 턴이 끝나면 다시 시도
        await self._emit({"type": "notice", "text":
                          f"에이전트 코드 변경({', '.join(changed)}) — 서비스 재시작 중… 약 10초 후 같은 세션으로 재접속"})
        if not await self.prepare_restart(relaunch_dev_server=dev_server):
            return
        logger.info("auto self-restart: %s", changed)
        asyncio.get_running_loop().call_later(0.5, os._exit, 1)

    # ------------------------------------------------------------ 권한
    async def _guard_hook(self, input_data, tool_use_id, context) -> dict[str, Any]:
        name = input_data.get("tool_name", "")
        reason = check_tool(name, input_data.get("tool_input") or {})
        if reason is None:
            return {}
        await self._emit({"type": "blocked", "name": name, "reason": reason,
                          "summary": _summarize_input(name, input_data.get("tool_input") or {})})
        return {"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": f"웹 에이전트 차단 목록: {reason}",
        }}

    async def _can_use_tool(self, tool_name: str, tool_input: dict[str, Any], ctx):
        from claude_agent_sdk import PermissionResultAllow, PermissionResultDeny
        req_id = ctx.tool_use_id or uuid.uuid4().hex
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        event = {
            "type": "permission_request", "id": req_id, "name": tool_name,
            "title": ctx.title or f"{tool_name} 실행",
            "summary": _summarize_input(tool_name, tool_input),
            "reason": ctx.decision_reason,
        }
        self._pending[req_id] = {"future": fut, "event": event}
        await self._emit(event, log=False)
        await self._emit(self._status(), log=False)
        try:
            allowed = await asyncio.wait_for(fut, timeout=_PERMISSION_TIMEOUT_S)
        except asyncio.TimeoutError:
            allowed = False
        finally:
            self._pending.pop(req_id, None)
        self._touch()
        await self._emit({"type": "permission_resolved", "id": req_id, "allowed": allowed,
                          "name": tool_name, "summary": event["summary"]})
        await self._emit(self._status(), log=False)
        if allowed:
            return PermissionResultAllow()
        return PermissionResultDeny(message="사용자가 웹 UI에서 거부했다 (또는 10분 무응답).")

    def resolve(self, req_id: str, allow: bool) -> None:
        p = self._pending.get(req_id)
        if p and not p["future"].done():
            p["future"].set_result(bool(allow))

    # ------------------------------------------------------------ 유휴 정리
    def _touch(self) -> None:
        self._last_activity = time.monotonic()

    def _ensure_reaper(self) -> None:
        if self._reaper is None or self._reaper.done():
            self._reaper = asyncio.create_task(self._reap_loop())

    async def _reap_loop(self) -> None:
        while True:
            await asyncio.sleep(60)
            idle = time.monotonic() - self._last_activity
            if (self._client is not None and self.state == "idle"
                    and not self._pending and idle > _IDLE_DISCONNECT_S):
                logger.info("agent idle %.0fs — disconnecting CLI (session kept on disk)", idle)
                sid = self.session_id
                await self.close()
                self.session_id = sid      # 다음 send가 같은 세션으로 resume


def _block_to_dict(b: Any) -> dict[str, Any]:
    from claude_agent_sdk import TextBlock, ToolResultBlock, ToolUseBlock
    if isinstance(b, TextBlock):
        return {"type": "text", "text": b.text}
    if isinstance(b, ToolUseBlock):
        return {"type": "tool_use", "id": b.id, "name": b.name, "input": b.input}
    if isinstance(b, ToolResultBlock):
        return {"type": "tool_result", "tool_use_id": b.tool_use_id,
                "content": b.content, "is_error": b.is_error}
    return {"type": "other"}


# ---------------------------------------------------------------- 세션 기록
_ENTRY_RE = re.compile(r'"entrypoint":"([^"]+)"')
_origin_cache: dict[str, tuple[float, dict[str, Any]]] = {}


def session_origin(session_id: str) -> dict[str, Any]:
    """세션 출처 — CLI가 기록 줄마다 남기는 `entrypoint`로 판정 (cli=터미널, sdk-*=웹).

    origin은 첫 기록 기준, mixed는 양쪽에서 이어 쓴 흔적 (기록 꼬임 경고용).
    파일 mtime 기준 캐시 — 목록을 열 때마다 수 MB를 다시 읽지 않는다.
    """
    path = SESSIONS_DIR / f"{session_id}.jsonl"
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return {"origin": "unknown", "mixed": False}
    hit = _origin_cache.get(session_id)
    if hit and hit[0] == mtime:
        return hit[1]
    kinds: list[str] = []
    try:
        with path.open(encoding="utf-8", errors="ignore") as f:
            for line in f:
                m = _ENTRY_RE.search(line)
                if m:
                    k = "terminal" if m.group(1) == "cli" else "web"
                    if k not in kinds:
                        kinds.append(k)
                        if len(kinds) == 2:
                            break
    except OSError:
        pass
    info = {"origin": kinds[0] if kinds else "unknown", "mixed": len(kinds) > 1}
    _origin_cache[session_id] = (mtime, info)
    return info


def list_project_sessions(limit: int = 20) -> list[dict[str, Any]]:
    from claude_agent_sdk import list_sessions
    out = []
    for s in list_sessions(directory=str(PROJECT_ROOT), limit=limit, include_worktrees=False):
        out.append({
            "session_id": s.session_id,
            "title": s.custom_title or s.summary or (s.first_prompt or "")[:80],
            "last_modified": s.last_modified,
            **session_origin(s.session_id),
        })
    return out


def load_history_events(session_id: str, max_events: int = _LOG_CAP) -> list[dict[str, Any]]:
    """디스크 세션 기록 → UI 이벤트 (resume 시 이전 대화 표시용)."""
    from claude_agent_sdk import get_session_messages
    events: list[dict[str, Any]] = []
    try:
        msgs = get_session_messages(session_id, directory=str(PROJECT_ROOT))
    except Exception as e:
        logger.warning("session history load failed: %s", e)
        return events
    for m in msgs:
        message = m.message or {}
        role = message.get("role") or m.type
        evs = blocks_to_events(role, message.get("content"))
        if role == "user":
            # 사용자 쪽은 실제 입력 텍스트 + 도구 결과만. 시스템 리마인더 등 주입 텍스트는 생략
            evs = [e for e in evs if e["type"] == "tool_result"
                   or (e["type"] == "user" and not e["text"].lstrip().startswith("<"))]
        events.extend(evs)
    return events[-max_events:]


_hub: AgentHub | None = None


def get_hub() -> AgentHub:
    global _hub
    if _hub is None:
        _hub = AgentHub()
        _hub.restore_last_session()
    return _hub
