@echo off
title EdgeFlo (Qoder)
cd /d "%~dp0"

echo ====================================
echo   EDGEFLO (QODER) STARTING
echo ====================================
echo   Frontend    : http://localhost:5174
echo   Backend API : http://localhost:4000
echo   MT5 bridge  : http://127.0.0.1:5001
echo ====================================
echo.
echo Browser will open automatically at http://localhost:5174
echo Keep this window OPEN while using EdgeFlo.
echo Press Ctrl+C to stop all services.
echo.

npm run dev

echo.
echo EdgeFlo stopped.
pause
