#!/usr/bin/env bash
# exam-app 로컬 백엔드 기동 (on-demand).
# Claude Code SessionStart 훅에서 호출됨. 수동 실행도 가능.
# 주의: 부팅 자동시작(systemd)으로 쓰지 말 것 — 배경은 CLAUDE.md '실행' 섹션 참고.
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG=/tmp/backend.log
PIDFILE=/tmp/exam-app-backend.pid

# 이미 8008에서 서버가 살아있으면 중복 기동하지 않는다.
if lsof -ti:8008 >/dev/null 2>&1; then
  echo "[exam-app] 백엔드가 이미 8008에서 실행 중 — 기동 생략"
  exit 0
fi

cd "$PROJECT_DIR/backend" || { echo "[exam-app] backend 디렉터리 없음"; exit 0; }
# shellcheck disable=SC1091
source venv/bin/activate 2>/dev/null || { echo "[exam-app] venv 활성화 실패 — 기동 생략"; exit 0; }

# reload 없이 백그라운드 구동 (reload=True는 CPU 과부하 원인이라 서버 모드에서 미사용)
nohup uvicorn main:app --host 0.0.0.0 --port 8008 > "$LOG" 2>&1 &
echo $! > "$PIDFILE"
echo "[exam-app] 백엔드 기동 (PID $(cat "$PIDFILE"), 로그 $LOG, http://192.168.50.102:8008)"
