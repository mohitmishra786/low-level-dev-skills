---
name: cmake
description: CMake build system skill for C/C++ projects. Use when writing or refactoring CMakeLists.txt, configuring out-of-source builds, selecting generators (Ninja, Make, VS), managing targets and dependencies with target_link_libraries, integrating external packages via find_package or FetchContent, enabling sanitizers, setting up toolchain files for cross-compilation, or exporting CMake packages. Activates on queries about CMakeLists.txt, cmake configure errors, target properties, install rules, CPack, or CMake presets.
---

# CMake

## Purpose

Guide agents through modern (target-first) CMake for C/C++ projects: out-of-source builds, dependency management, generator selection, and integration with CI and IDEs.

## Triggers

- "How do I write a CMakeLists.txt for my project?"
- "How do I add an external library with CMake?"
- "CMake can't find my package / library"
- "How do I enable sanitizers in CMake?"
- "How do I cross-compile with CMake?"
- "How do I use CMake Presets?"

## Workflow

### 1. Modern CMake principles

- Define targets, not variables. Use `target_*` commands.
- Use `PUBLIC`/`PRIVATE`/`INTERFACE` to control property propagation.
- Never use `include_directories()` or `link_libraries()` (legacy).
- Minimum CMake version: `cmake_minimum_required(VERSION 3.20)` for most features.

### 2. Minimal project

```cmake
cmake_minimum_required(VERSION 3.20)
project(MyApp VERSION 1.0 LANGUAGES C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(myapp
    src/main.c
    src/utils.c
)

target_include_directories(myapp PRIVATE include)
target_compile_options(myapp PRIVATE -Wall -Wextra)
```

### 3. Static / shared libraries

```cmake
# Static library
add_library(mylib STATIC lib/foo.c lib/bar.c)
target_include_directories(mylib
    PUBLIC  include      # consumers get this include path
    PRIVATE src          # only mylib itself sees this
)

# Shared library
add_library(myshared SHARED lib/foo.c)
set_target_properties(myshared PROPERTIES
    VERSION   1.0.0
    SOVERSION 1
)

# Link executable against library
add_executable(myapp src/main.c)
target_link_libraries(myapp PRIVATE mylib)
```

### 4. Configure and build

```bash
# Out-of-source build (always do this)
cmake -S . -B build
cmake --build build

# With generator
cmake -S . -B build -G Ninja
cmake --build build -- -j$(nproc)

# Debug build
cmake -S . -B build-debug -DCMAKE_BUILD_TYPE=Debug
cmake --build build-debug

# Release
cmake -S . -B build-release -DCMAKE_BUILD_TYPE=Release
cmake --build build-release

# Install
cmake --install build --prefix /usr/local
```

Build types: `Debug`, `Release`, `RelWithDebInfo`, `MinSizeRel`.

### 5. External dependencies

#### find_package (system-installed libraries)

```cmake
find_package(OpenSSL REQUIRED)
target_link_libraries(myapp PRIVATE OpenSSL::SSL OpenSSL::Crypto)

find_package(Threads REQUIRED)
target_link_libraries(myapp PRIVATE Threads::Threads)

find_package(ZLIB REQUIRED)
target_link_libraries(myapp PRIVATE ZLIB::ZLIB)
```

#### FetchContent (download and build dependency)

```cmake
include(FetchContent)

FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG        v1.14.0
)
FetchContent_MakeAvailable(googletest)

add_executable(mytest test/test_foo.cpp)
target_link_libraries(mytest PRIVATE GTest::gtest_main mylib)
```

#### pkg-config fallback

```cmake
find_package(PkgConfig REQUIRED)
pkg_check_modules(LIBFOO REQUIRED libfoo>=1.2)
target_link_libraries(myapp PRIVATE ${LIBFOO_LIBRARIES})
target_include_directories(myapp PRIVATE ${LIBFOO_INCLUDE_DIRS})
```

### 6. Compiler options by configuration

```cmake
target_compile_options(myapp PRIVATE
    $<$<CONFIG:Debug>:-g -Og -fsanitize=address>
    $<$<CONFIG:Release>:-O2 -DNDEBUG>
    $<$<CXX_COMPILER_ID:GNU>:-fanalyzer>
    $<$<CXX_COMPILER_ID:Clang>:-Weverything>
)

target_link_options(myapp PRIVATE
    $<$<CONFIG:Debug>:-fsanitize=address>
)
```

Generator expressions: `$<condition:value>` evaluated at build time.

### 7. Enable sanitizers

```cmake
option(ENABLE_ASAN "Enable AddressSanitizer" OFF)

if(ENABLE_ASAN)
    target_compile_options(myapp PRIVATE -fsanitize=address -fno-omit-frame-pointer -g -O1)
    target_link_options(myapp PRIVATE -fsanitize=address)
endif()
```

Build: `cmake -DENABLE_ASAN=ON -S . -B build-asan && cmake --build build-asan`

### 8. Cross-compilation toolchain file

```cmake
# toolchain-aarch64.cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)
set(CMAKE_C_COMPILER   aarch64-linux-gnu-gcc)
set(CMAKE_CXX_COMPILER aarch64-linux-gnu-g++)
set(CMAKE_SYSROOT /opt/aarch64-sysroot)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
```

```bash
cmake -S . -B build-arm -DCMAKE_TOOLCHAIN_FILE=toolchain-aarch64.cmake
```

### 9. CMake Presets (CMake 3.20+)

```json
{
  "version": 6,
  "configurePresets": [
    {
      "name": "release",
      "displayName": "Release",
      "generator": "Ninja",
      "binaryDir": "${sourceDir}/build/release",
      "cacheVariables": {
        "CMAKE_BUILD_TYPE": "Release",
        "CMAKE_EXPORT_COMPILE_COMMANDS": "ON"
      }
    },
    {
      "name": "debug",
      "displayName": "Debug",
      "generator": "Ninja",
      "binaryDir": "${sourceDir}/build/debug",
      "cacheVariables": {
        "CMAKE_BUILD_TYPE": "Debug",
        "ENABLE_ASAN": "ON"
      }
    }
  ],
  "buildPresets": [
    { "name": "release", "configurePreset": "release" },
    { "name": "debug",   "configurePreset": "debug" }
  ]
}
```

```bash
cmake --preset release
cmake --build --preset release
```

### 10. Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Could not find package Foo` | Package not installed or wrong prefix | Install dev package; set `CMAKE_PREFIX_PATH` |
| `No CMAKE_CXX_COMPILER` | No C++ compiler found | Install g++/clang++; check PATH |
| `target_link_libraries called with wrong number of arguments` | Missing `PUBLIC/PRIVATE/INTERFACE` | Add the keyword |
| `Cannot find source file` | Typo or wrong relative path | Check path relative to `CMakeLists.txt` |
| `generator expression` error | Wrong `$<>` syntax | Check CMake docs for expression name |

For a complete CMakeLists.txt template, see [references/templates.md](references/templates.md).

## Related skills

- Use `skills/build-systems/ninja` for Ninja generator details
- Use `skills/build-systems/make` for Make generator
- Use `skills/compilers/cross-gcc` for cross-compilation toolchain setup
- Use `skills/runtimes/sanitizers` for sanitizer integration details
