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
EXIT /B %ERRORLEVEL%
)

REM =============================================
REM 3. List
REM =============================================
ECHO.
ECHO Processes started successfully. Displaying PM2 list...
pm2 list
ECHO.

REM =============================================
REM 4. PM2 Monitor - JANGAN TUTUP PROMPT
REM =============================================
ECHO --------------------------------------------
ECHO SETUP COMPLETE - Starting PM2 Monitor (Tekan CTRL+C untuk keluar dari Monitor).
ECHO --------------------------------------------
pm2 monit

REM Setelah PM2 monit dihentikan (dengan CTRL+C), command prompt akan tetap terbuka
REM dan menampilkan prompt command line biasa.
CMD K
