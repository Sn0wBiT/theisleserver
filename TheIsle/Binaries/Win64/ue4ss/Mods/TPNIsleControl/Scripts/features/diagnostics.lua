local Runtime = require("core.runtime")
local Diagnostics = {}

function Diagnostics.registerDamageHook()
    local ok, err = pcall(function()
        RegisterHook("/Script/TheIsle.TICharacterBase:ApplyDamage", function(_self, _target, ...)
            -- Address extraction stays in the native side-mod, where FFrame locals are safe.
        end)
    end)
    Runtime.log(ok and "ApplyDamage diagnostic hook registered"
        or ("ApplyDamage diagnostic hook unavailable: " .. tostring(err)))
end

return Diagnostics
