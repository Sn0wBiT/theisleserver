#include "overlay/InputManager.hpp"
#include <cwctype>

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

std::optional<int> InputManager::ParseKey(const std::wstring& key) {
    if (key.size() == 1) {
        const wchar_t value = std::towupper(key[0]);
        if ((value >= L'A' && value <= L'Z') || (value >= L'0' && value <= L'9')) return static_cast<int>(value);
    }
    if (key.size() >= 2 && std::towupper(key[0]) == L'F') {
        try { const int number = std::stoi(key.substr(1)); if (number >= 1 && number <= 24) return VK_F1 + number - 1; } catch (...) {}
    }
    if (key == L"SPACE") return VK_SPACE;
    if (key == L"MOUSE4") return VK_XBUTTON1;
    if (key == L"MOUSE5") return VK_XBUTTON2;
    return std::nullopt;
}

bool InputManager::SetVoiceKey(const std::wstring& key) {
    const auto parsed = ParseKey(key);
    if (!parsed) return false;
    voiceVirtualKey_ = *parsed;
    voiceKeyDown_ = false;
    return true;
}

std::optional<bool> InputManager::PollVoiceTransition(bool enabled) {
    const bool down = enabled && (GetAsyncKeyState(voiceVirtualKey_) & 0x8000) != 0;
    if (down == voiceKeyDown_) return std::nullopt;
    voiceKeyDown_ = down;
    return down;
}

std::optional<bool> InputManager::ForceVoiceStop() {
    if (!voiceKeyDown_) return std::nullopt;
    voiceKeyDown_ = false;
    return false;
}
