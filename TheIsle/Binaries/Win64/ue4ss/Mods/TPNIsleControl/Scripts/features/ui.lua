local Runtime = require("core.runtime")
local Players = require("game.players")
local Presence = require("game.presence")
local Ui = { scanCompleted = false }

local function reflectionName(value)
    local name = ""
    pcall(function() name = value:GetFName():ToString() end)
    return name
end

-- Exceptions raised by a Lua callback invoked from UE4SS reflection can escape
-- the inner pcall and abort the enclosing ForEachFunction call.  Keep every
-- callback non-throwing, especially when probing methods that vary by version.
local function safeReflectionNumber(value, methodName)
    local number
    pcall(function()
        local method = value[methodName]
        if type(method) == "function" then number = tonumber(method(value)) end
    end)
    return number or 0
end

local function reflectionClassName(value)
    local name = ""
    pcall(function() name = Runtime.safeString(value:GetClass():GetFName()) end)
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
                pcall(function()
                    local name = reflectionName(fn)
                    if not isCandidate(name) then return end
                    functionCount = functionCount + 1
                    local flags = safeReflectionNumber(fn, "GetFunctionFlags")
                    Runtime.appendLine(path, string.format("FUNCTION class=%s name=%s flags=0x%X",
                        className, name, flags))
                    pcall(function()
                        fn:ForEachProperty(function(property)
                            pcall(function()
                                Runtime.appendLine(path,
                                    string.format("  PARAM name=%s type=%s offset=0x%X size=%d",
                                        reflectionName(property), reflectionClassName(property),
                                        safeReflectionNumber(property, "GetOffset_Internal"),
                                        safeReflectionNumber(property, "GetSize")))
                            end)
                            return false
                        end)
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
