#include "app/Application.hpp"
#include "cef/CefApplication.hpp"

#include "include/cef_app.h"
#include <windows.h>
#include <objbase.h>
#include <filesystem>

namespace {
std::filesystem::path ExecutableDirectory() {
    std::wstring path(32768, L'\0');
    const DWORD length = GetModuleFileNameW(nullptr, path.data(), static_cast<DWORD>(path.size()));
    path.resize(length);
    return std::filesystem::path(path).parent_path();
}

std::filesystem::path CefDataDirectory() {
    std::wstring localAppData(32768, L'\0');
    const DWORD length = GetEnvironmentVariableW(L"LOCALAPPDATA", localAppData.data(),
                                                  static_cast<DWORD>(localAppData.size()));
    if (length > 0 && length < localAppData.size()) {
        localAppData.resize(length);
        return std::filesystem::path(localAppData) / L"TPNIsleControlHUD" / L"CEF";
    }
    return ExecutableDirectory() / L"cef-data";
}
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int) {
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

    CefMainArgs mainArguments(instance);
    CefRefPtr<CefApp> cefApplication = CreateHudCefApplication();
    const int subprocessResult = CefExecuteProcess(mainArguments, cefApplication, nullptr);
    if (subprocessResult >= 0) return subprocessResult;

    const auto cefData = CefDataDirectory();
    std::error_code directoryError;
    std::filesystem::create_directories(cefData, directoryError);

    CefSettings cefSettings;
    cefSettings.no_sandbox = true;
    cefSettings.windowless_rendering_enabled = true;
    cefSettings.background_color = CefColorSetARGB(0, 0, 0, 0);
    CefString(&cefSettings.root_cache_path) = cefData.wstring();
    CefString(&cefSettings.cache_path) = (cefData / L"cache").wstring();
    CefString(&cefSettings.log_file) = (cefData / L"cef.log").wstring();
    cefSettings.log_severity = LOGSEVERITY_WARNING;
    if (!CefInitialize(mainArguments, cefSettings, cefApplication, nullptr)) return 1;

    const HRESULT com = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    if (FAILED(com)) {
        CefShutdown();
        return 1;
    }
    int result = 1;
    {
        Application application(instance);
        result = application.Run();
    }
    CefShutdown();
    CoUninitialize();
    return result;
}
