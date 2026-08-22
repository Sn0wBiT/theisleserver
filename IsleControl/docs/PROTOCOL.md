# IsleControl IPC protocol

The game-process side and the external sidecar communicate through NDJSON files.
For the bridge's HTTP endpoints and complete game-command catalog, see
[API.md](./API.md).

## Snapshots

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

## Commands

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

## Player quest requests

When a player enters `/quests` in client chat, the game-process mod appends a
request to `events.ndjson`:

```json
{
  "type": "quest_request",
  "ts": 1777000000,
  "steam": "76561198000000000"
}
```

The sidecar reads the player's current quest windows and token balance, formats
all available quests, and queues a private `notify` command for that player.
Requests older than 30 seconds are ignored so restarting the sidecar does not
replay old chat responses.

## Results

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

## Native hit observations

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
