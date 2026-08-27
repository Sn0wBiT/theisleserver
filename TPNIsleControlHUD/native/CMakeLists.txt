if(NOT WIN32)
  message(STATUS "TPNIsleControlHUD native target is Windows-only")
  return()
endif()

include(FetchContent)
set(CEF_VERSION "151.3.17+gf059e67+chromium-151.0.7922.138" CACHE STRING "CEF binary distribution version")
set(CEF_PLATFORM "windows64")
set(CEF_ARCHIVE_NAME "cef_binary_${CEF_VERSION}_${CEF_PLATFORM}")
FetchContent_Declare(cef
  URL "https://cef-builds.spotifycdn.com/${CEF_ARCHIVE_NAME}.tar.bz2"
  SOURCE_SUBDIR "_populate_only"
  DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
FetchContent_MakeAvailable(cef)

if(EXISTS "${cef_SOURCE_DIR}/${CEF_ARCHIVE_NAME}/CMakeLists.txt")
  set(CEF_ROOT "${cef_SOURCE_DIR}/${CEF_ARCHIVE_NAME}")
else()
  set(CEF_ROOT "${cef_SOURCE_DIR}")
endif()
set(USE_SANDBOX OFF CACHE BOOL "Disable the CEF sandbox for the single-executable build" FORCE)
list(APPEND CMAKE_MODULE_PATH "${CEF_ROOT}/cmake")
find_package(CEF REQUIRED)
add_subdirectory("${CEF_LIBCEF_DLL_WRAPPER_PATH}" "${CMAKE_BINARY_DIR}/libcef_dll_wrapper")
ADD_LOGICAL_TARGET("libcef_lib" "${CEF_LIB_DEBUG}" "${CEF_LIB_RELEASE}")

add_executable(TPNIsleControlHUD WIN32
  resources/TPNIsleControlHUD.rc
  src/main.cpp
  src/app/Application.cpp
  src/cef/CefApplication.cpp
  src/overlay/GameWindowTracker.cpp
  src/overlay/InputManager.cpp
  src/overlay/OverlayWindow.cpp
  src/webview/WebViewHost.cpp)

add_executable(TPNIsleControlHUDUpdater WIN32 src/updater/Updater.cpp)
target_compile_features(TPNIsleControlHUDUpdater PRIVATE cxx_std_20)
target_compile_definitions(TPNIsleControlHUDUpdater PRIVATE UNICODE _UNICODE NOMINMAX WIN32_LEAN_AND_MEAN)
target_link_libraries(TPNIsleControlHUDUpdater PRIVATE winhttp bcrypt shell32 comctl32)

target_compile_features(TPNIsleControlHUD PRIVATE cxx_std_20)
target_compile_definitions(TPNIsleControlHUD PRIVATE UNICODE _UNICODE NOMINMAX WIN32_LEAN_AND_MEAN)
target_include_directories(TPNIsleControlHUD PRIVATE
  src
  "${CEF_INCLUDE_PATH}")
SET_EXECUTABLE_TARGET_PROPERTIES(TPNIsleControlHUD)
target_link_libraries(TPNIsleControlHUD PRIVATE
  libcef_lib
  libcef_dll_wrapper
  ${CEF_STANDARD_LIBS}
  user32 shell32 ole32 comctl32 version)

COPY_FILES(TPNIsleControlHUD "${CEF_BINARY_FILES}" "${CEF_BINARY_DIR}" "$<TARGET_FILE_DIR:TPNIsleControlHUD>")
COPY_FILES(TPNIsleControlHUD "${CEF_RESOURCE_FILES}" "${CEF_RESOURCE_DIR}" "$<TARGET_FILE_DIR:TPNIsleControlHUD>")

if(MSVC)
  target_compile_options(TPNIsleControlHUD PRIVATE /W4 /permissive- /EHsc)
  target_compile_options(TPNIsleControlHUDUpdater PRIVATE /W4 /permissive- /EHsc)
endif()

install(TARGETS TPNIsleControlHUD TPNIsleControlHUDUpdater RUNTIME DESTINATION .)
foreach(CEF_BINARY_FILE IN LISTS CEF_BINARY_FILES)
  install(FILES "${CEF_BINARY_DIR_RELEASE}/${CEF_BINARY_FILE}" DESTINATION .)
endforeach()
foreach(CEF_RESOURCE_FILE IN LISTS CEF_RESOURCE_FILES)
  if(IS_DIRECTORY "${CEF_RESOURCE_DIR}/${CEF_RESOURCE_FILE}")
    install(DIRECTORY "${CEF_RESOURCE_DIR}/${CEF_RESOURCE_FILE}" DESTINATION .)
  else()
    install(FILES "${CEF_RESOURCE_DIR}/${CEF_RESOURCE_FILE}" DESTINATION .)
  endif()
endforeach()
install(FILES "${CEF_ROOT}/LICENSE.txt" DESTINATION . RENAME CEF_LICENSE.txt)
set(HUD_FRONTEND_DIST "${CMAKE_CURRENT_SOURCE_DIR}/../frontend/dist")
file(GLOB HUD_FRONTEND_ASSETS "${HUD_FRONTEND_DIST}/assets/*")
if(NOT EXISTS "${HUD_FRONTEND_DIST}/index.html" OR NOT HUD_FRONTEND_ASSETS)
  message(FATAL_ERROR "Frontend production assets are missing. Run npm ci, npm test, and npm run build in frontend first.")
endif()
install(DIRECTORY "${HUD_FRONTEND_DIST}/" DESTINATION ui)
