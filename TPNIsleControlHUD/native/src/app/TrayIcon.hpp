#pragma once

#include <windows.h>
#include <shellapi.h>
#include <functional>
#include <string>

class TrayIcon {
public:
    using Callback = std::function<void()>;
    using Logger = std::function<void(const wchar_t*)>;
    bool Create(HINSTANCE instance, Callback showRestore, Callback reconnect, Callback exit, Logger logger);
    void Destroy();
private:
    static LRESULT CALLBACK WindowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam);
    void ShowMenu(POINT anchor);
    void Log(const wchar_t* message) const;
    HWND hwnd_{nullptr};
    NOTIFYICONDATAW icon_{};
    Callback showRestore_;
    Callback reconnect_;
    Callback exit_;
    Logger logger_;
};
