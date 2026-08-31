# Repository Guidelines

## Project Structure & Module Organization

`tpn-dino/` is the Next.js 16 web app and API; routes live under `app/`, shared logic under `lib/`, and assets under `public/`. `TPNIsleControl/bridge/` contains the Node.js/PostgreSQL bridge (`src/`, `test/`, and `sql/`). The UE4SS Lua mod lives under `TheIsle/Binaries/Win64/ue4ss/`. `TPNIsleControlHUD/frontend/` is the React/Vite overlay, while `TPNIsleControlHUD/native/` is its Win32/CEF host. Deployment scripts are in `deploy/windows/`; plans are in `docs/`.

## Build, Test, and Development Commands

Run commands from the relevant package directory:

- `cd tpn-dino && npm ci && npm run dev` starts the web app at `localhost:3000`.
- `cd tpn-dino && npm test && npm run lint && npm run build` validates the Next.js service.
- `cd TPNIsleControl/bridge && npm ci && npm test` runs Node's built-in test suite; `npm start` launches the bridge.
- `cd TPNIsleControlHUD/frontend && npm ci && npm run dev:ui` opens the HUD with development mock data.
- `cd TPNIsleControlHUD/frontend && npm test && npm run lint && npm run build` validates and bundles the overlay.
- From Visual Studio Developer PowerShell, run `TPNIsleControlHUD/scripts/build.ps1` for a complete native HUD build. Build the native mod with CMake as documented in `TPNIsleControl/native/README.md`.

## Coding Style & Naming Conventions

Use two-space indentation in TypeScript/JavaScript, ES modules, double quotes, and configured trailing commas. React components use PascalCase; functions, variables, and hooks use camelCase; route folders use lowercase URL segments. C++ types use PascalCase, with declarations in `.hpp` and implementations in `.cpp`. Run ESLint before submitting.

## Testing Guidelines

Vitest covers `tpn-dino` and the HUD frontend; the bridge uses `node:test`. Name tests `*.test.ts`, `*.test.tsx`, or `*.test.js`, colocating frontend/API tests near their subject and bridge tests under `bridge/test/`. Add focused regression coverage for behavior changes. Integration tests requiring PostgreSQL may depend on local environment configuration.

## Commit & Pull Request Guidelines

Recent history generally follows Conventional Commit prefixes such as `feat:`, `fix:`, and `refactor:`. Keep subjects imperative and scoped to one change. Pull requests should explain behavior and configuration impacts, list validation commands, link relevant issues or plans, and include screenshots for HUD or web UI changes. Never commit secrets from `.env.local`, `bridge/config.json`, tokens, database URLs, or generated runtime data.

## Agent-Specific Instructions

Use GitNexus before code edits: run upstream impact analysis for every changed symbol, warn before HIGH or CRITICAL-risk edits, and run `detect_changes` before committing. Do not use text replacement to rename symbols; use graph-aware rename tooling.
