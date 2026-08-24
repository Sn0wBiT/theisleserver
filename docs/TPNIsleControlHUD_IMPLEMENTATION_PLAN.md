# TPNIsleControlHUD Implementation Plan

## 1. Goal

Build `TPNIsleControlHUD.exe`, an external Windows HUD/overlay application for **The Isle: EVRIMA**.

The application must:

- Run as a separate Windows process.
- Detect and track The Isle game window.
- Render a transparent WebView2 overlay above the game.
- Use React + TypeScript + Vite for the frontend.
- Use Tailwind CSS + shadcn/ui for UI.
- Let the frontend call the TPN HTTP API directly.
- Initially implement the Quests UI.
- Leave clean extension points for:
  - player level/profile system
  - minimap
  - realtime WebSocket updates
  - proximity voice chat

The HUD must **not** inject code into The Isle, hook DirectX, read/write game memory, or otherwise modify the client process.

---

# 2. High-Level Architecture

```text
                    TPN Backend API
                  HTTPS / WSS later
                         |
                         v
              React + TypeScript SPA
              ----------------------
              Quests
              Profile / Level
              Minimap later
              Voice controls later
                         |
                      WebView2
                         |
                         v
              TPNIsleControlHUD.exe
              ---------------------
              C++ / Win32
              Overlay window
              Game window tracker
              Hotkey/input manager
              WebView2 host
                         |
                         v
                    The Isle
```

Responsibility boundary:

```text
Native C++:
- Windows process lifecycle
- The Isle window discovery
- overlay positioning
- transparent/click-through behavior
- global hotkeys
- WebView2 hosting
- future native audio/voice implementation

React:
- HUD rendering
- API requests
- authentication UI/state
- quest UI
- profile/level UI
- minimap rendering
- settings
- voice controls
```

---

# 3. Non-Goals

Do not implement any of the following:

- DLL injection into `TheIsle.exe`
- DirectX / Vulkan hooks
- `ReadProcessMemory`
- `WriteProcessMemory`
- remote thread creation
- game client patching
- UE4SS client injection
- custom `.pak` UI
- minimap in v0.1
- voice chat in v0.1
- level system in v0.1
- WebSocket realtime updates in v0.1

The first release is a **Quests HUD MVP**.

---

# 4. Technology Stack

## Native

- C++20
- Win32 API
- CMake
- Microsoft WebView2 SDK
- WIL where useful

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Zustand
- Zod

Optional later:

- React Router
- WebSocket client
- native Opus/WebRTC voice subsystem

---

# 5. Repository Structure

Create this structure:

```text
TPNIsleControlHUD/
|
|-- CMakeLists.txt
|-- README.md
|
|-- native/
|   |-- CMakeLists.txt
|   |
|   |-- src/
|   |   |-- main.cpp
|   |   |
|   |   |-- app/
|   |   |   |-- Application.hpp
|   |   |   `-- Application.cpp
|   |   |
|   |   |-- overlay/
|   |   |   |-- OverlayWindow.hpp
|   |   |   |-- OverlayWindow.cpp
|   |   |   |-- GameWindowTracker.hpp
|   |   |   |-- GameWindowTracker.cpp
|   |   |   |-- InputManager.hpp
|   |   |   `-- InputManager.cpp
|   |   |
|   |   |-- webview/
|   |   |   |-- WebViewHost.hpp
|   |   |   `-- WebViewHost.cpp
|   |   |
|   |   `-- config/
|   |       |-- Config.hpp
|   |       `-- Config.cpp
|   |
|   `-- resources/
|
|-- frontend/
|   |-- package.json
|   |-- vite.config.ts
|   |-- tsconfig.json
|   |
|   `-- src/
|       |-- main.tsx
|       |
|       |-- app/
|       |   |-- App.tsx
|       |   |-- query-client.ts
|       |   `-- providers.tsx
|       |
|       |-- components/
|       |   |-- ui/
|       |   |-- hud/
|       |   `-- common/
|       |
|       |-- features/
|       |   |-- quests/
|       |   |   |-- api/
|       |   |   |-- components/
|       |   |   |-- hooks/
|       |   |   `-- types.ts
|       |   |
|       |   |-- profile/
|       |   |-- level/
|       |   |-- minimap/
|       |   |-- voice/
|       |   `-- settings/
|       |
|       |-- services/
|       |   |-- api.ts
|       |   `-- auth.ts
|       |
|       |-- stores/
|       |   `-- overlay.store.ts
|       |
|       |-- types/
|       `-- styles/
|
`-- config/
    `-- config.example.json
```

