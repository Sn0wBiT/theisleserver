#include "webview/WebViewHost.hpp"

#include "include/cef_browser.h"
#include "include/cef_app.h"
#include "include/cef_client.h"
#include "include/cef_context_menu_handler.h"
#include "include/cef_life_span_handler.h"
#include "include/cef_load_handler.h"
#include "include/cef_parser.h"
#include "include/cef_process_message.h"
#include "include/cef_render_handler.h"
#include "include/cef_scheme.h"
#include "include/cef_stream.h"
#include "include/wrapper/cef_stream_resource_handler.h"

#include <commctrl.h>
#include <shellapi.h>
#include <windowsx.h>

#include <algorithm>
#include <chrono>
#include <cstdint>
#include <cstring>
#include <regex>
#include <sstream>
#include <thread>
#include <utility>

namespace {
constexpr char kNativeMessageName[] = "tpn.native.message";
constexpr UINT_PTR kBrowserSubclassId = 0x54504e43;
constexpr int kInspectElementCommand = MENU_ID_USER_FIRST;

std::wstring MimeTypeFor(const std::filesystem::path& path) {
    const std::wstring extension = path.extension().wstring();
    if (extension == L".html") return L"text/html";
    if (extension == L".js" || extension == L".mjs") return L"text/javascript";
    if (extension == L".css") return L"text/css";
    if (extension == L".json") return L"application/json";
    if (extension == L".svg") return L"image/svg+xml";
    if (extension == L".png") return L"image/png";
    if (extension == L".jpg" || extension == L".jpeg") return L"image/jpeg";
    if (extension == L".webp") return L"image/webp";
    if (extension == L".woff") return L"font/woff";
    if (extension == L".woff2") return L"font/woff2";
    return L"application/octet-stream";
}

class LocalResourceFactory final : public CefSchemeHandlerFactory {
public:
    explicit LocalResourceFactory(std::filesystem::path root) : root_(std::move(root)) {}

    CefRefPtr<CefResourceHandler> Create(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame>,
                                         const CefString&, CefRefPtr<CefRequest> request) override {
        CefURLParts parts;
        if (!CefParseURL(request->GetURL(), parts)) return nullptr;

        std::wstring relative = CefString(&parts.path).ToWString();
        while (!relative.empty() && (relative.front() == L'/' || relative.front() == L'\\')) {
            relative.erase(relative.begin());
        }
        if (relative.empty()) relative = L"index.html";

        const std::filesystem::path requested(relative);
        if (requested.is_absolute()) return nullptr;
        for (const auto& component : requested) {
            if (component == L"..") return nullptr;
        }

        const auto file = (root_ / requested).lexically_normal();
        auto stream = CefStreamReader::CreateForFile(file.wstring());
        if (!stream) return nullptr;

        CefResponse::HeaderMap headers;
        headers.emplace(L"Cache-Control", L"no-cache");
        headers.emplace(L"X-Content-Type-Options", L"nosniff");
        return new CefStreamResourceHandler(200, L"OK", MimeTypeFor(file), std::move(headers), stream);
    }

private:
    const std::filesystem::path root_;
    IMPLEMENT_REFCOUNTING(LocalResourceFactory);
};

uint32_t CefModifiers(WPARAM wParam) {
    uint32_t modifiers = 0;
    if (wParam & MK_SHIFT) modifiers |= EVENTFLAG_SHIFT_DOWN;
    if (wParam & MK_CONTROL) modifiers |= EVENTFLAG_CONTROL_DOWN;
    if (wParam & MK_LBUTTON) modifiers |= EVENTFLAG_LEFT_MOUSE_BUTTON;
    if (wParam & MK_MBUTTON) modifiers |= EVENTFLAG_MIDDLE_MOUSE_BUTTON;
    if (wParam & MK_RBUTTON) modifiers |= EVENTFLAG_RIGHT_MOUSE_BUTTON;
    if (GetKeyState(VK_MENU) < 0) modifiers |= EVENTFLAG_ALT_DOWN;
    if (GetKeyState(VK_CAPITAL) & 1) modifiers |= EVENTFLAG_CAPS_LOCK_ON;
    if (GetKeyState(VK_NUMLOCK) & 1) modifiers |= EVENTFLAG_NUM_LOCK_ON;
    return modifiers;
}
}

