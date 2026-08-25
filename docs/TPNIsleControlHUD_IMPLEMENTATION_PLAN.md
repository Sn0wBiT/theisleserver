# TPNIsleControlHUD Architecture and Acceptance

## Runtime architecture

TPNIsleControlHUD is an external Win32 process. It does not inject into, hook, patch, or read memory from The Isle. A transparent topmost layered window follows the game client, and CEF renders the React frontend using windowless/off-screen rendering (OSR). Premultiplied BGRA frames are composited with `UpdateLayeredWindow` for per-pixel alpha.

Production UI assets are served by a CEF scheme handler at `http://dino.tpnrp.local`. Development mode navigates to the configured Vite URL. No separately installed browser runtime is required; packaging includes the pinned CEF runtime, resources, locales, and license.

```text
The Isle window
      |
GameWindowTracker
      |
Win32 layered overlay
      |
CEF OSR browser  -- app.config/runtime state --> React HUD
      |                                           |
      +-- mouse, keyboard, focus forwarding       +-- authenticated Next.js API
```

## Runtime configuration and startup

The frontend-ready message causes the native host to send:

- `app.config` with the runtime API origin;
- the current overlay mode;
- current game-process connection state;
- current foreground state.

In CEF, React does not mount authentication or contact the API until `app.config.apiUrl` is a valid HTTP(S) origin. Browser/Vite mode initializes from `VITE_API_URL`. The embedded UI/CORS origin is `http://dino.tpnrp.local`.

The production example disables development mode and DevTools and uses the intentionally nonfunctional `https://api.invalid` API origin. The development example enables Vite and DevTools. Both list all supported Isle executable names.

## Authentication and player presence

REST requests and the minimap SSE connection use the same single-flight refresh-token rotation. A 401 retries once after successful refresh. A refresh credential is deleted only when the refresh endpoint authoritatively rejects it; configuration and connectivity failures preserve it.

One position-stream provider owns the authenticated SSE connection shared by compact and expanded maps. It runs only while authenticated, the game process is connected, and shutdown has not started. A player is present only when a validated position is less than five seconds old. Ordinary HUD and quest polling are hidden or paused without that signal; sign-in and interactive connection status remain available.

## Native controls and tray

- F6 toggles click-through HUD and interactive modes.
- Escape closes the interactive panel.
- F12 and element inspection are available only when DevTools are enabled.
- `NOTIFYICON_VERSION_4` opens the tray menu only for `WM_CONTEXTMENU`, at the callback anchor. The owner is foregrounded for `TrackPopupMenuEx`, receives `WM_NULL` afterward, and the tray icon receives `NIM_SETFOCUS`. Focus then returns to the prior/game window.
- Tray double-click reconnect is independent of the context menu.

## Build and package contract

`scripts/build.ps1` runs these stages in order:

1. `npm ci` for the frontend;
2. frontend tests;
3. frontend production build;
4. native CMake configure;
5. native Release build;
6. installation into the release directory.

CMake fails configuration when `frontend/dist/index.html` or generated assets are missing. Frontend chunks are split into stable React, Leaflet, query/UI, and remaining vendor groups.

## Acceptance criteria

Automated checks:

- frontend tests, lint, TypeScript, and Vite production build pass;
- backend route tests, lint, and Next.js production build pass;
- the main frontend application chunk stays below Vite's warning threshold;
- GitNexus change detection reports only the intended auth, minimap, quest, native lifecycle/tray, build, configuration, and documentation flows.

Windows acceptance:

- a clean Release build/install succeeds with no pre-existing frontend `dist`;
- packaged CEF loads production assets and has no production DevTools;
- a stored login restores without contacting localhost;
- joining/leaving a server changes HUD visibility within five seconds;
- access-token expiry refreshes the SSE connection without signing out;
- compact and expanded maps share one upstream subscriber;
- minimize/restore/resize/refocus, click-through, F6, Escape, persistence, tray menu, reconnect, and exit behave correctly.

`docs/TODO.md` entries remain until this Windows acceptance pass succeeds.
