#include "ue4ss_compat.hpp"

#include <windows.h>
#include <winhttp.h>

#include <chrono>
#include <charconv>
#include <condition_variable>
#include <cstring>
#include <cstdint>
#include <deque>
#include <mutex>
#include <optional>
#include <new>
#include <stop_token>
#include <string>
#include <string_view>
#include <thread>
#include <utility>

namespace IsleControlNative
{
    using namespace RC;

    constexpr std::size_t max_payload_bytes = 1024 * 1024;
    constexpr std::size_t max_queue_depth = 128;

    struct InternetHandle
    {
        HINTERNET value{};

        InternetHandle() = default;
        explicit InternetHandle(HINTERNET handle) : value(handle) {}
        InternetHandle(const InternetHandle&) = delete;
        auto operator=(const InternetHandle&) -> InternetHandle& = delete;

        InternetHandle(InternetHandle&& other) noexcept : value(std::exchange(other.value, nullptr)) {}
        auto operator=(InternetHandle&& other) noexcept -> InternetHandle&
        {
            if (this != &other)
            {
                if (value) WinHttpCloseHandle(value);
                value = std::exchange(other.value, nullptr);
            }
            return *this;
        }

        ~InternetHandle()
        {
            if (value) WinHttpCloseHandle(value);
        }

        explicit operator bool() const { return value != nullptr; }
    };

    struct Endpoint
    {
        std::wstring host{};
        std::wstring path{};
        INTERNET_PORT port{};
        bool secure{};
        std::wstring bearer_token{};
    };

    auto utf8_to_wide(std::string_view input) -> std::optional<std::wstring>
    {
        if (input.empty()) return std::wstring{};

        const int required = MultiByteToWideChar(
            CP_UTF8, MB_ERR_INVALID_CHARS, input.data(), static_cast<int>(input.size()), nullptr, 0);
        if (required <= 0) return std::nullopt;

        std::wstring output(static_cast<std::size_t>(required), L'\0');
        if (MultiByteToWideChar(
                CP_UTF8,
                MB_ERR_INVALID_CHARS,
                input.data(),
                static_cast<int>(input.size()),
                output.data(),
                required) <= 0)
        {
            return std::nullopt;
        }

        return output;
    }

    auto parse_endpoint(std::string_view url, std::string_view token) -> std::optional<Endpoint>
    {
        const auto wide_url = utf8_to_wide(url);
        const auto wide_token = utf8_to_wide(token);
        if (!wide_url || !wide_token) return std::nullopt;
        if (wide_token->find_first_of(L"\r\n") != std::wstring::npos) return std::nullopt;

        URL_COMPONENTS parts{};
        parts.dwStructSize = sizeof(parts);
        parts.dwHostNameLength = static_cast<DWORD>(-1);
        parts.dwUrlPathLength = static_cast<DWORD>(-1);
        parts.dwExtraInfoLength = static_cast<DWORD>(-1);

        if (!WinHttpCrackUrl(wide_url->c_str(), static_cast<DWORD>(wide_url->size()), 0, &parts))
        {
            return std::nullopt;
        }
        if (parts.nScheme != INTERNET_SCHEME_HTTP && parts.nScheme != INTERNET_SCHEME_HTTPS)
        {
            return std::nullopt;
        }

        Endpoint endpoint{};
        endpoint.host.assign(parts.lpszHostName, parts.dwHostNameLength);
        endpoint.path.assign(parts.lpszUrlPath, parts.dwUrlPathLength);
        if (parts.lpszExtraInfo && parts.dwExtraInfoLength > 0)
        {
            endpoint.path.append(parts.lpszExtraInfo, parts.dwExtraInfoLength);
        }
        if (endpoint.path.empty()) endpoint.path = L"/game/sync";
        endpoint.port = parts.nPort;
        endpoint.secure = parts.nScheme == INTERNET_SCHEME_HTTPS;
        endpoint.bearer_token = *wide_token;

        // This transport is intentionally restricted to the local bridge.
        if (endpoint.host != L"127.0.0.1" && endpoint.host != L"localhost" && endpoint.host != L"::1")
        {
            return std::nullopt;
        }

        return endpoint;
    }

