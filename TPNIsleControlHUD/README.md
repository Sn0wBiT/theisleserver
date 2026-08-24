# TPN Isle Control HUD

External Win32/WebView2 overlay for The Isle: EVRIMA. Version 0.1 provides the Quests HUD only and remains a separate process: it does not inject into, hook, patch, or read memory from the game.

## Prerequisites

- Windows 10/11 and Microsoft Edge WebView2 Evergreen Runtime
- Visual Studio 2022 with Desktop development with C++
- CMake 3.24+
- Node.js 20+ and npm

## Frontend development

```powershell
cd frontend
npm install
npm run dev
```

Vite development mode uses built-in Vietnamese mock quest data, including incomplete, claimable, and claimed states across all three periods. Claiming a mock reward updates its state and token balance in memory. Production builds always use the Next.js API.

Copy `config/config.example.json` beside the executable as `config.json`, then set `development` to `true`. The native host loads `http://localhost:5173`.

Set `frontend/public/config.json` to the public origin of the `tpn-dino` Next.js app. The HUD only calls its authenticated `/api/quests` routes. The Next.js server derives the Steam ID from the player session and keeps the bridge URL and administrative token server-side.

Set `HUD_ORIGIN` on the Next.js deployment to the WebView origin (default `https://app.tpn.local`; use `http://localhost:5173` during Vite development) so its quest API allows only the intended HUD origin. Authentication may use the existing signed session cookie or a future short-lived player bearer token; bridge/admin tokens are never accepted by the HUD.

## Native build

From a Visual Studio Developer PowerShell:

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
```

CMake downloads the Microsoft WebView2 SDK NuGet package at configure time. The Evergreen Runtime itself is not bundled; startup shows a clear error when it is missing.

## Release layout

```powershell
cd frontend
npm run build
cd ..
cmake --install build --config Release --prefix release
```

The result contains `TPNIsleControlHUD.exe`, `config.json`, and the production frontend under `ui/`. Review `config.json` before distribution; the example API URL is intentionally non-functional.

## Controls

- `F6` toggles HUD and interactive modes (configurable to another F-key).
- `Escape` closes the interactive quest panel.
- HUD mode is click-through; interactive mode accepts mouse input.

The overlay tracks the client rectangle of `TheIsle-Win64-Shipping.exe` or `TheIsle.exe`, hides when the game is minimized, closed, or not foreground, and waits for it to return.

## Configuration

Native settings live in `config.json`. Frontend runtime settings live in `ui/config.json`, allowing the API URL and adapter mode to change without rebuilding JavaScript. Never place an administrative API token in either frontend configuration or source.

WebView2 uses a windowed controller with a fully transparent default background, hosted by a topmost layered Win32 popup. This keeps the v0.1 implementation small while preserving the external-process boundary; a composition controller can replace it later if testing identifies GPU/driver-specific windowed-controller artifacts.
