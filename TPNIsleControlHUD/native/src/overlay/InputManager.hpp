#pragma once
#include <windows.h>
#include <string>

class InputManager {
public:
    static constexpr int ToggleHotkeyId = 1;
    static constexpr int MapHotkeyId = 2;
    bool Register(HWND owner, const std::wstring& key);
    void Unregister(HWND owner);
private:
    bool toggleRegistered_{false};
    bool mapRegistered_{false};
};
