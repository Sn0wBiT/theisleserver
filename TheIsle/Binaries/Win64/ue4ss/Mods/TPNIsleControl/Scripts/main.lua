-- TPNIsleControl bootstrap.
-- Implementation is grouped under core/, game/, features/, and commands/.

local Runtime = require("core.runtime")
local Transport = require("core.transport")
local Presence = require("game.presence")
local Snapshots = require("game.snapshots")
-- local Ui = require("features.ui")
local Chat = require("features.chat")
local Diagnostics = require("features.diagnostics")
local Commands = require("commands.processor")

Runtime.loadConfig()
Transport.configure()
-- Presence.registerHook(Ui.scanFirstPlayer)
Chat.registerHook()
Diagnostics.registerDamageHook()
-- Ui.registerCommand()

LoopInGameThreadWithDelay(Runtime.config.presenceRefreshMs, function()
    pcall(Presence.refresh)
end)

LoopInGameThreadWithDelay(Runtime.config.snapshotIntervalMs, function()
    pcall(Snapshots.capture)
end)

LoopInGameThreadWithDelay(Runtime.config.commandPollMs, function()
    pcall(Commands.poll)
end)

Runtime.log("loaded")
