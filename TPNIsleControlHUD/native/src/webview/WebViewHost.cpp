#include "webview/WebViewHost.hpp"

#include <WebView2EnvironmentOptions.h>
#include <wrl/event.h>
#include <shellapi.h>
#include <regex>
#include <sstream>
#include <utility>

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

bool WebViewHost::Initialize(HWND parent, bool development, const std::wstring& devUrl,
                             const std::filesystem::path& uiFolder, bool enableDevTools,
                             const std::wstring& apiOrigin, CommandHandler handler, StatusHandler statusHandler) {
    parent_ = parent;
    development_ = development;
    apiOrigin_ = apiOrigin;
    commandHandler_ = std::move(handler);
    statusHandler_ = std::move(statusHandler);
    const HRESULT result = CreateCoreWebView2EnvironmentWithOptions(nullptr, nullptr, nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [this, development, devUrl, uiFolder, enableDevTools](HRESULT error, ICoreWebView2Environment* environment) -> HRESULT {
                if (FAILED(error) || !environment) {
                    if (statusHandler_) statusHandler_(L"WebView2 environment creation failed: " + std::to_wstring(error));
                    MessageBoxW(parent_, L"Microsoft Edge WebView2 Runtime is required.", L"TPN Isle Control HUD", MB_ICONERROR);
                    return error;
                }
                if (statusHandler_) statusHandler_(L"WebView2 environment created");
                return environment->CreateCoreWebView2Controller(parent_,
                    Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                        [this, development, devUrl, uiFolder, enableDevTools](HRESULT controllerError, ICoreWebView2Controller* controller) -> HRESULT {
                            if (FAILED(controllerError) || !controller) {
                                if (statusHandler_) statusHandler_(L"WebView2 controller creation failed: " + std::to_wstring(controllerError));
                                return controllerError;
                            }
                            controller_ = controller;
                            controller_->get_CoreWebView2(&webview_);
                            Configure(development, devUrl, uiFolder, enableDevTools);
                            Resize();
                            SetVisible(IsWindowVisible(parent_) != FALSE);
                            if (statusHandler_) statusHandler_(L"WebView2 controller created");
                            return S_OK;
                        }).Get());
            }).Get());
    return SUCCEEDED(result);
}

void WebViewHost::Configure(bool development, const std::wstring& devUrl,
                            const std::filesystem::path& uiFolder, bool enableDevTools) {
    ComPtr<ICoreWebView2Controller2> controller2;
    if (SUCCEEDED(controller_.As(&controller2))) controller2->put_DefaultBackgroundColor({255, 255, 0, 255});
    ComPtr<ICoreWebView2Settings> settings;
    webview_->get_Settings(&settings);
    settings->put_AreDevToolsEnabled(enableDevTools ? TRUE : FALSE);
    settings->put_AreDefaultContextMenusEnabled(enableDevTools ? TRUE : FALSE);
    settings->put_IsStatusBarEnabled(FALSE);
    settings->put_IsZoomControlEnabled(FALSE);

    webview_->AddScriptToExecuteOnDocumentCreated(
        LR"js(window.addEventListener('error',function(e){chrome.webview.postMessage({type:'app.frontendError',message:String(e.message),source:String(e.filename),line:e.lineno});});window.addEventListener('unhandledrejection',function(e){chrome.webview.postMessage({type:'app.frontendError',message:String(e.reason)});});)js",
        Callback<ICoreWebView2AddScriptToExecuteOnDocumentCreatedCompletedHandler>(
            [this](HRESULT error, LPCWSTR) -> HRESULT {
                if (FAILED(error) && statusHandler_)
                    statusHandler_(L"frontend error hook failed: " + std::to_wstring(error));
                return S_OK;
            }).Get());

    EventRegistrationToken messageToken{};
    webview_->add_WebMessageReceived(Callback<ICoreWebView2WebMessageReceivedEventHandler>(
        [this](ICoreWebView2*, ICoreWebView2WebMessageReceivedEventArgs* args) -> HRESULT {
            LPWSTR raw = nullptr;
            if (SUCCEEDED(args->get_WebMessageAsJson(&raw)) && raw) { HandleMessage(raw); CoTaskMemFree(raw); }
            return S_OK;
        }).Get(), &messageToken);

    EventRegistrationToken navigationToken{};
    webview_->add_NavigationCompleted(Callback<ICoreWebView2NavigationCompletedEventHandler>(
        [this](ICoreWebView2*, ICoreWebView2NavigationCompletedEventArgs* args) -> HRESULT {
            BOOL success = FALSE;
            args->get_IsSuccess(&success);
            COREWEBVIEW2_WEB_ERROR_STATUS status{};
            args->get_WebErrorStatus(&status);
            if (statusHandler_) statusHandler_(success
                ? L"frontend navigation completed"
                : L"frontend navigation failed, status: " + std::to_wstring(static_cast<int>(status)));
            if (success && webview_) {
                webview_->ExecuteScript(
                    LR"js((()=>{const inspect=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{children:e.childElementCount,htmlLength:e.innerHTML.length,rect:[r.left,r.top,r.right,r.bottom],display:s.display,visibility:s.visibility,opacity:s.opacity,pointerEvents:s.pointerEvents}};return JSON.stringify({url:String(location.href),documentVisibility:document.visibilityState,viewport:[innerWidth,innerHeight,devicePixelRatio],scripts:document.scripts.length,styles:document.styleSheets.length,body:inspect(document.body),root:inspect(document.getElementById('root')),main:inspect(document.querySelector('main'))})})())js",
                    Callback<ICoreWebView2ExecuteScriptCompletedHandler>(
                        [this](HRESULT error, LPCWSTR result) -> HRESULT {
                            if (statusHandler_) statusHandler_(FAILED(error)
                                ? L"frontend DOM inspection failed: " + std::to_wstring(error)
                                : L"frontend DOM: " + std::wstring(result ? result : L"null"));
                            return S_OK;
                        }).Get());
            }
            return S_OK;
        }).Get(), &navigationToken);

    if (development) {
        webview_->Navigate(devUrl.c_str());
    } else {
        ComPtr<ICoreWebView2_3> webview3;
        if (SUCCEEDED(webview_.As(&webview3))) {
            const HRESULT mapping = webview3->SetVirtualHostNameToFolderMapping(
                L"app.tpn.local", uiFolder.c_str(), COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY_CORS);
            if (statusHandler_) statusHandler_(SUCCEEDED(mapping)
                ? L"frontend virtual host mapped to " + uiFolder.wstring()
                : L"frontend virtual host mapping failed: " + std::to_wstring(mapping));
            const HRESULT navigation = webview_->Navigate(L"https://app.tpn.local/index.html");
            if (FAILED(navigation) && statusHandler_)
                statusHandler_(L"frontend navigation could not start: " + std::to_wstring(navigation));
        }
    }
}

