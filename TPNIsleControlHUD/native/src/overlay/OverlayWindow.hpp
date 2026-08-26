#pragma once
#include <windows.h>

class OverlayWindow {
public:
    bool Create(HINSTANCE instance);
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
};
