-- IsleControl
-- Clean-room UE4SS Lua server mod for The Isle: EVRIMA.
--
-- Design goals:
--   * no proprietary IslePilot code/protocol
--   * no hard-coded executable offsets
--   * safe controller/pawn lifetime handling
--   * file IPC for external quest/API sidecar

local MOD_NAME = "IsleControl"
local SAVED_DIR = "ue4ss/Mods/IsleControl/Saved"
local CONFIG_PATH = SAVED_DIR .. "/config.json"
local EVENTS_PATH = SAVED_DIR .. "/events.ndjson"
local COMMANDS_PATH = SAVED_DIR .. "/commands.ndjson"
local RESULTS_PATH = SAVED_DIR .. "/results.ndjson"

local config = {
    enabled = true,
    snapshotIntervalMs = 5000,
    commandPollMs = 1000,
    presenceRefreshMs = 15000,
    presenceExpirySec = 180,
    adminSteamIds = {}
}

local function log(msg)
    print(string.format("[%s] %s\n", MOD_NAME, tostring(msg)))
end

local function readAll(path)
    local f = io.open(path, "rb")
    if f == nil then return nil end
    local s = f:read("*a")
    f:close()
    return s
end

local function appendLine(path, line)
    local f = io.open(path, "ab")
    if f == nil then
        log("cannot append: " .. tostring(path))
        return false
    end
    f:write(line)
    f:write("\n")
    f:close()
    return true
end

local function jsonEscape(s)
    if s == nil then return "" end
    s = tostring(s)
    s = s:gsub("\\", "\\\\")
    s = s:gsub('"', '\\"')
    s = s:gsub("\n", "\\n")
    s = s:gsub("\r", "\\r")
    s = s:gsub("\t", "\\t")
    return s
end

local function jsonReadString(body, fieldName)
    return string.match(body or "", '"' .. fieldName .. '"%s*:%s*"([^"]*)"')
end

local function jsonReadNumber(body, fieldName)
    return tonumber(string.match(body or "", '"' .. fieldName .. '"%s*:%s*(-?%d+%.?%d*)'))
end

local function jsonReadBool(body, fieldName)
    local v = string.match(body or "", '"' .. fieldName .. '"%s*:%s*([%a]+)')
    if v == "true" then return true end
    if v == "false" then return false end
    return nil
end

local function jsonReadObject(body, fieldName)
    local after = string.match(body or "", '"' .. fieldName .. '"%s*:%s*(.*)')
    if after == nil then return "{}" end
    return string.match(after, "(%b{})") or "{}"
end

