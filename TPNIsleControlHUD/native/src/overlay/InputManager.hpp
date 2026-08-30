#pragma once
#include <windows.h>
#include <string>
#include <optional>

class InputManager {
public:
    static constexpr int ToggleHotkeyId = 1;
    bool Register(HWND owner, const std::wstring& key);
    void Unregister(HWND owner);
    bool PollMapPressed(bool enabled);
    bool PollFactionPressed(bool enabled);
    bool SetVoiceKey(const std::wstring& key);
    std::optional<bool> PollVoiceTransition(bool enabled);
    std::optional<bool> ForceVoiceStop();
private:
    static std::optional<int> ParseKey(const std::wstring& key);
    bool toggleRegistered_{false};
    bool mapKeyDown_{false};
    bool factionKeyDown_{false};
    int voiceVirtualKey_{L'V'};
    bool voiceKeyDown_{false};
};
