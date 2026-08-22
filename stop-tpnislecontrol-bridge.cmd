@echo off
powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*TPNIsleControl*bridge*src*index.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