struct WebViewHost::Impl {
    class Client final : public CefClient,
                         public CefContextMenuHandler,
                         public CefLifeSpanHandler,
                         public CefLoadHandler,
                         public CefRenderHandler {
    public:
        explicit Client(Impl* impl) : impl_(impl) {}

        CefRefPtr<CefContextMenuHandler> GetContextMenuHandler() override { return this; }
        CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler() override { return this; }
        CefRefPtr<CefLoadHandler> GetLoadHandler() override { return this; }
        CefRefPtr<CefRenderHandler> GetRenderHandler() override { return this; }

        void OnAfterCreated(CefRefPtr<CefBrowser> browser) override {
            impl_->browser = browser;
            impl_->closed = false;
            browser->GetHost()->WasHidden(!impl_->visible);
            impl_->owner->Resize();
            impl_->Status(L"CEF browser created");
        }

        void OnBeforeClose(CefRefPtr<CefBrowser>) override {
            impl_->browser = nullptr;
            impl_->closed = true;
            impl_->Status(L"CEF browser closed");
        }

        void OnLoadEnd(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, int httpStatusCode) override {
            if (!frame->IsMain()) return;
            impl_->Status(L"frontend navigation completed, status: " + std::to_wstring(httpStatusCode));
        }

        void OnLoadError(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame> frame, ErrorCode errorCode,
                         const CefString& errorText, const CefString&) override {
            if (!frame->IsMain() || errorCode == ERR_ABORTED) return;
            impl_->Status(L"frontend navigation failed: " + errorText.ToWString() +
                          L" (" + std::to_wstring(errorCode) + L")");
        }

        bool OnProcessMessageReceived(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame>, CefProcessId sourceProcess,
                                      CefRefPtr<CefProcessMessage> message) override {
            if (sourceProcess != PID_RENDERER || message->GetName() != kNativeMessageName) return false;
            impl_->HandleMessage(message->GetArgumentList()->GetString(0).ToWString());
            return true;
        }

        void OnBeforeContextMenu(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame>,
                                 CefRefPtr<CefContextMenuParams>, CefRefPtr<CefMenuModel> model) override {
            if (!impl_->enableDevTools) {
                model->Clear();
                return;
            }
            if (model->GetCount() > 0) model->AddSeparator();
            model->AddItem(kInspectElementCommand, L"Inspect element");
        }

        bool OnContextMenuCommand(CefRefPtr<CefBrowser>, CefRefPtr<CefFrame>,
                                  CefRefPtr<CefContextMenuParams> params, int commandId,
                                  EventFlags) override {
            if (!impl_->enableDevTools || commandId != kInspectElementCommand) return false;
            impl_->ShowDevTools(CefPoint(params->GetXCoord(), params->GetYCoord()));
            return true;
        }

        void GetViewRect(CefRefPtr<CefBrowser>, CefRect& rect) override {
            RECT clientRect{};
            GetClientRect(impl_->parent, &clientRect);
            rect = CefRect(0, 0, (std::max)(1L, clientRect.right - clientRect.left),
                           (std::max)(1L, clientRect.bottom - clientRect.top));
        }

        bool GetScreenPoint(CefRefPtr<CefBrowser>, int viewX, int viewY, int& screenX, int& screenY) override {
            POINT point{viewX, viewY};
            if (!ClientToScreen(impl_->parent, &point)) return false;
            screenX = point.x;
            screenY = point.y;
            return true;
        }

        void OnPaint(CefRefPtr<CefBrowser>, PaintElementType type, const RectList&, const void* buffer,
                     int width, int height) override {
            if (type == PET_VIEW && impl_->visible) impl_->Paint(buffer, width, height);
        }

    private:
        Impl* const impl_;
        IMPLEMENT_REFCOUNTING(Client);
    };

