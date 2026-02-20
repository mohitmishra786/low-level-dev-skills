---
name: conan-vcpkg
description: C/C++ package manager skill covering Conan and vcpkg. Use when adding third-party library dependencies to C/C++ projects, managing binary compatibility, integrating with CMake, or choosing between Conan and vcpkg. Activates on queries about Conan, vcpkg, C++ dependency management, conanfile.txt, vcpkg.json, CMake package integration, or C++ package managers.
---

# Conan and vcpkg

## Purpose

Guide agents through C/C++ dependency management with Conan and vcpkg: declaring dependencies, integrating with CMake, managing binary compatibility, and choosing the right tool for a given project.

## Triggers

- "How do I add a C++ library dependency with Conan?"
- "How do I use vcpkg with CMake?"
- "What's the difference between Conan and vcpkg?"
- "How do I add zlib/openssl/fmt with a package manager?"
- "How do I create a vcpkg.json manifest?"
- "My Conan package build is failing — how do I debug it?"

## Workflow

### 1. Conan vs vcpkg decision

```text
Which package manager?
├── Team uses MSVC on Windows primarily → vcpkg (better MSVC integration)
├── Need binary packages (no source builds in CI) → Conan (binary cache)
├── Need cross-compilation support → Conan (profiles) or Zig-based builds
├── Need a specific version of a package → Conan (flexible versioning)
├── Quick project setup, just need it to work → vcpkg (simpler)
└── Open-source project, broad audience → vcpkg (GitHub-integrated)
```

### 2. vcpkg setup

```bash
# Clone vcpkg
git clone https://github.com/microsoft/vcpkg.git
./vcpkg/bootstrap-vcpkg.sh    # Linux/macOS
./vcpkg/bootstrap-vcpkg.bat   # Windows

# Install packages (classic mode)
./vcpkg/vcpkg install zlib curl openssl

# Integrate with CMake
cmake -S . -B build \
    -DCMAKE_TOOLCHAIN_FILE=/path/to/vcpkg/scripts/buildsystems/vcpkg.cmake
```

### 3. vcpkg manifest mode (recommended)

```json
// vcpkg.json — place at project root
{
    "name": "myapp",
    "version": "1.0.0",
    "dependencies": [
        "zlib",
        "curl",
        { "name": "openssl", "version>=": "3.0.0" },
        { "name": "boost-filesystem", "platform": "!windows" },
        {
            "name": "fmt",
            "features": ["core"]
        }
    ],
    "builtin-baseline": "abc123..."
}
```

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.20)
project(myapp)

find_package(ZLIB REQUIRED)
find_package(CURL REQUIRED)
find_package(fmt REQUIRED)

add_executable(myapp src/main.cpp)
target_link_libraries(myapp PRIVATE ZLIB::ZLIB CURL::libcurl fmt::fmt)
```

```bash
# Build — vcpkg automatically installs dependencies
cmake -S . -B build \
    -DCMAKE_TOOLCHAIN_FILE=/path/to/vcpkg/scripts/buildsystems/vcpkg.cmake
cmake --build build
```

### 4. Conan setup

```bash
# Install Conan
pip install conan

# Set up default profile (detects compiler, OS)
conan profile detect

# Check your profile
conan profile show
```

### 5. Conan with CMake (Conan 2.x)

```ini
# conanfile.txt
[requires]
zlib/1.3
fmt/10.2.1
openssl/3.2.0

[generators]
CMakeDeps
CMakeToolchain

[options]
openssl/*:shared=False
```

```bash
# Install dependencies
conan install . --output-folder=build --build=missing

# Configure and build
cmake -S . -B build \
    -DCMAKE_TOOLCHAIN_FILE=build/conan_toolchain.cmake \
    -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

```cmake
# CMakeLists.txt
find_package(ZLIB REQUIRED)
find_package(fmt REQUIRED)
find_package(OpenSSL REQUIRED)

add_executable(myapp src/main.cpp)
target_link_libraries(myapp PRIVATE
    ZLIB::ZLIB
    fmt::fmt
    OpenSSL::SSL OpenSSL::Crypto
)
```

### 6. Conan profiles for cross-compilation

```ini
# ~/.conan2/profiles/linux-arm64
[settings]
os=Linux
arch=armv8
compiler=gcc
compiler.version=12
compiler.libcxx=libstdc++11
build_type=Release

[buildenv]
CC=aarch64-linux-gnu-gcc
CXX=aarch64-linux-gnu-g++

[tool_requires]
# Tools that run on build machine (x86)
```

```bash
# Cross-compile
conan install . \
    --profile:build=default \
    --profile:host=linux-arm64 \
    --output-folder=build-arm \
    --build=missing
```

### 7. conanfile.py (advanced)

```python
# conanfile.py
from conan import ConanFile
from conan.tools.cmake import CMakeToolchain, CMakeDeps, CMake

class MyAppConan(ConanFile):
    name = "myapp"
    version = "1.0"
    settings = "os", "compiler", "build_type", "arch"

    def requirements(self):
        self.requires("zlib/1.3")
        self.requires("fmt/10.2.1")
        if self.settings.os == "Linux":
            self.requires("openssl/3.2.0")

    def generate(self):
        tc = CMakeToolchain(self)
        tc.generate()
        deps = CMakeDeps(self)
        deps.generate()

    def build(self):
        cmake = CMake(self)
        cmake.configure()
        cmake.build()
```

### 8. Common dependency lookup

| Library | vcpkg name | Conan name |
|---------|-----------|-----------|
| zlib | `zlib` | `zlib/1.3` |
| OpenSSL | `openssl` | `openssl/3.2.0` |
| libcurl | `curl` | `libcurl/8.4.0` |
| {fmt} | `fmt` | `fmt/10.2.1` |
| spdlog | `spdlog` | `spdlog/1.12.0` |
| Boost | `boost` | `boost/1.83.0` |
| nlohmann-json | `nlohmann-json` | `nlohmann_json/3.11.3` |
| googletest | `gtest` | `gtest/1.14.0` |
| Google Benchmark | `benchmark` | `benchmark/1.8.3` |
| SQLite | `sqlite3` | `sqlite3/3.44.0` |
| protobuf | `protobuf` | `protobuf/4.25.1` |

For vcpkg baseline pinning and Conan binary cache setup, see [references/package-manager-patterns.md](references/package-manager-patterns.md).

## Related skills

- Use `skills/build-systems/cmake` for CMake integration with both Conan and vcpkg
- Use `skills/compilers/cross-gcc` for cross-compilation with Conan profiles
- Use `skills/build-systems/ninja` as the backend for package-managed projects
