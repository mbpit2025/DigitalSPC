@ECHO OFF
TITLE PM2 Monitor (PowerShell)

REM Pindah ke direktori script
cd /d "%~dp0"

ECHO.
ECHO Starting PM2 Monitor in PowerShell...
ECHO.

REM Jalankan PowerShell dengan execution policy bypass (hanya untuk sesi ini)
powershell -NoExit -ExecutionPolicy Bypass -Command "cd '%CD%'; pm2 monit"