    explicit Impl(WebViewHost* owner) : owner(owner) {}
    ~Impl() { ReleaseSurface(); }

    void Status(const std::wstring& message) const {
        if (owner->statusHandler_) owner->statusHandler_(message);
    }

    void HandleMessage(const std::wstring& json) const { owner->HandleMessage(json); }

    void ShowDevTools(const CefPoint& inspectPoint = CefPoint()) {
        if (!enableDevTools || !browser) return;
        CefWindowInfo windowInfo;
        CefBrowserSettings settings;
        browser->GetHost()->ShowDevTools(windowInfo, nullptr, settings, inspectPoint);
        Status(L"CEF DevTools opened");
    }

    void ReleaseSurface() {
        if (memoryDc && oldBitmap) SelectObject(memoryDc, oldBitmap);
        if (bitmap) DeleteObject(bitmap);
        if (memoryDc) DeleteDC(memoryDc);
        memoryDc = nullptr;
        bitmap = nullptr;
        oldBitmap = nullptr;
        pixels = nullptr;
        surfaceWidth = 0;
        surfaceHeight = 0;
    }

    bool EnsureSurface(int width, int height) {
        if (memoryDc && surfaceWidth == width && surfaceHeight == height) return true;
        ReleaseSurface();

        BITMAPINFO info{};
        info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
        info.bmiHeader.biWidth = width;
        info.bmiHeader.biHeight = -height;
        info.bmiHeader.biPlanes = 1;
        info.bmiHeader.biBitCount = 32;
        info.bmiHeader.biCompression = BI_RGB;

        memoryDc = CreateCompatibleDC(nullptr);
        bitmap = CreateDIBSection(memoryDc, &info, DIB_RGB_COLORS, &pixels, nullptr, 0);
        if (!memoryDc || !bitmap || !pixels) {
            ReleaseSurface();
            return false;
        }
        oldBitmap = SelectObject(memoryDc, bitmap);
        surfaceWidth = width;
        surfaceHeight = height;
        return true;
    }

    void Paint(const void* buffer, int width, int height) {
        if (!parent || !buffer || width <= 0 || height <= 0 || !EnsureSurface(width, height)) return;
        std::memcpy(pixels, buffer, static_cast<size_t>(width) * static_cast<size_t>(height) * 4U);

        RECT windowRect{};
        GetWindowRect(parent, &windowRect);
        POINT destination{windowRect.left, windowRect.top};
        POINT source{};
        SIZE size{width, height};
        BLENDFUNCTION blend{AC_SRC_OVER, 0, 255, AC_SRC_ALPHA};
        HDC screen = GetDC(nullptr);
        const BOOL painted = UpdateLayeredWindow(parent, screen, &destination, &size, memoryDc, &source,
                                                 0, &blend, ULW_ALPHA);
        ReleaseDC(nullptr, screen);
        if (!painted && owner->statusHandler_) {
            owner->statusHandler_(L"CEF transparent paint failed: " + std::to_wstring(GetLastError()));
        }
    }

    void SendMouse(UINT message, WPARAM wParam, LPARAM lParam) {
        if (!browser) return;
        CefMouseEvent event;
        event.x = GET_X_LPARAM(lParam);
        event.y = GET_Y_LPARAM(lParam);
        event.modifiers = CefModifiers(wParam);
        auto host = browser->GetHost();

        if (message == WM_MOUSEMOVE) host->SendMouseMoveEvent(event, false);
        else if (message == WM_MOUSELEAVE) host->SendMouseMoveEvent(event, true);
        else if (message == WM_MOUSEWHEEL || message == WM_MOUSEHWHEEL) {
            POINT point{event.x, event.y};
            ScreenToClient(parent, &point);
            event.x = point.x;
            event.y = point.y;
            const int delta = GET_WHEEL_DELTA_WPARAM(wParam);
            host->SendMouseWheelEvent(event, message == WM_MOUSEHWHEEL ? delta : 0,
                                     message == WM_MOUSEWHEEL ? delta : 0);
        } else {
            CefBrowserHost::MouseButtonType button = MBT_LEFT;
            if (message == WM_RBUTTONDOWN || message == WM_RBUTTONUP) button = MBT_RIGHT;
            if (message == WM_MBUTTONDOWN || message == WM_MBUTTONUP) button = MBT_MIDDLE;
            const bool mouseUp = message == WM_LBUTTONUP || message == WM_RBUTTONUP || message == WM_MBUTTONUP;
            host->SendMouseClickEvent(event, button, mouseUp, 1);
        }
    }

