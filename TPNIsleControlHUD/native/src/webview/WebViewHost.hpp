#pragma once

#include <windows.h>
#include <WebView2.h>
#include <wrl.h>
#include <filesystem>
#include <functional>
#include <string>

class WebViewHost {
public:
    using CommandHandler = std::function<void(const std::wstring& type, bool value)>;
    bool Initialize(HWND parent, bool development, const std::wstring& devUrl,
                    const std::filesystem::path& uiFolder, bool enableDevTools, CommandHandler handler);
    void Resize();
    void Close();
    void PostJson(const std::wstring& json) const;
private:
    void Configure(bool development, const std::wstring& devUrl, const std::filesystem::path& uiFolder, bool enableDevTools);
    void HandleMessage(const std::wstring& json);
    HWND parent_{nullptr};
    CommandHandler commandHandler_;
    Microsoft::WRL::ComPtr<ICoreWebView2Controller> controller_;
    Microsoft::WRL::ComPtr<ICoreWebView2> webview_;
};

