local Runtime = require("core.runtime")
local Transport = require("core.transport")
local Presence = require("game.presence")
local Positions = {}

local function positionLine(player)
    if player.pawn == nil then return nil end

    local x, y, z
    pcall(function()
        local location = player.pawn:K2_GetActorLocation()
        if location ~= nil then x, y, z = location.X, location.Y, location.Z end
    end)
    if type(x) ~= "number" or type(y) ~= "number" or type(z) ~= "number" then return nil end

    return string.format(
        '{"steam":"%s","pos":{"x":%s,"y":%s,"z":%s}}',
        Runtime.jsonEscape(player.steam), Runtime.numberJson(x), Runtime.numberJson(y), Runtime.numberJson(z))
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