    void SendKey(UINT message, WPARAM wParam, LPARAM lParam) {
        if (!browser) return;
        CefKeyEvent event;
        event.windows_key_code = static_cast<int>(wParam);
        event.native_key_code = static_cast<int>(lParam);
        event.is_system_key = message == WM_SYSKEYDOWN || message == WM_SYSKEYUP || message == WM_SYSCHAR;
        event.modifiers = CefModifiers(0);
        if (message == WM_KEYDOWN || message == WM_SYSKEYDOWN) event.type = KEYEVENT_RAWKEYDOWN;
        else if (message == WM_KEYUP || message == WM_SYSKEYUP) event.type = KEYEVENT_KEYUP;
        else event.type = KEYEVENT_CHAR;
        browser->GetHost()->SendKeyEvent(event);
    }

    static LRESULT CALLBACK SubclassProc(HWND hwnd, UINT message, WPARAM wParam, LPARAM lParam,
                                         UINT_PTR, DWORD_PTR reference) {
        auto* self = reinterpret_cast<Impl*>(reference);
        if (!self) return DefSubclassProc(hwnd, message, wParam, lParam);
        switch (message) {
        case WM_SIZE:
            self->owner->Resize();
            break;
        case WM_SETFOCUS:
            if (self->browser) self->browser->GetHost()->SetFocus(true);
            break;
        case WM_KILLFOCUS:
            if (self->browser) self->browser->GetHost()->SetFocus(false);
            break;
        case WM_CAPTURECHANGED:
            if (self->browser) self->browser->GetHost()->SendCaptureLostEvent();
            break;
        case WM_MOUSEMOVE:
        case WM_MOUSELEAVE:
        case WM_MOUSEWHEEL:
        case WM_MOUSEHWHEEL:
        case WM_LBUTTONDOWN:
        case WM_LBUTTONUP:
        case WM_RBUTTONDOWN:
        case WM_RBUTTONUP:
        case WM_MBUTTONDOWN:
        case WM_MBUTTONUP:
            self->SendMouse(message, wParam, lParam);
            break;
        case WM_KEYDOWN:
            if (wParam == VK_F12 && self->enableDevTools) {
                self->ShowDevTools();
                return 0;
            }
            self->SendKey(message, wParam, lParam);
            break;
        case WM_KEYUP:
        case WM_SYSKEYDOWN:
        case WM_SYSKEYUP:
        case WM_CHAR:
        case WM_SYSCHAR:
            self->SendKey(message, wParam, lParam);
            break;
        default:
            break;
        }
        return DefSubclassProc(hwnd, message, wParam, lParam);
    }

    WebViewHost* const owner;
    HWND parent{nullptr};
    CefRefPtr<Client> client;
    CefRefPtr<CefBrowser> browser;
    HDC memoryDc{nullptr};
    HBITMAP bitmap{nullptr};
    HGDIOBJ oldBitmap{nullptr};
    void* pixels{nullptr};
    int surfaceWidth{0};
    int surfaceHeight{0};
    RECT lastBounds{};
    bool boundsLogged{false};
    bool enableDevTools{false};
    bool visible{false};
    bool closed{true};
};

WebViewHost::WebViewHost() : impl_(std::make_unique<Impl>(this)) {}
WebViewHost::~WebViewHost() { Close(); }

