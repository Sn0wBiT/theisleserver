@echo off

:: Check for administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

title Caddy Server
cd /d C:\caddy

echo Starting Caddy...
echo.

caddy.exe run --config Caddyfile

pause