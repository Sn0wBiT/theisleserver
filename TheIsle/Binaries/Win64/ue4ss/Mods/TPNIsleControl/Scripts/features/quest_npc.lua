local Runtime = require("core.runtime")
local Players = require("game.players")
local QuestNpc = {}

-- Unreal locations are expressed in centimetres.
local ACCEPT_RADIUS_CM = 1000
local sessions = {}

local function unwrap(value)
    if value == nil then return nil end
    local unwrapped
    local ok = pcall(function() unwrapped = value:get() end)
    if ok and unwrapped ~= nil then return unwrapped end
    return value
end

local function arrayValues(array)
    local values = {}
    if array == nil then return values end
    pcall(function()
        array:ForEach(function(_, element)
            local value = unwrap(element)
            if Players.liveAddress(value) ~= nil then values[#values + 1] = value end
        end)
    end)
    return values
end

local function worldSpawner()
    local spawner
    pcall(function() spawner = FindFirstOf("TIAIWorldSpawner") end)
    if Players.liveAddress(spawner) == nil then return nil end
    return spawner
end

local function className(class)
    local name = ""
    pcall(function() name = Runtime.safeString(class:GetFullName()) end)
    return name
end

local function chooseClass(spawner, requestedSpecies)
    local classes
    pcall(function() classes = spawner.AIDinoCharacters end)
    local available = arrayValues(classes)
    if #available == 0 then return nil, "the AI dinosaur class list is empty" end

    local requested = (requestedSpecies or "dryosaurus"):lower()
    for _, class in ipairs(available) do
        if className(class):lower():find(requested, 1, true) ~= nil then return class, nil end
    end
    return nil, "AI species is not registered: " .. requested
end

local function currentCharacters(spawner)
    local characters
    pcall(function() characters = spawner.CurrentCharacters end)
    return arrayValues(characters)
end

local function actorLocation(actor)
    local location
    pcall(function() location = actor:K2_GetActorLocation() end)
    if location == nil or type(location.X) ~= "number" or type(location.Y) ~= "number"
        or type(location.Z) ~= "number" then return nil end
    return location
end

function QuestNpc.spawn(steam, questId, species, acceptMode)
    if not Players.isAdmin(steam) then return false, "admin access required" end
    if questId == nil or questId == "" then
        return false, "usage: /spawnquestnpc <quest-id> [species] [near|anywhere]"
    end
    acceptMode = (acceptMode or "near"):lower()
    if acceptMode ~= "near" and acceptMode ~= "anywhere" then
        return false, "accept mode must be near or anywhere"
    end

    local player = Players.pawnForSteam(steam)
    if Players.liveAddress(player) == nil then return false, "player has no live dinosaur" end
    local origin = actorLocation(player)
    if origin == nil then return false, "player location unavailable" end

    local spawner = worldSpawner()
    if spawner == nil then return false, "AI world spawner unavailable" end
    local class, classErr = chooseClass(spawner, species)
    if class == nil then return false, classErr end

    local before = {}
    for _, actor in ipairs(currentCharacters(spawner)) do
        before[Players.liveAddress(actor)] = true
    end

    local spawned = false
    local ok, spawnErr = pcall(function()
        spawned = spawner:TrySpawnCharacter(class, origin) == true
    end)
    if not ok then return false, "TrySpawnCharacter failed: " .. tostring(spawnErr) end
    if not spawned then return false, "the game rejected the AI spawn location" end

    local npc
    for _, actor in ipairs(currentCharacters(spawner)) do
        if not before[Players.liveAddress(actor)] then npc = actor; break end
    end
    if Players.liveAddress(npc) == nil then
        return false, "AI spawned but its actor could not be identified"
    end

    sessions[questId:lower()] = {
        actor = npc,
        species = className(class),
        requireProximity = acceptMode == "near",
        spawnedAt = os.time()
    }
    if acceptMode == "anywhere" then
        return true, string.format("quest NPC spawned; players may use /accept %s from anywhere", questId)
    end
    return true, string.format("quest NPC spawned; players must stay within %.0f m and use /accept %s",
        ACCEPT_RADIUS_CM / 100, questId)
end

function QuestNpc.canAccept(steam, questId)
    local session = sessions[(questId or ""):lower()]
    if session == nil then return true, nil end
    if session.requireProximity ~= true then return true, nil end
    if Players.liveAddress(session.actor) == nil then
        sessions[(questId or ""):lower()] = nil
        return false, "The quest NPC is no longer available. Ask an admin to spawn it again."
    end

    local player = Players.pawnForSteam(steam)
    if Players.liveAddress(player) == nil then return false, "You need a live character to accept this quest." end
    local playerLocation, npcLocation = actorLocation(player), actorLocation(session.actor)
    if playerLocation == nil or npcLocation == nil then return false, "Could not check distance to the quest NPC." end

    local dx, dy, dz = playerLocation.X - npcLocation.X, playerLocation.Y - npcLocation.Y,
        playerLocation.Z - npcLocation.Z
    local distance = math.sqrt(dx * dx + dy * dy + dz * dz)
    if distance > ACCEPT_RADIUS_CM then
        return false, string.format("Move closer to the quest NPC (%.0f m away; maximum %.0f m).",
            distance / 100, ACCEPT_RADIUS_CM / 100)
    end
    return true, nil
end

return QuestNpc
