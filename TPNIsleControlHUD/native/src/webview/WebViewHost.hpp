#pragma once

#include <windows.h>
#include <objbase.h>
#include <WebView2.h>
#include <wrl.h>
#include <filesystem>
#include <functional>
#include <string>

class WebViewHost {
public:
    using CommandHandler = std::function<void(const std::wstring& type, bool value)>;
    using StatusHandler = std::function<void(const std::wstring& message)>;
    bool Initialize(HWND parent, bool development, const std::wstring& devUrl,
                    const std::filesystem::path& uiFolder, bool enableDevTools,
                    const std::wstring& apiOrigin, CommandHandler handler, StatusHandler statusHandler);
    void Resize();
    void SetVisible(bool visible);
    bool Reload();
    void Close();
    void PostJson(const std::wstring& json) const;
private:
    void Configure(bool development, const std::wstring& devUrl, const std::filesystem::path& uiFolder, bool enableDevTools);
    void HandleMessage(const std::wstring& json);
    HWND parent_{nullptr};
    CommandHandler commandHandler_;
    StatusHandler statusHandler_;
    Microsoft::WRL::ComPtr<ICoreWebView2Controller> controller_;
    Microsoft::WRL::ComPtr<ICoreWebView2> webview_;
    RECT lastBounds_{};
    bool boundsLogged_{false};
    bool development_{false};
    std::wstring apiOrigin_;
};
