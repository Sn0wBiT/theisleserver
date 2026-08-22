local Runtime = {}

Runtime.MOD_NAME = "TPNIsleControl"
Runtime.SAVED_DIR = "ue4ss/Mods/TPNIsleControl/Saved"
Runtime.paths = {
    config = Runtime.SAVED_DIR .. "/config.json",
    events = Runtime.SAVED_DIR .. "/events.ndjson",
    commands = Runtime.SAVED_DIR .. "/commands.ndjson",
    results = Runtime.SAVED_DIR .. "/results.ndjson"
}

Runtime.config = {
    enabled = true,
    transport = "file",
    bridgeUrl = "http://127.0.0.1:31990/game/sync",
    bridgeToken = "",
    snapshotIntervalMs = 5000,
    commandPollMs = 1000,
    presenceRefreshMs = 15000,
    presenceExpirySec = 180,
    adminSteamIds = {}
}

function Runtime.log(message)
    print(string.format("[%s] %s\n", Runtime.MOD_NAME, tostring(message)))
end

function Runtime.readAll(path)
    local file = io.open(path, "rb")
    if file == nil then return nil end
    local contents = file:read("*a")
    file:close()
    return contents
end

function Runtime.appendLine(path, line)
    local file = io.open(path, "ab")
    if file == nil then
        Runtime.log("cannot append: " .. tostring(path))
        return false
    end
    file:write(line)
    file:write("\n")
    file:close()
    return true
end

function Runtime.jsonEscape(value)
    if value == nil then return "" end
    local escaped = tostring(value)
    escaped = escaped:gsub("\\", "\\\\")
    escaped = escaped:gsub('"', '\\"')
    escaped = escaped:gsub("\n", "\\n")
    escaped = escaped:gsub("\r", "\\r")
    escaped = escaped:gsub("\t", "\\t")
    return escaped
end

function Runtime.jsonReadString(body, fieldName)
    return string.match(body or "", '"' .. fieldName .. '"%s*:%s*"([^"]*)"')
end

function Runtime.jsonReadNumber(body, fieldName)
    return tonumber(string.match(body or "", '"' .. fieldName .. '"%s*:%s*(-?%d+%.?%d*)'))
end

function Runtime.jsonReadBool(body, fieldName)
    local value = string.match(body or "", '"' .. fieldName .. '"%s*:%s*([%a]+)')
    if value == "true" then return true end
    if value == "false" then return false end
    return nil
end

function Runtime.jsonReadObject(body, fieldName)
    local suffix = string.match(body or "", '"' .. fieldName .. '"%s*:%s*(.*)')
    if suffix == nil then return "{}" end
    return string.match(suffix, "(%b{})") or "{}"
end

function Runtime.jsonReadStringArray(body, fieldName)
    local values = {}
    local array = string.match(body or "", '"' .. fieldName .. '"%s*:%s*%[([^%]]*)%]')
    if array == nil then return values end
    for value in string.gmatch(array, '"([^"]*)"') do
        values[#values + 1] = value
    end
    return values
end

function Runtime.boolJson(value)
    return value and "true" or "false"
end

function Runtime.numberJson(value)
    if type(value) ~= "number" or value ~= value or value == math.huge or value == -math.huge then
        return "null"
    end
    return tostring(value)
end

function Runtime.safeString(value)
    if value == nil then return "" end
    local okText, text = pcall(function() return value:ToString() end)
    if okText and type(text) == "string" and text ~= "" then return text end
    local okString, stringValue = pcall(function() return tostring(value) end)
    if okString and type(stringValue) == "string" and stringValue ~= ""
        and not stringValue:find("^UObject") then
        return stringValue
    end
    return ""
end

function Runtime.safeNumber(callback)
    local ok, value = pcall(callback)
    if not ok or type(value) ~= "number" then return nil end
    return value
end

function Runtime.loadConfig()
    local body = Runtime.readAll(Runtime.paths.config)
    if body == nil or body == "" then
        Runtime.log("config.json missing; defaults active")
        return
    end

    local config = Runtime.config
    local value = Runtime.jsonReadBool(body, "enabled")
    if value ~= nil then config.enabled = value end
    value = Runtime.jsonReadString(body, "transport")
    if value == "http" or value == "file" then config.transport = value end
    value = Runtime.jsonReadString(body, "bridgeUrl")
    if value ~= nil and value ~= "" then config.bridgeUrl = value end
    value = Runtime.jsonReadString(body, "bridgeToken")
    if value ~= nil then config.bridgeToken = value end

    for _, option in ipairs({
        { "snapshotIntervalMs", 1000 },
        { "commandPollMs", 250 },
        { "presenceRefreshMs", 5000 },
        { "presenceExpirySec", 30 }
    }) do
        value = Runtime.jsonReadNumber(body, option[1])
        if value ~= nil and value >= option[2] then config[option[1]] = math.floor(value) end
    end

    config.adminSteamIds = Runtime.jsonReadStringArray(body, "adminSteamIds")
    Runtime.log(string.format("config loaded: snapshots=%dms commands=%dms admins=%d",
        config.snapshotIntervalMs, config.commandPollMs, #config.adminSteamIds))
end

return Runtime
