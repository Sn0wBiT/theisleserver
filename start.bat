@echo off
cls
title The Isle Evrima — My Server
:TheIsle
echo (%time%) Checking for updates...
start /wait D:\steamcmd\steamcmd.exe +force_install_dir D:\theisleserver +login anonymous +app_update 412680 -beta evrima validate +quit
if exist "D:\theisleserver\TheIsle\Binaries\Win64\ue4ss\Mods\IsleControl\dlls\main.next.dll" (
    copy /y "D:\theisleserver\TheIsle\Binaries\Win64\ue4ss\Mods\IsleControl\dlls\main.next.dll" "D:\theisleserver\TheIsle\Binaries\Win64\ue4ss\Mods\IsleControl\dlls\main.dll" >nul
    del /q "D:\theisleserver\TheIsle\Binaries\Win64\ue4ss\Mods\IsleControl\dlls\main.next.dll"
)
start "IsleControl Bridge" /min "D:\theisleserver\start-islecontrol-bridge.cmd"
echo (%time%) Starting Isle server...
start /wait D:\theisleserver\TheIsleServer.exe /Game/TheIsle/Maps/Game/Gateway/Gateway?Port=7777 -log
echo (%time%) Server stopped or crashed — restarting in 60s.
timeout /t 60
goto TheIsle
