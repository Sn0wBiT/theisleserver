@echo off
cls
title The Isle Evrima — My Server
:TheIsle
echo (%time%) Checking for updates...
start /wait D:\steamcmd\steamcmd.exe +force_install_dir D:\theisleserver +login anonymous +app_update 412680 -beta evrima validate +quit
set "LEGACY_MOD=Isle"
set "LEGACY_MOD=%LEGACY_MOD%Control"
if exist "D:\theisleserver\TheIsle\Binaries\Win64\ue4ss\Mods\%LEGACY_MOD%" (
    rmdir /s /q "D:\theisleserver\TheIsle\Binaries\Win64\ue4ss\Mods\%LEGACY_MOD%"
)
set "LEGACY_MOD="
if exist "D:\theisleserver\TheIsle\Binaries\Win64\ue4ss\Mods\TPNIsleControl\dlls\main.next.dll" (
    copy /y "D:\theisleserver\TheIsle\Binaries\Win64\ue4ss\Mods\TPNIsleControl\dlls\main.next.dll" "D:\theisleserver\TheIsle\Binaries\Win64\ue4ss\Mods\TPNIsleControl\dlls\main.dll" >nul
    del /q "D:\theisleserver\TheIsle\Binaries\Win64\ue4ss\Mods\TPNIsleControl\dlls\main.next.dll"
)
start "TPNIsleControl Bridge" /min "D:\theisleserver\start-tpnislecontrol-bridge.cmd"
echo (%time%) Starting Isle server...
start /wait D:\theisleserver\TheIsleServer.exe /Game/TheIsle/Maps/Game/Gateway/Gateway?Port=7777 -log
echo (%time%) Server stopped or crashed — restarting in 60s.
timeout /t 60
goto TheIsle
