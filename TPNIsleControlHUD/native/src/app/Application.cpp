#include "app/Application.hpp"

#include "include/cef_app.h"

#include <cstdint>
#include <fstream>
#include <sstream>
#include <windowsx.h>

namespace {
constexpr UINT kTrayCallbackMessage = WM_APP + 1;
constexpr UINT kReconnectCommand = 1;
constexpr UINT kExitCommand = 2;
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
      config_(Config::Load(executableDirectory_ / L"config.json")), tracker_(config_.gameExecutables) {}

int Application::Run() {
    if (!Initialize()) return 1;
    MSG message{};
    while (GetMessageW(&message, nullptr, 0, 0) > 0) {
        if (message.message == WM_HOTKEY && message.wParam == InputManager::ToggleHotkeyId) {
            SetMode(mode_ == OverlayMode::Hud ? OverlayMode::Interactive : OverlayMode::Hud);
        } else if (message.message == kTrayCallbackMessage) {
            const UINT action = LOWORD(message.lParam);
            if (action == WM_CONTEXTMENU) {
                ShowTrayMenu(POINT{GET_X_LPARAM(message.wParam), GET_Y_LPARAM(message.wParam)});
            }
            else if (action == WM_LBUTTONDBLCLK) Reconnect();
        } else if (message.message == WM_TIMER && message.hwnd == overlay_.GetHandle() &&
                   message.wParam == kTrackerTimer) {
            Tick();
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
    if (!overlay_.Create(instance_)) { Log(L"overlay creation failed"); return false; }
    Log(L"overlay created");
    if (!input_.Register(overlay_.GetHandle(), config_.overlayHotkey)) Log(L"hotkey registration failed");
    Log(L"CEF hosting mode: windowless OSR with per-pixel alpha");
    if (!webview_.Initialize(overlay_.GetHandle(), config_.development, config_.frontendDevUrl,
        executableDirectory_ / L"ui", config_.enableDevTools, config_.apiOrigin,
        [this](const std::wstring& type, bool value) { HandleWebCommand(type, value); },
        [this](const std::wstring& message) { Log(message.c_str()); })) {
        Log(L"CEF initialization failed");
        return false;
    }
    Log(L"CEF initialization started");
    AddTrayIcon();
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
        if (!connected) SetMode(OverlayMode::Hud);
    }
    if (!connected) {
        webview_.SetVisible(false);
        overlay_.Hide();
        LogOverlayState(L"hide", L"game-not-found");
        return;
    }

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
        webview_.SetVisible(false);
        overlay_.Hide();
        LogOverlayState(L"hide", L"game-window-hidden");
        return;
    }
    if (tracker_.IsMinimized()) {
        webview_.SetVisible(false);
        overlay_.Hide();
        LogOverlayState(L"hide", L"game-window-minimized");
        return;
    }
    if (!foreground) {
        webview_.SetVisible(false);
        overlay_.Hide();
        LogOverlayState(L"hide", L"game-not-foreground");
        return;
    }
    overlay_.SetBounds(tracker_.GetClientScreenRect());
    webview_.Resize();
    webview_.SetVisible(true);
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

void Application::HandleWebCommand(const std::wstring& type, bool value) {
    if (type == L"overlay.closePanel") SetMode(OverlayMode::Hud);
    else if (type == L"overlay.setInteractive") SetMode(value ? OverlayMode::Interactive : OverlayMode::Hud);
    else if (type == L"app.frontendReady") SendFrontendState();
    else if (type == L"app.exit") PostMessageW(overlay_.GetHandle(), WM_CLOSE, 0, 0);
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

void Application::AddTrayIcon() {
    trayIcon_ = {};
    trayIcon_.cbSize = sizeof(trayIcon_);
    trayIcon_.hWnd = overlay_.GetHandle();
    trayIcon_.uID = 1;
    trayIcon_.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP | NIF_SHOWTIP;
    trayIcon_.uCallbackMessage = kTrayCallbackMessage;
    trayIcon_.hIcon = LoadIconW(nullptr, IDI_APPLICATION);
    wcscpy_s(trayIcon_.szTip, L"TPN Isle Control HUD");
    if (!Shell_NotifyIconW(NIM_ADD, &trayIcon_)) {
        Log(L"tray icon creation failed");
        return;
    }
    trayIcon_.uVersion = NOTIFYICON_VERSION_4;
    if (!Shell_NotifyIconW(NIM_SETVERSION, &trayIcon_)) Log(L"tray icon version setup failed");
    else Log(L"tray icon created");
}

void Application::RemoveTrayIcon() {
    if (trayIcon_.hWnd) Shell_NotifyIconW(NIM_DELETE, &trayIcon_);
    trayIcon_ = {};
}

void Application::ShowTrayMenu(POINT anchor) {
    Log(L"tray menu requested");
    if (anchor.x == -1 && anchor.y == -1 && !GetCursorPos(&anchor)) {
        Log(L"tray menu anchor lookup failed");
        return;
    }
    HMENU menu = CreatePopupMenu();
    if (!menu) { Log(L"tray menu creation failed"); return; }
    if (!AppendMenuW(menu, MF_STRING, kReconnectCommand, L"Reconnect HUD") ||
        !AppendMenuW(menu, MF_SEPARATOR, 0, nullptr) ||
        !AppendMenuW(menu, MF_STRING, kExitCommand, L"Exit")) {
        Log(L"tray menu item creation failed");
        DestroyMenu(menu);
        return;
    }
    const HWND previousForeground = GetForegroundWindow();
    if (!SetForegroundWindow(overlay_.GetHandle())) Log(L"tray menu owner foreground request failed");
    SetLastError(ERROR_SUCCESS);
    const UINT command = TrackPopupMenuEx(menu, TPM_RIGHTBUTTON | TPM_RETURNCMD | TPM_NONOTIFY,
                                          anchor.x, anchor.y, overlay_.GetHandle(), nullptr);
    if (!command && GetLastError() != ERROR_SUCCESS) Log(L"tray menu display failed");
    DestroyMenu(menu);
    PostMessageW(overlay_.GetHandle(), WM_NULL, 0, 0);
    if (!Shell_NotifyIconW(NIM_SETFOCUS, &trayIcon_)) Log(L"tray icon focus restore failed");
    if (command == kReconnectCommand) Reconnect();
    else if (command == kExitCommand) PostMessageW(overlay_.GetHandle(), WM_CLOSE, 0, 0);
    const HWND focusTarget = (previousForeground && IsWindow(previousForeground))
        ? previousForeground : tracker_.GetWindow();
    if (focusTarget) SetForegroundWindow(focusTarget);
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
    RemoveTrayIcon();
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
           << L" gameMinimized=" << (tracker_.IsMinimized() ? 1 : 0)
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
