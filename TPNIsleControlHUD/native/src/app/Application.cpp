#include "app/Application.hpp"

#include <fstream>

namespace {
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
        } else if (message.message == WM_TIMER && message.hwnd == overlay_.GetHandle()) {
            Tick();
        }
        TranslateMessage(&message);
        DispatchMessageW(&message);
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
    SetEnvironmentVariableW(L"WEBVIEW2_DEFAULT_BACKGROUND_COLOR", L"00000000");
    if (!webview_.Initialize(overlay_.GetHandle(), config_.development, config_.frontendDevUrl,
        executableDirectory_ / L"ui", config_.enableDevTools, config_.apiOrigin,
        [this](const std::wstring& type, bool value) { HandleWebCommand(type, value); })) {
        Log(L"WebView2 initialization failed");
        return false;
    }
    Log(L"WebView2 initialization started");
    SetTimer(overlay_.GetHandle(), 1, 100, nullptr);
    Tick();
    return true;
}

void Application::Tick() {
    if (tracker_.IsFound()) tracker_.Update(); else tracker_.Find();
    const bool connected = tracker_.IsFound();
    if (connected != gameConnected_) {
        gameConnected_ = connected;
        Log(connected ? L"The Isle found" : L"The Isle lost");
        webview_.PostJson(connected ? L"{\"type\":\"game.connected\"}" : L"{\"type\":\"game.disconnected\"}");
        if (!connected) SetMode(OverlayMode::Hud);
    }
    if (!connected) { overlay_.Hide(); return; }

    const bool foreground = tracker_.IsForeground() || (mode_ == OverlayMode::Interactive && GetForegroundWindow() == overlay_.GetHandle());
    if (foreground != gameForeground_) {
        gameForeground_ = foreground;
        webview_.PostJson(foreground ? L"{\"type\":\"game.foregroundChanged\",\"foreground\":true}" : L"{\"type\":\"game.foregroundChanged\",\"foreground\":false}");
    }
    if (!tracker_.IsVisible() || tracker_.IsMinimized() || !foreground) { overlay_.Hide(); return; }
    overlay_.SetBounds(tracker_.GetClientScreenRect());
    webview_.Resize();
    overlay_.Show();
}

void Application::SetMode(OverlayMode mode) {
    if (mode_ == mode) return;
    mode_ = mode;
    overlay_.SetInteractive(mode == OverlayMode::Interactive);
    webview_.PostJson(mode == OverlayMode::Interactive
        ? L"{\"type\":\"overlay.modeChanged\",\"mode\":\"interactive\"}"
        : L"{\"type\":\"overlay.modeChanged\",\"mode\":\"hud\"}");
    if (mode == OverlayMode::Hud && tracker_.GetWindow()) SetForegroundWindow(tracker_.GetWindow());
}

void Application::HandleWebCommand(const std::wstring& type, bool value) {
    if (type == L"overlay.closePanel") SetMode(OverlayMode::Hud);
    else if (type == L"overlay.setInteractive") SetMode(value ? OverlayMode::Interactive : OverlayMode::Hud);
    else if (type == L"app.exit") PostMessageW(overlay_.GetHandle(), WM_CLOSE, 0, 0);
}

void Application::Shutdown() {
    Log(L"shutdown");
    KillTimer(overlay_.GetHandle(), 1);
    input_.Unregister(overlay_.GetHandle());
    webview_.Close();
    overlay_.Destroy();
}

void Application::Log(const wchar_t* message) const {
    const std::wstring line = std::wstring(L"[TPNHUD] ") + message + L"\n";
    OutputDebugStringW(line.c_str());
    std::wofstream output(executableDirectory_ / L"TPNIsleControlHUD.log", std::ios::app);
    if (output) output << line;
}
