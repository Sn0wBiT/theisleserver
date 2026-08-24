#pragma once

#include <windows.h>
#include <string>
#include <vector>

class GameWindowTracker {
public:
    explicit GameWindowTracker(std::vector<std::wstring> executableNames);
    bool Find();
    void Update();
    [[nodiscard]] HWND GetWindow() const { return gameWindow_; }
    [[nodiscard]] RECT GetClientScreenRect() const { return clientRect_; }
    [[nodiscard]] bool IsFound() const { return gameWindow_ != nullptr; }
    [[nodiscard]] bool IsVisible() const { return visible_; }
    [[nodiscard]] bool IsMinimized() const { return minimized_; }
    [[nodiscard]] bool IsForeground() const { return foreground_; }

private:
    bool MatchesExecutable(HWND window) const;
    void Clear();
    std::vector<std::wstring> executableNames_;
    HWND gameWindow_{nullptr};
    RECT clientRect_{};
    bool visible_{false};
    bool minimized_{false};
    bool foreground_{false};
};

