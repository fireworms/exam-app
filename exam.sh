#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "================================"
echo "  Exam App Launcher"
echo "================================"
echo "1) dev    - 백엔드 + 프론트 개발 서버"
echo "2) build  - 프론트 빌드 후 백엔드 서빙"
echo "3) stop   - 실행 중인 서버 종료"
echo ""

read -rp "선택 (1/2/3): " choice

case "$choice" in
  1|dev)
    echo "[*] 개발 서버 시작..."
    cd "$SCRIPT_DIR/backend"
    source venv/bin/activate
    python main.py &
    BACKEND_PID=$!
    echo "[*] 백엔드 PID: $BACKEND_PID"
    cd "$SCRIPT_DIR/frontend"
    npm run dev
    kill "$BACKEND_PID" 2>/dev/null
    ;;
  2|build)
    echo "[*] 프론트엔드 빌드..."
    cd "$SCRIPT_DIR/frontend"
    npm run build
    echo "[*] 백엔드 서버 시작 (http://0.0.0.0:8008)..."
    cd "$SCRIPT_DIR/backend"
    source venv/bin/activate
    python main.py
    ;;
  3|stop)
    echo "[*] 포트 8008 프로세스 종료..."
    fuser -k 8008/tcp 2>/dev/null && echo "종료 완료" || echo "실행 중인 서버 없음"
    ;;
  *)
    echo "잘못된 선택입니다."
    exit 1
    ;;
esac
