@ECHO OFF
TITLE PM2 Monitor (Admin)

cd /d "%~dp0"

ECHO.
ECHO [1/3] Ensuring PM2 daemon is running...
pm2 ping >nul 2>&1 || (
    ECHO Starting PM2 daemon...
    pm2 ping
)

ECHO.
ECHO [2/3] Starting spc-api via PM2 (direct JS file)...
REM ✅ Jalankan file JS langsung — SESUAIKAN PATH!
pm2 start ./data-collector/server-test.js --name "spc-api" --no-daemon

REM Optional: Tambahkan --env production jika perlu
REM pm2 start ./data-collector/server-test.js --name "spc-api" --env production

ECHO.
ECHO [3/3] Launching PM2 Monitor...
ECHO Tekan CTRL+C untuk keluar dari monitor (aplikasi tetap berjalan di latar).
ECHO.

REM Jalankan pm2 monit di PowerShell yang sama (tidak buka jendela baru berulang)
powershell -NoExit -ExecutionPolicy Bypass -Command "pm2 monit"