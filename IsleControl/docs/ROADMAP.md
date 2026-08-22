# Roadmap

## v0.1 — included

- live players
- REST bridge
- daily/weekly/monthly quests
- playtime quest
- growth quest
- player-kill quest
- token rewards
- growth control
- vitals
- teleport
- mutations
- prime toggle
- notify
- optional native direct-hit hook

## Good next modules

### Dino garage

Capture / restore:
- growth
- vitals
- nutrients
- mutations
- prime state
- species

Use transform-in-place restore, not Lua `RequestRespawn`.

### Custom AI

Separate mod:
- preset-driven spawn caps
- spawn interval
- target players / target AI
- flee threshold
- per-species templates

### Body drops

Spawn pre-cooked corpse-capable actor classes based on configurable presets.

### Weather / time

Add explicit commands only after verifying the current UFunctions on the target build.

### Nest quests

Emit an event when a hatch succeeds:
- child steam
- parent Steam IDs
- species
- coordinates

Then add a `hatches` quest type in the sidecar.

### Better kill attribution

Upgrade from the direct-hit + health-transition rule to the native GAS
`PostGameplayEffectExecute` hook.

That can cover:
- DoT
- environmental deaths
- direct instigator context

It requires a stable vtable/signature identification strategy for the current build.

## Deliberately excluded

- Battlepass
- IslePilot-compatible private API
- IslePilot licensing
- IslePilot CDN updater
- copied binary signatures / offsets