void WebViewHost::Resize() {
    if (!controller_ || !parent_) return;
    RECT bounds{};
    GetClientRect(parent_, &bounds);
    const HRESULT resize = controller_->put_Bounds(bounds);
    BOOL controllerVisible = FALSE;
    controller_->get_IsVisible(&controllerVisible);
    if (!boundsLogged_ || !EqualRect(&bounds, &lastBounds_)) {
        lastBounds_ = bounds;
        boundsLogged_ = true;
        if (statusHandler_) {
            std::wostringstream output;
            output << L"WebView2 state: bounds=[" << bounds.left << L"," << bounds.top << L"," << bounds.right << L"," << bounds.bottom << L"]"
                   << L" controllerVisible=" << (controllerVisible ? 1 : 0)
                   << L" parentVisible=" << (IsWindowVisible(parent_) ? 1 : 0)
                   << L" parentEnabled=" << (IsWindowEnabled(parent_) ? 1 : 0)
                   << L" resizeResult=" << resize;
            statusHandler_(output.str());
        }
    }
}

void WebViewHost::SetVisible(bool visible) {
    if (!controller_) return;
    BOOL current = FALSE;
    const HRESULT read = controller_->get_IsVisible(&current);
    if (FAILED(read) || (current != FALSE) == visible) return;
    const HRESULT result = controller_->put_IsVisible(visible ? TRUE : FALSE);
    if (statusHandler_) {
        statusHandler_(std::wstring(L"WebView2 visibility changed: visible=") +
                       (visible ? L"1" : L"0") + L" result=" + std::to_wstring(result));
    }
}

bool WebViewHost::Reload() {
    return webview_ && SUCCEEDED(webview_->Reload());
}

void WebViewHost::Close() {
    if (controller_) controller_->Close();
    webview_.Reset();
    controller_.Reset();
}

void WebViewHost::PostJson(const std::wstring& json) const {
    if (webview_) webview_->PostWebMessageAsJson(json.c_str());
}

void WebViewHost::HandleMessage(const std::wstring& json) {
    auto hasType = [&json](const wchar_t* type) { return json.find(std::wstring(L"\"type\":\"") + type + L"\"") != std::wstring::npos; };
    if (hasType(L"app.frontendError")) {
        if (statusHandler_) statusHandler_(L"frontend error: " + json);
    }
    else if (hasType(L"overlay.closePanel")) commandHandler_(L"overlay.closePanel", false);
    else if (hasType(L"overlay.setInteractive")) commandHandler_(L"overlay.setInteractive", json.find(L"\"value\":true") != std::wstring::npos);
    else if (hasType(L"app.getVersion")) {
        if (statusHandler_) statusHandler_(L"frontend bridge ready");
        PostJson(std::wstring(L"{\"type\":\"app.config\",\"apiUrl\":\"") + apiOrigin_ + L"\"}");
    }
    else if (hasType(L"app.openLogin")) {
        const std::wregex codePattern(LR"regex("browserCode"\s*:\s*"([A-Za-z0-9_-]{32})")regex");
        const std::wregex productionOrigin(LR"(^https://[A-Za-z0-9.-]+(?::[0-9]+)?$)");
        const std::wregex developmentOrigin(LR"(^http://(?:localhost|127\.0\.0\.1)(?::[0-9]+)?$)");
        std::wsmatch match;
        const bool originAllowed = std::regex_match(apiOrigin_, productionOrigin) || (development_ && std::regex_match(apiOrigin_, developmentOrigin));
        if (originAllowed && std::regex_search(json, match, codePattern)) {
            const std::wstring url = apiOrigin_ + L"/hud/connect?code=" + match[1].str();
            ShellExecuteW(nullptr, L"open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
        }
    }
    else if (hasType(L"app.exit")) commandHandler_(L"app.exit", false);
}