    auto post_json(const Endpoint& endpoint, const std::string& body) -> std::optional<std::string>
    {
        InternetHandle session{WinHttpOpen(
            L"IsleControl/0.2",
            WINHTTP_ACCESS_TYPE_NO_PROXY,
            WINHTTP_NO_PROXY_NAME,
            WINHTTP_NO_PROXY_BYPASS,
            0)};
        if (!session) return std::nullopt;

        WinHttpSetTimeouts(session.value, 1000, 1000, 2000, 2000);

        InternetHandle connection{WinHttpConnect(
            session.value, endpoint.host.c_str(), endpoint.port, 0)};
        if (!connection) return std::nullopt;

        const DWORD flags = endpoint.secure ? WINHTTP_FLAG_SECURE : 0;
        InternetHandle request{WinHttpOpenRequest(
            connection.value,
            L"POST",
            endpoint.path.c_str(),
            nullptr,
            WINHTTP_NO_REFERER,
            WINHTTP_DEFAULT_ACCEPT_TYPES,
            flags)};
        if (!request) return std::nullopt;

        std::wstring headers = L"Content-Type: application/json\r\n";
        if (!endpoint.bearer_token.empty())
        {
            headers += L"Authorization: Bearer ";
            headers += endpoint.bearer_token;
            headers += L"\r\n";
        }

        if (!WinHttpSendRequest(
                request.value,
                headers.c_str(),
                static_cast<DWORD>(headers.size()),
                const_cast<char*>(body.data()),
                static_cast<DWORD>(body.size()),
                static_cast<DWORD>(body.size()),
                0) ||
            !WinHttpReceiveResponse(request.value, nullptr))
        {
            return std::nullopt;
        }

        DWORD status{};
        DWORD status_size = sizeof(status);
        if (!WinHttpQueryHeaders(
                request.value,
                WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                WINHTTP_HEADER_NAME_BY_INDEX,
                &status,
                &status_size,
                WINHTTP_NO_HEADER_INDEX) ||
            status < 200 || status >= 300)
        {
            return std::nullopt;
        }

        std::string response{};
        while (response.size() <= max_payload_bytes)
        {
            DWORD available{};
            if (!WinHttpQueryDataAvailable(request.value, &available)) return std::nullopt;
            if (available == 0) break;
            if (response.size() + available > max_payload_bytes) return std::nullopt;

            const auto old_size = response.size();
            response.resize(old_size + available);
            DWORD bytes_read{};
            if (!WinHttpReadData(request.value, response.data() + old_size, available, &bytes_read))
            {
                return std::nullopt;
            }
            response.resize(old_size + bytes_read);
        }

        return response;
    }

    class Transport
    {
      public:
        Transport() : worker([this](std::stop_token stop) { run(stop); }) {}

        ~Transport()
        {
            worker.request_stop();
            wake.notify_all();
        }

        auto configure(std::string_view url, std::string_view token) -> bool
        {
            auto parsed = parse_endpoint(url, token);
            if (!parsed) return false;

            {
                std::lock_guard lock{mutex};
                endpoint = std::move(*parsed);
                configured = true;
            }
            wake.notify_one();
            return true;
        }

        auto enqueue(std::string body) -> bool
        {
            if (body.empty() || body.size() > max_payload_bytes) return false;

            {
                std::lock_guard lock{mutex};
                if (!configured || outgoing.size() >= max_queue_depth) return false;
                outgoing.emplace_back(std::move(body));
            }
            wake.notify_one();
            return true;
        }

        auto poll() -> std::optional<std::string>
        {
            std::lock_guard lock{mutex};
            if (incoming.empty()) return std::nullopt;
            auto body = std::move(incoming.front());
            incoming.pop_front();
            return body;
        }

      private:
        std::mutex mutex{};
        std::condition_variable_any wake{};
        std::deque<std::string> outgoing{};
        std::deque<std::string> incoming{};
        Endpoint endpoint{};
        bool configured{};
        std::jthread worker{};

        void run(std::stop_token stop)
        {
            while (!stop.stop_requested())
            {
                std::string body{};
                Endpoint target{};

                {
                    std::unique_lock lock{mutex};
                    wake.wait(lock, stop, [this] { return configured && !outgoing.empty(); });
                    if (stop.stop_requested()) return;
                    body = std::move(outgoing.front());
                    outgoing.pop_front();
                    target = endpoint;
                }

                auto response = post_json(target, body);
                if (response)
                {
                    if (!response->empty())
                    {
                        std::lock_guard lock{mutex};
                        if (incoming.size() >= max_queue_depth) incoming.pop_front();
                        incoming.emplace_back(std::move(*response));
                    }
                    continue;
                }

                // Preserve ordering and retry while the local bridge restarts.
                {
                    std::lock_guard lock{mutex};
                    outgoing.emplace_front(std::move(body));
                }
                std::this_thread::sleep_for(std::chrono::seconds(1));
            }
        }
    };

    Transport* active_transport{};

    auto parse_object_address(std::string_view text) -> Unreal::UObject*
    {
        if (text.starts_with("0x") || text.starts_with("0X")) text.remove_prefix(2);
        std::uintptr_t value{};
        const auto result = std::from_chars(text.data(), text.data() + text.size(), value, 16);
        if (result.ec != std::errc{} || result.ptr != text.data() + text.size() || value < 0x10000)
        {
            return nullptr;
        }

        MEMORY_BASIC_INFORMATION memory{};
        if (!VirtualQuery(reinterpret_cast<void*>(value), &memory, sizeof(memory)) ||
            memory.State != MEM_COMMIT || (memory.Protect & (PAGE_GUARD | PAGE_NOACCESS)))
        {
            return nullptr;
        }
        return reinterpret_cast<Unreal::UObject*>(value);
    }

