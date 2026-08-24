# Replace the Bridge with the Next.js Game Backend

## Summary

Move all bridge responsibilities into the self-hosted Next.js 16 Node server running on the same Windows host as The Isle. Use PostgreSQL as the sole state store, HTTP as the sole game transport, and deploy a new protocol and empty game dataset in one coordinated cutover. Preserve the existing HUD response shapes while removing the standalone bridge package, file IPC, and bridge proxy calls.

## Implementation Changes

- Before editing, regenerate the missing GitNexus index, query the game-sync and quest flows, and run upstream impact analysis for every affected symbol. Report any HIGH or CRITICAL blast radius before continuing.
- Add a Node-runtime `POST /api/internal/game/sync` route protected by `GAME_SYNC_TOKEN`. Require protocol version `2` and a native-generated UUID batch ID that remains stable across retries.
- Keep the bounded batch model: snapshots, positions, events, command acknowledgements, and command results. Continue returning pending commands as NDJSON so Lua can process one command per line.
- Process each new batch in one PostgreSQL transaction: record its ID, acknowledge commands, store results, update snapshots and positions, evaluate quest and combat events, and enqueue response commands. Duplicate batch IDs skip mutations but still return currently pending commands.
- Replace in-memory bridge state with game-domain tables for processed batches, players and dinosaurs, latest positions, quest progress, token balances, recent combat observations, queued commands, and command results. Add retention cleanup for processed batches and expired combat observations.
- Reimplement quest reads, acceptance, progress, and claims as concurrency-safe SQL-backed services. Claiming must lock the quest row and credit tokens exactly once. Move quest and approved AI-species definitions into the Next.js project.
- Change the existing HUD quest routes and server-rendered page to call the new database services directly. Remove `QUEST_API_URL` and `QUEST_API_TOKEN`; keep existing public response and error shapes.
- Replace the minimap's bridge-proxy SSE route with a local position stream: authenticate the player, subscribe before reading their latest PostgreSQL position, emit updates after sync transactions commit, send heartbeats, and reconnect cleanly after a Next.js restart.
- Add admin-token-protected Next.js endpoints for backend health, player inspection, arbitrary-player quest operations, command queueing, and command-result inspection. Keep the internal sync path blocked by the public reverse proxy as defense in depth.
- Update the native transport to attach protocol and stable batch-ID headers. Update Lua to use HTTP only, buffer command results into the next sync batch, and remove file fallback, file polling, and NDJSON result writing.
- Keep the native transport restricted to loopback and point it to `http://127.0.0.1:3000/api/internal/game/sync`.
- Add a migration runner and a fresh game-backend migration. Recreate only game and bridge-domain tables with empty data; preserve the independent HUD authentication tables.
- Add supervised Windows start and stop scripts for the production Next.js process, start it before The Isle, and remove bridge startup references. Delete the bridge package and obsolete bridge configuration after parity tests pass within the same release.
- Rewrite the API, protocol, and deployment documentation around Next.js, PostgreSQL, the v2 sync contract, required secrets, build and migration commands, and the HTTP-only failure model.

## Public Interfaces

- Game sync headers: `Authorization: Bearer ...`, `X-TPN-Protocol-Version: 2`, and `X-TPN-Batch-Id: <uuid>`.
- Game sync body: `{ snapshots, positions, events, acknowledgements, results }`, retaining current limits and the 1 MiB maximum.
- Game sync response: `application/x-ndjson`; commands remain pending until acknowledged.
- HUD quest and minimap URLs and response schemas remain unchanged.
- Admin APIs move under `/api/admin/game/*` and require `ADMIN_API_TOKEN`.
- Health reports database availability, last successful sync, active-player count, oldest pending command, and queue and result counts without exposing secrets.

## Test and Cutover Plan

- Unit-test batch validation, quest windows, acceptance requirements, progress calculation, combat attribution, command and result serialization, and admin authentication.
- Run PostgreSQL integration tests for duplicate-batch replay, transaction rollback, concurrent claims, durable commands across restart, acknowledgements, result deduplication, and cleanup retention.
- Test SSE initial snapshots, player isolation, committed updates, heartbeats, disconnect cleanup, and reconnect after a Next.js restart.
- Build and test the Lua and native transport for stable retry IDs, HTTP failure retries, command deduplication, result delivery, invalid tokens, and oversized responses.
- Run the existing Next.js lint, tests, type validation, and production build plus the native C++ build.
- In one maintenance window: stop the game and bridge, back up configuration, deploy the updated Next.js, native, and Lua bundle, reset and migrate game tables, configure tokens and the loopback URL, start Next.js, verify health, then start The Isle and exercise snapshot, quest, position, command, acknowledgement, and result flows.
- Run GitNexus `detect_changes` against `main` before any commit and confirm only the expected game-sync, quest, minimap, transport, startup, and documentation flows changed.

## Assumptions

- Next.js is a single persistent Node process on the game's Windows host, reached publicly through the existing HTTPS reverse proxy.
- This is a clean game-backend start: no bridge data, JSON state, quest progress, balances, commands, or results are imported.
- Old mod builds and the v1 and file protocols are intentionally unsupported after cutover.
- PostgreSQL and Next.js must be available for gameplay integrations; transient failures are handled by the native HTTP retry queue.
