@echo off
setlocal
set "ROOT=%~dp0..\.."
set "APP=%ROOT%\apps\tpn-dino"
set "NODE=%ROOT%\TPNIsleControl\runtime\node\node.exe"
set "ENV_FILE=%ROOT%\config\tpn-dino.env"

if not exist "%NODE%" (
  echo Missing shared Node runtime: %NODE%
  exit /b 1
)
if not exist "%APP%\server.js" (
  echo Missing Next standalone runtime: %APP%
  exit /b 1
)

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENV_FILE%") do if not "%%A"=="" set "%%A=%%B"
cd /d "%APP%"
"%NODE%" server.js
