local Runtime = require("core.runtime")
local Transport = require("core.transport")
local Players = require("game.players")
local Presence = require("game.presence")
local Messaging = require("features.messaging")
local QuestNpc = require("features.quest_npc")
local Chat = {}

local function unwrap(param)
    if param == nil then return nil end
    local value
    local ok = pcall(function() value = param:get() end)
    if ok and value ~= nil then return value end
    return param
end

function Chat.registerHook()
    local eventTypes = {
        ["/quests"] = "quest_request", quests = "quest_request",
        ["/help"] = "help_request", help = "help_request",
        ["/human"] = "human_request", human = "human_request",
        ["/revive"] = "revive_request", revive = "revive_request"
    }
    local ok, err = pcall(function()
        RegisterHook("/Script/TheIsle.TIPlayerController:ServerExecuteChatCommand",
            function(controllerParam, commandParam)
                local controller = unwrap(controllerParam)
                if controller == nil then return end
                local command = Runtime.safeString(unwrap(commandParam)):match("^%s*(.-)%s*$") or ""
                command = command:lower()
                -- ServerExecuteChatCommand differs between game builds: some
                -- pass `/quests 2`, while others strip the leading slash and
                -- pass `quests 2`. Parse special commands from a normalized
                -- value so both forms behave identically.
                local bareCommand = command:gsub("^/", "")
                local spawnQuestId, spawnSpecies, spawnAcceptMode = bareCommand:match(
                    "^spawnquestnpc%s+([%w_%-]+)%s*([%w_%-]*)%s*([%w_%-]*)%s*$")
                if spawnQuestId ~= nil then
                    local steam = Players.getControllerSteamId(controller)
                    if steam == "" then return end
                    if not Players.isAdmin(steam) then
                        Messaging.notify(steam, "Bạn không có quyền sử dụng /spawnquestnpc")
                        Runtime.log(string.format("admin command /spawnquestnpc denied for %s", steam))
                        return
                    end
                    -- Allow the short form `/spawnquestnpc <quest-id> anywhere`
                    -- without requiring a species argument.
                    if spawnSpecies == "near" or spawnSpecies == "anywhere" then
                        spawnAcceptMode, spawnSpecies = spawnSpecies, ""
                    end
                    local success, message = QuestNpc.spawn(steam, spawnQuestId,
                        spawnSpecies ~= "" and spawnSpecies or nil,
                        spawnAcceptMode ~= "" and spawnAcceptMode or nil)
                    Messaging.notify(steam, "Quest NPC test: " .. tostring(message))
                    Runtime.log(string.format("spawn quest NPC %s for %s: %s (%s)", spawnQuestId, steam,
                        success and "ok" or "failed", tostring(message)))
                    return
                end
                local questPage = bareCommand:match("^quests%s*(%d*)%s*$")
                if questPage ~= nil then
                    local steam = Players.getControllerSteamId(controller)
                    if steam == "" then return end
                    Presence.update(steam)
                    local sent = Transport.sendEvent(string.format(
                        '{"type":"quest_request","ts":%d,"steam":"%s","page":%d}',
                        os.time(), Runtime.jsonEscape(steam), tonumber(questPage) or 1))
                    Runtime.log(string.format("quest page %s from %s: %s", questPage == "" and "1" or questPage,
                        steam, sent and "queued" or "transport failed"))
                    return
                end
                local acceptQuestId = bareCommand:match("^accept%s+([%w_%-]+)%s*$")
                if acceptQuestId ~= nil then
                    local steam = Players.getControllerSteamId(controller)
                    if steam == "" then return end
                    Presence.update(steam)
                    local allowed, denyMessage = QuestNpc.canAccept(steam, acceptQuestId)
                    if not allowed then
                        Messaging.notify(steam, denyMessage)
                        Runtime.log(string.format("quest accept %s denied for %s: %s", acceptQuestId, steam,
                            tostring(denyMessage)))
                        return
                    end
                    local sent = Transport.sendEvent(string.format(
                        '{"type":"quest_accept","ts":%d,"steam":"%s","questId":"%s"}',
                        os.time(), Runtime.jsonEscape(steam), Runtime.jsonEscape(acceptQuestId)))
                    Runtime.log(string.format("quest accept %s from %s: %s", acceptQuestId, steam,
                        sent and "queued" or "transport failed"))
                    return
                end
                local eventType = eventTypes[command]
                if eventType == nil then return end
                local steam = Players.getControllerSteamId(controller)
                if steam == "" then
                    Runtime.log(command .. " ignored: could not resolve requesting Steam ID")
                    return
                end
                if eventType == "revive_request" and not Players.isAdmin(steam) then
                    Runtime.log(string.format("admin command %s denied for %s", command, steam))
                    Messaging.notify(steam, "Bạn không có quyền sử dụng /revive")
                    return
                end
                Presence.update(steam)
                local sent = Transport.sendEvent(string.format('{"type":"%s","ts":%d,"steam":"%s"}',
                    eventType, os.time(), Runtime.jsonEscape(steam)))
                Runtime.log(string.format("chat command %s from %s: %s", command, steam,
                    sent and "queued" or "transport failed"))
            end)
    end)
    Runtime.log(ok and "player chat command hook registered (/help, /quests, /accept, /human, /revive)"
        or ("player chat command hook failed: " .. tostring(err)))
end

return Chat
