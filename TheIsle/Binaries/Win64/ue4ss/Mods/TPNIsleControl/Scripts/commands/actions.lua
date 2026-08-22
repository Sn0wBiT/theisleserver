local Runtime = require("core.runtime")
local Players = require("game.players")
local Messaging = require("features.messaging")
local Human = require("commands.human")
local Actions = {}

local function targetPawn(steam)
    if steam == nil or steam == "" then return nil, "missing steam" end
    local pawn = Players.pawnForSteam(steam)
    if pawn == nil then return nil, "player has no live dino" end
    return pawn, nil
end

local function setGrowth(steam, args)
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end
    local value = Runtime.jsonReadNumber(args, "value")
    if value == nil then return false, "missing value" end
    value = math.max(0, math.min(1, value))
    local ok, callErr = pcall(function() pawn:SetGrowth(value) end)
    if not ok then return false, tostring(callErr) end
    return true, string.format("growth set to %.3f", value)
end

local function heal(steam)
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end
    local maximum = Runtime.safeNumber(function() return pawn:GetMaxHealth() end)
    if maximum == nil then return false, "GetMaxHealth unavailable" end
    local ok, callErr = pcall(function() pawn:SetHealth(maximum) end)
    if not ok then return false, tostring(callErr) end
    return true, "healed"
end

local function kill(steam)
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end
    local ok, callErr = pcall(function() pawn:SetHealth(0) end)
    if not ok then return false, tostring(callErr) end
    return true, "killed"
end

local function revive(steam)
    if not Players.isAdmin(steam) then return false, "admin access required" end
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end
    local maximum = Runtime.safeNumber(function() return pawn:GetMaxHealth() end)
    if maximum == nil or maximum <= 0 then return false, "GetMaxHealth unavailable" end
    local ok, callErr = pcall(function() pawn:SetHealth(maximum) end)
    if not ok then return false, "revive failed: " .. tostring(callErr) end
    return true, "revived with full health"
end

local function setVital(steam, args)
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end
    local name = (Runtime.jsonReadString(args, "name") or ""):lower()
    local value = Runtime.jsonReadNumber(args, "value")
    if value == nil then return false, "missing value" end
    local setter = ({ health = "SetHealth", hunger = "SetHunger", thirst = "SetThirst",
        stamina = "SetStamina", food = "SetFood" })[name]
    if setter == nil then return false, "unsupported vital" end
    local ok, callErr = pcall(function() pawn[setter](pawn, value) end)
    if not ok then return false, tostring(callErr) end
    return true, name .. " set"
end

local function teleport(steam, args)
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end
    local x, y, z = Runtime.jsonReadNumber(args, "x"), Runtime.jsonReadNumber(args, "y"),
        Runtime.jsonReadNumber(args, "z")
    local yaw = Runtime.jsonReadNumber(args, "yaw") or 0
    if x == nil or y == nil or z == nil then return false, "x/y/z required" end
    local ok, callErr = pcall(function()
        pawn:K2_TeleportTo({ X = x, Y = y, Z = z }, { Pitch = 0, Yaw = yaw, Roll = 0 })
    end)
    if not ok then return false, tostring(callErr) end
    return true, string.format("teleported to %.1f %.1f %.1f", x, y, z)
end

local function mutations(steam, args)
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end
    if FName == nil then return false, "FName constructor unavailable" end
    local liveMutations
    local okRead, readErr = pcall(function() liveMutations = pawn.ReplicatedMutationsData end)
    if not okRead or liveMutations == nil then
        return false, "cannot read ReplicatedMutationsData: " .. tostring(readErr)
    end
    local changed = 0
    for index = 1, 4 do
        local value = Runtime.jsonReadString(args, "slot" .. index)
            or Runtime.jsonReadString(args, "Slot" .. index)
            or Runtime.jsonReadString(args, "MutationSlot" .. index)
        if value ~= nil and value ~= "" then
            local okSet, setErr = pcall(function()
                liveMutations["MutationSlot" .. index] = FName(value)
            end)
            if not okSet then return false, "slot" .. index .. ": " .. tostring(setErr) end
            changed = changed + 1
        end
    end
    if changed == 0 then return false, "no slots supplied" end
    local okPush, pushErr = pcall(function() pawn:SetReplicatedMutationsData(liveMutations, true) end)
    if not okPush then return false, tostring(pushErr) end
    return true, string.format("%d mutation slot(s) updated", changed)
end

local function prime(steam, args)
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end
    local value = Runtime.jsonReadBool(args, "value")
    if value == nil then value = true end
    local ok, callErr = pcall(function() pawn:ServerSetPrimeEligible(value) end)
    if not ok then return false, tostring(callErr) end
    return true, value and "prime eligible" or "prime cleared"
end

local function message(steam, args)
    local text = Runtime.jsonReadString(args, "message")
    if text == nil or text == "" then return false, "missing message" end
    return Messaging.notify(steam, text)
end

Actions.handlers = {
    setgrowth = setGrowth, heal = heal, kill = kill, setvital = setVital, teleport = teleport,
    mutations = mutations, prime = prime,
    unprime = function(steam) return prime(steam, '{"value":false}') end,
    notify = message,
    human = Human.execute,
    revive = revive
}

return Actions
