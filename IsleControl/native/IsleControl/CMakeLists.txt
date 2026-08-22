cmake_minimum_required(VERSION 3.22)

set(TARGET IsleControl)
project(${TARGET})

add_library(${TARGET} SHARED src/tpndino.cpp)
set_target_properties(${TARGET} PROPERTIES OUTPUT_NAME TPNIsle)
target_compile_features(${TARGET} PRIVATE cxx_std_23)
target_include_directories(${TARGET} PRIVATE include)

set(UE4SS_IMPORT_LIB "${CMAKE_CURRENT_BINARY_DIR}/UE4SS.lib")
add_custom_command(
    OUTPUT "${UE4SS_IMPORT_LIB}"
    COMMAND "${CMAKE_AR}" /nologo /def:${CMAKE_CURRENT_SOURCE_DIR}/UE4SS.def
            /machine:x64 /out:${UE4SS_IMPORT_LIB}
    DEPENDS "${CMAKE_CURRENT_SOURCE_DIR}/UE4SS.def"
    VERBATIM)
add_custom_target(GenerateUE4SSImportLib DEPENDS "${UE4SS_IMPORT_LIB}")
add_dependencies(${TARGET} GenerateUE4SSImportLib)
target_link_libraries(${TARGET} PRIVATE "${UE4SS_IMPORT_LIB}" winhttp)