bool WebViewHost::Initialize(HWND parent, bool development, const std::wstring& devUrl,
                             const std::filesystem::path& uiFolder, bool enableDevTools,
                             const std::wstring& apiOrigin, CommandHandler handler, StatusHandler statusHandler) {
    impl_->parent = parent;
    impl_->enableDevTools = enableDevTools;
    development_ = development;
    apiOrigin_ = apiOrigin;
    commandHandler_ = std::move(handler);
    statusHandler_ = std::move(statusHandler);

    if (!development && !CefRegisterSchemeHandlerFactory(
            L"http", L"dino.tpnrp.local", new LocalResourceFactory(uiFolder))) {
        if (statusHandler_) statusHandler_(L"CEF local resource handler registration failed");
        return false;
    }
    if (!SetWindowSubclass(parent, Impl::SubclassProc, kBrowserSubclassId,
                           reinterpret_cast<DWORD_PTR>(impl_.get()))) {
        if (statusHandler_) statusHandler_(L"CEF input subclass installation failed");
        return false;
    }

    impl_->client = new Impl::Client(impl_.get());
    CefWindowInfo windowInfo;
    windowInfo.SetAsWindowless(parent);
    windowInfo.shared_texture_enabled = false;

    CefBrowserSettings settings;
    settings.background_color = CefColorSetARGB(0, 0, 0, 0);
    settings.windowless_frame_rate = 60;
    settings.chrome_status_bubble = STATE_DISABLED;

    const CefString url = development ? CefString(devUrl) : CefString(L"http://dino.tpnrp.local/index.html");
    const bool started = CefBrowserHost::CreateBrowser(windowInfo, impl_->client, url, settings, nullptr, nullptr);
    if (!started) {
        RemoveWindowSubclass(parent, Impl::SubclassProc, kBrowserSubclassId);
        impl_->client = nullptr;
        if (statusHandler_) statusHandler_(L"CEF browser creation could not start");
        return false;
    }

    if (statusHandler_) {
        statusHandler_(std::wstring(L"CEF initialization started; transparent OSR enabled; DevTools=") +
                       (enableDevTools ? L"1" : L"0"));
    }
    return true;
}

void WebViewHost::Resize() {
    if (!impl_->parent) return;
    RECT bounds{};
    GetClientRect(impl_->parent, &bounds);
    if (impl_->browser) {
        impl_->browser->GetHost()->WasResized();
        impl_->browser->GetHost()->NotifyScreenInfoChanged();
    }
    if (!impl_->boundsLogged || !EqualRect(&bounds, &impl_->lastBounds)) {
        impl_->lastBounds = bounds;
        impl_->boundsLogged = true;
        if (statusHandler_) {
            std::wostringstream output;
            output << L"CEF OSR state: bounds=[" << bounds.left << L"," << bounds.top << L"," << bounds.right
                   << L"," << bounds.bottom << L"] browserReady=" << (impl_->browser ? 1 : 0)
                   << L" parentVisible=" << (IsWindowVisible(impl_->parent) ? 1 : 0);
            statusHandler_(output.str());
        }
    }
}

void WebViewHost::SetVisible(bool visible) {
    if (impl_->visible == visible) return;
    impl_->visible = visible;
    if (impl_->browser) {
        impl_->browser->GetHost()->WasHidden(!visible);
        if (visible) impl_->browser->GetHost()->Invalidate(PET_VIEW);
    }
    if (statusHandler_) statusHandler_(std::wstring(L"CEF visibility changed: visible=") + (visible ? L"1" : L"0"));
}

bool WebViewHost::Reload() {
    if (!impl_->browser) return false;
    impl_->browser->Reload();
    return true;
}