Do not add premature abstractions beyond this structure unless implementation pressure requires them.

---

# 6. Runtime Modes

The HUD has two modes.

## 6.1 HUD Mode

Default state.

Requirements:

- Overlay visible.
- Transparent background.
- Mouse input passes through to The Isle.
- React may show small HUD indicators.
- Quests button may be visible, but interaction should normally be activated via hotkey in v0.1.
- The Isle remains the active gameplay target.

Native behavior:

```text
WS_EX_TRANSPARENT enabled
```

## 6.2 Interactive Mode

Activated by configurable hotkey.

Default hotkey for MVP:

```text
F6
```

Requirements:

- Overlay accepts mouse input.
- Quest panel is shown.
- React controls can be clicked.
- F6 or Escape exits interactive mode.

Native behavior:

```text
WS_EX_TRANSPARENT removed
```

When exiting interactive mode:

```text
WS_EX_TRANSPARENT restored
```

---

# 7. Phase 0 - Project Bootstrap

## Tasks

### Native

- Create root CMake project.
- Create `native` target named:

```text
TPNIsleControlHUD
```

- Configure C++20.
- Add Win32 subsystem executable.
- Add WebView2 SDK dependency.
- Add WIL dependency if needed.

### Frontend

Create Vite React TypeScript application.

Install:

```text
react
react-dom
typescript
vite
tailwindcss
shadcn
@tanstack/react-query
zustand
zod
```

Configure:

- Tailwind
- shadcn
- TypeScript strict mode
- Vite development server

## Acceptance Criteria

- Native executable builds.
- Frontend `npm run dev` starts.
- Frontend `npm run build` succeeds.
- No overlay functionality yet.

---

# 8. Phase 1 - The Isle Window Detection

Implement:

```text
GameWindowTracker
```

## Responsibilities

- Find The Isle top-level HWND.
- Verify the owning process executable.
- Track:
  - HWND
  - client bounds
  - minimized state
  - visible state
  - foreground state

Do not rely only on the window title.

Prefer process executable matching.

Candidate executable names should be configurable, for example:

```text
TheIsle-Win64-Shipping.exe
TheIsle.exe
```

Do not request unnecessary process permissions.

Use only the minimum query permissions required to identify the executable.

## Suggested API

```cpp
class GameWindowTracker
{
public:
    bool Find();
    void Update();

    [[nodiscard]] HWND GetWindow() const;
    [[nodiscard]] RECT GetClientScreenRect() const;

    [[nodiscard]] bool IsFound() const;
    [[nodiscard]] bool IsVisible() const;
    [[nodiscard]] bool IsMinimized() const;
    [[nodiscard]] bool IsForeground() const;

private:
    HWND gameWindow_{nullptr};
};
```

## Important

Convert The Isle's **client rectangle** to screen coordinates.

The overlay should follow the render/client area, not Windows borders.

## Acceptance Criteria

With The Isle running:

- tracker finds game window
- reports correct client position
- reports correct size
- handles moving the game window
- handles resizing
- handles minimizing/restoring
- handles game process closing

Without The Isle running:

- application remains stable
- no busy-loop
- waits for game to appear

---

# 9. Phase 2 - Transparent Overlay Window

Implement:

```text
OverlayWindow
```

## Window Requirements

Use a borderless Win32 popup.

Suggested base styles:

```cpp
WS_POPUP
```

Suggested extended styles:

```cpp
WS_EX_TOPMOST
WS_EX_LAYERED
WS_EX_TOOLWINDOW
WS_EX_NOACTIVATE
WS_EX_TRANSPARENT
```

Exact implementation may be adjusted if required for WebView2 composition.

## Responsibilities

- Create overlay HWND.
- Match game client rectangle.
- Stay above The Isle.
- Do not appear in Alt+Tab.
- Hide when:
  - The Isle is minimized
  - The Isle is closed
