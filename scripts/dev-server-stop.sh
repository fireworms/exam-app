#!/usr/bin/env bash
# exam-app 로컬 백엔드 종료.
# Claude Code SessionEnd 훅에서 호출되며, Claude Code가 비정상 종료돼
# 서버가 남았을 때를 대비한 수동 폴백 스크립트로도 쓴다 (그냥 직접 실행).
set -u

PIDFILE=/tmp/exam-app-backend.pid
killed=0

# 1) pidfile 기준 우선 종료
if [ -f "$PIDFILE" ]; then
  PID="$(cat "$PIDFILE" 2>/dev/null)"
  if [ -n "${PID:-}" ] && kill "$PID" 2>/dev/null; then
    killed=1
  fi
  rm -f "$PIDFILE"
fi

# 2) pidfile이 없거나 어긋났을 때를 대비해 포트 점유 프로세스도 정리
PORT_PIDS="$(lsof -ti:8008 2>/dev/null)"
if [ -n "$PORT_PIDS" ]; then
  echo "$PORT_PIDS" | xargs -r kill 2>/dev/null && killed=1
fi

if [ "$killed" -eq 1 ]; then
  echo "[exam-app] 백엔드 종료 완료"
else
  echo "[exam-app] 실행 중인 백엔드 없음"
fi
