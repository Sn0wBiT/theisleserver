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
    mapRegistered_ = RegisterHotKey(owner, MapHotkeyId, MOD_NOREPEAT, L'M') != FALSE;
    return toggleRegistered_ && mapRegistered_;
}

void InputManager::Unregister(HWND owner) {
    if (toggleRegistered_) UnregisterHotKey(owner, ToggleHotkeyId);
    if (mapRegistered_) UnregisterHotKey(owner, MapHotkeyId);
    toggleRegistered_ = false;
    mapRegistered_ = false;
}