- Reappear when The Isle becomes available.
- Support:

```cpp
SetInteractive(bool enabled)
```

## Suggested API

```cpp
class OverlayWindow
{
public:
    bool Create(HINSTANCE instance);

    void SetBounds(const RECT& rect);
    void Show();
    void Hide();

    void SetInteractive(bool enabled);

    [[nodiscard]] HWND GetHandle() const;

private:
    HWND hwnd_{nullptr};
    bool interactive_{false};
};
```

## Interactive Switching

When `enabled == true`:

```text
remove WS_EX_TRANSPARENT
```

When `enabled == false`:

```text
add WS_EX_TRANSPARENT
```

Use `SetWindowLongPtr` and refresh frame/window state if required.

## Acceptance Criteria

- Transparent window follows The Isle.
- Does not steal gameplay input in HUD mode.
- Can be switched into interactive mode.
- Returns to click-through mode.
- Does not remain floating over desktop when game minimizes.

---

# 10. Phase 3 - Hotkey and Input State

Implement:

```text
InputManager
```

## MVP Behavior

F6:

```text
HUD mode -> Interactive mode
Interactive mode -> HUD mode
```

Escape:

```text
Interactive mode -> HUD mode
```

Do not intercept Escape globally while the overlay is not interactive.

## State

Native application owns authoritative overlay interaction state:

```cpp
enum class OverlayMode
{
    Hud,
    Interactive
};
```

## Acceptance Criteria

- F6 reliably toggles mode.
- HUD mode never blocks game input.
- Interactive mode receives mouse clicks.
- Escape closes interactive UI.

---

# 11. Phase 4 - WebView2 Host

Implement:

```text
WebViewHost
```

## Responsibilities

- Initialize WebView2 environment.
- Create controller/composition controller suitable for overlay usage.
- Attach to overlay window.
- Keep WebView bounds synchronized with overlay.
- Support transparent background.
- Navigate to frontend.

## Development Mode

Load:

```text
http://localhost:5173
```

when:

```json
{
  "development": true
}
```

## Production Mode

Load frontend assets locally.

Preferred approach:

Map local frontend directory to a virtual host, e.g.:

```text
https://app.tpn.local/
```

and navigate to:

```text
https://app.tpn.local/index.html
```

Avoid `file://` if possible.

Example release directory:

```text
TPNIsleControlHUD/
|-- TPNIsleControlHUD.exe
`-- ui/
    |-- index.html
    `-- assets/
```

## Transparency

React root/body background must remain transparent unless an individual component intentionally draws a surface.

## Acceptance Criteria

- React development page renders over The Isle.
- WebView background is transparent.
- Browser surface resizes with game.
- Production Vite build loads from disk.
- No visible browser chrome.

---

# 12. Phase 5 - Native / React Message Bridge

Even though API requests are made directly by React, expose a small WebView2 native bridge.

## React -> Native messages

Initial commands:

```text
overlay.closePanel
overlay.setInteractive
app.getVersion
app.exit
```

Example:

```ts
window.chrome.webview.postMessage({
  type: "overlay.setInteractive",
  value: false
});
```

## Native -> React messages

Initial events:

```text
overlay.modeChanged
game.connected
game.disconnected
game.foregroundChanged
```

Example:

```json
{
  "type": "overlay.modeChanged",
  "mode": "interactive"
}
```

## Requirements

- Validate message type.
- Ignore malformed messages.
- Never execute arbitrary strings or native commands.
- Use an explicit allow-list of message types.

## Acceptance Criteria

- React can request closing interactive mode.
- Native can notify React when game state changes.
- Invalid messages are safely ignored.

---

# 13. Phase 6 - React Application Foundation

Implement the frontend shell.

## App Structure

```tsx
<App>
  <HudLayer />
  <PanelLayer />
  <NotificationLayer />
</App>
```

### HudLayer

Later contains:

```text
Quest shortcut
Level indicator
Voice indicator
Minimap
```

For v0.1 only:

```text
Quest shortcut
```

### PanelLayer

v0.1:

```text
QuestPanel
```

Later:

```text
ProfilePanel
VoicePanel
SettingsPanel
```

