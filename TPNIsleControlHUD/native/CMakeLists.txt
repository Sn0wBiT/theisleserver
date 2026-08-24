if(NOT WIN32)
  message(STATUS "TPNIsleControlHUD native target is Windows-only")
  return()
endif()

include(FetchContent)
set(WEBVIEW2_VERSION "1.0.3967.48" CACHE STRING "Microsoft.Web.WebView2 SDK version")
FetchContent_Declare(webview2
  URL "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/${WEBVIEW2_VERSION}"
  DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
FetchContent_MakeAvailable(webview2)

if(CMAKE_SIZEOF_VOID_P EQUAL 8)
  if(CMAKE_SYSTEM_PROCESSOR MATCHES "ARM64|aarch64")
    set(WEBVIEW2_ARCH arm64)
  else()
    set(WEBVIEW2_ARCH x64)
  endif()
else()
  set(WEBVIEW2_ARCH x86)
endif()

add_executable(TPNIsleControlHUD WIN32
  src/main.cpp
  src/app/Application.cpp
  src/config/Config.cpp
  src/overlay/GameWindowTracker.cpp
  src/overlay/InputManager.cpp
  src/overlay/OverlayWindow.cpp
  src/webview/WebViewHost.cpp)

target_compile_features(TPNIsleControlHUD PRIVATE cxx_std_20)
target_compile_definitions(TPNIsleControlHUD PRIVATE UNICODE _UNICODE NOMINMAX WIN32_LEAN_AND_MEAN)
target_include_directories(TPNIsleControlHUD PRIVATE
  src
  "${webview2_SOURCE_DIR}/build/native/include")
target_link_libraries(TPNIsleControlHUD PRIVATE
  "${webview2_SOURCE_DIR}/build/native/${WEBVIEW2_ARCH}/WebView2LoaderStatic.lib"
  user32 shell32 ole32 shlwapi version)

if(MSVC)
  target_compile_options(TPNIsleControlHUD PRIVATE /W4 /permissive- /EHsc)
endif()

install(TARGETS TPNIsleControlHUD RUNTIME DESTINATION .)
install(DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/../frontend/dist/" DESTINATION ui OPTIONAL)
install(FILES "${CMAKE_CURRENT_SOURCE_DIR}/../config/config.example.json" DESTINATION . RENAME config.json)

