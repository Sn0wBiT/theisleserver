#include <windows.h>
#include <winhttp.h>
#include <bcrypt.h>
#include <commctrl.h>
#include <shellapi.h>

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <regex>
#include <string>
#include <vector>

namespace {
struct ManifestFile { std::wstring path; std::wstring hash; };
struct Manifest { std::wstring version; std::wstring hash; std::vector<ManifestFile> files; std::string raw; };

class StatusWindow {
public:
    StatusWindow(HINSTANCE instance) {
        INITCOMMONCONTROLSEX controls{sizeof(controls), ICC_PROGRESS_CLASS};
        InitCommonControlsEx(&controls);
        window_ = CreateWindowExW(WS_EX_TOPMOST, L"STATIC", L"TPN Isle Control HUD Update",
            WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU, CW_USEDEFAULT, CW_USEDEFAULT, 520, 180,
            nullptr, nullptr, instance, nullptr);
        label_ = CreateWindowW(L"STATIC", L"Đang kiểm tra cập nhật...", WS_CHILD | WS_VISIBLE,
            20, 20, 470, 24, window_, nullptr, instance, nullptr);
        filename_ = CreateWindowW(L"STATIC", L"", WS_CHILD | WS_VISIBLE | SS_PATHELLIPSIS,
            20, 48, 470, 24, window_, nullptr, instance, nullptr);
        progress_ = CreateWindowW(PROGRESS_CLASSW, nullptr, WS_CHILD | WS_VISIBLE | PBS_SMOOTH,
            20, 80, 470, 22, window_, nullptr, instance, nullptr);
        font_ = CreateFontW(-16, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, VIETNAMESE_CHARSET,
            OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY,
            DEFAULT_PITCH | FF_DONTCARE, L"Segoe UI");
        if (font_) {
            SendMessageW(label_, WM_SETFONT, reinterpret_cast<WPARAM>(font_), TRUE);
            SendMessageW(filename_, WM_SETFONT, reinterpret_cast<WPARAM>(font_), TRUE);
        }
        SendMessageW(progress_, PBM_SETRANGE32, 0, 100);
        RECT workArea{};
        RECT windowBounds{};
        if (SystemParametersInfoW(SPI_GETWORKAREA, 0, &workArea, 0) && GetWindowRect(window_, &windowBounds)) {
            const int width = windowBounds.right - windowBounds.left;
            const int height = windowBounds.bottom - windowBounds.top;
            const int x = workArea.left + ((workArea.right - workArea.left) - width) / 2;
            const int y = workArea.top + ((workArea.bottom - workArea.top) - height) / 2;
            SetWindowPos(window_, nullptr, x, y, 0, 0, SWP_NOACTIVATE | SWP_NOZORDER | SWP_NOSIZE);
        }
        ShowWindow(window_, SW_SHOW);
        UpdateWindow(window_);
    }

    ~StatusWindow() {
        if (window_) DestroyWindow(window_);
        if (font_) DeleteObject(font_);
    }

    void Set(const std::wstring& text, const std::wstring& filename, size_t completed, size_t total) {
        SetWindowTextW(label_, text.c_str());
        SetWindowTextW(filename_, filename.c_str());
        const int percent = total == 0 ? 0 : static_cast<int>((std::min(completed, total) * 100) / total);
        SendMessageW(progress_, PBM_SETPOS, percent, 0);
        RedrawWindow(window_, nullptr, nullptr, RDW_INVALIDATE | RDW_UPDATENOW | RDW_ALLCHILDREN);
        MSG message{};
        while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
    }

private:
    HWND window_{};
    HWND label_{};
    HWND filename_{};
    HWND progress_{};
    HFONT font_{};
};

std::wstring Utf8ToWide(const std::string& value) {
    if (value.empty()) return {};
    const int size = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                                         static_cast<int>(value.size()), nullptr, 0);
    if (size <= 0) return {};
    std::wstring result(static_cast<size_t>(size), L'\0');
    MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()),
                        result.data(), size);
    return result;
}