local function jsonReadStringArray(body, fieldName)
    local out = {}
    local arr = string.match(body or "", '"' .. fieldName .. '"%s*:%s*%[([^%]]*)%]')
    if arr == nil then return out end
    for s in string.gmatch(arr, '"([^"]*)"') do
        out[#out + 1] = s
    end
    return out
end

local function boolJson(v)
    return v and "true" or "false"
end

local function numberJson(v)
    if type(v) ~= "number" then return "null" end
    if v ~= v or v == math.huge or v == -math.huge then return "null" end
    return tostring(v)
end

local function safeString(value)
    if value == nil then return "" end

    local okT, t = pcall(function() return value:ToString() end)
    if okT and type(t) == "string" and t ~= "" then return t end

    local ok, s = pcall(function() return tostring(value) end)
    if ok and type(s) == "string" and s ~= "" and not s:find("^UObject") then
        return s
    end

    return ""
end

local function normalizeSteamId(value)
    local s = safeString(value)
    return s:match("(%d%d%d%d%d%d%d%d%d%d%d%d%d%d%d%d%d)") or ""
end

local function loadConfig()
    local body = readAll(CONFIG_PATH)
    if body == nil or body == "" then
        log("config.json missing; defaults active")
        return
    end

    local v
    v = jsonReadBool(body, "enabled")
    if v ~= nil then config.enabled = v end

    v = jsonReadNumber(body, "snapshotIntervalMs")
    if v ~= nil and v >= 1000 then config.snapshotIntervalMs = math.floor(v) end

    v = jsonReadNumber(body, "commandPollMs")
    if v ~= nil and v >= 250 then config.commandPollMs = math.floor(v) end

    v = jsonReadNumber(body, "presenceRefreshMs")
    if v ~= nil and v >= 5000 then config.presenceRefreshMs = math.floor(v) end

    v = jsonReadNumber(body, "presenceExpirySec")
    if v ~= nil and v >= 30 then config.presenceExpirySec = math.floor(v) end

    config.adminSteamIds = jsonReadStringArray(body, "adminSteamIds")
    log(string.format("config loaded: snapshots=%dms commands=%dms admins=%d",
        config.snapshotIntervalMs,
        config.commandPollMs,
        #config.adminSteamIds))
end

local function findGameMode()
    local candidates = {
        "BP_SurvivalGameMode_C",
        "TISurvivalGameMode",
        "TIGameModeBase",
        "GameModeBase"
    }

    for _, name in ipairs(candidates) do
        local gm
        pcall(function() gm = FindFirstOf(name) end)
        if gm ~= nil then return gm end
    end

    return nil
end

local function livePawnFromCtrl(ctrl)
    if ctrl == nil then return nil end

    local pawn
    pcall(function() pawn = ctrl:K2_GetPawn() end)
    if pawn == nil then return nil end

    local addr
    pcall(function() addr = pawn:GetAddress() end)
    if addr == nil or addr == 0 then return nil end

    return pawn
end

local function getControllerSteamId(ctrl)
    if ctrl == nil then return "" end

    local sid
    pcall(function() sid = ctrl:GetSteamId() end)
    if sid ~= nil then
        local s = normalizeSteamId(sid)
        if s ~= "" then return s end
    end

    local field
    pcall(function() field = ctrl.SteamId end)
    if field ~= nil then
        local s = normalizeSteamId(field)
        if s ~= "" then return s end
    end

    return ""
end

local function controllerForSteam(steam)
    if steam == nil or steam == "" then return nil end
    local gm = findGameMode()
    if gm == nil then return nil end

    local ctrl
    pcall(function() ctrl = gm:GetControllerBySteamId(steam) end)
    return ctrl
end

local function pawnForSteam(steam)
    return livePawnFromCtrl(controllerForSteam(steam))
end

local function isAdmin(steam)
    if steam == nil or steam == "" then return false end
    for _, s in ipairs(config.adminSteamIds or {}) do
        if tostring(s) == tostring(steam) then return true end
    end
    return false
end

-- ---------------------------------------------------------------------------
-- Presence
-- ---------------------------------------------------------------------------

local presenceRegistry = {}

local function presenceUpdate(steam)
    if steam == nil or steam == "" then return end
    local s = tostring(steam)

    if presenceRegistry[s] == nil then
        presenceRegistry[s] = {
            firstSeen = os.time(),
            lastSeen = os.time()
        }
        log("presence + " .. s)
    else
        presenceRegistry[s].lastSeen = os.time()
    end
end

local function registerPresenceHook()
    local ok, err = pcall(function()
        RegisterHook("/Script/TheIsle.TIPlayerController:SetAdminCred",
            function(ctrlParam, _isAdmin)
                local ctrl
                pcall(function() ctrl = ctrlParam:get() end)
                if ctrl == nil then return end

                local steam = getControllerSteamId(ctrl)
                if steam ~= "" then presenceUpdate(steam) end
            end)
    end)

    if ok then
        log("presence heartbeat hook registered")
    else
        log("presence hook failed: " .. tostring(err))
    end
end

local function refreshPresence()
    local gm = findGameMode()
    if gm == nil then return end

    local now = os.time()

    for steam, entry in pairs(presenceRegistry) do
        local ctrl
        pcall(function() ctrl = gm:GetControllerBySteamId(steam) end)

        if ctrl == nil then
            presenceRegistry[steam] = nil
            log("presence - " .. steam)
        elseif (now - (entry.lastSeen or 0)) > config.presenceExpirySec then
            -- Controller still resolves, so player is online. Refresh the entry.
            entry.lastSeen = now
        else
            entry.lastSeen = now
        end
    end
end

local function enumerateOnlinePlayers()
    local out = {}
    local gm = findGameMode()
    if gm == nil then return out end

    local now = os.time()

    for steam, entry in pairs(presenceRegistry) do
        if (now - (entry.lastSeen or 0)) > config.presenceExpirySec then
            presenceRegistry[steam] = nil
        else
            local ctrl
            pcall(function() ctrl = gm:GetControllerBySteamId(steam) end)

            if ctrl == nil then
                presenceRegistry[steam] = nil
            else
                out[#out + 1] = {
                    steam = steam,
                    controller = ctrl,
                    pawn = livePawnFromCtrl(ctrl)
                }
            end
        end
    end

    return out
end

-- ---------------------------------------------------------------------------
-- Snapshot helpers
-- ---------------------------------------------------------------------------

local function safeNumber(fn)
    local ok, value = pcall(fn)
    if not ok or type(value) ~= "number" then return nil end
    return value
end

local function getSpecies(pawn)
    local species = ""
    pcall(function()
        local cls = pawn:GetClass()
        if cls ~= nil then species = safeString(cls:GetFullName()) end
    end)
    return species
end

local function pawnAddress(pawn)
    local addr
    pcall(function() addr = pawn:GetAddress() end)
    if addr == nil then return "0" end
    return string.format("0x%X", addr)
end

local function snapshotLine(p, ts)
    local pawn = p.pawn
    if pawn == nil then return nil end

    local growth = safeNumber(function() return pawn:GetGrowth() end)
    local hp = safeNumber(function() return pawn:GetHealth() end)
    local hpMax = safeNumber(function() return pawn:GetMaxHealth() end)
    local hunger = safeNumber(function() return pawn:GetHunger() end)
    local hungerMax = safeNumber(function() return pawn:GetMaxHunger() end)
    local thirst = safeNumber(function() return pawn:GetThirst() end)
    local thirstMax = safeNumber(function() return pawn:GetMaxThirst() end)
    local stamina = safeNumber(function() return pawn:GetStamina() end)
    local staminaMax = safeNumber(function() return pawn:GetMaxStamina() end)
    local food = safeNumber(function() return pawn:GetFood() end)
    local foodMax = safeNumber(function() return pawn:GetMaxFood() end)

    local x, y, z = nil, nil, nil
    pcall(function()
        local loc = pawn:K2_GetActorLocation()
        if loc ~= nil then
            x, y, z = loc.X, loc.Y, loc.Z
        end
    end)

    return string.format(
        '{"type":"snapshot","ts":%d,"steam":"%s","addr":"%s","species":"%s","growth":%s,' ..
        '"pos":{"x":%s,"y":%s,"z":%s},' ..
        '"vitals":{"hp":%s,"hpMax":%s,"hunger":%s,"hungerMax":%s,"thirst":%s,"thirstMax":%s,' ..
        '"stamina":%s,"staminaMax":%s,"food":%s,"foodMax":%s}}',
        ts,
        jsonEscape(p.steam),
        jsonEscape(pawnAddress(pawn)),
        jsonEscape(getSpecies(pawn)),
        numberJson(growth),
        numberJson(x), numberJson(y), numberJson(z),
        numberJson(hp), numberJson(hpMax),
        numberJson(hunger), numberJson(hungerMax),
        numberJson(thirst), numberJson(thirstMax),
        numberJson(stamina), numberJson(staminaMax),
        numberJson(food), numberJson(foodMax)
    )
end

local function snapshotOnce()
    if not config.enabled then return end

    local now = os.time()
    for _, p in ipairs(enumerateOnlinePlayers()) do
        if p.pawn ~= nil then
            local ok, line = pcall(function() return snapshotLine(p, now) end)
            if ok and line ~= nil then appendLine(EVENTS_PATH, line) end
        end
    end
end

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

local function makeText(message)
    if FText == nil then return message end
    local ok, ft = pcall(function() return FText(message) end)
    if ok and ft ~= nil then return ft end
    return message
end

local function notify(steam, message)
    local ctrl = controllerForSteam(steam)
    if ctrl == nil then return false, "player offline" end

    local ok, err = pcall(function()
        ctrl:ClientShowNotification(makeText(message))
    end)

    if not ok then
        return false, "notification failed: " .. tostring(err)
    end

    return true, "notification queued"
end

-- ---------------------------------------------------------------------------
-- Admin actions
-- ---------------------------------------------------------------------------

local function targetPawn(steam)
    if steam == nil or steam == "" then
        return nil, "missing steam"
    end

    local pawn = pawnForSteam(steam)
    if pawn == nil then return nil, "player has no live dino" end
    return pawn, nil
end

local function actionSetGrowth(steam, args)
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end

    local value = jsonReadNumber(args, "value")
    if value == nil then return false, "missing value" end
    if value < 0 then value = 0 end
    if value > 1 then value = 1 end

    local ok, callErr = pcall(function() pawn:SetGrowth(value) end)
    if not ok then return false, tostring(callErr) end

    return true, string.format("growth set to %.3f", value)
end

local function actionHeal(steam, _args)
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end

    local max = safeNumber(function() return pawn:GetMaxHealth() end)
    if max == nil then return false, "GetMaxHealth unavailable" end

    local ok, callErr = pcall(function() pawn:SetHealth(max) end)
    if not ok then return false, tostring(callErr) end

    return true, "healed"
end

local function actionKill(steam, _args)
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end

    local ok, callErr = pcall(function() pawn:SetHealth(0) end)
    if not ok then return false, tostring(callErr) end

    return true, "killed"
end

local function actionSetVital(steam, args)
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end

    local name = (jsonReadString(args, "name") or ""):lower()
    local value = jsonReadNumber(args, "value")
    if value == nil then return false, "missing value" end

    local setters = {
        health = "SetHealth",
        hunger = "SetHunger",
        thirst = "SetThirst",
        stamina = "SetStamina",
        food = "SetFood"
    }

    local setter = setters[name]
    if setter == nil then return false, "unsupported vital" end

    local ok, callErr = pcall(function()
        pawn[setter](pawn, value)
    end)

    if not ok then return false, tostring(callErr) end
    return true, name .. " set"
end

local function actionTeleport(steam, args)
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end

    local x = jsonReadNumber(args, "x")
    local y = jsonReadNumber(args, "y")
    local z = jsonReadNumber(args, "z")
    local yaw = jsonReadNumber(args, "yaw") or 0

    if x == nil or y == nil or z == nil then
        return false, "x/y/z required"
    end

    -- UE4SS accepts POD structs as Lua tables for reflected UFunction parameters.
    local ok, callErr = pcall(function()
        pawn:K2_TeleportTo(
            { X = x, Y = y, Z = z },
            { Pitch = 0, Yaw = yaw, Roll = 0 }
        )
    end)

    if not ok then return false, tostring(callErr) end
    return true, string.format("teleported to %.1f %.1f %.1f", x, y, z)
end

local function mutationValue(args, n)
    return jsonReadString(args, "slot" .. n)
        or jsonReadString(args, "Slot" .. n)
        or jsonReadString(args, "MutationSlot" .. n)
end

local function actionMutations(steam, args)
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end

    if FName == nil then
        return false, "FName constructor unavailable"
    end

    local liveMut
    local okRead, readErr = pcall(function()
        liveMut = pawn.ReplicatedMutationsData
    end)

    if not okRead or liveMut == nil then
        return false, "cannot read ReplicatedMutationsData: " .. tostring(readErr)
    end

    local changed = 0

    for i = 1, 4 do
        local value = mutationValue(args, i)
        if value ~= nil and value ~= "" then
            local okSet, setErr = pcall(function()
                liveMut["MutationSlot" .. i] = FName(value)
            end)

            if not okSet then
                return false, "slot" .. i .. ": " .. tostring(setErr)
            end

            changed = changed + 1
        end
    end

    if changed == 0 then return false, "no slots supplied" end

    local okPush, pushErr = pcall(function()
        pawn:SetReplicatedMutationsData(liveMut, true)
    end)

    if not okPush then return false, tostring(pushErr) end

    return true, string.format("%d mutation slot(s) updated", changed)
end

local function actionPrime(steam, args)
    local pawn, err = targetPawn(steam)
    if pawn == nil then return false, err end

    local value = jsonReadBool(args, "value")
    if value == nil then value = true end

    local ok, callErr = pcall(function()
        pawn:ServerSetPrimeEligible(value)
    end)

    if not ok then return false, tostring(callErr) end
    return true, value and "prime eligible" or "prime cleared"
end

local function actionNotify(steam, args)
    local message = jsonReadString(args, "message")
    if message == nil or message == "" then return false, "missing message" end
    return notify(steam, message)
end

local handlers = {
    setgrowth = actionSetGrowth,
    heal = actionHeal,
    kill = actionKill,
    setvital = actionSetVital,
    teleport = actionTeleport,
    mutations = actionMutations,
    prime = function(steam, args)
        if jsonReadBool(args, "value") == nil then
            args = '{"value":true}'
        end
        return actionPrime(steam, args)
    end,
    unprime = function(steam, _args)
        return actionPrime(steam, '{"value":false}')
    end,
    notify = actionNotify
}

local function emitResult(id, verb, steam, ok, msg)
    appendLine(RESULTS_PATH, string.format(
        '{"id":"%s","ts":%d,"verb":"%s","steam":"%s","ok":%s,"msg":"%s"}',
        jsonEscape(id or ""),
        os.time(),
        jsonEscape(verb or ""),
        jsonEscape(steam or ""),
        boolJson(ok == true),
        jsonEscape(msg or "")
    ))
end

local function processCommand(line)
    local id = jsonReadString(line, "id") or ""
    local verb = (jsonReadString(line, "verb") or ""):lower()
    local steam = jsonReadString(line, "steam") or ""
    local args = jsonReadObject(line, "args")

    if verb == "" then
        emitResult(id, verb, steam, false, "missing verb")
        return
    end

    local handler = handlers[verb]
    if handler == nil then
        emitResult(id, verb, steam, false, "unknown verb")
        return
    end

    local ok, success, msg = pcall(function()
        local s, m = handler(steam, args)
        return s, m
    end)

    if not ok then
        emitResult(id, verb, steam, false, "handler exception: " .. tostring(success))
        return
    end

    emitResult(id, verb, steam, success == true, msg or "")
end

local function processCommands()
    if not config.enabled then return end

    local f = io.open(COMMANDS_PATH, "rb")
    if f == nil then return end
    f:close()

    local processing = COMMANDS_PATH .. ".processing"
    os.remove(processing)

    local renamed = os.rename(COMMANDS_PATH, processing)
    if not renamed then return end

    local body = readAll(processing)
    if body ~= nil and body ~= "" then
        for line in body:gmatch("[^\r\n]+") do
            processCommand(line)
        end
    end

    os.remove(processing)
end

-- ---------------------------------------------------------------------------
-- Optional read-only hit hook.
--
-- The C++ side-mod is preferred for address extraction because it can inspect
-- FFrame locals safely. This Lua hook is intentionally diagnostic only.
-- ---------------------------------------------------------------------------

local function registerDiagnosticDamageHook()
    local ok, err = pcall(function()
        RegisterHook("/Script/TheIsle.TICharacterBase:ApplyDamage",
            function(_self, _target, ...)
                -- Deliberately no heavy calls here.
                -- The native side-mod writes precise attacker/target addresses.
            end)
    end)

    if ok then
        log("ApplyDamage diagnostic hook registered")
    else
        log("ApplyDamage diagnostic hook unavailable: " .. tostring(err))
    end
end

-- ---------------------------------------------------------------------------
-- Boot
-- ---------------------------------------------------------------------------

loadConfig()
registerPresenceHook()
registerDiagnosticDamageHook()

LoopInGameThreadWithDelay(config.presenceRefreshMs, function()
    pcall(refreshPresence)
end)

LoopInGameThreadWithDelay(config.snapshotIntervalMs, function()
    pcall(snapshotOnce)
end)

LoopInGameThreadWithDelay(config.commandPollMs, function()
    pcall(processCommands)
end)

log("loaded")
