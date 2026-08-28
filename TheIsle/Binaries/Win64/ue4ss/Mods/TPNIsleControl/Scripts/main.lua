-- TPNIsleControl bootstrap.
-- Implementation is grouped under core/, game/, features/, and commands/.

local Runtime = require("core.runtime")
local Transport = require("core.transport")
local Presence = require("game.presence")
local Players = require("game.players")
local Positions = require("game.positions")
local Snapshots = require("game.snapshots")
local Chat = require("features.chat")
local Diagnostics = require("features.diagnostics")
local Commands = require("commands.processor")

Runtime.loadConfig()
Transport.configure()
Chat.registerHook()
Diagnostics.registerDamageHook()
Presence.registerHook(function(controller)
    local steam = Players.getControllerSteamId(controller)
    if steam ~= "" then
        Transport.sendEvent(string.format('{"type":"player_joined","ts":%d,"steam":"%s"}',
            os.time(), Runtime.jsonEscape(steam)))
    end
end)

LoopInGameThreadWithDelay(Runtime.config.presenceRefreshMs, function()
    pcall(Presence.refresh)
end)

LoopInGameThreadWithDelay(Runtime.config.positionIntervalMs, function()
    pcall(Positions.capture)
end)

LoopInGameThreadWithDelay(Runtime.config.snapshotIntervalMs, function()
    pcall(Snapshots.capture)
end)

LoopInGameThreadWithDelay(Runtime.config.commandPollMs, function()
    pcall(Commands.poll)
end)

Runtime.log("loaded")
