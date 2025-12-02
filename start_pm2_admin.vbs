Set shell = CreateObject("WScript.Shell")

' Jalankan batch file dengan akses admin (RunAs)
shell.Run "cmd.exe /c start """" ""start_ecosystem.bat""", 0, False
