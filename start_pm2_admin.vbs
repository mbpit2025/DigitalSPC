Set UAC = CreateObject("Shell.Application")
' Ganti "start_ecosystem.bat" dengan nama file bat utama Anda
UAC.ShellExecute "start_ecosystem.bat", "", "", "runas", 1