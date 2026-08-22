local Runtime = require("core.runtime")
local Players = require("game.players")
local Presence = require("game.presence")
local Ui = { scanCompleted = false }

local function reflectionName(value)
    local name = ""
    pcall(function() name = value:GetFName():ToString() end)
    return name
end

local function isCandidate(name)
    name = (name or ""):lower()
    for _, token in ipairs({
        "client", "chat", "hud", "message", "notification", "prompt",
        "announcement", "dialog", "widget", "quest", "toast", "banner"
    }) do
        if name:find(token, 1, true) ~= nil then return true end
    end
    return false
end

function Ui.scan(controller, reason)
    if controller == nil then return false, "no live player controller" end
    local class
    local okClass, classErr = pcall(function() class = controller:GetClass() end)
    if not okClass or class == nil then
        return false, "cannot resolve controller class: " .. tostring(classErr)
    end

    local path = Runtime.paths.uiCandidates
    Runtime.appendLine(path, string.format("=== UI scan ts=%d reason=%s controller=%s ===",
        os.time(), tostring(reason or "manual"), Runtime.safeString(class:GetFullName())))
    local classCount, functionCount = 0, 0
    local current = class
    while current ~= nil and classCount < 64 do
        classCount = classCount + 1
        local className = Runtime.safeString(current:GetFullName())
        local okFunctions, functionErr = pcall(function()
            current:ForEachFunction(function(fn)
                local name = reflectionName(fn)
                if not isCandidate(name) then return false end
                functionCount = functionCount + 1
                local flags = 0
                pcall(function() flags = fn:GetFunctionFlags() end)
                Runtime.appendLine(path, string.format("FUNCTION class=%s name=%s flags=0x%X",
                    className, name, tonumber(flags) or 0))
                pcall(function()
                    fn:ForEachProperty(function(property)
                        Runtime.appendLine(path, string.format("  PARAM name=%s type=%s offset=0x%X size=%d",
                            reflectionName(property), Runtime.safeString(property:GetClass():GetFName()),
                            tonumber(property:GetOffset_Internal()) or 0, tonumber(property:GetSize()) or 0))
                        return false
                    end)
                end)
                return false
            end)
        end)
        if not okFunctions then
            Runtime.appendLine(path, "ERROR class=" .. className .. " message=" .. tostring(functionErr))
        end
        local parent
        pcall(function() parent = current:GetSuperStruct() end)
        if parent == current then break end
        current = parent
    end
    Runtime.appendLine(path, string.format("=== UI scan complete classes=%d candidates=%d ===",
        classCount, functionCount))
    Runtime.log(string.format("UI scan complete: %d candidate functions -> %s", functionCount, path))
    Ui.scanCompleted = true
    return true, string.format("%d UI candidate functions", functionCount)
end

function Ui.scanFirstPlayer(controller)
    if not Ui.scanCompleted then Ui.scan(controller, "first-player") end
end

function Ui.registerCommand()
    if type(RegisterConsoleCommandGlobalHandler) ~= "function" then
        Runtime.log("tpn.ui.scan unavailable: global console command API missing")
        return
    end
    local ok, err = pcall(function()
        RegisterConsoleCommandGlobalHandler("tpn.ui.scan", function(_command, parameters, output)
            local controller
            local steam = parameters and parameters[1] or nil
            if steam ~= nil and steam ~= "" then controller = Players.controllerForSteam(steam) end
            if controller == nil then controller = Presence.firstOnlineController() end
            local _, message = Ui.scan(controller, "console")
            pcall(function() output:Log("TPNIsleControl: " .. tostring(message)) end)
            return true
        end)
    end)
    Runtime.log(ok and "UI discovery command registered (tpn.ui.scan [steam-id])"
        or ("UI discovery command failed: " .. tostring(err)))
end

return Ui
