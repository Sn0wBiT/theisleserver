#pragma once

#include <filesystem>
#include <string>
#include <vector>

struct Config {
    bool development{false};
    bool enableDevTools{false};
    std::wstring frontendDevUrl{L"http://localhost:5173"};
    std::wstring overlayHotkey{L"F6"};
    std::vector<std::wstring> gameExecutables{L"TheIsle-Win64-Shipping.exe", L"TheIsle.exe"};

    static Config Load(const std::filesystem::path& path);
};
