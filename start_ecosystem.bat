@ECHO OFF
TITLE PM2 Ecosystem Starter (ADMIN MODE)

REM Pindah ke direktori skrip ini berada
cd /d "%~dp0"
ECHO Current directory: %CD%
ECHO.

ECHO ======================================
ECHO 1. Cleaning previous PM2 processes...
ECHO ======================================
pm2 delete all >nul 2>&1

ECHO ======================================
ECHO 2. Starting PM2 Ecosystem...
ECHO ======================================
pm2 start ecosystem.config.js --env production --update-env

IF %ERRORLEVEL% NEQ 0 (
    ECHO.
    ECHO [CRITICAL ERROR] PM2 FAILED TO START!
    ECHO ErrorLevel: %ERRORLEVEL%
    PAUSE
    EXIT /B %ERRORLEVEL%
)

ECHO.
ECHO ✔ All PM2 apps started successfully in PRODUCTION MODE.
ECHO.

pause
