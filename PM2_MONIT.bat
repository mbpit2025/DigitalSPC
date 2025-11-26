@echo off
REM start_pm2_monit.bat

REM Perintah untuk menjalankan PM2 monit di PowerShell
REM /k berarti konsol akan tetap terbuka setelah perintah selesai

PowerShell.exe -Command "& { & 'C:\Windows\System32\cmd.exe' /k 'pm2 monit' }"

REM Jika Anda hanya ingin PM2 monit berjalan tanpa konsol PowerShell terpisah:
REM pm2 monit