## Global UI State

Use Zustand only for UI/client state.

Example:

```ts
type Panel = "none" | "quests" | "profile" | "voice" | "settings";

type OverlayStore = {
  interactive: boolean;
  panel: Panel;

  openPanel(panel: Panel): void;
  closePanel(): void;
};
```

Do not store remote quest data in Zustand.

Remote/server data belongs in TanStack Query.

## Acceptance Criteria

- App starts with transparent background.
- Quest panel can be opened/closed.
- Overlay state is separated from API state.

---

# 14. Phase 7 - API Client

The frontend directly calls TPN HTTP APIs.

Implement:

```text
frontend/src/services/api.ts
```

## Requirements

- Base URL from runtime/frontend configuration.
- JSON request helper.
- Standard error object.
- Abort signal support.
- Bearer token support.
- Do not hardcode admin/server API tokens in frontend source.

Example interface:

```ts
export type ApiError = {
  status: number;
  code?: string;
  message: string;
};
```

Example helper:

```ts
request<T>(
  path: string,
  options?: RequestInit
): Promise<T>
```

## Authentication Direction

Production player APIs should eventually be identity-based:

Preferred:

```http
GET /v1/me
GET /v1/me/quests
POST /v1/me/quests/:questId/claim
```

Avoid making the player UI depend on arbitrary Steam IDs:

```http
GET /quests/:steamId
```

The existing IsleControl bridge may still expose Steam-ID-based endpoints internally, but the public HUD API should use the authenticated player identity.

## Development Compatibility

Until the public TPN backend is available, permit an adapter/dev configuration that calls the existing quest bridge API.

Do not make that development path the final security model.

---

# 15. Phase 8 - Quests Data Model

Define frontend types matching current quest behavior.

Example:

```ts
export type QuestPeriod =
  | "daily"
  | "weekly"
  | "monthly";

export interface Quest {
  id: string;
  name: string;
  period: QuestPeriod;
  type: string;

  target: number;
  progress: number;

  rewardTokens: number;

  completed: boolean;
  claimed: boolean;

  window?: string;
}

export interface QuestResponse {
  tokenBalance: number;
  quests: Quest[];
}
```

## API Functions

Implement:

```ts
getQuests(): Promise<QuestResponse>
claimQuest(questId: string): Promise<ClaimQuestResult>
```

## TanStack Query

Implement hooks:

```text
useQuests
useClaimQuest
```

Initial polling interval:

```text
5 seconds
```

Recommended:

```ts
refetchInterval: 5000
```

Pause/refuse unnecessary polling if:

- game is disconnected
- app is shutting down

Future WebSocket support will replace most polling.

---

# 16. Phase 9 - Quest UI

Create:

```text
features/quests/
|-- components/
|   |-- QuestPanel.tsx
|   |-- QuestTabs.tsx
|   |-- QuestCard.tsx
|   |-- QuestProgress.tsx
|   `-- QuestReward.tsx
|
|-- hooks/
|   |-- useQuests.ts
|   `-- useClaimQuest.ts
|
|-- api/
|   `-- quests.api.ts
|
`-- types.ts
```

## Quest Panel

Tabs:

```text
Daily
Weekly
Monthly
```

Each card shows:

- quest name
- normalized progress
- progress label
- reward
- completion state
- claimed state
- claim button where appropriate

Example:

```text
Play for 30 minutes

██████████████░░░░
23 / 30 min

Reward: 100

[ Claim ]
```

## Progress Display

Do not display raw seconds for playtime quests if the UI knows how to format them.

Examples:

```text
1350 / 1800 seconds

->

22:30 / 30:00
```

Growth:

```text
0.75

->

75%
```

Kills:

```text
2 / 3
```

Formatting should be based on known quest type.

Fallback to generic numeric formatting for unknown types.

## Claim Rules

Button states:

```text
Incomplete:
disabled

Completed:
enabled

Claiming:
loading

Claimed:
disabled + "Claimed"
```

After successful claim:

- invalidate/refetch quests
- update token balance
- show toast

## Error Handling

Handle:

- network failure
- unauthorized
- not complete
- already claimed
- quest not found
- malformed API response

