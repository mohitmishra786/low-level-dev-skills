# Conan and vcpkg Patterns Reference

## vcpkg Baseline Pinning

A baseline pins all packages to a specific vcpkg commit:

```json
// vcpkg.json with baseline
{
    "name": "myapp",
    "version": "1.0.0",
    "builtin-baseline": "e79c0d2b5d72eb3063cf32a1f7de1a3e8f6b5d3a",
    "dependencies": [
        "zlib",
        "fmt",
        { "name": "openssl", "version>=": "3.0.0" }
    ]
}
```

```bash
# Find current baseline
git -C /path/to/vcpkg rev-parse HEAD

# Update baseline
vcpkg x-update-baseline
```

## vcpkg Feature Flags

```json
// Opt into specific features
{
    "dependencies": [
        {
            "name": "boost",
            "features": ["filesystem", "program_options", "regex"]
        },
        {
            "name": "openssl",
            "default-features": false,
            "features": ["ssl", "crypto"]
        }
    ]
}
```

## vcpkg Custom Triplets

```cmake
# Custom triplet file: triplets/x64-linux-release.cmake
set(VCPKG_TARGET_ARCHITECTURE x64)
set(VCPKG_CRT_LINKAGE static)
set(VCPKG_LIBRARY_LINKAGE static)
set(VCPKG_CMAKE_SYSTEM_NAME Linux)
set(VCPKG_BUILD_TYPE release)  # Only release, no debug
```

```bash
# Use custom triplet
cmake -S . -B build \
    -DCMAKE_TOOLCHAIN_FILE=/vcpkg/scripts/buildsystems/vcpkg.cmake \
    -DVCPKG_TARGET_TRIPLET=x64-linux-release \
    -DVCPKG_OVERLAY_TRIPLETS=triplets/
```

## vcpkg in CI (GitHub Actions)

```yaml
- name: Setup vcpkg
  uses: lukka/run-vcpkg@v11
  with:
    vcpkgGitCommitId: 'e79c0d2...'  # Pin commit

- name: Configure
  run: |
    cmake -S . -B build \
      -DCMAKE_TOOLCHAIN_FILE=$VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake \
      -DCMAKE_BUILD_TYPE=Release

- name: Build
  run: cmake --build build -j$(nproc)
```

## Conan Binary Cache

```bash
# Set up Conan Center (default remote)
conan remote list

# Add Artifactory remote (enterprise)
conan remote add mycompany https://artifactory.company.com/artifactory/api/conan/conan-local

# Upload built packages
conan upload "*" --remote mycompany --confirm

# Download pre-built packages (no --build=missing needed)
conan install . --remote mycompany
```

## Conan Lockfile (Reproducible Builds)

```bash
# Generate lockfile
conan lock create . --build=missing

# Use lockfile for reproducible builds
conan install . --lockfile=conan.lock

# Update lockfile after dependency change
conan lock update conan.lock
```

## Mixing Conan and Non-Conan Dependencies

```cmake
# CMakeLists.txt
# Conan-managed
find_package(fmt REQUIRED)
find_package(OpenSSL REQUIRED)

# System-provided (not in Conan)
find_package(Threads REQUIRED)
find_package(X11)

# Vendored (in-tree)
add_subdirectory(third_party/myhdr)
```

## vcpkg Overlay Ports (Custom Packages)

```text
my-project/
├── vcpkg.json
└── ports/
    └── mylib/
        ├── vcpkg.json
        ├── portfile.cmake
        └── usage
```

```cmake
# portfile.cmake
vcpkg_from_github(
    OUT_SOURCE_PATH SOURCE_PATH
    REPO myorg/mylib
    REF v1.2.3
    SHA512 abc...
    HEAD_REF main
)
vcpkg_cmake_configure(SOURCE_PATH "${SOURCE_PATH}")
vcpkg_cmake_install()
vcpkg_cmake_config_fixup()
file(INSTALL "${SOURCE_PATH}/LICENSE" DESTINATION "${CURRENT_PACKAGES_DIR}/share/${PORT}")
```

```bash
# Use overlay port
cmake -S . -B build \
    -DCMAKE_TOOLCHAIN_FILE=/vcpkg/scripts/buildsystems/vcpkg.cmake \
    -DVCPKG_OVERLAY_PORTS=ports/
```

## Conan for Private Packages

```python
# conanfile.py for your own library
class MyLibConan(ConanFile):
    name = "mylib"
    version = "1.0.0"
    exports_sources = "src/*", "include/*", "CMakeLists.txt"

    def layout(self):
        cmake_layout(self)

    def build(self):
        cmake = CMake(self)
        cmake.configure()
        cmake.build()

    def package(self):
        cmake = CMake(self)
        cmake.install()

    def package_info(self):
        self.cpp_info.libs = ["mylib"]
```

```bash
# Build and export to local cache
conan create . --build=missing

# Then use in other projects
# conanfile.txt:
# [requires]
# mylib/1.0.0
```
