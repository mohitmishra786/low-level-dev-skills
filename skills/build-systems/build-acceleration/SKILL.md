---
name: build-acceleration
description: Build acceleration skill for C/C++ projects. Use when reducing compilation times with ccache, sccache, distcc, unity builds, precompiled headers, split DWARF, or IWYU. Covers caching strategies, distributed compilation, link time reduction, and diagnosing build bottlenecks. Activates on queries about slow builds, ccache, sccache, precompiled headers, unity builds, split-DWARF, or reducing C++ compile times.
---

# Build Acceleration

## Purpose

Guide agents through reducing C/C++ build times using caching (ccache/sccache), distributed compilation (distcc), unity/jumbo builds, precompiled headers, split-DWARF for faster linking, and include pruning with IWYU.

## Triggers

- "My C++ build is too slow — how do I speed it up?"
- "How do I set up ccache / sccache?"
- "How do precompiled headers work with CMake?"
- "How do I set up distributed compilation with distcc?"
- "How do I reduce link times with split-DWARF?"
- "How do I find which headers are slowing down compilation?"

## Workflow

### 1. Diagnose the bottleneck first

```bash
# Time the full build
time cmake --build build -j$(nproc)

# Find the slowest TUs (CMake ≥3.16 with --profiling-output)
cmake -S . -B build -DCMAKE_CXX_FLAGS="-ftime-report"
cmake --build build 2>&1 | grep "Total" | sort -t: -k2 -rn | head -20

# Ninja build timings (use ninja -j1 for serial timing)
ninja -C build -j1 2>&1 | grep "^\[" | sort -t" " -k2 -rn | head -20
```

### 2. ccache — compiler cache

```bash
# Install
apt-get install ccache   # Ubuntu/Debian
brew install ccache      # macOS

# Check hit rate
ccache -s

# Configure cache size (default 5GB)
ccache -M 20G

# Invalidate cache if needed
ccache -C
```

CMake integration (recommended over prefix hacks):

```cmake
# CMakeLists.txt
find_program(CCACHE_PROGRAM ccache)
if(CCACHE_PROGRAM)
    set(CMAKE_C_COMPILER_LAUNCHER   ${CCACHE_PROGRAM})
    set(CMAKE_CXX_COMPILER_LAUNCHER ${CCACHE_PROGRAM})
endif()
```

Key `~/.config/ccache/ccache.conf` options:

```ini
max_size = 20G
compression = true
compression_level = 6
# For CI: share cache across jobs
cache_dir = /shared/ccache
```

### 3. sccache — cloud-compatible cache (Rust, C/C++)

```bash
cargo install sccache
# Or: brew install sccache

# Set as compiler launcher
export RUSTC_WRAPPER=sccache          # for Rust
export CMAKE_C_COMPILER_LAUNCHER=sccache    # for CMake

# With S3 backend
export SCCACHE_BUCKET=my-build-cache
export SCCACHE_REGION=us-east-1
sccache --start-server

sccache --show-stats
```

### 4. Precompiled headers (PCH)

PCH compiles a large header once and reuses the binary form.

```cmake
# CMake ≥3.16 native PCH support
target_precompile_headers(mylib PRIVATE
    <vector>
    <string>
    <unordered_map>
    "myproject/common.h"
)

# Share PCH across targets (avoids recompilation)
target_precompile_headers(myapp REUSE_FROM mylib)
```

```c
// Traditional: stdafx.h / pch.h approach
// All TUs include pch.h as the very first include
// pch.h includes heavy system headers
#pragma once
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
```

PCH is most effective when headers are large and stable (STL, Boost, Qt). Avoid PCH for frequently-changing project headers.

### 5. Unity / jumbo builds

Combine multiple `.cpp` files into one TU to reduce header parsing overhead and improve inlining.

```cmake
# CMake ≥3.16 unity build
set_target_properties(mylib PROPERTIES UNITY_BUILD ON)
# Control batch size (default 8 files per unity TU)
set_target_properties(mylib PROPERTIES UNITY_BUILD_BATCH_SIZE 16)

# Exclude specific files from unity (e.g., if they have ODR issues)
set_source_files_properties(problem.cpp PROPERTIES SKIP_UNITY_BUILD_INCLUSION ON)
```

Manual unity file:

```cpp
// unity_build.cpp
#include "module_a.cpp"
#include "module_b.cpp"
#include "module_c.cpp"
```

Watch out for: anonymous namespaces (each TU has its own), `using namespace` in headers, duplicate static variables.

### 6. split-DWARF — reduce link time

Split DWARF puts debug info in `.dwo` sidecar files, dramatically reducing what the linker must process.

```bash
# GCC / Clang
gcc -g -gsplit-dwarf -o prog main.c

# CMake global
add_compile_options(-gsplit-dwarf)

# Combine .dwo files for distribution (optional)
dwp -o prog.dwp prog  # GNU dwp tool
```

Pair with `--gdb-index` for faster GDB startup:

```bash
gcc -g -gsplit-dwarf -Wl,--gdb-index -o prog main.c
```

Link time comparison (large project, typical): `-g` full DWARF ~4×–6× longer link vs `-gsplit-dwarf`.

### 7. distcc — distributed compilation

```bash
# Install on all machines
apt-get install distcc

# Start daemon on worker machines
distccd --daemon --allow 192.168.1.0/24 --jobs 8

# Client: set DISTCC_HOSTS
export DISTCC_HOSTS="localhost/4 worker1/8 worker2/8"
make -j20 CC="distcc gcc"

# CMake integration
set(CMAKE_C_COMPILER_LAUNCHER distcc)
set(CMAKE_CXX_COMPILER_LAUNCHER distcc)
```

Stack with ccache: `CC="ccache distcc gcc"` — ccache checks local cache first, falls back to distcc.

### 8. Include pruning with IWYU

```bash
# Install
apt-get install iwyu

# Run via CMake
cmake -S . -B build -DCMAKE_CXX_INCLUDE_WHAT_YOU_USE=iwyu
cmake --build build 2>&1 | tee iwyu.log

# Apply fixes automatically
fix_include < iwyu.log --nosafe_headers
```

See `skills/build-systems/include-what-you-use` for full IWYU workflow.

For ccache configuration options, see [references/ccache-config.md](references/ccache-config.md).

## Related skills

- Use `skills/build-systems/cmake` for CMake project structure
- Use `skills/build-systems/include-what-you-use` for IWYU header pruning
- Use `skills/rust/rust-build-times` for Rust-specific build acceleration
- Use `skills/debuggers/dwarf-debug-format` for split-DWARF internals
