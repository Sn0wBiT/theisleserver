local Runtime = require("core.runtime")
local Transport = require("core.transport")
local Players = require("game.players")
local Diagnostics = {}

local function unwrap(param)
    if param == nil then return nil end
    local value
    local ok = pcall(function() value = param:get() end)
    return ok and value or param
end

local function address(object)
    local value = Players.liveAddress(object)
    return value ~= nil and string.format("0x%X", value) or ""
end

local function send(typeName, fields)
    local line = string.format('{"type":"%s","ts":%d%s}', typeName, os.time(), fields or "")
    Transport.sendEvent(line)
end

local function species(character)
    local value = ""
    pcall(function()
        local class = character:GetClass()
        if class ~= nil then value = Runtime.safeString(class:GetFullName()) end
    end)
    return value
end

function Diagnostics.registerDamageHook()
    local ok, err = pcall(function()
        RegisterHook("/Script/TheIsle.TICharacterBase:ApplyDamage",
            function(characterParam, damageCauserParam, ...)
                local targetAddress = address(unwrap(characterParam))
                local attackerAddress = address(unwrap(damageCauserParam))
                if targetAddress == "" or attackerAddress == "" then return end
                send("damage_hit", string.format(',"attacker_addr":"%s","target_addr":"%s"',
                    Runtime.jsonEscape(attackerAddress), Runtime.jsonEscape(targetAddress)))
            end,
            function(characterParam, _damageCauserParam, ...)
                local character = unwrap(characterParam)
                local health = Runtime.safeNumber(function() return character:GetHealth() end)
                if health == nil or health > 0 then return end
                local targetAddress = address(character)
                if targetAddress ~= "" then
                    send("ai_dinosaur_death", string.format(',"target_addr":"%s","target_species":"%s"',
                        Runtime.jsonEscape(targetAddress), Runtime.jsonEscape(species(character))))
                end
            end)
    end)
    Runtime.log(ok and "ApplyDamage kill-observation hook registered"
        or ("ApplyDamage kill-observation hook unavailable: " .. tostring(err)))
end

return Diagnostics
