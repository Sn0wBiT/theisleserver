local Runtime = require("core.runtime")
local Players = {}

local GAME_MODE_CLASSES = {
    "BP_SurvivalGameMode_C",
    "TISurvivalGameMode",
    "TIGameModeBase",
    "GameModeBase"
}

function Players.findGameMode()
    for _, name in ipairs(GAME_MODE_CLASSES) do
        local gameMode
        pcall(function() gameMode = FindFirstOf(name) end)
        if gameMode ~= nil then return gameMode end
    end
    return nil
end

function Players.liveAddress(object)
    if object == nil then return nil end
    local address
    pcall(function() address = object:GetAddress() end)
    if type(address) ~= "number" or address == 0 then return nil end
    return address
end

function Players.livePawnFromController(controller)
    if controller == nil then return nil end
    local pawn
    pcall(function() pawn = controller:K2_GetPawn() end)
    if Players.liveAddress(pawn) == nil then return nil end
    return pawn
end

function Players.normalizeSteamId(value)
    return Runtime.safeString(value):match("(%d%d%d%d%d%d%d%d%d%d%d%d%d%d%d%d%d)") or ""
end

function Players.getControllerSteamId(controller)
    if controller == nil then return "" end
    local steamId
    pcall(function() steamId = controller:GetSteamId() end)
    local normalized = Players.normalizeSteamId(steamId)
    if normalized ~= "" then return normalized end
    pcall(function() steamId = controller.SteamId end)
    return Players.normalizeSteamId(steamId)
end

function Players.controllerForSteam(steam)
    if steam == nil or steam == "" then return nil end
    local gameMode = Players.findGameMode()
    if gameMode == nil then return nil end
    local controller
    pcall(function() controller = gameMode:GetControllerBySteamId(steam) end)
    return controller
end

function Players.pawnForSteam(steam)
    return Players.livePawnFromController(Players.controllerForSteam(steam))
end

function Players.getSpecies(pawn)
    local species = ""
    pcall(function()
        local class = pawn:GetClass()
        if class ~= nil then species = Runtime.safeString(class:GetFullName()) end
    end)
    return species
end

function Players.isAdmin(steam)
    if steam == nil or steam == "" then return false end
    for _, adminSteam in ipairs(Runtime.config.adminSteamIds or {}) do
        if tostring(adminSteam) == tostring(steam) then return true end
    end
    return false
end

return Players