## Acceptance Criteria

- Current quest definitions can be displayed.
- Progress updates every polling interval.
- Completed quests can be claimed.
- Claimed state persists from API.
- Token balance updates.
- API errors do not crash HUD.

---

# 17. Phase 10 - HUD Styling

Use shadcn/ui primarily for component behavior.

Use custom TPN theme styling.

Design direction:

```text
dark
earthy
prehistoric
subtle transparency
low visual noise
minimal glow
game HUD rather than SaaS dashboard
```

Do not use large dashboard cards or generic admin-panel styling.

## Suggested shadcn Components

Use only where helpful:

```text
Button
Progress
Tabs
Tooltip
ScrollArea
Switch
Slider
Select
Dialog
Toast / Sonner
```

## Performance Rules

Avoid:

```text
full-screen backdrop-filter blur
continuous decorative animations
video backgrounds
large animated gradients
constant React state updates
60 FPS timers
```

Prefer:

```text
opacity
transform
simple transitions
small DOM
memoization only when profiling justifies it
```

---

# 18. Phase 11 - Configuration

Create:

```json
{
  "development": false,
  "frontendDevUrl": "http://localhost:5173",
  "apiUrl": "https://api.example.tpn",
  "overlayHotkey": "F6"
}
```

Development-only authentication may exist in local config, but:

- do not commit secrets
- add local config to `.gitignore`
- provide `config.example.json`

Future configuration fields:

```text
minimap
voice device IDs
push-to-talk
overlay opacity
HUD scale
```

---

# 19. Phase 12 - Logging

Native logging should include:

```text
application start
config load
The Isle found/lost
overlay created
WebView2 initialized
frontend navigation failures
hotkey registration failures
shutdown
```

Frontend logging should be minimal.

Do not log:

```text
access tokens
refresh tokens
API secrets
voice data
sensitive player session data
```

For development, WebView2 DevTools may be enabled.

For production, disable developer tools unless explicitly configured.

---

# 20. Phase 13 - Graceful Lifecycle

## Startup

```text
start EXE
  ->
load config
  ->
initialize native app
  ->
wait for The Isle
  ->
find The Isle
  ->
show overlay
  ->
initialize/navigate WebView2
```

The exact WebView2 initialization order may happen before finding the game if easier, but the overlay should remain hidden until appropriate.

## Game closes

```text
The Isle exits
  ->
hide overlay
  ->
React receives game.disconnected
  ->
wait for The Isle to return
```

Do not terminate TPN automatically unless configuration later requests it.

## Application shutdown

Cleanly:

- unregister hotkeys
- close WebView2 controller
- destroy overlay HWND
- release COM
- exit message loop

---

# 21. Phase 14 - Build Integration

## Development

Terminal A:

```bash
cd frontend
npm run dev
```

Native config:

```json
{
  "development": true,
  "frontendDevUrl": "http://localhost:5173"
}
```

Run:

```text
TPNIsleControlHUD.exe
```

WebView2 loads Vite.

## Release

Run:

```bash
cd frontend
npm run build
```

Copy:

```text
frontend/dist/*
```

to:

```text
release/ui/
```

Release layout:

```text
release/
|-- TPNIsleControlHUD.exe
|-- config.json
`-- ui/
    |-- index.html
    `-- assets/
```

Add a CMake custom command later to automatically run/copy frontend build artifacts.

Do not make that part of the first native bootstrap commit if it slows initial implementation.

---

# 22. Phase 15 - WebView2 Runtime Deployment

Use WebView2 Evergreen Runtime.

Installer/startup must detect whether a compatible runtime exists.

If missing:

- show a clear error
- later provide bootstrap installer integration

Do not bundle Fixed Version WebView2 for v0.1.

---

# 23. Future Phase - Authentication

Do not fully implement unless backend support exists.

Target design:

```text
TPNIsleControlHUD
     |
     | login/session
     v
TPN Backend
     |
     v
short-lived player access token
```

Public player API:

```http
GET /v1/me
GET /v1/me/quests
POST /v1/me/quests/:id/claim
```

The frontend may perform HTTP calls directly.

Do not put server administration API keys in the React bundle.

---

# 24. Future Phase - Level System

