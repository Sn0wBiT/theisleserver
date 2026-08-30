#include "app/Application.hpp"

#include "include/cef_app.h"

#include <cstdint>
#include <fstream>
#include <regex>
#include <shellapi.h>
#include <sstream>

namespace {
constexpr UINT_PTR kTrackerTimer = 1;
constexpr UINT_PTR kCefPumpTimer = 2;

std::filesystem::path ExecutableDirectory() {
    std::wstring path(32768, L'\0');
    const DWORD length = GetModuleFileNameW(nullptr, path.data(), static_cast<DWORD>(path.size()));
    path.resize(length);
    return std::filesystem::path(path).parent_path();
}
}

Application::Application(HINSTANCE instance)
    : instance_(instance), executableDirectory_(ExecutableDirectory()),
      config_(), tracker_(config_.gameExecutables) {}

int Application::Run() {
    if (!Initialize()) return 1;
    MSG message{};
    while (GetMessageW(&message, nullptr, 0, 0) > 0) {
        if (message.message == WM_HOTKEY && message.wParam == InputManager::ToggleHotkeyId) {
            SetMode(mode_ == OverlayMode::Hud ? OverlayMode::Interactive : OverlayMode::Hud);
        } else if (message.message == WM_TIMER && message.hwnd == overlay_.GetHandle() &&
                   message.wParam == kTrackerTimer) {
            Tick();
        } else if (message.message == WM_TIMER && message.hwnd == overlay_.GetHandle() &&
                   message.wParam == kCefPumpTimer) {
            if (input_.PollMapPressed(gameConnected_ && tracker_.IsForeground())) {
                HandleWebCommand(L"overlay.openMap", false, L"");
            }
            if (input_.PollFactionPressed(gameConnected_ && tracker_.IsForeground())) {
                webview_.PostJson(L"{\"type\":\"overlay.togglePanel\",\"panel\":\"gang\"}");
            }
            POINT cursor{};
            bool capturePointer = false;
            if (mode_ == OverlayMode::Hud && GetCursorPos(&cursor) &&
                ScreenToClient(overlay_.GetHandle(), &cursor)) {
                capturePointer = webview_.IsPointOpaque(cursor.x, cursor.y);
            }
            overlay_.SetHudPointerCapture(capturePointer);
        }
        TranslateMessage(&message);
        DispatchMessageW(&message);
        CefDoMessageLoopWork();
    }
    Shutdown();
    return static_cast<int>(message.wParam);
}

bool Application::Initialize() {
    Log(L"application start");
    Log(L"config loaded");
    if (!overlay_.Create(instance_, [this](OverlayWindowState state) { HandleOverlayWindowState(state); })) {
        Log(L"overlay creation failed"); return false;
    }
    Log(L"overlay created");
    if (!input_.Register(overlay_.GetHandle(), config_.overlayHotkey)) Log(L"hotkey registration failed");
    Log(L"CEF hosting mode: windowless OSR with per-pixel alpha");
    if (!webview_.Initialize(overlay_.GetHandle(), config_.development, config_.frontendDevUrl,
        executableDirectory_ / L"ui", config_.enableDevTools, config_.apiOrigin,
        [this](const std::wstring& type, bool value, const std::wstring& payload) { HandleWebCommand(type, value, payload); },
        [this](const std::wstring& message) { Log(message.c_str()); })) {
        Log(L"CEF initialization failed");
        return false;
    }
    Log(L"CEF initialization started");
    trayIcon_.Create(instance_, [this] { ShowOrRestore(); }, [this] { Reconnect(); },
                     [] { PostQuitMessage(0); }, [this](const wchar_t* message) { Log(message); });
    SetTimer(overlay_.GetHandle(), kTrackerTimer, 100, nullptr);
    SetTimer(overlay_.GetHandle(), kCefPumpTimer, 10, nullptr);
    Tick();
    return true;
}

