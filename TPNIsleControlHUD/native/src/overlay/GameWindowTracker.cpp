#include "overlay/GameWindowTracker.hpp"

#include <filesystem>
#include <utility>

namespace { struct SearchContext { const GameWindowTracker* tracker; HWND result; }; }

GameWindowTracker::GameWindowTracker(std::vector<std::wstring> executableNames)
    : executableNames_(std::move(executableNames)) {}

bool GameWindowTracker::Find() {
    SearchContext context{this, nullptr};
    EnumWindows([](HWND window, LPARAM parameter) -> BOOL {
        auto* search = reinterpret_cast<SearchContext*>(parameter);
        if (!IsWindowVisible(window) || GetWindow(window, GW_OWNER) != nullptr) return TRUE;
        if (search->tracker->MatchesExecutable(window)) { search->result = window; return FALSE; }
        return TRUE;
    }, reinterpret_cast<LPARAM>(&context));
    gameWindow_ = context.result;
    Update();
    return IsFound();
}

void GameWindowTracker::Update() {
    if (!gameWindow_ || !IsWindow(gameWindow_) || !MatchesExecutable(gameWindow_)) { Clear(); return; }
    visible_ = IsWindowVisible(gameWindow_) != FALSE;
    minimized_ = IsIconic(gameWindow_) != FALSE;
    foreground_ = GetForegroundWindow() == gameWindow_;
    RECT client{};
    POINT origin{};
    if (!GetClientRect(gameWindow_, &client) || !ClientToScreen(gameWindow_, &origin)) { Clear(); return; }
    clientRect_ = {origin.x, origin.y, origin.x + client.right, origin.y + client.bottom};
}

bool GameWindowTracker::MatchesExecutable(HWND window) const {
    DWORD processId = 0;
    GetWindowThreadProcessId(window, &processId);
    if (!processId) return false;
    HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, processId);
    if (!process) return false;
    std::wstring path(32768, L'\0');
    DWORD length = static_cast<DWORD>(path.size());
    const bool queried = QueryFullProcessImageNameW(process, 0, path.data(), &length) != FALSE;
    CloseHandle(process);
    if (!queried) return false;
    path.resize(length);
    const auto filename = std::filesystem::path(path).filename().wstring();
    for (const auto& candidate : executableNames_) {
        if (_wcsicmp(filename.c_str(), candidate.c_str()) == 0) return true;
    }
    return false;
}

void GameWindowTracker::Clear() {
    gameWindow_ = nullptr;
    clientRect_ = {};
    visible_ = minimized_ = foreground_ = false;
}
