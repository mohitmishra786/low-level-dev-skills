# C++20 Modules CMake Support Reference

Source: https://cmake.org/cmake/help/latest/manual/cmake-cxxmodules.7.html

## Table of Contents

1. [Version Requirements](#version-requirements)
2. [FILE_SET CXX_MODULES](#file_set-cxx_modules)
3. [Generator Support](#generator-support)
4. [Compiler Support Matrix](#compiler-support-matrix)

## Version Requirements

| Feature | Minimum CMake |
|---------|---------------|
| Stable `CXX_MODULES` FILE_SET | 3.28 |
| Experimental modules (Ninja) | 3.25 |
| `import std;` support | 3.30 (with MSVC STL) |

## FILE_SET CXX_MODULES

```cmake
add_library(mylib)
target_sources(mylib
    PUBLIC
        FILE_SET CXX_MODULES FILES
            include/mylib.cppm        # module interface
            include/mylib-utils.cppm  # partition
    PRIVATE
        src/mylib-impl.cpp            # implementation unit (module; not export module)
)

# Install module interface units alongside the library
install(TARGETS mylib
    ARCHIVE DESTINATION lib
    FILE_SET CXX_MODULES DESTINATION include/mylib
)
```

## Generator Support

| Generator | Module Support | Notes |
|-----------|---------------|-------|
| Ninja ≥1.11 | Full | Best support; use for development |
| Ninja Multi-Config | Full | CMake ≥3.28 |
| MSBuild (VS 2022) | Full | MSVC modules work well |
| Make | None | Does not support dynamic deps |
| Xcode | Partial | Experimental |

Always use Ninja for module builds during development:

```bash
cmake -S . -B build -G Ninja -DCMAKE_CXX_STANDARD=20
```

## Compiler Support Matrix

| Compiler | Status | Notes |
|----------|--------|-------|
| MSVC 19.34+ (VS 2022 17.4+) | Best | `import std;` supported |
| Clang ≥16 | Good | Use `--precompile` pipeline |
| Clang ≥18 | Better | stdlib module support |
| GCC ≥14 | Improving | `-fmodules-ts` more stable |
| GCC 11–13 | Experimental | Many edge cases |

### MSVC-specific

```cmake
# Enable standard library modules with MSVC
target_compile_features(mylib PUBLIC cxx_std_23)
# In C++23: import std; // works with MSVC and CMake 3.30+
```

### Clang-specific flags

```cmake
# Force Clang to use module compilation mode
if(CMAKE_CXX_COMPILER_ID STREQUAL "Clang")
    target_compile_options(mylib PRIVATE -fmodules)
endif()
```

### GCC-specific

```cmake
if(CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
    target_compile_options(mylib PRIVATE -fmodules-ts)
    # GCC stores BMI in gcm.cache/ relative to build dir
endif()
```
