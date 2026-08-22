@echo off
setlocal
cls
title The Isle Evrima - My Server

set "SERVER_DIR=%~dp0"
set "STEAMCMD=D:\steamcmd\steamcmd.exe"
set "MOD_DLL_DIR=%SERVER_DIR%TheIsle\Binaries\Win64\ue4ss\Mods\TPNIsleControl\dlls"

:restart
echo (%time%) Checking for updates...
start "" /wait "%STEAMCMD%" +force_install_dir "%SERVER_DIR%" +login anonymous +app_update 412680 -beta evrima validate +quit

if exist "%MOD_DLL_DIR%\main.next.dll" (
    move /y "%MOD_DLL_DIR%\main.next.dll" "%MOD_DLL_DIR%\main.dll" >nul
)

start "TPNIsleControl Bridge" /min "%SERVER_DIR%start-tpnislecontrol-bridge.cmd"
echo (%time%) Starting Isle server...
start "" /wait "%SERVER_DIR%TheIsleServer.exe" /Game/TheIsle/Maps/Game/Gateway/Gateway?Port=7777 -log

echo (%time%) Server stopped or crashed - restarting in 60 seconds.
timeout /t 60 /nobreak >nul
goto restart
