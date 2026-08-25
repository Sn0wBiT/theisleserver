#pragma once

#include <windows.h>
#include <filesystem>
#include <functional>
#include <memory>
#include <string>

class WebViewHost {
public:
    using CommandHandler = std::function<void(const std::wstring& type, bool value)>;
    using StatusHandler = std::function<void(const std::wstring& message)>;
    WebViewHost();
    ~WebViewHost();
    WebViewHost(const WebViewHost&) = delete;
    WebViewHost& operator=(const WebViewHost&) = delete;

    bool Initialize(HWND parent, bool development, const std::wstring& devUrl,
                    const std::filesystem::path& uiFolder, bool enableDevTools,
                    const std::wstring& apiOrigin, CommandHandler handler, StatusHandler statusHandler);
    void Resize();
    void SetVisible(bool visible);
    bool Reload();
    void Close();
    void PostJson(const std::wstring& json) const;
    [[nodiscard]] bool IsPointOpaque(int x, int y) const;
private:
    void HandleMessage(const std::wstring& json);
    struct Impl;
    std::unique_ptr<Impl> impl_;
    CommandHandler commandHandler_;
    StatusHandler statusHandler_;
    bool development_{false};
    std::wstring apiOrigin_;
};
