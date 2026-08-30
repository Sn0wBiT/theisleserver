@echo off
setlocal EnableExtensions
title TPN Proximity Voice - LiveKit

rem Optional overrides:
rem   set TPN_LIVEKIT_ROOT=D:\TheIsleServer
rem   set TPN_LIVEKIT_CONFIG=D:\TheIsleServer\config\livekit.yaml
if not defined TPN_LIVEKIT_ROOT set "TPN_LIVEKIT_ROOT=D:\TheIsleServer"
if not defined TPN_LIVEKIT_CONFIG set "TPN_LIVEKIT_CONFIG=%TPN_LIVEKIT_ROOT%\config\livekit.yaml"

echo Starting TPN proximity voice...

rem Prefer the production scheduled task installed by Install-LiveKit.ps1.
schtasks /Query /TN "TPN-LiveKit" >nul 2>&1
if %errorlevel% equ 0 (
    net session >nul 2>&1
    if not %errorlevel% equ 0 (
        echo Administrator access is required to start the LiveKit task.
        powershell.exe -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
        exit /b
    )
    schtasks /Run /TN "TPN-LiveKit"
    if not %errorlevel% equ 0 goto :failed
    echo LiveKit scheduled task started.
    echo Check status with: schtasks /Query /TN "TPN-LiveKit" /V /FO LIST
    goto :done
)

rem Development/manual fallback: locate the newest pinned installation.
if not exist "%TPN_LIVEKIT_CONFIG%" (
    echo ERROR: LiveKit config was not found: %TPN_LIVEKIT_CONFIG%
    echo Copy deploy\windows\livekit.yaml.example to that path and replace all CHANGE_ME values.
    goto :failed
)

findstr /C:"CHANGE_ME" "%TPN_LIVEKIT_CONFIG%" >nul 2>&1
if %errorlevel% equ 0 (
    echo ERROR: %TPN_LIVEKIT_CONFIG% still contains CHANGE_ME credentials or hostnames.
    goto :failed
)

set "TPN_LIVEKIT_EXE="
for /f "delims=" %%F in ('dir /b /s /o-n "%TPN_LIVEKIT_ROOT%\services\livekit-*\livekit-server.exe" 2^>nul') do if not defined TPN_LIVEKIT_EXE set "TPN_LIVEKIT_EXE=%%F"
if not defined TPN_LIVEKIT_EXE (
    echo ERROR: livekit-server.exe was not found below %TPN_LIVEKIT_ROOT%\services.
    echo Run deploy\windows\Install-LiveKit.ps1 as Administrator first.
    goto :failed
)

echo Executable: %TPN_LIVEKIT_EXE%
echo Config:     %TPN_LIVEKIT_CONFIG%
echo Press Ctrl+C to stop this manual LiveKit process.
"%TPN_LIVEKIT_EXE%" --config "%TPN_LIVEKIT_CONFIG%"
if not %errorlevel% equ 0 goto :failed
goto :done

:failed
echo.
echo Voice server did not start. See docs\VOICE_SERVER_SETUP.md.
pause
exit /b 1

:done
echo.
echo LiveKit is starting. Ensure Caddy and the Next.js/bridge services are also running.
echo See docs\VOICE_SERVER_SETUP.md for ports and health checks.
pause
exit /b 0
