#include "app/TrayIcon.hpp"

#include <shellapi.h>
#include <windowsx.h>

namespace {
constexpr wchar_t kTrayOwnerClass[] = L"TPNIsleControlHUDTrayOwner";
constexpr UINT kTrayCallback = WM_APP + 1;
constexpr UINT kShowRestoreCommand = 1;
constexpr UINT kReconnectCommand = 2;
constexpr UINT kExitCommand = 3;
constexpr int kAppIconResourceId = 101;
}

bool TrayIcon::Create(HINSTANCE instance, Callback showRestore, Callback reconnect, Callback exit, Logger logger) {
    showRestore_ = std::move(showRestore);
    reconnect_ = std::move(reconnect);
    exit_ = std::move(exit);
    logger_ = std::move(logger);
    WNDCLASSEXW windowClass{sizeof(windowClass)};
    windowClass.hInstance = instance;
    windowClass.lpfnWndProc = WindowProc;
    windowClass.lpszClassName = kTrayOwnerClass;
    RegisterClassExW(&windowClass);
    hwnd_ = CreateWindowExW(WS_EX_TOOLWINDOW, kTrayOwnerClass, L"TPN Isle Control HUD tray", WS_POPUP,
                            0, 0, 0, 0, nullptr, nullptr, instance, this);
    if (!hwnd_) { Log(L"tray owner window creation failed"); return false; }
    icon_.cbSize = sizeof(icon_);
    icon_.hWnd = hwnd_;
    icon_.uID = 1;
    icon_.uFlags = NIF_MESSAGE | NIF_ICON | NIF_TIP | NIF_SHOWTIP;
    icon_.uCallbackMessage = kTrayCallback;
    icon_.hIcon = static_cast<HICON>(LoadImageW(instance, MAKEINTRESOURCEW(kAppIconResourceId), IMAGE_ICON,
                                                GetSystemMetrics(SM_CXSMICON), GetSystemMetrics(SM_CYSMICON), LR_DEFAULTCOLOR));
    wcscpy_s(icon_.szTip, L"TPN Isle Control HUD");
    if (!icon_.hIcon || !Shell_NotifyIconW(NIM_ADD, &icon_)) { Log(L"tray icon creation failed"); Destroy(); return false; }
    icon_.uVersion = NOTIFYICON_VERSION_4;
    if (!Shell_NotifyIconW(NIM_SETVERSION, &icon_)) Log(L"tray icon version setup failed");
    Log(L"tray icon created");
    return true;
}

void TrayIcon::Destroy() {
    if (icon_.hWnd) Shell_NotifyIconW(NIM_DELETE, &icon_);
    icon_ = {};
    if (hwnd_) DestroyWindow(hwnd_);
    hwnd_ = nullptr;
}

void TrayIcon::ShowMenu(POINT anchor) {
    Log(L"tray menu requested");
    if ((anchor.x == -1 || anchor.y == -1) && !GetCursorPos(&anchor)) { Log(L"tray menu anchor lookup failed"); return; }
    HMENU menu = CreatePopupMenu();
    if (!menu) { Log(L"tray menu creation failed"); return; }
    AppendMenuW(menu, MF_STRING | MF_DEFAULT, kShowRestoreCommand, L"Show/Restore");
    AppendMenuW(menu, MF_STRING, kReconnectCommand, L"Reconnect HUD");
    AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
    AppendMenuW(menu, MF_STRING, kExitCommand, L"Exit");
    const HWND previousForeground = GetForegroundWindow();
    if (!SetForegroundWindow(hwnd_)) Log(L"tray menu owner foreground request failed");
    SetLastError(ERROR_SUCCESS);
    const UINT command = TrackPopupMenuEx(menu, TPM_RIGHTBUTTON | TPM_RETURNCMD | TPM_NONOTIFY,
                                          anchor.x, anchor.y, hwnd_, nullptr);
    if (!command && GetLastError() != ERROR_SUCCESS) Log(L"tray menu display failed");
    DestroyMenu(menu);
    PostMessageW(hwnd_, WM_NULL, 0, 0);
    if (!Shell_NotifyIconW(NIM_SETFOCUS, &icon_)) Log(L"tray icon focus restore failed");
    if (command == kShowRestoreCommand) { Log(L"tray command: show/restore"); showRestore_(); }
    else if (command == kReconnectCommand) { Log(L"tray command: reconnect"); reconnect_(); }
    else if (command == kExitCommand) { Log(L"tray command: exit"); exit_(); }
    if (command != kShowRestoreCommand && previousForeground && IsWindow(previousForeground)) {
        SetForegroundWindow(previousForeground);
    }
}

void TrayIcon::Log(const wchar_t* message) const { if (logger_) logger_(message); }

LRESULT CALLBACK TrayIcon::WindowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) {
    if (message == WM_NCCREATE) {
        auto* create = reinterpret_cast<CREATESTRUCTW*>(lParam);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(create->lpCreateParams));
    }
    auto* self = reinterpret_cast<TrayIcon*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    if (self && message == kTrayCallback) {
        const UINT action = LOWORD(lParam);
        if (action == WM_CONTEXTMENU) self->ShowMenu(POINT{GET_X_LPARAM(wParam), GET_Y_LPARAM(wParam)});
        else if (action == WM_RBUTTONUP) { POINT cursor{-1, -1}; GetCursorPos(&cursor); self->ShowMenu(cursor); }
        else if (action == WM_LBUTTONDBLCLK) { self->Log(L"tray double-click: show/restore"); self->showRestore_(); }
        return 0;
    }
    return DefWindowProcW(hwnd, message, wParam, lParam);
}
