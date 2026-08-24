#include "webview/WebViewHost.hpp"

#include <WebView2EnvironmentOptions.h>
#include <wrl/event.h>
#include <shellapi.h>
#include <regex>
#include <utility>

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

bool WebViewHost::Initialize(HWND parent, bool development, const std::wstring& devUrl,
                             const std::filesystem::path& uiFolder, bool enableDevTools,
                             const std::wstring& apiOrigin, CommandHandler handler) {
    parent_ = parent;
    development_ = development;
    apiOrigin_ = apiOrigin;
    commandHandler_ = std::move(handler);
    const HRESULT result = CreateCoreWebView2EnvironmentWithOptions(nullptr, nullptr, nullptr,
        Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
            [this, development, devUrl, uiFolder, enableDevTools](HRESULT error, ICoreWebView2Environment* environment) -> HRESULT {
                if (FAILED(error) || !environment) {
                    MessageBoxW(parent_, L"Microsoft Edge WebView2 Runtime is required.", L"TPN Isle Control HUD", MB_ICONERROR);
                    return error;
                }
                return environment->CreateCoreWebView2Controller(parent_,
                    Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>(
                        [this, development, devUrl, uiFolder, enableDevTools](HRESULT controllerError, ICoreWebView2Controller* controller) -> HRESULT {
                            if (FAILED(controllerError) || !controller) return controllerError;
                            controller_ = controller;
                            controller_->get_CoreWebView2(&webview_);
                            Configure(development, devUrl, uiFolder, enableDevTools);
                            Resize();
                            return S_OK;
                        }).Get());
            }).Get());
    return SUCCEEDED(result);
}

void WebViewHost::Configure(bool development, const std::wstring& devUrl,
                            const std::filesystem::path& uiFolder, bool enableDevTools) {
    ComPtr<ICoreWebView2Controller2> controller2;
    if (SUCCEEDED(controller_.As(&controller2))) controller2->put_DefaultBackgroundColor({0, 0, 0, 0});
    ComPtr<ICoreWebView2Settings> settings;
    webview_->get_Settings(&settings);
    settings->put_AreDevToolsEnabled(enableDevTools ? TRUE : FALSE);
    settings->put_AreDefaultContextMenusEnabled(enableDevTools ? TRUE : FALSE);
    settings->put_IsStatusBarEnabled(FALSE);
    settings->put_IsZoomControlEnabled(FALSE);

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
            if (!success) OutputDebugStringW(L"[TPNHUD] frontend navigation failed\n");
            return S_OK;
        }).Get(), &navigationToken);

    if (development) {
        webview_->Navigate(devUrl.c_str());
    } else {
        ComPtr<ICoreWebView2_3> webview3;
        if (SUCCEEDED(webview_.As(&webview3))) {
            webview3->SetVirtualHostNameToFolderMapping(L"app.tpn.local", uiFolder.c_str(), COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY_CORS);
            webview_->Navigate(L"https://app.tpn.local/index.html");
        }
    }
}

void WebViewHost::Resize() {
    if (!controller_ || !parent_) return;
    RECT bounds{};
    GetClientRect(parent_, &bounds);
    controller_->put_Bounds(bounds);
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
    if (hasType(L"overlay.closePanel")) commandHandler_(L"overlay.closePanel", false);
    else if (hasType(L"overlay.setInteractive")) commandHandler_(L"overlay.setInteractive", json.find(L"\"value\":true") != std::wstring::npos);
    else if (hasType(L"app.getVersion")) {
        PostJson(std::wstring(L"{\"type\":\"app.config\",\"apiUrl\":\"") + apiOrigin_ + L"\"}");
    }
    else if (hasType(L"app.openLogin")) {
        const std::wregex codePattern(LR"("browserCode"\s*:\s*"([A-Za-z0-9_-]{32})")");
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
