#pragma once

// Minimal ABI declarations copied from UE4SS commit d7e7826d. Keeping this
// surface small avoids requiring UE4SS's private UEPseudo submodule merely to
// call CppUserModBase and register three Lua functions.

#include <cstdint>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace RC
{
    using StringType = std::wstring;
    using StringViewType = std::wstring_view;

    namespace GUI
    {
        class GUITab;
    }

    namespace LuaMadeSimple
    {
        class Lua
        {
          public:
            using LuaFunction = int (*)(const Lua&);

            __declspec(dllimport) void register_function(const std::string&, const LuaFunction&) const;
            [[nodiscard]] __declspec(dllimport) bool is_string(std::int32_t force_index = 1) const;
            [[nodiscard]] __declspec(dllimport) std::string_view get_string(std::int32_t force_index = 1) const;
            __declspec(dllimport) void set_string(const char*, std::size_t) const;
            __declspec(dllimport) void set_nil() const;
            __declspec(dllimport) void set_bool(bool) const;
        };
    }

    class CppUserModBase
    {
      protected:
        std::vector<std::shared_ptr<GUI::GUITab>> GUITabs{};

      public:
        StringType ModName{};
        StringType ModVersion{};
        StringType ModDescription{};
        StringType ModAuthors{};
        StringType ModIntendedSDKVersion{};

        __declspec(dllimport) CppUserModBase();
        __declspec(dllimport) virtual ~CppUserModBase();

        virtual void on_update() {}
        virtual void on_unreal_init() {}
        virtual void on_ui_init() {}
        virtual void on_program_start() {}

        virtual void on_lua_start(StringViewType,
                                  LuaMadeSimple::Lua&,
                                  LuaMadeSimple::Lua&,
                                  LuaMadeSimple::Lua&,
                                  std::vector<LuaMadeSimple::Lua*>&) {}
        virtual void on_lua_start(LuaMadeSimple::Lua&,
                                  LuaMadeSimple::Lua&,
                                  LuaMadeSimple::Lua&,
                                  std::vector<LuaMadeSimple::Lua*>&) {}
        virtual void on_lua_stop(StringViewType,
                                 LuaMadeSimple::Lua&,
                                 LuaMadeSimple::Lua&,
                                 LuaMadeSimple::Lua&,
                                 std::vector<LuaMadeSimple::Lua*>&) {}
        virtual void on_lua_stop(LuaMadeSimple::Lua&,
                                 LuaMadeSimple::Lua&,
                                 LuaMadeSimple::Lua&,
                                 std::vector<LuaMadeSimple::Lua*>&) {}

        virtual void on_dll_load(StringViewType) {}
        virtual void render_tab() {}

        virtual void on_lua_start(StringViewType,
                                  LuaMadeSimple::Lua&,
                                  LuaMadeSimple::Lua&,
                                  LuaMadeSimple::Lua&,
                                  LuaMadeSimple::Lua*) {}
        virtual void on_lua_start(LuaMadeSimple::Lua&,
                                  LuaMadeSimple::Lua&,
                                  LuaMadeSimple::Lua&,
                                  LuaMadeSimple::Lua*) {}
        virtual void on_lua_stop(StringViewType,
                                 LuaMadeSimple::Lua&,
                                 LuaMadeSimple::Lua&,
                                 LuaMadeSimple::Lua&,
                                 LuaMadeSimple::Lua*) {}
        virtual void on_lua_stop(LuaMadeSimple::Lua&,
                                 LuaMadeSimple::Lua&,
                                 LuaMadeSimple::Lua&,
                                 LuaMadeSimple::Lua*) {}

        virtual void on_cpp_mods_loaded() {}
    };
}
