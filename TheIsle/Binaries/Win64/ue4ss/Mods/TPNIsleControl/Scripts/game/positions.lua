local Runtime = require("core.runtime")
local Transport = require("core.transport")
local Presence = require("game.presence")
local Positions = {}

local function positionLine(player)
    if player.pawn == nil then return nil end

    local x, y, z, pitch, yaw, roll
    pcall(function()
        local location = player.pawn:K2_GetActorLocation()
        if location ~= nil then x, y, z = location.X, location.Y, location.Z end
    end)
    if type(x) ~= "number" or type(y) ~= "number" or type(z) ~= "number" then return nil end
    pcall(function()
        local rotation = player.pawn:K2_GetActorRotation()
        if rotation ~= nil then pitch, yaw, roll = rotation.Pitch, rotation.Yaw, rotation.Roll end
    end)
    if type(pitch) ~= "number" or type(yaw) ~= "number" or type(roll) ~= "number" then return nil end

    return string.format(
        '{"steam":"%s","gameServerId":"%s","pos":{"x":%s,"y":%s,"z":%s},"rotation":{"pitch":%s,"yaw":%s,"roll":%s}}',
        Runtime.jsonEscape(player.steam), Runtime.jsonEscape(Runtime.config.gameServerId or "gateway-1"),
        Runtime.numberJson(x), Runtime.numberJson(y), Runtime.numberJson(z), Runtime.numberJson(pitch), Runtime.numberJson(yaw), Runtime.numberJson(roll))
end

function Positions.capture()
    if not Runtime.config.enabled or not Transport.isHttp() then return end

    local lines = {}
    for _, player in ipairs(Presence.onlinePlayers()) do
        local ok, line = pcall(positionLine, player)
        if ok and line ~= nil then lines[#lines + 1] = line end
    end
    if #lines > 0 then Transport.enqueuePositions(lines) end
end

return Positions
