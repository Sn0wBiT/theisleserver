# TPNIsleControl API reference

The TPNIsleControl bridge exposes an HTTP JSON API for inspecting live players,
tracking and claiming quests, and queuing commands for the UE4SS game mod.
The bridge and game mod communicate through batched localhost HTTP, with the
file protocol retained as an automatic fallback, as described in
[PROTOCOL.md](./PROTOCOL.md).

## Connection

The default base URL is:

```text
http://127.0.0.1:31990
```

The host and port come from `bridge/config.json`. The bridge does not provide
TLS, so keep it bound to localhost or place it behind a trusted HTTPS reverse
proxy.

Responses use `application/json; charset=utf-8`, except successful game sync
responses, which use `application/x-ndjson; charset=utf-8`.

## Authentication

Every administrative endpoint except `GET /health` requires the token from the bridge's
`apiToken` configuration value:

```http
Authorization: Bearer YOUR_API_TOKEN
```

An absent, disabled, or incorrect token produces:

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json; charset=utf-8

{
  "ok": false,
  "error": "unauthorized"
}
```

The examples below assume these shell variables:

```bash
BASE_URL=http://127.0.0.1:31990
API_TOKEN=YOUR_API_TOKEN
STEAM_ID=76561198000000000
```

## Endpoint summary

| Method | Path | Authentication | Success |
| --- | --- | --- | --- |
| `GET` | `/health` | No | `200` |
| `POST` | `/game/sync` | Loopback or game bearer token | `200` |
| `GET` | `/players` | Bearer token | `200` |
| `GET` | `/quests/{steam}` | Bearer token | `200` |
| `POST` | `/quests/{steam}/claim/{questId}` | Bearer token | `200` |
| `POST` | `/command` | Bearer token | `202` |
| `GET` | `/results` | Bearer token | `200` |

Unknown routes return `404` after authentication:

```json
{
  "ok": false,
  "error": "not-found"
}
```

## Game synchronization

### `POST /game/sync`

The native UE4SS WinHTTP transport sends one batch containing all current
player snapshots, discrete game events, and command acknowledgements. This
endpoint is accepted from loopback when `gameToken` is empty. If `gameToken`
is configured, it requires that bearer token instead.

```json
{
  "snapshots": [
    {"steam":"76561198000000000","ts":1777000000,"growth":0.75}
  ],
  "events": [
    {"type":"quest_request","steam":"76561198000000000","ts":1777000000},
    {"type":"help_request","steam":"76561198000000000","ts":1777000000}
  ],
  "acknowledgements": ["previous-command-id"]
}
```

The response uses `application/x-ndjson`. Each line is a pending command. A
command remains pending until its ID appears in a later `acknowledgements`
array. An empty response means there are no commands.

The request body is limited to 1 MiB, 500 snapshots, 1,000 events, and 1,000
acknowledgements.

## Health

### `GET /health`

Checks whether the bridge is running. This is the only public endpoint.

```bash
curl "$BASE_URL/health"
```

Response:

```json
{
  "ok": true,
  "players": 2,
  "gameTransport": "auto",
  "httpConnected": true,
  "lastHttpSyncAt": 1787410000000,
  "eventsPath": "C:\\theisleserver\\TheIsle\\Binaries\\Win64\\ue4ss\\Mods\\TPNIsleControl\\Saved\\events.ndjson",
  "nativeEventsPath": "C:\\theisleserver\\TheIsle\\Binaries\\Win64\\ue4ss\\Mods\\TPNIsleControl\\Saved\\native-events.ndjson"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `ok` | boolean | Always `true` when the bridge answers. |
| `players` | integer | Number of Steam IDs with a snapshot in bridge memory. |
| `gameTransport` | string | Configured command transport mode. |
| `httpConnected` | boolean | Whether a game sync arrived in the last 15 seconds. |
| `lastHttpSyncAt` | integer or null | Unix time in milliseconds of the latest HTTP game sync. |
| `eventsPath` | string | Configured absolute snapshot-event file path. |
| `nativeEventsPath` | string | Configured absolute native-event file path. |

`players` is not an active connection count. The bridge retains the latest
snapshot for each Steam ID until it restarts.

## Players

### `GET /players`

Returns the most recent in-memory snapshot for every observed player.

```bash
curl -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/players"
```

Response:

```json
{
  "players": [
    {
      "type": "snapshot",
      "ts": 1777000000,
      "steam": "76561198000000000",
      "addr": "0x1ABCDEF0000",
      "species": "BlueprintGeneratedClass /Game/...",
      "growth": 0.75,
      "pos": {
        "x": 1,
        "y": 2,
        "z": 3
      },
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
  ]
}
```

Snapshot numbers can be `null` when a reflected game function is unavailable.
Snapshots may be stale because entries are retained until the bridge restarts;
use `ts` to decide whether a player is currently active.

## Quests

Quest definitions are loaded from `bridge/quests.json` when the bridge starts.
Quest windows use UTC. Daily windows use `YYYY-MM-DD`, weekly windows use a
Monday-based `YYYY-Www` key, and monthly windows use `YYYY-MM`.

### `GET /quests/{steam}`

Returns the current quest state and token balance for a Steam ID. The path
value must be URL-encoded when necessary.

```bash
curl -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/quests/$STEAM_ID"
```

Response:

```json
{
  "steam": "76561198000000000",
  "tokenBalance": 100,
  "quests": [
    {
      "id": "daily_play_30",
      "name": "Play for 30 minutes",
      "period": "daily",
      "type": "play_seconds",
      "target": 1800,
      "rewardTokens": 100,
      "window": "2026-08-22",
      "progress": 1800,
      "completed": true,
      "claimed": false
    }
  ]
}
```

| Quest state field | Type | Description |
| --- | --- | --- |
| `window` | string | Current UTC window key for the quest period. |
| `progress` | number | Accumulated or highest observed value. |
| `completed` | boolean | Whether progress reached the configured target. |
| `claimed` | boolean | Whether the reward was added to the token balance. |

The remaining fields come directly from each definition in `quests.json`.
Unknown Steam IDs are valid and return a zero balance with unstarted quests.

### `POST /quests/{steam}/claim/{questId}`

Claims a completed quest in its current window. A successful claim updates the
token balance and queues an in-game `notify` command.

```bash
curl -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  "$BASE_URL/quests/$STEAM_ID/claim/daily_play_30"
```

Successful response:

```http
HTTP/1.1 200 OK

{
  "ok": true,
  "rewardTokens": 100,
  "tokenBalance": 200
}
```

Claim failures return `400 Bad Request`:

| Error | Meaning |
| --- | --- |
| `quest-not-found` | No definition has the requested quest ID. |
| `not-complete` | The current-window quest has not reached its target. |
| `already-claimed` | The current-window reward was already claimed. |

Example failure:

```json
{
  "ok": false,
  "error": "not-complete"
}
```

## Commands

### `POST /command`

Queues an asynchronous command for the game mod. A `202 Accepted` response
only confirms that the command was appended to `commands.ndjson`; it does not
mean the game applied it successfully. Match the returned command `id` against
`GET /results` to learn the outcome.

The JSON request body is limited to 1 MiB.

```bash
curl -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"verb\":\"heal\",\"steam\":\"$STEAM_ID\"}" \
  "$BASE_URL/command"
```

Request schema:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `verb` | string | Yes | Game-side action name. See the command catalog. |
| `steam` | string | For current verbs | Target player's Steam ID. Defaults to an empty string if omitted. |
| `args` | object | No | Verb-specific arguments. Defaults to `{}`. |
| `id` | string | No | Caller-supplied correlation ID. A UUID is generated when omitted or empty. |

Successful queue response:

```http
HTTP/1.1 202 Accepted

{
  "ok": true,
  "queued": {
    "id": "cc8632b1-8f0a-4104-93d7-713001c6cdca",
    "ts": 1787366400,
    "verb": "heal",
    "steam": "76561198000000000",
    "args": {}
  }
}
```

Invalid JSON, a body larger than 1 MiB, or a missing/empty `verb` returns
`400 Bad Request`. A missing verb has the stable error `verb-required`; JSON
parser and size errors are returned as their runtime string in `error`.

### Command catalog

All current game-side commands target the player identified by `steam`.

| Verb | `args` | Behavior |
| --- | --- | --- |
| `setgrowth` | `{ "value": number }` | Sets growth, clamped to the inclusive range `0` to `1`. |
| `heal` | `{}` | Sets health to the player's current maximum health. |
| `kill` | `{}` | Sets health to `0`. |
| `setvital` | `{ "name": string, "value": number }` | Sets one supported vital: `health`, `hunger`, `thirst`, `stamina`, or `food`. |
| `teleport` | `{ "x": number, "y": number, "z": number, "yaw"?: number }` | Teleports to Unreal coordinates; `yaw` defaults to `0`. |
| `mutations` | Mutation slots | Updates one or more mutation slots. |
| `prime` | `{ "value"?: boolean }` | Sets prime eligibility; `value` defaults to `true`. |
| `unprime` | `{}` | Clears prime eligibility. |
| `notify` | `{ "message": string }` | Shows a notification to an online player. |
| `human` | `{}` | Test command: swaps the player's live dinosaur to the playable Generation 2 human. |

For `mutations`, provide at least one of `slot1` through `slot4`. The aliases
`Slot1` through `Slot4` and `MutationSlot1` through `MutationSlot4` are also
accepted. Values are game mutation names.

Examples:

```json
{ "verb": "setgrowth", "steam": "76561198000000000", "args": { "value": 0.8 } }
{ "verb": "heal",      "steam": "76561198000000000", "args": {} }
{ "verb": "kill",      "steam": "76561198000000000", "args": {} }
{ "verb": "setvital",  "steam": "76561198000000000", "args": { "name": "stamina", "value": 500 } }
{ "verb": "teleport",  "steam": "76561198000000000", "args": { "x": 100, "y": 200, "z": 300, "yaw": 90 } }
{ "verb": "mutations", "steam": "76561198000000000", "args": { "slot1": "MutationName", "slot2": "OtherMutation" } }
{ "verb": "prime",     "steam": "76561198000000000", "args": { "value": true } }
{ "verb": "unprime",   "steam": "76561198000000000", "args": {} }
{ "verb": "notify",    "steam": "76561198000000000", "args": { "message": "Welcome!" } }
{ "verb": "human",       "steam": "76561198000000000", "args": {} }
```

Common game-side failures include `missing steam`, `player has no live dino`,
`player offline`, missing verb arguments, unsupported vitals, unavailable game
functions, and `unknown verb`. These appear in command results, not in the
initial `POST /command` response.

## Results

### `GET /results`

Returns the last 100 non-empty lines from `results.ndjson`, oldest to newest
within that slice.

```bash
curl -H "Authorization: Bearer $API_TOKEN" "$BASE_URL/results"
```

Response:

```json
{
  "results": [
    {
      "id": "cc8632b1-8f0a-4104-93d7-713001c6cdca",
      "ts": 1787366401,
      "verb": "heal",
      "steam": "76561198000000000",
      "ok": true,
      "msg": "healed"
    }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Correlation ID copied from the queued command. |
| `ts` | integer | Unix timestamp in seconds when the game mod emitted the result. |
| `verb` | string | Lowercase command verb processed by the game mod. |
| `steam` | string | Target Steam ID copied from the command. |
| `ok` | boolean | Whether the game-side handler succeeded. |
| `msg` | string | Human-readable result or failure detail. |

If a stored line is not valid JSON, the API preserves it as
`{ "malformed": "original line" }`. If the results file does not exist or
cannot be read, the endpoint returns an empty `results` array.

## Asynchronous command workflow

1. Send `POST /command` and retain `queued.id`.
2. Wait at least one game-mod command polling interval.
3. Call `GET /results` and find the row with the same `id`.
4. Treat the result's `ok` value as the command outcome.

Results are a rolling view of the file's final 100 rows, not a per-client queue.
Clients should use unique IDs and persist their last known result locally when
reliable delivery tracking is required.