void WebViewHost::Close() {
    if (!impl_) return;
    if (impl_->browser) {
        impl_->browser->GetHost()->CloseBrowser(true);
        const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(5);
        while (!impl_->closed && std::chrono::steady_clock::now() < deadline) {
            CefDoMessageLoopWork();
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
    }
    if (impl_->parent) RemoveWindowSubclass(impl_->parent, Impl::SubclassProc, kBrowserSubclassId);
    impl_->browser = nullptr;
    impl_->client = nullptr;
    impl_->parent = nullptr;
    CefClearSchemeHandlerFactories();
}

void WebViewHost::PostJson(const std::wstring& json) const {
    if (!impl_->browser || !impl_->browser->GetMainFrame()) return;
    auto encoded = CefValue::Create();
    encoded->SetString(json);
    const std::string quoted = CefWriteJSON(encoded, JSON_WRITER_DEFAULT).ToString();
    const std::string script =
        "(()=>{const b=window.chrome&&window.chrome.webview;if(b){b.dispatchEvent(new MessageEvent('message',{data:JSON.parse(" +
        quoted + ")}));}})();";
    impl_->browser->GetMainFrame()->ExecuteJavaScript(script, impl_->browser->GetMainFrame()->GetURL(), 0);
}

bool WebViewHost::IsPointOpaque(int x, int y) const {
    if (!impl_->visible || !impl_->pixels || x < 0 || y < 0 ||
        x >= impl_->surfaceWidth || y >= impl_->surfaceHeight) return false;
    const auto* bytes = static_cast<const unsigned char*>(impl_->pixels);
    const size_t alphaIndex = (static_cast<size_t>(y) * static_cast<size_t>(impl_->surfaceWidth) +
                               static_cast<size_t>(x)) * 4U + 3U;
    return bytes[alphaIndex] >= 32U;
}

void WebViewHost::HandleMessage(const std::wstring& json) {
    auto hasType = [&json](const wchar_t* type) {
        return json.find(std::wstring(L"\"type\":\"") + type + L"\"") != std::wstring::npos;
    };
    if (hasType(L"app.frontendError")) {
        if (statusHandler_) statusHandler_(L"frontend error: " + json);
    } else if (hasType(L"overlay.closePanel")) {
        if (commandHandler_) commandHandler_(L"overlay.closePanel", false, L"");
    } else if (hasType(L"overlay.setInteractive")) {
        if (commandHandler_) commandHandler_(L"overlay.setInteractive", json.find(L"\"value\":true") != std::wstring::npos, L"");
    } else if (hasType(L"overlay.openMap")) {
        if (commandHandler_) commandHandler_(L"overlay.openMap", false, L"");
    } else if (hasType(L"app.getVersion")) {
        if (statusHandler_) statusHandler_(L"frontend bridge ready");
        PostJson(std::wstring(L"{\"type\":\"app.config\",\"apiUrl\":\"") + apiOrigin_ + L"\"}");
        if (commandHandler_) commandHandler_(L"app.frontendReady", false, L"");
    } else if (hasType(L"app.openLogin")) {
        const std::wregex codePattern(LR"regex("browserCode"\s*:\s*"([A-Za-z0-9_-]{32})")regex");
        const std::wregex configuredOrigin(LR"(^https?://[A-Za-z0-9.-]+(?::[0-9]+)?$)");
        std::wsmatch match;
        const bool originAllowed = std::regex_match(apiOrigin_, configuredOrigin);
        if (originAllowed && std::regex_search(json, match, codePattern)) {
            const std::wstring url = apiOrigin_ + L"/hud/connect?code=" + match[1].str();
            const auto result = reinterpret_cast<std::intptr_t>(
                ShellExecuteW(nullptr, L"open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL));
            if (statusHandler_) statusHandler_(result > 32 ? L"browser login requested" : L"browser login request failed");
        } else if (statusHandler_) {
            statusHandler_(L"browser login request rejected");
        }
    } else if (hasType(L"app.launchGame")) {
        const std::wregex addressPattern(LR"regex("serverAddress"\s*:\s*"([A-Za-z0-9.:-]+)")regex");
        std::wsmatch match;
        if (std::regex_search(json, match, addressPattern) && commandHandler_)
            commandHandler_(L"app.launchGame", false, match[1].str());
    } else if (hasType(L"app.minimize")) {
        if (commandHandler_) commandHandler_(L"app.minimize", false, L"");
    } else if (hasType(L"app.exit")) {
        if (commandHandler_) commandHandler_(L"app.exit", false, L"");
    }
}
