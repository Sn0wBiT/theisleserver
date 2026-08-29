#pragma once
#include <windows.h>
#include <string>

class InputManager {
public:
    static constexpr int ToggleHotkeyId = 1;
    bool Register(HWND owner, const std::wstring& key);
    void Unregister(HWND owner);
    bool PollMapPressed(bool enabled);
    bool PollFactionPressed(bool enabled);
private:
    bool toggleRegistered_{false};
    bool mapKeyDown_{false};
    bool factionKeyDown_{false};
};