bool GetArgument(const wchar_t* name, std::wstring& value) {
    int count = 0;
    wchar_t** arguments = CommandLineToArgvW(GetCommandLineW(), &count);
    if (!arguments) return false;
    bool found = false;
    for (int index = 1; index + 1 < count; ++index) {
        if (wcscmp(arguments[index], name) == 0) { value = arguments[index + 1]; found = true; break; }
    }
    LocalFree(arguments);
    return found;
}

bool HttpGet(const std::wstring& url, std::vector<unsigned char>& body) {
    URL_COMPONENTSW parts{sizeof(parts)};
    wchar_t host[256]{};
    wchar_t path[4096]{};
    parts.lpszHostName = host;
    parts.dwHostNameLength = static_cast<DWORD>(std::size(host));
    parts.lpszUrlPath = path;
    parts.dwUrlPathLength = static_cast<DWORD>(std::size(path));
    if (!WinHttpCrackUrl(url.c_str(), 0, 0, &parts)) return false;

    HINTERNET session = WinHttpOpen(L"TPNIsleControlHUDUpdater/0.1.1",
        WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    if (!session) return false;
    HINTERNET connection = WinHttpConnect(session, std::wstring(host, parts.dwHostNameLength).c_str(), parts.nPort, 0);
    const DWORD flags = parts.nScheme == INTERNET_SCHEME_HTTPS ? WINHTTP_FLAG_SECURE : 0;
    HINTERNET request = connection ? WinHttpOpenRequest(connection, L"GET",
        std::wstring(path, parts.dwUrlPathLength).c_str(), nullptr, WINHTTP_NO_REFERER,
        WINHTTP_DEFAULT_ACCEPT_TYPES, flags) : nullptr;
    bool success = request && WinHttpSendRequest(request, L"Cache-Control: no-cache\r\n", -1L,
        WINHTTP_NO_REQUEST_DATA, 0, 0, 0) && WinHttpReceiveResponse(request, nullptr);
    DWORD status = 0;
    DWORD statusSize = sizeof(status);
    if (success) success = WinHttpQueryHeaders(request, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                                               nullptr, &status, &statusSize, nullptr) && status == 200;
    body.clear();
    while (success) {
        DWORD available = 0;
        if (!WinHttpQueryDataAvailable(request, &available)) { success = false; break; }
        if (available == 0) break;
        const size_t offset = body.size();
        body.resize(offset + available);
        DWORD read = 0;
        if (!WinHttpReadData(request, body.data() + offset, available, &read)) { success = false; break; }
        body.resize(offset + read);
    }
    if (request) WinHttpCloseHandle(request);
    if (connection) WinHttpCloseHandle(connection);
    WinHttpCloseHandle(session);
    return success;
}

std::wstring Sha256(const unsigned char* data, size_t size) {
    BCRYPT_ALG_HANDLE algorithm{};
    BCRYPT_HASH_HANDLE hash{};
    DWORD objectSize = 0, hashSize = 0, bytes = 0;
    std::vector<unsigned char> object;
    std::vector<unsigned char> digest;
    if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) < 0 ||
        BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH, reinterpret_cast<PUCHAR>(&objectSize), sizeof(objectSize), &bytes, 0) < 0 ||
        BCryptGetProperty(algorithm, BCRYPT_HASH_LENGTH, reinterpret_cast<PUCHAR>(&hashSize), sizeof(hashSize), &bytes, 0) < 0) {
        if (algorithm) BCryptCloseAlgorithmProvider(algorithm, 0);
        return {};
    }
    object.resize(objectSize);
    digest.resize(hashSize);
    bool success = BCryptCreateHash(algorithm, &hash, object.data(), objectSize, nullptr, 0, 0) >= 0;
    if (success && size > 0) success = BCryptHashData(hash, const_cast<PUCHAR>(data), static_cast<ULONG>(size), 0) >= 0;
    if (success) success = BCryptFinishHash(hash, digest.data(), hashSize, 0) >= 0;
    if (hash) BCryptDestroyHash(hash);
    BCryptCloseAlgorithmProvider(algorithm, 0);
    if (!success) return {};
    static constexpr wchar_t digits[] = L"0123456789abcdef";
    std::wstring result;
    result.reserve(digest.size() * 2);
    for (const auto byte : digest) { result.push_back(digits[byte >> 4]); result.push_back(digits[byte & 15]); }
    return result;
}