void Application::Tick() {
    overlay_.SetInteractive(mode_ == OverlayMode::Interactive);
    if (tracker_.IsFound()) tracker_.Update(); else tracker_.Find();
    const bool connected = tracker_.IsFound();
    if (connected != gameConnected_) {
        gameConnected_ = connected;
        Log(connected ? L"The Isle found" : L"The Isle lost");
        webview_.PostJson(connected ? L"{\"type\":\"game.connected\"}" : L"{\"type\":\"game.disconnected\"}");
        if (connected && IsIconic(overlay_.GetHandle())) {
            launcherState_ = LauncherState::Restoring;
            ShowWindow(overlay_.GetHandle(), SW_RESTORE);
        }
        SetMode(connected ? OverlayMode::Hud : OverlayMode::Interactive);
    }
    if (launcherState_ != LauncherState::Shown) return;
    if (IsIconic(overlay_.GetHandle())) return;
    if (!connected) {
        overlay_.SetLauncherMode(true);
        overlay_.SetLauncherBounds();
        overlay_.SetInteractive(true);
        webview_.Resize();
        if (!IsWindowVisible(overlay_.GetHandle())) webview_.ResumeRendering();
        overlay_.Show();
        LogOverlayState(L"show", L"launcher-ready");
        return;
    }

    overlay_.SetLauncherMode(false);

    const HWND foregroundWindow = GetForegroundWindow();
    const bool overlayForeground = foregroundWindow == overlay_.GetHandle() ||
                                   IsChild(overlay_.GetHandle(), foregroundWindow) != FALSE;
    const bool foreground = tracker_.IsForeground() ||
                            (mode_ == OverlayMode::Interactive && overlayForeground);
    if (foreground != gameForeground_) {
        gameForeground_ = foreground;
        webview_.PostJson(foreground ? L"{\"type\":\"game.foregroundChanged\",\"foreground\":true}" : L"{\"type\":\"game.foregroundChanged\",\"foreground\":false}");
    }
    if (!tracker_.IsVisible()) {
        webview_.SuspendRendering();
        overlay_.Hide();
        LogOverlayState(L"hide", L"game-window-hidden");
        return;
    }
    if ((tracker_.IsMinimized)()) {
        webview_.SuspendRendering();
        overlay_.Hide();
        LogOverlayState(L"hide", L"game-window-minimized");
        return;
    }
    if (!foreground) {
        webview_.SuspendRendering();
        overlay_.Hide();
        LogOverlayState(L"hide", L"game-not-foreground");
        return;
    }
    overlay_.SetBounds(tracker_.GetClientScreenRect());
    webview_.Resize();
    if (!IsWindowVisible(overlay_.GetHandle())) webview_.ResumeRendering();
    overlay_.Show();
    LogOverlayState(L"show", L"game-ready");
}

void Application::SetMode(OverlayMode mode) {
    if (mode_ == mode) return;
    mode_ = mode;
    Log(mode == OverlayMode::Interactive ? L"overlay mode changed: interactive" : L"overlay mode changed: hud");
    overlay_.SetInteractive(mode == OverlayMode::Interactive);
    webview_.PostJson(mode == OverlayMode::Interactive
        ? L"{\"type\":\"overlay.modeChanged\",\"mode\":\"interactive\"}"
        : L"{\"type\":\"overlay.modeChanged\",\"mode\":\"hud\"}");
    if (mode == OverlayMode::Hud && tracker_.GetWindow()) SetForegroundWindow(tracker_.GetWindow());
}

void Application::HandleWebCommand(const std::wstring& type, bool value, const std::wstring& payload) {
    if (type == L"overlay.closePanel") SetMode(OverlayMode::Hud);
    else if (type == L"overlay.setInteractive") SetMode(value ? OverlayMode::Interactive : OverlayMode::Hud);
    else if (type == L"overlay.openMap") {
        SetMode(OverlayMode::Interactive);
        webview_.PostJson(L"{\"type\":\"overlay.openPanel\",\"panel\":\"minimap\"}");
    }
    else if (type == L"app.frontendReady") SendFrontendState();
    else if (type == L"app.launchGame") {
        static const std::wregex addressPattern(LR"(^[A-Za-z0-9.-]+:[0-9]{1,5}$)");
        if (!std::regex_match(payload, addressPattern)) {
            Log(L"launcher rejected invalid server address");
            return;
        }
        const std::wstring uri = L"steam://run/376210//+connect%20" + payload;
        const auto result = reinterpret_cast<std::intptr_t>(ShellExecuteW(nullptr, L"open", uri.c_str(), nullptr, nullptr, SW_SHOWNORMAL));
        Log(result > 32 ? L"The Isle launch requested" : L"The Isle launch request failed");
    }
    else if (type == L"app.minimize") {
        MinimizeLauncher();
    }
    else if (type == L"app.exit") PostQuitMessage(0);
}

void Application::SendFrontendState() {
    webview_.PostJson(mode_ == OverlayMode::Interactive
        ? L"{\"type\":\"overlay.modeChanged\",\"mode\":\"interactive\"}"
        : L"{\"type\":\"overlay.modeChanged\",\"mode\":\"hud\"}");
    webview_.PostJson(gameConnected_ ? L"{\"type\":\"game.connected\"}" : L"{\"type\":\"game.disconnected\"}");
    webview_.PostJson(gameForeground_
        ? L"{\"type\":\"game.foregroundChanged\",\"foreground\":true}"
        : L"{\"type\":\"game.foregroundChanged\",\"foreground\":false}");
}

void Application::HandleOverlayWindowState(OverlayWindowState state) {
    if (state == OverlayWindowState::Minimized && launcherState_ == LauncherState::Minimizing) {
        launcherState_ = LauncherState::Minimized;
        Log(L"launcher transition: minimized");
    } else if (state == OverlayWindowState::Restored &&
               (launcherState_ == LauncherState::Minimized || launcherState_ == LauncherState::Restoring)) {
        CompleteLauncherRestore();
    }
}

