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

Vite development mode uses built-in Vietnamese mock quest data, including accept, incomplete, claimable, and claimed states across all three periods. Accepting or claiming updates the mock state in memory. Production builds always use the configured Next.js API.

Copy `config/config.example.json` beside the executable as `config.json`, then set `development` to `true`. The native host loads `http://localhost:5173`.

Set `apiOrigin` in native `config.json` to the public origin of the `tpn-dino` Next.js app. CEF sends and validates this origin during the frontend-ready handshake before authentication mounts or any API request starts. Browser/Vite mode uses `VITE_API_URL` instead.

Set `HUD_ORIGIN` on the Next.js deployment to the embedded browser origin (default `http://dino.tpnrp.local`; use `http://localhost:5173` during Vite development) so its API allows only the intended HUD origin. Bridge/admin tokens are never accepted by the HUD.

## Native build

From a Visual Studio Developer PowerShell:

```powershell
.\..\scripts\build.ps1
```

CMake downloads the pinned 64-bit CEF standard distribution at configure time and builds its C++ wrapper. Expect the first configure to download a few hundred megabytes. CEF's Chromium runtime, resources, locales, and license are copied beside the executable and included by `cmake --install`; no separately installed browser runtime is required.

## Release layout

```powershell
cd frontend
npm run build
cd ..
cmake --install build --config Release --prefix release
```

The result contains `TPNIsleControlHUD.exe`, `config.json`, and the production frontend under `ui/`. The build script performs locked dependency installation, frontend tests/build, native configure/build, and installation in order. Packaging fails if `dist/index.html` or generated assets are absent. Review `apiOrigin` before distribution; the example HTTPS origin is intentionally non-functional.

## Controls

- `F6` toggles HUD and interactive modes (configurable to another F-key).
- `F12` opens CEF DevTools when `enableDevTools` is enabled. In interactive mode, right-click an element and choose **Inspect element** to inspect it directly.
- `Escape` closes the interactive quest panel.
- HUD mode is click-through; interactive mode accepts mouse input.

The overlay tracks the client rectangle of `TheIsleClient-Win64-Shipping.exe`, `TheIsle-Win64-Shipping.exe`, or `TheIsle.exe`, hides when the game is minimized, closed, or not foreground, and waits for it to return.

## Configuration

Native settings live in `config.json`. `config.dev.json` enables Vite and DevTools; the production example disables both. `apiOrigin` is a runtime value, so changing the API service does not require rebuilding the frontend. Never place an administrative API token in frontend or native configuration source.

CEF uses windowless/off-screen rendering with a fully transparent browser background. Each premultiplied BGRA frame is composited into the topmost layered Win32 popup with `UpdateLayeredWindow`, preserving per-pixel alpha instead of relying on a color key. Native mouse, wheel, focus, and keyboard messages are forwarded to CEF while interactive mode is active. Production assets are served from `http://dino.tpnrp.local`, and the host emulates the existing `window.chrome.webview` message contract.

One authenticated SSE connection owns player position for both minimap views. Normal HUD layers appear only while the game process is connected and a valid position has arrived within five seconds. Quest polling uses the same presence signal. Access-token expiry is recovered through the shared single-flight refresh rotation for REST and SSE; refresh credentials are cleared only after an authoritative invalid-refresh response.

CEF browser data and logs are stored under `%LOCALAPPDATA%\TPNIsleControlHUD\CEF` (with an executable-directory fallback when `LOCALAPPDATA` is unavailable).
JavaScript `console` output is available on the DevTools **Console** tab. Set `enableDevTools` to `false` in `config.json` for production builds to disable F12, element inspection, and the browser context menu.