    auto deliver_private_chat(Unreal::UObject* controller,
                              const std::wstring& sender,
                              const std::wstring& sender_steam,
                              const std::wstring& message) -> bool
    {
        if (!controller) return false;

        auto* function = controller->GetFunctionByNameInChain(L"UpdateChat");
        if (!function) return false;

        auto* sender_property = function->FindProperty(Unreal::FName{L"Sender", Unreal::FNAME_Find});
        auto* text_property = function->FindProperty(Unreal::FName{L"Text", Unreal::FNAME_Find});
        auto* steam_property = function->FindProperty(Unreal::FName{L"SenderSteamId", Unreal::FNAME_Find});
        auto* mode_property = function->FindProperty(Unreal::FName{L"ChatMode", Unreal::FNAME_Find});
        if (!sender_property || !text_property || !steam_property || !mode_property) return false;

        const auto parameter_size = static_cast<std::size_t>(function->GetParmsSize());
        const auto field_fits = [parameter_size](Unreal::FProperty* property) {
            const auto offset = property->GetOffset_Internal();
            const auto size = property->GetSize();
            return offset >= 0 && size > 0 && static_cast<std::size_t>(offset) + size <= parameter_size;
        };
        if (!field_fits(sender_property) || !field_fits(text_property) ||
            !field_fits(steam_property) || !field_fits(mode_property) ||
            sender_property->GetSize() > 16 || text_property->GetSize() > 16 ||
            steam_property->GetSize() != sizeof(Unreal::FString))
        {
            return false;
        }

        std::vector<std::uint8_t> buffer(parameter_size, 0);
        auto* parameters = buffer.data();

        Unreal::FText sender_text{Unreal::FString{sender.c_str()}};
        Unreal::FText body_text{Unreal::FString{message.c_str()}};
        std::memcpy(parameters + sender_property->GetOffset_Internal(),
                    &sender_text,
                    sender_property->GetSize());
        std::memcpy(parameters + text_property->GetOffset_Internal(),
                    &body_text,
                    text_property->GetSize());

        new (parameters + steam_property->GetOffset_Internal()) Unreal::FString{sender_steam.c_str()};
        *(parameters + mode_property->GetOffset_Internal()) = 0; // EChatMode::Spatial

        controller->ProcessEvent(function, parameters);
        return true;
    }

    auto lua_configure(const LuaMadeSimple::Lua& state) -> int
    {
        if (!active_transport || !state.is_string(1) || !state.is_string(2))
        {
            state.set_bool(false);
            return 1;
        }

        state.set_bool(active_transport->configure(state.get_string(1), state.get_string(2)));
        return 1;
    }

    auto lua_enqueue(const LuaMadeSimple::Lua& state) -> int
    {
        if (!active_transport || !state.is_string(1))
        {
            state.set_bool(false);
            return 1;
        }

        state.set_bool(active_transport->enqueue(std::string{state.get_string(1)}));
        return 1;
    }

    auto lua_poll(const LuaMadeSimple::Lua& state) -> int
    {
        auto response = active_transport ? active_transport->poll() : std::nullopt;
        if (!response)
        {
            state.set_nil();
        }
        else
        {
            state.set_string(response->data(), response->size());
        }
        return 1;
    }

    auto lua_private_chat(const LuaMadeSimple::Lua& state) -> int
    {
        if (!state.is_string(1) || !state.is_string(2) || !state.is_string(3) || !state.is_string(4))
        {
            state.set_bool(false);
            return 1;
        }

        auto* controller = parse_object_address(state.get_string(1));
        const auto sender = utf8_to_wide(state.get_string(2));
        const auto sender_steam = utf8_to_wide(state.get_string(3));
        const auto message = utf8_to_wide(state.get_string(4));
        state.set_bool(controller && sender && sender_steam && message &&
                       deliver_private_chat(controller, *sender, *sender_steam, *message));
        return 1;
    }

    class IsleControlMod : public CppUserModBase
    {
      public:
        IsleControlMod()
        {
            ModName = L"IsleControl";
            ModVersion = L"0.2.0";
            ModAuthors = L"IsleControl";
            ModDescription = L"Non-blocking localhost WinHTTP transport for the IsleControl Lua mod";
            ModIntendedSDKVersion = L"3.0.1";
            active_transport = &transport;
        }

        ~IsleControlMod() override
        {
            active_transport = nullptr;
        }

        auto on_lua_start(LuaMadeSimple::Lua& lua,
                          LuaMadeSimple::Lua&,
                          LuaMadeSimple::Lua&,
                          LuaMadeSimple::Lua*) -> void override
        {
            lua.register_function("IsleControlHttpConfigure", lua_configure);
            lua.register_function("IsleControlHttpEnqueue", lua_enqueue);
            lua.register_function("IsleControlHttpPoll", lua_poll);
            lua.register_function("IsleControlSendPrivateChat", lua_private_chat);
        }

      private:
        Transport transport{};
    };
}

#define MOD_EXPORT __declspec(dllexport)

extern "C"
{
    MOD_EXPORT RC::CppUserModBase* start_mod()
    {
        return new IsleControlNative::IsleControlMod();
    }

    MOD_EXPORT void uninstall_mod(RC::CppUserModBase* mod)
    {
        delete mod;
    }
}
