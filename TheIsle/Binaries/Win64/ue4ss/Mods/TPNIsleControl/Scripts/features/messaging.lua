local Runtime = require("core.runtime")
local Players = require("game.players")
local Messaging = {}

local function makeText(message)
    if FText == nil then return message end
    local ok, text = pcall(function() return FText(message) end)
    if ok and text ~= nil then return text end
    return message
end

function Messaging.notify(steam, message)
    local controller = Players.controllerForSteam(steam)
    if controller == nil then return false, "player offline" end
    local ok, err = pcall(function() controller:ClientShowNotification(makeText(message)) end)
    if not ok then return false, "notification failed: " .. tostring(err) end
    return true, "notification queued"
end

function Messaging.privateChat(steam, message)
    local controller = Players.controllerForSteam(steam)
    if controller == nil then return false, "player offline" end
    if type(TPNIsleControlSendPrivateChat) == "function" then
        local address = Players.liveAddress(controller)
        if address ~= nil then
            local ok, sent = pcall(function()
                return TPNIsleControlSendPrivateChat(
                    string.format("0x%X", address), Runtime.MOD_NAME, "0", message)
            end)
            if ok and sent == true then return true, "private chat queued" end
        end
    end
    return false, "private chat unavailable"
end

return Messaging