std::wstring HashFile(const std::filesystem::path& path) {
    std::ifstream input(path, std::ios::binary);
    if (!input) return {};
    std::vector<unsigned char> bytes((std::istreambuf_iterator<char>(input)), std::istreambuf_iterator<char>());
    return Sha256(bytes.data(), bytes.size());
}

bool ParseManifest(const std::vector<unsigned char>& bytes, Manifest& manifest) {
    manifest.raw.assign(bytes.begin(), bytes.end());
    std::smatch version;
    const std::regex versionPattern(R"json("version"\s*:\s*"([^"]+)")json");
    if (!std::regex_search(manifest.raw, version, versionPattern)) return false;
    manifest.version = Utf8ToWide(version[1].str());
    std::smatch aggregateHash;
    const std::regex hashPattern(R"json("hash"\s*:\s*"([0-9a-fA-F]{64})")json");
    if (!std::regex_search(manifest.raw, aggregateHash, hashPattern)) return false;
    manifest.hash = Utf8ToWide(aggregateHash[1].str());
    const size_t filesKey = manifest.raw.find("\"files\"");
    const size_t filesStart = filesKey == std::string::npos ? std::string::npos : manifest.raw.find('{', filesKey);
    const size_t filesEnd = manifest.raw.rfind('}');
    if (filesStart == std::string::npos || filesEnd == std::string::npos || filesEnd <= filesStart) return false;
    const std::string files = manifest.raw.substr(filesStart + 1, filesEnd - filesStart - 1);
    const std::regex filePattern(R"json("([^"]+)"\s*:\s*"([0-9a-fA-F]{64})")json");
    std::vector<std::string> canonicalEntries;
    for (std::sregex_iterator match(files.begin(), files.end(), filePattern), end; match != end; ++match) {
        std::wstring path = Utf8ToWide((*match)[1].str());
        std::replace(path.begin(), path.end(), L'/', L'\\');
        if (path.empty() || path.find(L"..") != std::wstring::npos || path.find(L':') != std::wstring::npos ||
            path.front() == L'\\') return false;
        manifest.files.push_back({path, Utf8ToWide((*match)[2].str())});
        canonicalEntries.push_back((*match)[1].str() + ":" + (*match)[2].str());
    }
    std::string canonical;
    for (size_t index = 0; index < canonicalEntries.size(); ++index) {
        if (index > 0) canonical.push_back('\n');
        canonical += canonicalEntries[index];
    }
    const auto calculatedHash = Sha256(reinterpret_cast<const unsigned char*>(canonical.data()), canonical.size());
    return !manifest.version.empty() && !manifest.files.empty() && calculatedHash == manifest.hash;
}

bool WriteBytes(const std::filesystem::path& path, const std::vector<unsigned char>& bytes) {
    std::error_code error;
    std::filesystem::create_directories(path.parent_path(), error);
    if (error) return false;
    std::ofstream output(path, std::ios::binary | std::ios::trunc);
    if (!output) return false;
    output.write(reinterpret_cast<const char*>(bytes.data()), static_cast<std::streamsize>(bytes.size()));
    return output.good();
}

bool LaunchHud(const std::filesystem::path& installDirectory) {
    const auto executable = installDirectory / L"TPNIsleControlHUD.exe";
    std::wstring command = L"\"" + executable.wstring() + L"\" --skip-update";
    STARTUPINFOW startup{sizeof(startup)};
    PROCESS_INFORMATION process{};
    const bool launched = CreateProcessW(nullptr, command.data(), nullptr, nullptr, FALSE, 0,
                                         nullptr, installDirectory.c_str(), &startup, &process) != FALSE;
    if (launched) { CloseHandle(process.hThread); CloseHandle(process.hProcess); }
    return launched;
}

void Fail(const std::wstring& message) {
    MessageBoxW(nullptr, (message + L"\n\nHUD startup is blocked until the release can be verified.").c_str(),
                L"TPN Isle Control HUD Update", MB_OK | MB_ICONERROR);
}
}

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int) {
    std::wstring installValue, origin, pidValue;
    if (!GetArgument(L"--install-dir", installValue) || !GetArgument(L"--origin", origin) ||
        !GetArgument(L"--pid", pidValue)) { Fail(L"The updater arguments are invalid."); return 1; }
    const auto installDirectory = std::filesystem::path(installValue);
    const DWORD parentPid = static_cast<DWORD>(wcstoul(pidValue.c_str(), nullptr, 10));
    if (HANDLE parent = OpenProcess(SYNCHRONIZE, FALSE, parentPid)) {
        WaitForSingleObject(parent, 30000);
        CloseHandle(parent);
    }

    StatusWindow status(instance);
    status.Set(L"Đang kiểm tra manifest...", L"manifest.json", 0, 1);
    std::vector<unsigned char> manifestBytes;
    if (!HttpGet(origin + L"/hud/manifest.json", manifestBytes)) { Fail(L"Không thể tải manifest.json. Vui lòng thử lại sau!"); return 1; }
    Manifest remote;
    if (!ParseManifest(manifestBytes, remote)) { Fail(L"Dữ liệu manifest không hợp lệ. Vui lòng thử lại sau!"); return 1; }
    status.Set(L"Đã kiểm tra manifest.", L"manifest.json", 1, 1);

    Manifest local;
    std::vector<unsigned char> localBytes;
    const auto localManifestPath = installDirectory / L"manifest.json";
    {
        std::ifstream input(localManifestPath, std::ios::binary);
        if (input) localBytes.assign(std::istreambuf_iterator<char>(input), std::istreambuf_iterator<char>());
    }
    const bool hasLocalManifest = ParseManifest(localBytes, local);
    std::vector<ManifestFile> changed;
    for (size_t index = 0; index < remote.files.size(); ++index) {
        const auto& file = remote.files[index];
        status.Set(L"Đang xác minh tệp...", file.path, index, remote.files.size());
        if (HashFile(installDirectory / file.path) != file.hash) changed.push_back(file);
        status.Set(L"Đang xác minh tệp...", file.path, index + 1, remote.files.size());
    }

    if (!hasLocalManifest || local.version != remote.version || !changed.empty()) {
        const auto staging = installDirectory / L".update";
        std::error_code error;
        std::filesystem::remove_all(staging, error);
        for (size_t index = 0; index < changed.size(); ++index) {
            const auto& file = changed[index];
            status.Set(L"Đang tải xuống tệp...", file.path, index, changed.size());
            std::wstring urlPath = file.path;
            std::replace(urlPath.begin(), urlPath.end(), L'\\', L'/');
            std::vector<unsigned char> bytes;
            if (!HttpGet(origin + L"/hud/release/" + urlPath, bytes) || Sha256(bytes.data(), bytes.size()) != file.hash ||
                !WriteBytes(staging / file.path, bytes)) { Fail(L"Failed to download or verify " + file.path + L"."); return 1; }
            status.Set(L"Đang tải xuống tệp...", file.path, index + 1, changed.size());
        }
        for (size_t index = 0; index < changed.size(); ++index) {
            const auto& file = changed[index];
            status.Set(L"Đang cài đặt tệp...", file.path, index, changed.size());
            std::filesystem::create_directories((installDirectory / file.path).parent_path(), error);
            if (!CopyFileW((staging / file.path).c_str(), (installDirectory / file.path).c_str(), FALSE)) {
                Fail(L"Failed to install " + file.path + L"."); return 1;
            }
            status.Set(L"Đang cài đặt tệp...", file.path, index + 1, changed.size());
        }
        if (hasLocalManifest) {
            for (const auto& oldFile : local.files) {
                const bool retained = std::any_of(remote.files.begin(), remote.files.end(), [&](const ManifestFile& file) {
                    return file.path == oldFile.path;
                });
                if (!retained) std::filesystem::remove(installDirectory / oldFile.path, error);
            }
        }
        if (!WriteBytes(localManifestPath, manifestBytes)) { Fail(L"Failed to save manifest.json."); return 1; }
        std::filesystem::remove_all(staging, error);
    }

    status.Set(L"Đã xác minh bản phát hành. Đang khởi động HUD...", L"", 1, 1);
    if (!LaunchHud(installDirectory)) { Fail(L"The updated HUD could not be started."); return 1; }
    return 0;
}
