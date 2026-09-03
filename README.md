# TPN Isle Server

TPN Isle Server is a server-control and player-experience stack for **The Isle:
EVRIMA**. It connects an UE4SS server mod to a PostgreSQL-backed bridge, a
Next.js web application, and an external Win32/CEF HUD.

The project provides Steam sign-in, live player and dinosaur state, quests and
token rewards, a live minimap, administrative game commands, and automatic HUD
updates, with faction and territory systems under active development.

> [!NOTE]
> This project is still under development. Proximity voice chat is not yet
> implemented, and the territory features are not complete.

## Architecture

![TPN Isle Server architecture](docs/images/flowchart.png)

The preferred game transport is batched HTTP over loopback. If the native
transport is unavailable, the mod and bridge can fall back to NDJSON files.
PostgreSQL remains the authoritative durable store in either mode.

## Repository layout

| Path | Purpose |
| --- | --- |
| `tpn-dino/` | Next.js 16 web application and authenticated player/HUD API |
| `TPNIsleControl/bridge/` | Node.js bridge, PostgreSQL schema, quest definitions, and tests |
| `TPNIsleControl/native/` | Native WinHTTP transport module for UE4SS |
| `TheIsle/Binaries/Win64/ue4ss/` | UE4SS configuration and Lua game-server mod |
| `TPNIsleControlHUD/frontend/` | React/Vite HUD interface |
| `TPNIsleControlHUD/native/` | Win32/CEF overlay host and updater |
| `deploy/windows/` | Production packaging and Windows Task Scheduler scripts |
| `docs/` | Design notes, plans, calibration, and implementation documentation |

## Prerequisites

For web and bridge development:

- Node.js 20 or newer and npm
- PostgreSQL 16 or newer

For the Windows game-server and HUD components:

- Windows 10/11 or Windows Server
- Visual Studio 2022 with **Desktop development with C++**
- CMake 3.24 or newer
- A compatible The Isle dedicated server and UE4SS installation

The native game transport currently targets the UE4SS build documented in
[`TPNIsleControl/native/README.md`](TPNIsleControl/native/README.md). Revalidate
the ABI before using another UE4SS version.

## Local development

### 1. Configure PostgreSQL

Create a database and a restricted application user, then expose its connection
string to the bridge:

```bash
export DATABASE_URL="postgresql://user:password@127.0.0.1:5432/tpnislecontrol"
```

The bridge applies its idempotent schema from
`TPNIsleControl/bridge/sql/001_initial.sql` during startup. See the
[PostgreSQL setup guide](TPNIsleControl/docs/POSTGRESQL_SETUP.md) for the full
Windows installation, backup, and restore procedure.

### 2. Start the bridge

```bash
cd TPNIsleControl/bridge
cp config.example.json config.json
npm ci
npm start
```

Update `config.json` with the absolute UE4SS mod `Saved` directory and replace
the example API token. The bridge listens on `127.0.0.1:31990` by default.
Confirm it is ready with:

```bash
curl http://127.0.0.1:31990/health
```

### 3. Start the web application

```bash
cd tpn-dino
cp .env.example .env.local
npm ci
npm run dev
```

Set `DATABASE_URL`, `QUEST_API_TOKEN`, `SESSION_SECRET`,
`HUD_ACCESS_TOKEN_SECRET`, and the public/HUD origins in `.env.local`. The
`QUEST_API_TOKEN` value must match the bridge's `apiToken`. Add a
`STEAM_WEB_API_KEY` when testing Steam profile enrichment.

Open [http://localhost:3000](http://localhost:3000).

### 4. Run the HUD frontend

The UI-only mode uses mock data and does not require Steam authentication or a
running game:

```bash
cd TPNIsleControlHUD/frontend
npm ci
npm run dev:ui
```

Open [http://localhost:5173](http://localhost:5173). Use `npm run dev` instead
to exercise the normal authentication and game-presence gates. Native host
configuration and packaging are covered in the
[HUD guide](TPNIsleControlHUD/README.md).

## Validation commands

Run each command from its package directory.

| Component | Commands |
| --- | --- |
| Web app | `npm test`, `npm run lint`, `npm run build` |
| Bridge | `npm test` |
| HUD frontend | `npm test`, `npm run lint`, `npm run build` |

Bridge PostgreSQL integration tests run only when `TEST_DATABASE_URL` points to
a disposable database. Without it, the unit suite still runs and reports the
integration tests as skipped.

## Building native components

Build the UE4SS WinHTTP module from a Visual Studio Developer PowerShell:

```powershell
cd TPNIsleControl/native
cmake -B build -G "Visual Studio 17 2022"
cmake --build build --config Release
```

Copy the resulting DLL to
`TheIsle\Binaries\Win64\ue4ss\Mods\TPNIsleControl\dlls\main.dll` only after
confirming that it loads against the installed UE4SS version.

The HUD host is a separate, non-injecting Win32/CEF process. Follow the
[HUD native build and release instructions](TPNIsleControlHUD/README.md) for
CEF configuration, compiled settings, packaging, and updater behavior.

## Production deployment

Production deployment keeps the game installation and persistent data on the
server while packaging only the bridge and standalone Next.js runtime. From a
Windows checkout:

```powershell
.\deploy\windows\Deploy-TPNIsleServer.ps1 -DestinationRoot D:\TheIsleServer
```

Complete the host configuration and register startup tasks using the
[Windows deployment guide](deploy/windows/README.md). Keep the bridge and
PostgreSQL bound to loopback; expose only the HTTPS reverse proxy.

## Configuration and security

- Never commit `.env.local`, `bridge/config.json`, database URLs, Steam keys,
  signing secrets, or API tokens.
- Use separate random values for the bridge API token, web session secret, HUD
  access-token secret, and optional game token.
- Never embed the administrative bridge token in the HUD frontend or native
  host.
- Keep bridge port `31990` and PostgreSQL port `5432` off the public internet.
- Back up PostgreSQL with `pg_dump`; NDJSON transport files are not backups.

Tracked `config.example.json` and `.env.example` files document all supported
settings.

## Documentation

- [Bridge API reference](TPNIsleControl/docs/API.md)
- [Game/bridge protocol](TPNIsleControl/docs/PROTOCOL.md)
- [PostgreSQL setup and operations](TPNIsleControl/docs/POSTGRESQL_SETUP.md)
- [Native UE4SS transport](TPNIsleControl/native/README.md)
- [HUD development and packaging](TPNIsleControlHUD/README.md)
- [Windows server deployment](deploy/windows/README.md)

## AI Agents

AI coding agents must read and follow [`AGENTS.md`](AGENTS.md) before changing
the repository. In particular:

- Use GitNexus to explore unfamiliar code and run upstream impact analysis
  before editing any function, class, method, or other indexed symbol.
- Warn before proceeding with a change that GitNexus classifies as HIGH or
  CRITICAL risk.
- Use graph-aware rename tooling instead of text replacement when renaming
  symbols.
- Preserve unrelated worktree changes and never add secrets or generated
  runtime data to the repository.
- Add focused regression coverage and run the relevant component tests, lint,
  and build commands for behavioral changes.
- Run GitNexus `detect_changes` before creating a commit to confirm that only
  the intended symbols and execution flows were affected.

## Contributing

Keep changes scoped, add regression tests for behavior changes, and run the
relevant validation commands before opening a pull request. Use Conventional
Commit prefixes such as `feat:`, `fix:`, and `refactor:`. Include configuration
impact, validation results, and screenshots for web or HUD interface changes.