void Application::MinimizeLauncher() {
    if (gameConnected_ || launcherState_ != LauncherState::Shown) return;
    launcherState_ = LauncherState::Minimizing;
    Log(L"launcher transition: minimizing");
    webview_.SuspendRendering();
    ShowWindow(overlay_.GetHandle(), SW_MINIMIZE);
}

void Application::ShowOrRestore() {
    if (!gameConnected_) {
        if (launcherState_ == LauncherState::Minimized || IsIconic(overlay_.GetHandle())) {
            launcherState_ = LauncherState::Restoring;
            Log(L"launcher transition: restoring");
            ShowWindow(overlay_.GetHandle(), SW_RESTORE);
        } else {
            overlay_.Show();
            SetForegroundWindow(overlay_.GetHandle());
            SetFocus(overlay_.GetHandle());
        }
        return;
    }
    if (IsIconic(overlay_.GetHandle())) ShowWindow(overlay_.GetHandle(), SW_RESTORE);
    if (const HWND game = tracker_.GetWindow()) SetForegroundWindow(game);
}

void Application::CompleteLauncherRestore() {
    if (gameConnected_) {
        launcherState_ = LauncherState::Shown;
        Log(L"launcher transition: restored for game detection");
        Tick();
        return;
    }
    overlay_.SetLauncherBounds();
    webview_.Resize();
    webview_.ResumeRendering();
    overlay_.Show();
    SetForegroundWindow(overlay_.GetHandle());
    SetFocus(overlay_.GetHandle());
    launcherState_ = LauncherState::Shown;
    Log(L"launcher transition: restored");
    LogOverlayState(L"show", L"launcher-restored");
}

void Application::Reconnect() {
    Log(webview_.Reload() ? L"HUD reconnect requested" : L"HUD reconnect failed");
}

void Application::Shutdown() {
    Log(L"shutdown");
    webview_.PostJson(L"{\"type\":\"app.shuttingDown\"}");
    KillTimer(overlay_.GetHandle(), kTrackerTimer);
    KillTimer(overlay_.GetHandle(), kCefPumpTimer);
    input_.Unregister(overlay_.GetHandle());
    trayIcon_.Destroy();
    webview_.Close();
    overlay_.Destroy();
}

void Application::LogOverlayState(const wchar_t* action, const wchar_t* reason) {
    const HWND overlay = overlay_.GetHandle();
    RECT overlayRect{};
    RECT overlayClient{};
    GetWindowRect(overlay, &overlayRect);
    GetClientRect(overlay, &overlayClient);
    const RECT gameRect = tracker_.GetClientScreenRect();
    const auto handle = [](HWND window) { return reinterpret_cast<std::uintptr_t>(window); };

    std::wostringstream output;
    output << L"overlay state: action=" << action
           << L" reason=" << reason
           << L" mode=" << (mode_ == OverlayMode::Interactive ? L"interactive" : L"hud")
           << L" gameHwnd=" << handle(tracker_.GetWindow())
           << L" foregroundHwnd=" << handle(GetForegroundWindow())
           << L" overlayHwnd=" << handle(overlay)
           << L" gameVisible=" << (tracker_.IsVisible() ? 1 : 0)
           << L" gameMinimized=" << ((tracker_.IsMinimized)() ? 1 : 0)
           << L" gameForeground=" << (tracker_.IsForeground() ? 1 : 0)
           << L" overlayVisible=" << (IsWindowVisible(overlay) ? 1 : 0)
           << L" overlayEnabled=" << (IsWindowEnabled(overlay) ? 1 : 0)
           << L" exStyle=" << static_cast<unsigned long long>(GetWindowLongPtrW(overlay, GWL_EXSTYLE))
           << L" gameRect=[" << gameRect.left << L"," << gameRect.top << L"," << gameRect.right << L"," << gameRect.bottom << L"]"
           << L" overlayRect=[" << overlayRect.left << L"," << overlayRect.top << L"," << overlayRect.right << L"," << overlayRect.bottom << L"]"
           << L" clientSize=" << (overlayClient.right - overlayClient.left) << L"x" << (overlayClient.bottom - overlayClient.top);
    const std::wstring diagnostic = output.str();
    if (diagnostic == lastOverlayDiagnostic_) return;
    lastOverlayDiagnostic_ = diagnostic;
    Log(diagnostic.c_str());
}

void Application::Log(const wchar_t* message) const {
    const std::wstring line = std::wstring(L"[TPNHUD] ") + message + L"\n";
    OutputDebugStringW(line.c_str());
    std::wofstream output(executableDirectory_ / L"TPNIsleControlHUD.log", std::ios::app);
    if (output) output << line;
}
