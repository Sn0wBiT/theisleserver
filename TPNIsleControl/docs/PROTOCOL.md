# TPNIsleControl game/bridge protocol

The preferred transport is batched HTTP over loopback. A native UE4SS C++ mod
uses WinHTTP on a worker thread, leaving all Unreal object access on the game
thread. NDJSON files remain available as an automatic fallback if the native
transport cannot load or configure.

For the bridge's HTTP endpoints and complete game-command catalog, see
[API.md](./API.md).

## Batched HTTP transport

Every snapshot interval, Lua submits all online player snapshots in one call to
`POST /game/sync`. Chat and combat events use the same endpoint. The native
worker retries requests without blocking the game thread and queues response
commands for Lua to poll.

While HTTP transport is active, Lua also submits lightweight dinosaur position
updates every `positionIntervalMs` (100 ms by default). These contain the Steam
ID, dinosaur ID, and Unreal `x`, `y`, and `z` coordinates. The bridge caches them
for latency-sensitive consumers and batches them into `tpn_dinosaur_positions`.

The bridge keeps live snapshots in memory. Pending HTTP commands are mirrored to
a private journal under `modSavedDir`, while player,
dinosaur, position, quest, token, faction, and territory state is persisted in
PostgreSQL. PostgreSQL setup is documented in
[POSTGRESQL_SETUP.md](./POSTGRESQL_SETUP.md).

Commands are returned as NDJSON and are retained by the bridge until Lua sends
their IDs in `acknowledgements`. Lua also deduplicates command IDs for one hour.

With `gameTransport` set to `auto`, the bridge sends commands over HTTP after a
recent game sync. After 30 seconds without a sync it appends queued commands to
`commands.ndjson` and removes them from the HTTP journal only after that append
succeeds. Command IDs are preserved for game-side deduplication. The pending HTTP
queue is bounded by `maxPendingHttpCommands` (default `1000`).

## File fallback

### Snapshots

`events.ndjson`

```json
{
  "type": "snapshot",
  "ts": 1777000000,
  "steam": "76561198000000000",
  "dinosaurId": "persistent-character-id",
  "addr": "0x000001ABCDEF0000",
  "species": "BlueprintGeneratedClass /Game/...",
  "growth": 0.75,
  "pos": {"x": 1, "y": 2, "z": 3},
  "vitals": {
    "hp": 900,
    "hpMax": 1000,
    "hunger": 50,
    "hungerMax": 100,
    "thirst": 400,
    "thirstMax": 1000,
    "stamina": 500,
    "staminaMax": 600,
    "food": 100,
    "foodMax": 600
  }
}
```

`dinosaurId` is optional for compatibility, but it must be a stable identifier
from the game or dinosaur-slot system to persist more than one dinosaur per
player correctly. Snapshots without it use the single `legacy` slot. A pawn
address is process-local and must not be used as a persistent dinosaur ID.

### Commands

`commands.ndjson`

```json
{
  "id": "uuid",
  "ts": 1777000000,
  "verb": "setgrowth",
  "steam": "76561198000000000",
  "args": {"value": 0.8}
}
```

### Player chat requests

When file fallback is active, the game-process mod appends player chat requests
to `events.ndjson`. `/quests` produces:

```json
{
  "type": "quest_request",
  "ts": 1777000000,
  "steam": "76561198000000000"
}
```

`/help` produces the same shape with `"type":"help_request"`. To start a
quest, a player uses `/accept <quest-id>`; it produces a `quest_accept` event
with a `questId` field. The bridge only advances accepted quests.

The sidecar reads the player's current quest windows and token balance, formats
the requested quest page, and queues a `notify` command for that player.
If the list spans multiple pages, the notification includes the next `/quests`
command.
Help requests similarly return the current player command list.
Requests older than 30 seconds are ignored so restarting the sidecar does not
replay old chat responses.

### Results

`results.ndjson`

```json
{
  "id": "uuid",
  "ts": 1777000001,
  "verb": "setgrowth",
  "steam": "76561198000000000",
  "ok": true,
  "msg": "growth set to 0.800"
}
```

### Native hit observations

`native-events.ndjson`

```json
{
  "type": "damage_hit",
  "ts": 1777000000,
  "attacker_addr": "0x0000011111111111",
  "target_addr": "0x0000022222222222"
}
```

The sidecar correlates addresses from the native hit stream with the `addr` value in recent player snapshots.

A victim health transition `> 0` to `<= 0` within `combatWindowSec` of the last direct hit is treated as a player kill by the last hitter.

`TPNIsleControl` also hooks `TICharacterBase:ApplyDamage`. Its post-hook emits
an `ai_dinosaur_death` observation when the damaged character reaches zero
health. The bridge ignores player addresses, attributes the remaining death to
the latest player hit, and increments accepted `ai_dinosaur_kills` quests.
Only species listed in `bridge/ai-dinosaurs.json` are eligible; each entry is
matched against the target's Unreal class name.
## Territory activity

The game may send `territory_activity` records through HTTP sync or the NDJSON
fallback. Each record contains `event_id`, `steam`, `zone_id`,
`activity_type`, `points`, and `ts`. The bridge validates membership and zone
existence, then writes the idempotent ledger event and territory state in one
PostgreSQL transaction. Replaying the same `event_id` is safe and does not add
influence twice. PostgreSQL is authoritative; NDJSON is transport only.

Territory ownership is a fixed lease. Owner activity records influence but does
not extend the expiry or create another capture event. Expiry clears ownership,
capture timestamps, total influence, and per-faction influence, so recapture
starts from zero.
