@echo off
title SPC PM2 Launcher

echo ============================================
echo   SPC Monitoring System - PM2 Launcher
echo ============================================
echo.
echo Pilih mode server backend:
echo.
echo [1] REAL DATA     (server-test.js)
echo [2] DUMMY DATA    (dummy-server.js)
echo [3] Keluar
echo.

set /p pilihan="Masukkan pilihan (1/2/3) : "

if "%pilihan%"=="1" goto REAL
if "%pilihan%"=="2" goto DUMMY
if "%pilihan%"=="3" exit
goto END

:REAL
echo Menjalankan SERVER REAL...
pm2 stop spc-api-dummy >nul 2>&1
pm2 delete spc-api-dummy >nul 2>&1
pm2 start ecosystem.config.js --only spc-api-real --update-env
goto FRONTEND

:DUMMY
echo Menjalankan SERVER DUMMY...
pm2 stop spc-api-real >nul 2>&1
pm2 delete spc-api-real >nul 2>&1
pm2 start ecosystem.config.js --only spc-api-dummy --update-env
goto FRONTEND

:FRONTEND
echo.
echo Menjalankan FRONTEND...
pm2 start ecosystem.config.js --only spc-frontend --update-env
pm2 save
echo.
echo Semua proses berjalan.
pm2 list
echo.
pause
exit

:END
exit
