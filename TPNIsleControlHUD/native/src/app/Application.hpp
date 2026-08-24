#pragma once

#include "config/Config.hpp"
#include "overlay/GameWindowTracker.hpp"
#include "overlay/InputManager.hpp"
#include "overlay/OverlayWindow.hpp"
#include "webview/WebViewHost.hpp"

#include <filesystem>
#include <shellapi.h>

enum class OverlayMode { Hud, Interactive };

class Application {
public:
    explicit Application(HINSTANCE instance);
    int Run();
private:
    bool Initialize();
    void Tick();
    void SetMode(OverlayMode mode);
    void HandleWebCommand(const std::wstring& type, bool value);
    void AddTrayIcon();
    void RemoveTrayIcon();
    void ShowTrayMenu();
    void Reconnect();
    void Shutdown();
    void LogOverlayState(const wchar_t* action, const wchar_t* reason);
    void Log(const wchar_t* message) const;

    HINSTANCE instance_;
    std::filesystem::path executableDirectory_;
    Config config_;
    GameWindowTracker tracker_;
    OverlayWindow overlay_;
    InputManager input_;
    WebViewHost webview_;
    OverlayMode mode_{OverlayMode::Hud};
    bool gameConnected_{false};
    bool gameForeground_{false};
    std::wstring lastOverlayDiagnostic_;
    NOTIFYICONDATAW trayIcon_{};
};

