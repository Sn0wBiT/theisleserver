#include "config/Config.hpp"

#include <windows.h>
#include <fstream>
#include <regex>
#include <sstream>

namespace {
std::wstring Utf8ToWide(const std::string& value) {
    if (value.empty()) return {};
    const int size = MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0);
    std::wstring result(size, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), result.data(), size);
    return result;
}

std::string StringValue(const std::string& json, const char* key, const std::string& fallback) {
    const std::regex pattern(std::string{"\""} + key + R"regex("\s*:\s*"([^"]*)")regex");
    std::smatch match;
    return std::regex_search(json, match, pattern) ? match[1].str() : fallback;
}

bool BoolValue(const std::string& json, const char* key, bool fallback) {
    const std::regex pattern(std::string{"\""} + key + R"("\s*:\s*(true|false))");
    std::smatch match;
    return std::regex_search(json, match, pattern) ? match[1].str() == "true" : fallback;
}
}

Config Config::Load(const std::filesystem::path& path) {
    Config config;
    std::ifstream input(path, std::ios::binary);
    if (!input) return config;
    std::ostringstream buffer;
    buffer << input.rdbuf();
    const auto json = buffer.str();
    config.development = BoolValue(json, "development", config.development);
    config.enableDevTools = BoolValue(json, "enableDevTools", config.enableDevTools);
    config.frontendDevUrl = Utf8ToWide(StringValue(json, "frontendDevUrl", "http://localhost:5173"));
    config.apiOrigin = Utf8ToWide(StringValue(json, "apiOrigin", "https://api.invalid"));
    config.overlayHotkey = Utf8ToWide(StringValue(json, "overlayHotkey", "F6"));

    const std::regex arrayPattern(R"("gameExecutables"\s*:\s*\[([^\]]*)\])");
    const std::regex itemPattern(R"regex("([^"]+)")regex");
    std::smatch arrayMatch;
    if (std::regex_search(json, arrayMatch, arrayPattern)) {
        std::vector<std::wstring> executables;
        const std::string values = arrayMatch[1].str();
        for (std::sregex_iterator it(values.begin(), values.end(), itemPattern), end; it != end; ++it) {
            executables.push_back(Utf8ToWide((*it)[1].str()));
        }
        if (!executables.empty()) config.gameExecutables = std::move(executables);
    }
    return config;
}
