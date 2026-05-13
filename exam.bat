@echo off
title Exam App Launcher

:menu
cls
echo ================================
echo        Exam App Launcher
echo ================================
echo.
echo  1. Dev mode (frontend + backend)
echo  2. Build and run
echo  3. Build only
echo  0. Exit
echo.
set /p choice="Select: "

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto build_and_run
if "%choice%"=="3" goto build_only
if "%choice%"=="0" exit
goto menu

:dev
cls
echo [DEV] Starting backend and frontend...

start "Backend" cmd /k "cd /d E:\apps\exam-app\backend && (if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat) else (call .venv\Scripts\activate.bat)) && python main.py"

timeout /t 2 /nobreak > nul
start "Frontend" cmd /k "cd /d E:\apps\exam-app\frontend && npm run dev"

echo.
echo Backend : http://localhost:8008
echo Frontend: http://localhost:5173
echo.
pause
goto menu

:build_and_run
cls
echo [BUILD] Building frontend...
cd /d E:\apps\exam-app\frontend
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed!
    pause
    goto menu
)

echo.
echo [RUN] Starting backend server...
cd /d E:\apps\exam-app\backend
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
) else (
    call .venv\Scripts\activate.bat
)
echo.
echo Access: http://localhost:8008
echo.
uvicorn main:app --host 0.0.0.0 --port 8008
pause
goto menu

:build_only
cls
echo [BUILD] Building frontend...
cd /d E:\apps\exam-app\frontend
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed!
) else (
    echo [DONE] Build success!
)
pause
goto menu