Target API:

```http
GET /v1/me/profile
```

Example:

```json
{
  "steamId": "76561198000000000",
  "displayName": "Player",
  "level": 17,
  "xp": 12450,
  "currentLevelXp": 450,
  "nextLevelXp": 600,
  "tokens": 320
}
```

Frontend:

```text
features/level/
features/profile/
```

HUD example:

```text
LV 17
██████████████░░
450 / 600 XP
```

XP calculation must remain server-authoritative.

---

# 25. Future Phase - Realtime WebSocket

Add:

```text
WSS /v1/realtime
```

Possible events:

```text
quest.progress
quest.completed
profile.xpChanged
profile.levelChanged
player.position
server.notification
voice.state
```

When quest events arrive:

- update TanStack Query cache
- avoid unnecessary REST polling

Do not implement WebSocket in v0.1 unless required by backend.

---

# 26. Future Phase - Minimap

Frontend owns minimap rendering.

Backend owns player position data.

Do not obtain coordinates by reading game-client memory.

Target state:

```ts
interface MapState {
  x: number;
  y: number;
  z?: number;
  heading?: number;
}
```

Possible future UI:

```text
Minimap
- map background
- local player marker
- heading
- allowed teammate markers
- allowed POIs
```

Prefer WebSocket position updates.

Suggested frequency:

```text
5-10 updates/sec maximum
```

Do not tie React rendering to 60 Hz unless profiling demonstrates a need.

---

# 27. Future Phase - Proximity Voice

React owns only voice UI/settings.

Native C++ should eventually own:

```text
microphone capture
audio playback
device enumeration
Opus/WebRTC integration
push-to-talk
mute/deafen
audio mixing
```

Suggested architecture:

```text
React Voice UI
      |
      | WebView2 native messages
      v
Native VoiceEngine
      |
      v
TPN Voice Service
```

Proximity authorization should use server-authoritative player positions.

Do not trust the HUD to claim its own coordinates.

---

# 28. Security Requirements

Always maintain these rules.

## Client Process Boundary

TPN HUD must not:

```text
inject DLLs
hook graphics APIs
modify game memory
read gameplay memory
patch The Isle
```

## API

- HTTPS in production.
- WSS in production.
- Do not commit credentials.
- Do not expose server admin tokens to the frontend.
- Player endpoints should use player identity.
- Validate API payloads.

Use Zod where useful for responses crossing trust boundaries.

## WebView

- Do not expose unrestricted native execution to JavaScript.
- Native bridge must use an allow-list.
- Avoid enabling unnecessary browser permissions.
- Disable production DevTools by default.
- Do not navigate arbitrary untrusted URLs.

---

# 29. Performance Requirements

The HUD exists alongside a demanding game.

Treat low resource usage as a product requirement.

## API

Quests:

```text
5 second polling initially
```

Profile later:

```text
30-60 second polling
```

Realtime features should migrate to WebSocket.

## React

Avoid unnecessary component rerenders.

Do not build continuous animation loops for static UI.

## CSS

Avoid expensive full-screen effects.

Especially avoid large:

```css
backdrop-filter: blur(...)
filter: blur(...)
```

over the entire game.

## Native

Avoid high-frequency window polling if Win32 events/hooks can solve the same problem reliably.

If polling is used initially, use a reasonable interval.

Example:

```text
50-100 ms while game exists
250-1000 ms while searching
```

Profile before optimizing further.

---

# 30. v0.1 Definition of Done

The first usable version must satisfy all items below.

## Windows

- [ ] `TPNIsleControlHUD.exe` launches normally.
- [ ] Finds The Isle automatically.
- [ ] Creates a transparent overlay.
- [ ] Tracks game position and size.
- [ ] Hides when The Isle minimizes.
- [ ] Recovers when The Isle restores.
- [ ] Does not appear in Alt+Tab.
- [ ] HUD mode is mouse click-through.
- [ ] F6 enables interactive mode.
- [ ] F6 closes interactive mode.
- [ ] Escape closes interactive mode.

## WebView2

- [ ] WebView2 initializes successfully.
- [ ] Transparent React UI renders over game.
- [ ] Development mode loads Vite.
- [ ] Production mode loads local build.
- [ ] WebView resizes with game client area.

