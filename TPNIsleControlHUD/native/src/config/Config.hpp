#pragma once

#include <string>
#include <vector>

struct Config {
    const bool development{false};
    const bool enableDevTools{false};
    const std::wstring frontendDevUrl{L"http://localhost:5173"};
    const std::wstring apiOrigin{L"https://api.invalid"};
    const std::wstring overlayHotkey{L"F6"};
    const std::vector<std::wstring> gameExecutables{
        L"TheIsleClient-Win64-Shipping.exe",
        L"TheIsle-Win64-Shipping.exe",
        L"TheIsle.exe"
    };
};
