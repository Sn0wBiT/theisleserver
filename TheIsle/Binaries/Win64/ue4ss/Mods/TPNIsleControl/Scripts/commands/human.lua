local Players = require("game.players")
local Human = {}

-- Playable character assets live below Core/Characters in EVRIMA. LoadAsset is
-- required because StaticFindObject only sees assets which are already loaded.
local CLASS_PATHS = {
    "/Game/TheIsle/Core/Characters/Humans/BP_Human.BP_Human_C",
    "/Game/TheIsle/Core/Characters/Humans/BP_Human_Gen2.BP_Human_Gen2_C",
    "/Game/TheIsle/Core/Characters/Humans/Generation2/BP_Human.BP_Human_C",
    "/Game/TheIsle/Core/Characters/Humans/Generation2/BP_Human_Gen2.BP_Human_Gen2_C",
    "/Game/TheIsle/Core/Characters/Humans/Gen2/BP_Human.BP_Human_C",
    "/Game/TheIsle/Core/Characters/Humans/Gen2/BP_Human_Gen2.BP_Human_Gen2_C"
}

local function packagePath(classPath)
    return classPath:match("^([^%.]+)") or classPath
end

local function findClass()
    for _, path in ipairs(CLASS_PATHS) do
        local class
        pcall(function() class = StaticFindObject(path) end)
        if Players.liveAddress(class) ~= nil then return class, path end

        -- Dedicated servers do not normally load the human selection asset.
        -- UE4SS versions differ on whether LoadAsset expects the package or
        -- generated-class object path, so try both forms.
        pcall(function() LoadAsset(packagePath(path)) end)
        pcall(function() LoadAsset(path) end)
        pcall(function() class = StaticFindObject(path) end)
        if Players.liveAddress(class) ~= nil then return class, path end
    end
    return nil, nil
end

function Human.execute(steam, _args)
    if steam == nil or steam == "" then return false, "missing steam" end

    local gameMode = Players.findGameMode()
    if Players.liveAddress(gameMode) == nil then return false, "game mode unavailable" end

    local controller = Players.controllerForSteam(steam)
    if Players.liveAddress(controller) == nil then return false, "player offline" end

    local oldPawn = Players.livePawnFromController(controller)
    if Players.liveAddress(oldPawn) == nil then return false, "player has no live character" end
    if Players.getSpecies(oldPawn):lower():find("human", 1, true) ~= nil then
        return true, "already human"
    end

    pcall(function() gameMode:SetHumansEnabled(true) end)
    pcall(function() controller:ClientSendHumanButtonUpdate(true) end)

    local humanClass, humanPath = findClass()
    if Players.liveAddress(humanClass) == nil then
        return false, "human asset is not cooked in this server build"
    end

    local oldAddress = Players.liveAddress(oldPawn)
    local okSpawn, spawnErr = pcall(function()
        -- Server-side implementation behind Server_SpawnChar. Using the game's
        -- graph preserves its possession, replication, and cleanup bookkeeping.
        controller:SpawnChar(humanClass, 1.0, 1.0)
    end)
    if not okSpawn then return false, "SpawnChar failed: " .. tostring(spawnErr) end

    local newPawn = Players.livePawnFromController(controller)
    local newAddress = Players.liveAddress(newPawn)
    if newAddress == nil or newAddress == oldAddress then
        return false, "SpawnChar returned without replacing the player's character"
    end
    if Players.getSpecies(newPawn):lower():find("human", 1, true) == nil then
        return false, "SpawnChar replaced the character with a non-human class"
    end

    pcall(function() controller:RequestOnRespawnHudUpdate() end)
    pcall(function() newPawn:VerifyAndRemoveBlockAbilitiesTag() end)
    pcall(function() newPawn:SaveDataToFile(false) end)
    return true, "spawned as human via " .. humanPath
end

return Human
