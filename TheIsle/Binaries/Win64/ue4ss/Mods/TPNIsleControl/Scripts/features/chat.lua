local Runtime = require("core.runtime")
local Transport = require("core.transport")
local Players = require("game.players")
local Presence = require("game.presence")
local Chat = {}

local function unwrap(param)
    if param == nil then return nil end
    local value
    local ok = pcall(function() value = param:get() end)
    if ok and value ~= nil then return value end
    return param
end

function Chat.registerHook()
    local eventTypes = {
        ["/quests"] = "quest_request", quests = "quest_request",
        ["/help"] = "help_request", help = "help_request",
        ["/human"] = "human_request", human = "human_request"
    }
    local ok, err = pcall(function()
        RegisterHook("/Script/TheIsle.TIPlayerController:ServerExecuteChatCommand",
            function(controllerParam, commandParam)
                local controller = unwrap(controllerParam)
                if controller == nil then return end
                local command = Runtime.safeString(unwrap(commandParam)):match("^%s*(.-)%s*$") or ""
                command = command:lower()
                local eventType = eventTypes[command]
                if eventType == nil then return end
                local steam = Players.getControllerSteamId(controller)
                if steam == "" then
                    Runtime.log(command .. " ignored: could not resolve requesting Steam ID")
                    return
                end
                Presence.update(steam)
                Transport.sendEvent(string.format('{"type":"%s","ts":%d,"steam":"%s"}',
                    eventType, os.time(), Runtime.jsonEscape(steam)))
            end)
    end)
    Runtime.log(ok and "player chat command hook registered (/help, /quests, /human)"
        or ("player chat command hook failed: " .. tostring(err)))
end

return Chat
