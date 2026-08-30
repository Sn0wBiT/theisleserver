#pragma once
#include <windows.h>
#include <functional>

enum class OverlayWindowState { Minimized, Restored };

class OverlayWindow {
public:
    using StateChangeHandler = std::function<void(OverlayWindowState)>;
    bool Create(HINSTANCE instance, StateChangeHandler stateChangeHandler);
    void Destroy();
    void SetBounds(const RECT& rect);
    void SetLauncherBounds();
    void SetLauncherMode(bool enabled);
    void Show();
    void Hide();
    void SetInteractive(bool enabled);
    void SetHudPointerCapture(bool enabled);
    [[nodiscard]] HWND GetHandle() const { return hwnd_; }
    [[nodiscard]] bool IsInteractive() const { return interactive_; }
private:
    static LRESULT CALLBACK WindowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam);
    HWND hwnd_{nullptr};
    bool interactive_{false};
    bool hudPointerCaptured_{false};
    bool launcherMode_{false};
    StateChangeHandler stateChangeHandler_;
};
