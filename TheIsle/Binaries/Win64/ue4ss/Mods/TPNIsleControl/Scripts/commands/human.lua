local Players = require("game.players")
local Human = {}

local CLASS_PATHS = {
    "/Game/TheIsle/Characters/Humans/BP_Human.BP_Human_C",
    "/Game/TheIsle/Characters/Humans/BP_Human_Gen2.BP_Human_Gen2_C",
    "/Game/TheIsle/Characters/Humans/Generation2/BP_Human.BP_Human_C",
    "/Game/TheIsle/Characters/Humans/Generation2/BP_Human_Gen2.BP_Human_Gen2_C",
    "/Game/TheIsle/Characters/Humans/Gen2/BP_Human.BP_Human_C",
    "/Game/TheIsle/Characters/Humans/Gen2/BP_Human_Gen2.BP_Human_Gen2_C"
}

local function findClass()
    for _, path in ipairs(CLASS_PATHS) do
        local class
        pcall(function() class = StaticFindObject(path) end)
        if Players.liveAddress(class) ~= nil then return class, path end
    end
    return nil, nil
end

local function destroy(actor)
    if Players.liveAddress(actor) ~= nil then pcall(function() actor:K2_DestroyActor() end) end
end

function Human.execute(steam, _args)
    if steam == nil or steam == "" then return false, "missing steam" end
    local gameMode = Players.findGameMode()
    if gameMode == nil then return false, "game mode unavailable" end
    local controller
    pcall(function() controller = gameMode:GetControllerBySteamId(steam) end)
    if Players.liveAddress(controller) == nil then return false, "player offline" end

    local oldPawn = Players.livePawnFromController(controller)
    if Players.liveAddress(oldPawn) == nil then return false, "player has no live dino" end
    if Players.getSpecies(oldPawn):lower():find("human", 1, true) ~= nil then return true, "already human" end
    local humanClass, humanPath = findClass()
    if humanClass == nil then return false, "playable human class unavailable (is bEnableHumans=true?)" end
    local world
    pcall(function() world = gameMode:GetWorld() end)
    if world == nil then return false, "world unavailable" end

    local x, y, z, yaw
    local okTransform, transformErr = pcall(function()
        local location = oldPawn:K2_GetActorLocation()
        local rotation = oldPawn:K2_GetActorRotation()
        x, y, z, yaw = location.X, location.Y, location.Z, rotation.Yaw
    end)
    if not okTransform or type(x) ~= "number" or type(y) ~= "number" or type(z) ~= "number" then
        return false, "cannot read dino transform: " .. tostring(transformErr)
    end
    if type(yaw) ~= "number" then yaw = 0 end

    local newPawn
    for _, offset in ipairs({ 300, 600, 1000 }) do
        pcall(function()
            newPawn = world:SpawnActor(humanClass, { X = x, Y = y, Z = z + offset },
                { Pitch = 0, Yaw = yaw, Roll = 0 })
        end)
        if Players.liveAddress(newPawn) ~= nil then break end
        newPawn = nil
    end
    if newPawn == nil then return false, "human spawn blocked at player location" end

    local okPrepare, prepareErr = pcall(function()
        newPawn:SetReplicates(true)
        newPawn.bAlwaysRelevant = true
        newPawn:SetSteamId(steam)
        local characters = gameMode.AllPlayerCharacters
        characters[#characters + 1] = newPawn
    end)
    if not okPrepare then
        destroy(newPawn)
        return false, "human possession failed; original dino untouched: " .. tostring(prepareErr)
    end

    local okPossess, possessErr = pcall(function() controller:Possess(newPawn) end)
    if Players.liveAddress(Players.livePawnFromController(controller)) ~= Players.liveAddress(newPawn) then
        destroy(newPawn)
        if not okPossess then
            return false, "human possession failed; original dino untouched: " .. tostring(possessErr)
        end
        return false, "human possession was not confirmed; original dino untouched"
    end

    pcall(function() oldPawn:SetSteamId("") end)
    local okDestroy, destroyErr = pcall(function() oldPawn:K2_DestroyActor() end)
    local warnings = {}
    if not okDestroy then warnings[#warnings + 1] = "old dino cleanup failed: " .. tostring(destroyErr) end
    local okHud, hudErr = pcall(function() controller:RequestOnRespawnHudUpdate() end)
    if not okHud then warnings[#warnings + 1] = "HUD refresh failed: " .. tostring(hudErr) end
    pcall(function() newPawn:VerifyAndRemoveBlockAbilitiesTag() end)
    pcall(function() newPawn:SetHealth(newPawn:GetMaxHealth()) end)
    local okSave, saveErr = pcall(function() newPawn:SaveDataToFile(false) end)
    if not okSave then warnings[#warnings + 1] = "save failed: " .. tostring(saveErr) end
    local message = "turned into human via " .. humanPath
    if #warnings > 0 then message = message .. "; " .. table.concat(warnings, "; ") end
    return true, message
end

return Human
