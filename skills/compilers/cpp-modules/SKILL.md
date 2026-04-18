---
name: cpp-modules
description: C++20 modules skill for modern C++ projects. Use when working with named modules, module partitions, header units, CMake MODULE_SOURCES, Clang -fmodules-ts, BMI caching issues, or migrating from headers to modules. Activates on queries about C++20 modules, import statements, module interface units, header units, or BMI files.
user-invocable: true
triggers:
  - C++20 modules
  - import statement C++
  - module interface unit
  - header units C++20
  - BMI file caching
  - cmake C++ modules
  - Clang fmodules-ts
  - migrate headers to C++ modules
---

# C++20 Modules

## Purpose

Guide agents through authoring, building, and debugging C++20 modules: named modules vs header units, module partitions, CMake integration, compiler-specific flags, and interoperability with legacy headers.

## Triggers

- "How do I write a C++20 module?"
- "How do I import a module in CMake?"
- "What's the difference between a named module and a header unit?"
- "My module gives 'cannot find module' errors"
- "How do I use C++20 modules with Clang?"
- "How do I migrate from headers to modules?"

## Workflow

### 1. Module concepts overview

```
C++20 module kinds:
├── Named module interface unit  (.cppm / .ixx)  — exports declarations
├── Module implementation unit   (.cpp)           — defines module members
├── Module partition             (.cppm)          — internal module subdivision
└── Header unit                  (any header)     — import a legacy header as module
```

Named modules are the primary target. Header units are a bridge for legacy code. Avoid Global Module Fragment unless required for macro access.

### 2. Named module — minimal example

```cpp
// math.cppm — module interface unit
export module math;          // declares the module name

export int add(int a, int b) { return a + b; }
export double pi = 3.14159;

// Non-exported (module-private)
int internal_helper() { return 42; }
```

```cpp
// main.cpp — consumer
import math;                 // import the module
#include <iostream>          // legacy header (still works)

int main() {
    std::cout << add(2, 3) << "\n";  // 5
    std::cout << pi << "\n";
}
```

### 3. Module partitions

```cpp
// math-core.cppm — partition
export module math:core;     // partition 'core' of module 'math'

export int add(int a, int b) { return a + b; }
```

```cpp
// math.cppm — primary module interface
export module math;
export import :core;         // re-export the partition
```

```cpp
// math-impl.cpp — implementation unit (no export)
module math;                 // belongs to 'math' module, not a partition
// has access to all math declarations, but exports nothing
```

### 4. Header units — bridging legacy headers

```cpp
// Import a standard library header as a module unit
import <iostream>;           // header unit (compiler generates BMI)
import <vector>;

// Or import a project header (must be compilable as header unit)
import "myheader.h";
```

Header units do NOT provide macros to importers. For macro access, use the Global Module Fragment:

```cpp
module;                      // Global Module Fragment starts here
#include <cassert>           // macros like assert() are available
export module mymod;
// ... rest of module
```

### 5. Building with Clang

```bash
# Compile module interface → produces .pcm (precompiled module)
clang++ -std=c++20 --precompile math.cppm -o math.pcm

# Compile implementation using the .pcm
clang++ -std=c++20 -fmodule-file=math=math.pcm -c math.cpp -o math.o

# Compile consumer
clang++ -std=c++20 -fmodule-file=math=math.pcm main.cpp math.o -o prog
```

### 6. Building with GCC

```bash
# GCC ≥11 supports modules (experimental ≥11, better ≥14)
# Compile interface unit → produces .gcm in gcm.cache/
g++ -std=c++20 -fmodules-ts math.cppm -c -o math.o

# Compiler auto-discovers .gcm files in gcm.cache/
g++ -std=c++20 -fmodules-ts main.cpp math.o -o prog
```

### 7. CMake integration (CMake ≥3.28)

```cmake
cmake_minimum_required(VERSION 3.28)
project(myproject LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 20)

add_library(math)
target_sources(math
    PUBLIC
        FILE_SET CXX_MODULES FILES    # module interface units
            src/math.cppm
            src/math-core.cppm
    PRIVATE
        src/math-impl.cpp             # implementation unit
)

add_executable(myapp main.cpp)
target_link_libraries(myapp PRIVATE math)
```

```bash
# Requires a generator that supports modules (Ninja ≥1.11 or MSBuild)
cmake -S . -B build -G Ninja
cmake --build build
```

For CMake 3.25–3.27 (experimental):

```cmake
cmake_minimum_required(VERSION 3.25)
set(CMAKE_EXPERIMENTAL_CXX_MODULE_CMAKE_API "3c375311-a3c9-4396-a187-3227ef642046")
set(CMAKE_EXPERIMENTAL_CXX_MODULE_DYNDEP ON)
```

### 8. Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `module 'math' not found` | BMI not found in search path | Compile interface unit first; check `-fmodule-file=` flags |
| `cannot import header in module` | `#include` inside module purview | Move `#include` to Global Module Fragment or use `import <>` |
| `redefinition of module 'math'` | Two `.cppm` files declare same module | Only one primary interface per module |
| `macro not available after import` | Macros don't cross module boundaries | Move macro-dependent code to GMF or use `#include` |
| `ODR violation` | Same name in multiple partitions | Each name exported from exactly one partition |
| BMI cache stale | `.pcm`/`.gcm` not rebuilt after change | Clean build or ensure dependency tracking is working |

### 9. Interop with legacy headers

```cpp
// Wrapping a C library for module use
export module cjson;

module;                       // Global Module Fragment
#include <cjson/cJSON.h>      // C header with macros

export module cjson;          // back to module purview

// Re-export key types (optional)
export using ::cJSON;
export using ::cJSON_Parse;
```

For CMake module support details, see [references/modules-cmake-support.md](references/modules-cmake-support.md).

## Related skills

- Use `skills/build-systems/build-acceleration` for PCH as a modules alternative
- Use `skills/compilers/gcc` or `skills/compilers/clang` for compiler-specific module flags
- Use `skills/build-systems/cmake` for CMake project configuration
