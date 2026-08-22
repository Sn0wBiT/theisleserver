@echo off
cls
title The Isle Evrima — My Server
:TheIsle
echo (%time%) Checking for updates...
start /wait D:\steamcmd\steamcmd.exe +force_install_dir D:\theisleserver +login anonymous +app_update 412680 -beta evrima validate +quit
echo (%time%) Starting Isle server...
start /wait D:\theisleserver\TheIsleServer.exe /Game/TheIsle/Maps/Game/Gateway/Gateway?Port=7777 -log
echo (%time%) Server stopped or crashed — restarting in 60s.
timeout /t 60
goto TheIsle