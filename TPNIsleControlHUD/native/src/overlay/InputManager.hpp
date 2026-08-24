#pragma once
#include <windows.h>
#include <string>

class InputManager {
public:
    static constexpr int ToggleHotkeyId = 1;
    bool Register(HWND owner, const std::wstring& key);
    void Unregister(HWND owner);
private:
    bool registered_{false};
};