## Frontend

- [ ] React + TypeScript works.
- [ ] Tailwind works.
- [ ] shadcn/ui works.
- [ ] TanStack Query configured.
- [ ] Zustand configured for UI state only.

## Quests

- [ ] Fetch quests from API.
- [ ] Daily tab.
- [ ] Weekly tab.
- [ ] Monthly tab.
- [ ] Quest progress.
- [ ] Quest rewards.
- [ ] Completion status.
- [ ] Claim action.
- [ ] Claimed status.
- [ ] Token balance.
- [ ] Loading UI.
- [ ] Retry/error UI.
- [ ] Claim success toast.

## Safety

- [ ] No game DLL injection.
- [ ] No DirectX hooks.
- [ ] No process memory reads.
- [ ] No process memory writes.
- [ ] No server/admin API key embedded in React source.

---

# 31. Implementation Order for Codex

Codex should implement in this exact order unless a dependency forces a small deviation.

```text
1. inspect repository
2. bootstrap root/native/frontend structure
3. make native Win32 executable build
4. make React/Vite app build
5. implement GameWindowTracker
6. implement OverlayWindow
7. implement F6 interaction toggle
8. integrate WebView2
9. make WebView transparent
10. load Vite dev frontend
11. load local production frontend
12. implement small native message bridge
13. configure React/Tailwind/shadcn
14. configure TanStack Query/Zustand
15. implement API client
16. implement quest API adapter
17. implement QuestPanel
18. implement claim workflow
19. polish game lifecycle behavior
20. build/release integration
21. document setup and development commands
```

After every major step:

- build native project
- build frontend
- run available tests
- fix compiler/linter errors before continuing

Do not leave the repository in a knowingly broken state between major milestones.

---

# 32. Codex Working Rules

When implementing this plan:

1. Inspect existing files before changing architecture.
2. Reuse existing project conventions where sensible.
3. Prefer small focused commits/changes.
4. Do not invent game-memory integrations.
5. Do not add injection/hooking dependencies.
6. Do not implement future modules unless needed for a clean interface.
7. Keep frontend API code decoupled from the native host.
8. Keep the WebView2 native bridge minimal.
9. Do not place privileged API secrets in frontend code.
10. Keep UI responsive at common game resolutions.
11. Avoid fixed pixel assumptions for the whole HUD.
12. Use strong TypeScript types.
13. Handle API/network failures without crashing.
14. Build after meaningful changes.
15. Update README with actual commands and prerequisites.
16. If WebView2 transparency requires changing the original HWND design, preserve the external-overlay/security constraints and document the decision.
17. When unsure about a Windows/WebView2 API detail, verify against current Microsoft WebView2 documentation before introducing workarounds.

---

# 33. Initial Backend Compatibility

The current IsleControl quest backend already conceptually provides:

```text
GET player quests
POST claim quest
token balance
quest progress
daily / weekly / monthly windows
```

For the MVP, create the frontend API layer so the endpoint mapping can be switched later without changing React components.

For example:

```ts
interface QuestApi {
  getQuests(): Promise<QuestResponse>;
  claimQuest(id: string): Promise<ClaimQuestResult>;
}
```

Implement an initial REST adapter.

Later the adapter may switch from:

```text
/quests/:steam
```

to:

```text
/v1/me/quests
```

without changing `QuestPanel`, `QuestCard`, or query hooks.

---

# 34. Final Target After v0.1

Do not build this entire diagram now; use it to preserve architectural direction.

```text
                       TPN Backend
                HTTP / WebSocket / Voice
                         |
         +---------------+---------------+
         |               |               |
       Quests          Levels         Positions
         |               |               |
         +---------------+---------------+
                         |
                         v
              TPNIsleControlHUD.exe
              =====================
                     C++ Host
         +---------------+---------------+
         |               |               |
     Win32 Overlay    WebView2       VoiceEngine
                         |
                         v
                  React / TypeScript
         +---------------+---------------+
         |               |               |
       Quests          Level          Minimap
                                         |
                                      Voice UI
                         |
                         v
                      Player

TheIsle.exe remains a separate, untouched process.
```
