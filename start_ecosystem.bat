@ECHO OFF
TITLE PM2 Ecosystem Starter (ADMIN)

echo ============================================
echo   SPC Monitoring System - PM2 Launcher
echo ============================================
echo.
echo Pilih mode server backend:
echo.
goto START

:START
echo [1] REAL DATA     (server-test.js)
echo [2] DUMMY DATA    (dummy-server.js)
echo [3] MONITOR SERVER
echo [4] MATIKAN SERVER
echo [5] Keluar
echo.

set /p pilihan="Masukkan pilihan (1/2/3/4/5) : "
if "%pilihan%"=="1" goto REAL
if "%pilihan%"=="2" goto DUMMY
if "%pilihan%"=="3" goto MONITOR
if "%pilihan%"=="4" goto STOP
if "%pilihan%"=="5" exit
goto END



:REAL
ECHO Menjalankan SERVER REAL...
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
pm2 start ecosystem.config.js --only "spc-api-real,spc-frontend" --update-env

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
goto START
exit


:DUMMY
ECHO Menjalankan SERVER DUMMY...
ECHO Menjalankan SERVER REAL...
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
pm2 start ecosystem.config.js --only "spc-api-dummy,spc-frontend" --update-env

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
goto START

:MONITOR
cd /d "%~dp0"
ECHO Starting PM2 Monitoring...
pm2 monit

:STOP
ECHO Mematikan semua server...
pm2 kill
goto START

:END
exit