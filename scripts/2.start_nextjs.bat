```bat
@echo off
title TPN Dino Next.js

cd /d "%~dp0"
cd ..
cd tpn-dino

echo Installing dependencies...
call npm install

echo Building Next.js app...
call npm run build

echo Starting Next.js app...
call npm run start

pause
```
