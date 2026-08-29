#include "overlay/InputManager.hpp"

bool InputManager::Register(HWND owner, const std::wstring& key) {
    UINT virtualKey = VK_F6;
    if (key.size() >= 2 && (key[0] == L'F' || key[0] == L'f')) {
        try {
            const int number = std::stoi(key.substr(1));
            if (number >= 1 && number <= 24) virtualKey = VK_F1 + number - 1;
        } catch (...) {}
    }
    toggleRegistered_ = RegisterHotKey(owner, ToggleHotkeyId, MOD_NOREPEAT, virtualKey) != FALSE;
    return toggleRegistered_;
}

void InputManager::Unregister(HWND owner) {
    if (toggleRegistered_) UnregisterHotKey(owner, ToggleHotkeyId);
    toggleRegistered_ = false;
    mapKeyDown_ = false;
    factionKeyDown_ = false;
}

bool InputManager::PollMapPressed(bool enabled) {
    const bool keyDown = (GetAsyncKeyState(L'M') & 0x8000) != 0;
    const bool pressed = enabled && keyDown && !mapKeyDown_;
    mapKeyDown_ = keyDown;
    return pressed;
}

bool InputManager::PollFactionPressed(bool enabled) {
    const bool keyDown = (GetAsyncKeyState(VK_F7) & 0x8000) != 0;
    const bool pressed = enabled && keyDown && !factionKeyDown_;
    factionKeyDown_ = keyDown;
    return pressed;
}
