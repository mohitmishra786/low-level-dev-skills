---
name: include-what-you-use
description: Include What You Use (IWYU) skill for optimizing C/C++ header includes. Use when reducing compilation cascades, interpreting IWYU reports, applying mapping files, deciding between forward declarations and full includes, or integrating IWYU with CMake. Activates on queries about IWYU, include-what-you-use, header bloat, reducing includes, forward declarations, compilation cascade, or slow C++ compilation from headers.
---

# Include What You Use (IWYU)

## Purpose

Guide agents through using IWYU to reduce unnecessary `#include` directives, interpret IWYU reports and mapping files, decide between forward declarations and full includes, and integrate IWYU into CMake builds to reduce compilation cascades in large codebases.

## Triggers

- "How do I use include-what-you-use?"
- "How do I reduce my C++ compilation times by fixing includes?"
- "How do I interpret IWYU output?"
- "Should I use a forward declaration or include?"
- "How do I integrate IWYU with CMake?"
- "What is a compilation cascade and how do I avoid it?"

## Workflow

### 1. Install and run IWYU

```bash
# Install
apt-get install iwyu              # Ubuntu/Debian
brew install include-what-you-use # macOS

# Run on a single file
iwyu -Xiwyu --error main.cpp 2>&1

# Run via compile_commands.json
iwyu_tool.py -p build/ src/main.cpp 2>&1 | tee iwyu.log

# Run on entire project
iwyu_tool.py -p build/ 2>&1 | tee iwyu.log
```

### 2. CMake integration

```cmake
# CMakeLists.txt — use IWYU as include checker during build
find_program(IWYU_PROGRAM NAMES include-what-you-use iwyu)
if(IWYU_PROGRAM)
    set(CMAKE_CXX_INCLUDE_WHAT_YOU_USE
        ${IWYU_PROGRAM}
        -Xiwyu --mapping_file=${CMAKE_SOURCE_DIR}/iwyu.imp
        -Xiwyu --no_comments
    )
endif()
```

```bash
# Build with IWYU analysis
cmake -S . -B build -DCMAKE_CXX_COMPILER=clang++
cmake --build build 2>&1 | tee iwyu.log
```

### 3. Interpreting IWYU output

```text
main.cpp should add these lines:
#include <string>   // for std::string
#include "mylib/widget.h"  // for Widget

main.cpp should remove these lines:
- #include <vector>  // lines 5-5
- #include "internal/detail.h"  // lines 8-8

The full include-list for main.cpp:
#include <iostream>  // for std::cout
#include <string>    // for std::string
#include "mylib/widget.h"  // for Widget
---
```

Reading the output:
- **should add**: headers providing symbols used but not yet included
- **should remove**: headers included but whose symbols aren't used directly
- **The full include-list**: what the final header list should look like

### 4. Apply IWYU fixes automatically

```bash
# fix_include script (comes with IWYU)
fix_include < iwyu.log

# Options
fix_include --nosafe_headers < iwyu.log    # more aggressive — also removes system headers
fix_include --comments < iwyu.log          # preserve // comments in includes
fix_include --dry_run < iwyu.log           # preview changes without applying

# Limit to specific files
fix_include --only_re='src/.*\.cpp' < iwyu.log

# Run and apply in one pipeline
iwyu_tool.py -p build/ 2>&1 | fix_include
```

### 5. Forward declarations vs full includes

IWYU prefers forward declarations (class/struct declarations without definition) when the full type isn't needed:

```cpp
// full_include.h — DON'T include this if only a pointer is used
#include "widget.h"      // full definition: Widget members, vtable, etc.

// forward_decl.h — OK when Widget* or Widget& is sufficient
class Widget;            // forward declaration
void process(Widget *w); // pointer: forward decl is enough

// When forward declaration is sufficient:
// - Pointer or reference parameter: Widget*, Widget&
// - Return type as pointer: Widget*
// - Base class declared elsewhere (but defined in .cpp)

// When full include is required:
// - Inheriting from Widget: class MyWidget : public Widget
// - Accessing Widget members: w.field, w.method()
// - Creating Widget instances: Widget w;
// - Sizeof(Widget)
// - Template instantiation: std::vector<Widget>
```

```cpp
// IWYU-friendly header
#pragma once
class Widget;            // forward declare (saves downstream compilation)

class Container {
    Widget *head_;       // pointer: forward decl is enough
public:
    void add(Widget *w);
    Widget *get(int idx);
};
// Container.cpp includes "widget.h" — only .cpp pays the compile cost
```

### 6. Mapping files for third-party headers

IWYU mapping files teach IWYU about indirect includes (where `#include <vector>` is provided by some internal STL header):

```python
# iwyu.imp — IWYU mapping file
[
  # Map internal LLVM headers to public ones
  { "include": ["<llvm/ADT/StringRef.h>", "private",
                 "<llvm/ADT/StringRef.h>", "public"] },

  # Map system headers to POSIX equivalents
  { "include": ["<bits/types.h>", "private", "<sys/types.h>", "public"] },
  { "include": ["<bits/socket.h>", "private", "<sys/socket.h>", "public"] },

  # Symbol → header mappings
  { "symbol": ["std::string", "private", "<string>", "public"] },
  { "symbol": ["NULL",        "private", "<cstddef>", "public"] },
]
```

```bash
# Use mapping file
iwyu -Xiwyu --mapping_file=iwyu.imp main.cpp

# IWYU ships with common mappings
ls /usr/share/include-what-you-use/
# gcc.stl.headers.imp, boost-1.62.imp, libcxx.imp, etc.

iwyu -Xiwyu --mapping_file=/usr/share/include-what-you-use/gcc.stl.headers.imp
```

### 7. What IWYU does not do

IWYU has limits — be aware:

```bash
# IWYU may give wrong advice for:
# - Macros from headers (hard to track)
# - Template specializations in included headers
# - Headers required for correct ODR linking

# Safe iterative workflow:
# 1. Run IWYU
# 2. Apply fixes with fix_include
# 3. Rebuild and run tests
# 4. Revert any changes that break the build
# 5. Repeat until clean

# Check for compilation cascade: how many TUs include a header
grep -rl '#include "expensive.h"' src/ | wc -l
```

## Related skills

- Use `skills/build-systems/build-acceleration` for ccache and other compile speed techniques
- Use `skills/build-systems/cmake` for CMake integration of build analysis tools
- Use `skills/compilers/cpp-modules` for C++20 modules as a long-term solution to include bloat
