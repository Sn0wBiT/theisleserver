# IsleControl native WinHTTP transport

This C++ mod adds three non-blocking functions to the existing `IsleControl`
Lua mod:

- `IsleControlHttpConfigure(url, token)`
- `IsleControlHttpEnqueue(json)`
- `IsleControlHttpPoll()`

WinHTTP runs on a worker thread. Unreal object access remains in Lua on the game
thread. The native transport accepts only loopback bridge URLs.

## ABI and toolchain

This source targets the installed UE4SS build:

- UE4SS `v3.0.1 Beta #0`
- Git commit `d7e7826d`
- `Game__Shipping__Win64` using MSVC

Install Visual Studio 2022 Build Tools with the Desktop development with C++
workload, CMake, and an MSVC toolset supported by this UE4SS commit.

Configure and build:

```bat
cmake -B build -G "Visual Studio 17 2022"
cmake --build build --config Release
```

The project uses a deliberately small compatibility header and generates its
import library from the exports of the installed ABI. This avoids UE4SS's
private `UEPseudo` source dependency. Re-check the declarations and exported
symbols before building against any other UE4SS commit.

Copy the resulting `IsleControl.dll` to:

```text
TheIsle\Binaries\Win64\ue4ss\Mods\IsleControl\dlls\main.dll
```

Do not enable HTTP transport until that DLL loads successfully.
