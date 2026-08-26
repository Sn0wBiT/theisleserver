@echo off
setlocal
set "ROOT=%~dp0..\.."
set "NODE=%ROOT%\TPNIsleControl\runtime\node\node.exe"
set "BRIDGE=%ROOT%\TPNIsleControl\bridge"
set "TPNISLECONTROL_CONFIG=%ROOT%\config\bridge.json"

cd /d "%BRIDGE%"
"%NODE%" src\index.js
