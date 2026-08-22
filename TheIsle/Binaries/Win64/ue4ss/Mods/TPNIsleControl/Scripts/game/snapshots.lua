local Runtime = require("core.runtime")
local Transport = require("core.transport")
local Players = require("game.players")
local Presence = require("game.presence")
local Snapshots = {}

local function pawnAddress(pawn)
    local address = Players.liveAddress(pawn)
    if address == nil then return "0" end
    return string.format("0x%X", address)
end

local function snapshotLine(player, timestamp)
    local pawn = player.pawn
    if pawn == nil then return nil end
    local value = Runtime.safeNumber
    local x, y, z
    pcall(function()
        local location = pawn:K2_GetActorLocation()
        if location ~= nil then x, y, z = location.X, location.Y, location.Z end
    end)
    return string.format(
        '{"type":"snapshot","ts":%d,"steam":"%s","addr":"%s","species":"%s","growth":%s,' ..
        '"pos":{"x":%s,"y":%s,"z":%s},' ..
        '"vitals":{"hp":%s,"hpMax":%s,"hunger":%s,"hungerMax":%s,"thirst":%s,"thirstMax":%s,' ..
        '"stamina":%s,"staminaMax":%s,"food":%s,"foodMax":%s}}',
        timestamp, Runtime.jsonEscape(player.steam), Runtime.jsonEscape(pawnAddress(pawn)),
        Runtime.jsonEscape(Players.getSpecies(pawn)), Runtime.numberJson(value(function() return pawn:GetGrowth() end)),
        Runtime.numberJson(x), Runtime.numberJson(y), Runtime.numberJson(z),
        Runtime.numberJson(value(function() return pawn:GetHealth() end)),
        Runtime.numberJson(value(function() return pawn:GetMaxHealth() end)),
        Runtime.numberJson(value(function() return pawn:GetHunger() end)),
        Runtime.numberJson(value(function() return pawn:GetMaxHunger() end)),
        Runtime.numberJson(value(function() return pawn:GetThirst() end)),
        Runtime.numberJson(value(function() return pawn:GetMaxThirst() end)),
        Runtime.numberJson(value(function() return pawn:GetStamina() end)),
        Runtime.numberJson(value(function() return pawn:GetMaxStamina() end)),
        Runtime.numberJson(value(function() return pawn:GetFood() end)),
        Runtime.numberJson(value(function() return pawn:GetMaxFood() end)))
end

function Snapshots.capture()
    if not Runtime.config.enabled then return end
    local lines = {}
    local timestamp = os.time()
    for _, player in ipairs(Presence.onlinePlayers()) do
        if player.pawn ~= nil then
            local ok, line = pcall(snapshotLine, player, timestamp)
            if ok and line ~= nil then lines[#lines + 1] = line end
        end
    end
    if Transport.enqueueSync(lines, {}) then return end
    for _, line in ipairs(lines) do Runtime.appendLine(Runtime.paths.events, line) end
end

return Snapshots
