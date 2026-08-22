local Runtime = require("core.runtime")
local Transport = require("core.transport")
local Messaging = require("features.messaging")
local Actions = require("commands.actions")
local Processor = {}

local function emitResult(id, verb, steam, ok, message)
    Runtime.appendLine(Runtime.paths.results, string.format(
        '{"id":"%s","ts":%d,"verb":"%s","steam":"%s","ok":%s,"msg":"%s"}',
        Runtime.jsonEscape(id or ""), os.time(), Runtime.jsonEscape(verb or ""),
        Runtime.jsonEscape(steam or ""), Runtime.boolJson(ok == true), Runtime.jsonEscape(message or "")))
end

function Processor.processLine(line)
    local id = Runtime.jsonReadString(line, "id") or ""
    local verb = (Runtime.jsonReadString(line, "verb") or ""):lower()
    local steam = Runtime.jsonReadString(line, "steam") or ""
    local args = Runtime.jsonReadObject(line, "args")
    if verb == "" then emitResult(id, verb, steam, false, "missing verb"); return end
    local handler = Actions.handlers[verb]
    if handler == nil then emitResult(id, verb, steam, false, "unknown verb"); return end
    local ok, success, message = pcall(function() return handler(steam, args) end)
    if not ok then emitResult(id, verb, steam, false, "handler exception: " .. tostring(success)); return end
    if verb == "human" then
        pcall(function()
            Messaging.privateChat(steam, "Human test: " .. tostring(message or (success and "done" or "failed")))
        end)
    end
    emitResult(id, verb, steam, success == true, message or "")
end

function Processor.poll()
    if not Runtime.config.enabled then return end
    if Transport.isHttp() then Transport.pollHttpCommands(Processor.processLine); return end
    local commandsPath = Runtime.paths.commands
    local file = io.open(commandsPath, "rb")
    if file == nil then return end
    file:close()
    local processingPath = commandsPath .. ".processing"
    os.remove(processingPath)
    if not os.rename(commandsPath, processingPath) then return end
    local body = Runtime.readAll(processingPath)
    if body ~= nil and body ~= "" then
        for line in body:gmatch("[^\r\n]+") do Processor.processLine(line) end
    end
    os.remove(processingPath)
end

return Processor
