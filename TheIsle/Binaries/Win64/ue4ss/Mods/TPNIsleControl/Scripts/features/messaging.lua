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
    if Players.liveAddress(controller) == nil then return false, "player offline" end
    local ok, err = pcall(function() controller:ClientShowNotification(makeText(message)) end)
    -- ClientShowNotification can return successfully on a dedicated server yet
    -- render nothing on the remote client. Also send through the client chat RPC.
    local chatOk, chatMessage = Messaging.privateChat(steam, message)
    if ok and chatOk then return true, "notification and private chat queued" end
    if ok then return true, "notification queued; " .. tostring(chatMessage) end
    if chatOk then return true, "private chat fallback queued" end
    return false, "notification failed: " .. tostring(err) .. "; " .. tostring(chatMessage)
end

function Messaging.privateChat(steam, message)
    local controller = Players.controllerForSteam(steam)
    if Players.liveAddress(controller) == nil then return false, "player offline" end
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
