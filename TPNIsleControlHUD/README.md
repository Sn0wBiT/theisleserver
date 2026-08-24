# TPN Isle Control HUD

External Win32/CEF (Chromium Embedded Framework) overlay for The Isle: EVRIMA. Version 0.1 provides the Quests HUD only and remains a separate process: it does not inject into, hook, patch, or read memory from the game.

## Prerequisites

- Windows 10/11
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

Set `apiUrl` in `frontend/src/services/api.ts` to the public origin of the `tpn-dino` Next.js app, then rebuild the frontend. The HUD only calls its authenticated API routes. The Next.js server derives the Steam ID from the player session and keeps the bridge URL and administrative token server-side.

Set `HUD_ORIGIN` on the Next.js deployment to the embedded browser origin (default `https://app.tpn.local`; use `http://localhost:5173` during Vite development) so its quest API allows only the intended HUD origin. Authentication may use the existing signed session cookie or a future short-lived player bearer token; bridge/admin tokens are never accepted by the HUD.

## Native build

From a Visual Studio Developer PowerShell:

```powershell
cmake -S . -B build -A x64
cmake --build build --config Release
```

CMake downloads the pinned 64-bit CEF standard distribution at configure time and builds its C++ wrapper. Expect the first configure to download a few hundred megabytes. CEF's Chromium runtime, resources, locales, and license are copied beside the executable and included by `cmake --install`; no separately installed browser runtime is required.

## Release layout

```powershell
cd frontend
npm run build
cd ..
cmake --install build --config Release --prefix release
```

The result contains `TPNIsleControlHUD.exe`, `config.json`, and the production frontend under `ui/`. Review the native configuration and the build-time `apiUrl` before distribution; the example API URL is intentionally non-functional.

## Controls

- `F6` toggles HUD and interactive modes (configurable to another F-key).
- `F12` opens CEF DevTools when `enableDevTools` is enabled. In interactive mode, right-click an element and choose **Inspect element** to inspect it directly.
- `Escape` closes the interactive quest panel.
- HUD mode is click-through; interactive mode accepts mouse input.

The overlay tracks the client rectangle of `TheIsle-Win64-Shipping.exe` or `TheIsle.exe`, hides when the game is minimized, closed, or not foreground, and waits for it to return.

## Configuration

Native settings live in `config.json`. The frontend API origin is the build-time `apiUrl` constant in `frontend/src/services/api.ts`; changing it requires rebuilding the frontend. Never place an administrative API token in frontend or native configuration source.

CEF uses windowless/off-screen rendering with a fully transparent browser background. Each premultiplied BGRA frame is composited into the topmost layered Win32 popup with `UpdateLayeredWindow`, preserving per-pixel alpha instead of relying on a color key. Native mouse, wheel, focus, and keyboard messages are forwarded to CEF while interactive mode is active. Production assets remain available at `https://app.tpn.local`, and the host emulates the existing `window.chrome.webview` message contract so the frontend bridge remains unchanged.

CEF browser data and logs are stored under `%LOCALAPPDATA%\TPNIsleControlHUD\CEF` (with an executable-directory fallback when `LOCALAPPDATA` is unavailable).
JavaScript `console` output is available on the DevTools **Console** tab. Set `enableDevTools` to `false` in `config.json` for production builds to disable F12, element inspection, and the browser context menu.
