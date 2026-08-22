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
    if ok then return true, "notification queued" end
    return false, "notification failed: " .. tostring(err)
end

return Messaging
