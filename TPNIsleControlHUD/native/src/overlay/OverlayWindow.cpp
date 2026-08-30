#include "overlay/OverlayWindow.hpp"

namespace {
constexpr wchar_t kOverlayClass[] = L"TPNIsleControlHUDOverlay";

bool InitializeTransparentSurface(HWND window) {
    BITMAPINFO info{};
    info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    info.bmiHeader.biWidth = 1;
    info.bmiHeader.biHeight = -1;
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;
    info.bmiHeader.biCompression = BI_RGB;

    HDC screen = GetDC(nullptr);
    HDC memory = CreateCompatibleDC(screen);
    void* pixels = nullptr;
    HBITMAP bitmap = CreateDIBSection(memory, &info, DIB_RGB_COLORS, &pixels, nullptr, 0);
    if (!screen || !memory || !bitmap || !pixels) {
        if (bitmap) DeleteObject(bitmap);
        if (memory) DeleteDC(memory);
        if (screen) ReleaseDC(nullptr, screen);
        return false;
    }

    *static_cast<unsigned int*>(pixels) = 0;
    HGDIOBJ oldBitmap = SelectObject(memory, bitmap);
    POINT source{};
    SIZE size{1, 1};
    BLENDFUNCTION blend{AC_SRC_OVER, 0, 255, AC_SRC_ALPHA};
    const BOOL result = UpdateLayeredWindow(window, screen, nullptr, &size, memory, &source, 0, &blend, ULW_ALPHA);
    SelectObject(memory, oldBitmap);
    DeleteObject(bitmap);
    DeleteDC(memory);
    ReleaseDC(nullptr, screen);
    return result != FALSE;
}
}

bool OverlayWindow::Create(HINSTANCE instance, StateChangeHandler stateChangeHandler) {
    stateChangeHandler_ = std::move(stateChangeHandler);
    WNDCLASSEXW windowClass{sizeof(windowClass)};
    windowClass.hInstance = instance;
    windowClass.lpfnWndProc = WindowProc;
    windowClass.lpszClassName = kOverlayClass;
    windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    RegisterClassExW(&windowClass);
    hwnd_ = CreateWindowExW(WS_EX_TOPMOST | WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_TRANSPARENT,
        kOverlayClass, L"TPN Isle Control HUD", WS_POPUP, 0, 0, 1, 1, nullptr, nullptr, instance, this);
    if (!hwnd_) return false;
    if (!InitializeTransparentSurface(hwnd_)) {
        DestroyWindow(hwnd_);
        hwnd_ = nullptr;
        return false;
    }
    return true;
}

void OverlayWindow::Destroy() { if (hwnd_) DestroyWindow(hwnd_); hwnd_ = nullptr; }
void OverlayWindow::SetBounds(const RECT& rect) {
    SetWindowPos(hwnd_, HWND_TOPMOST, rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top, SWP_NOACTIVATE);
}
void OverlayWindow::SetLauncherBounds() {
    RECT workArea{};
    SystemParametersInfoW(SPI_GETWORKAREA, 0, &workArea, 0);
    SetWindowPos(hwnd_, HWND_TOPMOST, workArea.left, workArea.top,
                 workArea.right - workArea.left, workArea.bottom - workArea.top,
                 SWP_NOACTIVATE);
}
void OverlayWindow::SetLauncherMode(bool enabled) {
    if (!hwnd_ || launcherMode_ == enabled) return;
    launcherMode_ = enabled;
    auto styles = GetWindowLongPtrW(hwnd_, GWL_EXSTYLE);
    if (enabled) {
        styles &= ~(WS_EX_TRANSPARENT | WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW);
        styles |= WS_EX_APPWINDOW;
    } else {
        styles |= WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW;
        styles &= ~WS_EX_APPWINDOW;
    }
    SetWindowLongPtrW(hwnd_, GWL_EXSTYLE, styles);
    SetWindowPos(hwnd_, HWND_TOPMOST, 0, 0, 0, 0,
                 SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED | SWP_NOACTIVATE);
}
void OverlayWindow::Show() { ShowWindow(hwnd_, SW_SHOWNOACTIVATE); }
void OverlayWindow::Hide() { ShowWindow(hwnd_, SW_HIDE); }

void OverlayWindow::SetInteractive(bool enabled) {
    if (!hwnd_ || interactive_ == enabled) return;
    interactive_ = enabled;
    auto styles = GetWindowLongPtrW(hwnd_, GWL_EXSTYLE);
    if (enabled) styles &= ~(WS_EX_TRANSPARENT | WS_EX_NOACTIVATE);
    else {
        styles |= WS_EX_NOACTIVATE;
        if (hudPointerCaptured_) styles &= ~WS_EX_TRANSPARENT;
        else styles |= WS_EX_TRANSPARENT;
    }
    SetWindowLongPtrW(hwnd_, GWL_EXSTYLE, styles);
    SetWindowPos(hwnd_, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED | SWP_NOACTIVATE);
    if (enabled) { SetForegroundWindow(hwnd_); SetFocus(hwnd_); }
}

void OverlayWindow::SetHudPointerCapture(bool enabled) {
    if (!hwnd_ || hudPointerCaptured_ == enabled) return;
    hudPointerCaptured_ = enabled;
    if (interactive_) return;
    auto styles = GetWindowLongPtrW(hwnd_, GWL_EXSTYLE);
    if (enabled) styles &= ~WS_EX_TRANSPARENT;
    else styles |= WS_EX_TRANSPARENT;
    SetWindowLongPtrW(hwnd_, GWL_EXSTYLE, styles);
    SetWindowPos(hwnd_, HWND_TOPMOST, 0, 0, 0, 0,
                 SWP_NOMOVE | SWP_NOSIZE | SWP_FRAMECHANGED | SWP_NOACTIVATE);
}

LRESULT CALLBACK OverlayWindow::WindowProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam) {
    if (message == WM_NCCREATE) {
        auto* create = reinterpret_cast<CREATESTRUCTW*>(lParam);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(create->lpCreateParams));
    }
    if (message == WM_ERASEBKGND) return 1;
    if (message == WM_SIZE) {
        auto* self = reinterpret_cast<OverlayWindow*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
        if (self && self->stateChangeHandler_) {
            if (wParam == SIZE_MINIMIZED) self->stateChangeHandler_(OverlayWindowState::Minimized);
            else if (wParam == SIZE_RESTORED) self->stateChangeHandler_(OverlayWindowState::Restored);
        }
    }
    if (message == WM_CLOSE) { PostQuitMessage(0); return 0; }
    if (message == WM_DESTROY) { PostQuitMessage(0); return 0; }
    return DefWindowProcW(hwnd, message, wParam, lParam);
}
