local Runtime = require("core.runtime")
local Players = require("game.players")
local Presence = { registry = {} }

function Presence.update(steam)
    if steam == nil or steam == "" then return false end
    steam = tostring(steam)
    local isNew = Presence.registry[steam] == nil
    if isNew then
        Presence.registry[steam] = { firstSeen = os.time(), lastSeen = os.time() }
        Runtime.log("presence + " .. steam)
    else
        Presence.registry[steam].lastSeen = os.time()
    end
    return isNew
end

function Presence.registerHook(onFirstPlayer)
    local ok, err = pcall(function()
        RegisterHook("/Script/TheIsle.TIPlayerController:SetAdminCred", function(controllerParam, _isAdmin)
            local controller
            pcall(function() controller = controllerParam:get() end)
            local steam = Players.getControllerSteamId(controller)
            if steam ~= "" and Presence.update(steam) and onFirstPlayer ~= nil then
                pcall(onFirstPlayer, controller)
            end
        end)
    end)
    Runtime.log(ok and "presence heartbeat hook registered" or ("presence hook failed: " .. tostring(err)))
end

function Presence.refresh()
    local gameMode = Players.findGameMode()
    if gameMode == nil then return end
    local now = os.time()
    for steam, entry in pairs(Presence.registry) do
        local controller
        pcall(function() controller = gameMode:GetControllerBySteamId(steam) end)
        if controller == nil then
            Presence.registry[steam] = nil
            Runtime.log("presence - " .. steam)
        else
            entry.lastSeen = now
        end
    end
end

function Presence.onlinePlayers()
    local online = {}
    local gameMode = Players.findGameMode()
    if gameMode == nil then return online end
    local now = os.time()
    for steam, entry in pairs(Presence.registry) do
        if now - (entry.lastSeen or 0) > Runtime.config.presenceExpirySec then
            Presence.registry[steam] = nil
        else
            local controller
            pcall(function() controller = gameMode:GetControllerBySteamId(steam) end)
            if controller == nil then
                Presence.registry[steam] = nil
            else
                online[#online + 1] = {
                    steam = steam,
                    controller = controller,
                    pawn = Players.livePawnFromController(controller)
                }
            end
        end
    end
    return online
end

function Presence.firstOnlineController()
    for _, player in ipairs(Presence.onlinePlayers()) do return player.controller end
    return nil
end

return Presence
