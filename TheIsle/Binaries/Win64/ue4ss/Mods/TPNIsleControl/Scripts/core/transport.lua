local Runtime = require("core.runtime")
local Transport = {}

local activeTransport = "file"
local pendingAcknowledgements = {}
local processedCommands = {}

function Transport.configure()
    if Runtime.config.transport ~= "http" then
        activeTransport = "file"
        Runtime.log("file IPC transport active")
        return
    end
    if type(TPNIsleControlHttpConfigure) ~= "function"
        or type(TPNIsleControlHttpEnqueue) ~= "function"
        or type(TPNIsleControlHttpPoll) ~= "function" then
        activeTransport = "file"
        Runtime.log("WinHTTP transport unavailable; file IPC fallback active")
        return
    end
    local ok, configured = pcall(function()
        return TPNIsleControlHttpConfigure(Runtime.config.bridgeUrl, Runtime.config.bridgeToken)
    end)
    if ok and configured == true then
        activeTransport = "http"
        Runtime.log("WinHTTP transport active: " .. Runtime.config.bridgeUrl)
    else
        activeTransport = "file"
        Runtime.log("WinHTTP configuration failed; file IPC fallback active")
    end
end

function Transport.isHttp()
    return activeTransport == "http"
end

local function acknowledgementJson()
    local values = {}
    for id, _ in pairs(pendingAcknowledgements) do
        values[#values + 1] = '"' .. Runtime.jsonEscape(id) .. '"'
    end
    table.sort(values)
    return "[" .. table.concat(values, ",") .. "]"
end

function Transport.enqueueSync(snapshots, events, positions)
    if not Transport.isHttp() then return false end
    local body = string.format(
        '{"snapshots":[%s],"positions":[%s],"events":[%s],"acknowledgements":%s}',
        table.concat(snapshots or {}, ","),
        table.concat(positions or {}, ","),
        table.concat(events or {}, ","),
        acknowledgementJson())
    local ok, queued = pcall(function() return TPNIsleControlHttpEnqueue(body) end)
    if not ok or queued ~= true then return false end
    pendingAcknowledgements = {}
    return true
end

function Transport.enqueuePositions(positions)
    if not Transport.isHttp() then return false end
    local body = string.format(
        '{"snapshots":[],"positions":[%s],"events":[],"acknowledgements":[]}',
        table.concat(positions or {}, ","))
    local ok, queued = pcall(function() return TPNIsleControlHttpEnqueue(body) end)
    return ok and queued == true
end

function Transport.sendEvent(line)
    if Transport.enqueueSync({}, { line }) then return true end
    return Runtime.appendLine(Runtime.paths.events, line)
end

function Transport.pollHttpCommands(processCommand)
    while true do
        local ok, body = pcall(function() return TPNIsleControlHttpPoll() end)
        if not ok or body == nil or body == "" then break end
        for line in tostring(body):gmatch("[^\r\n]+") do
            local id = Runtime.jsonReadString(line, "id") or ""
            if id == "" or processedCommands[id] == nil then
                processCommand(line)
                if id ~= "" then processedCommands[id] = os.time() end
            end
            if id ~= "" then pendingAcknowledgements[id] = true end
        end
    end
    local cutoff = os.time() - 3600
    for id, processedAt in pairs(processedCommands) do
        if processedAt < cutoff then processedCommands[id] = nil end
    end
end

return Transport
