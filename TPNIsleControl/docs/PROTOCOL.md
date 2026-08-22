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

The bridge keeps live snapshots and pending commands in memory. Only aggregated
quest progress, token balances, and minimal last-snapshot state are persisted.
Multiple quest changes in one HTTP batch produce one atomic state-file write.

Commands are returned as NDJSON and are retained by the bridge until Lua sends
their IDs in `acknowledgements`. Lua also deduplicates command IDs for one hour.

With `gameTransport` set to `auto`, the bridge sends commands over HTTP after a
recent game sync and otherwise uses `commands.ndjson`. This permits safe rollout
and automatic fallback while the game server is restarting.

## File fallback

### Snapshots

`events.ndjson`

```json
{
  "type": "snapshot",
  "ts": 1777000000,
  "steam": "76561198000000000",
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

`/help` produces the same shape with `"type":"help_request"`.

The sidecar reads the player's current quest windows and token balance, formats
all available quests, and queues a `notify` command for that player.
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
