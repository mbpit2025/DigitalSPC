@ECHO OFF
TITLE PM2 Ecosystem Starter (ADMIN)

REM =============================================
REM 1. Pindah folder
REM =============================================
cd /d "%~dp0"
ECHO Current directory: %CD%
ECHO.

REM =============================================
REM 2. Jalankan ecosystem
REM =============================================
ECHO Starting PM2 with Admin privileges...
pm2 start ecosystem.config.js --update-env

REM Cek error PM2 start
IF %ERRORLEVEL% NEQ 0 (
ECHO [CRITICAL ERROR] PM2 START GAGAL!
ECHO ErrorLevel: %ERRORLEVEL%
ECHO.
ECHO Tekan tombol apa saja untuk melihat status PM2 dan keluar.
pause >nul
)

REM =============================================
REM 3. List
REM =============================================
pm2 list
ECHO.

ECHO --------------------------------------------
ECHO SETUP COMPLETE - CMD will NOT close.
ECHO --------------------------------------------
pause