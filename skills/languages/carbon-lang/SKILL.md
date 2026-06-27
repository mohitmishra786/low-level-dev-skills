---
name: carbon-lang
description: Carbon language skill for C++ interop and toolchain. Use when evaluating Carbon syntax, bidirectional C++ interop, building carbon-toolchain, or comparing Carbon vs C++. Activates on queries about Carbon language, Carbon.h, carbon-toolchain, checked borrows, or C++ successor.
---

# Carbon

## Purpose

Guide agents through the Carbon programming language: syntax fundamentals, bidirectional C++ interoperability via `Carbon.h`, building from source with `carbon-toolchain`, the experimental memory safety model (checked borrows), current pre-1.0 limitations, and when to evaluate Carbon versus staying on C++.

## When to Use

- Evaluating Carbon for a greenfield project with heavy C++ dependencies
- Calling C++ libraries from Carbon or exposing Carbon to C++
- Experimenting with Carbon toolchain from GitHub source
- Understanding Carbon's migration path from C++ codebases
- Assessing readiness for production (currently experimental)
- Comparing Carbon ergonomics to modern C++ (C++20/23)

## Workflow

### 1. Project status awareness

```
Carbon (2026 state)
├── Experimental — no 1.0 release
├── Focus: C++ interoperability and migration
├── No production stdlib equivalent to C++ yet
└── Toolchain under active development
```

Use Carbon for exploration and migration prototyping, not production systems without team acceptance of instability.

### 2. Build carbon-toolchain

```bash
git clone https://github.com/carbon-language/carbon-lang
cd carbon-lang

# Prerequisites: LLVM, Clang, CMake, Ninja
./scripts/run_bazelisk.py build \
  //toolchain:install \
  --symlink_prefix=carbon/

# Add to PATH
export PATH="$PWD/carbon/bin:$PATH"

carbon --version
```

```bash
# Online explorer (Compiler Explorer instance)
# http://carbon.compiler-explorer.com/
```

### 3. Basic syntax

```carbon
package Sample api;

fn Add(a: i32, b: i32) -> i32 {
    return a + b;
}

fn Main() -> i32 {
    var x: i32 = 3;
    var y: i32 = 4;
    Print(ToString(Add(x, y)));
    return 0;
}
```

| Carbon | C++ equivalent |
|--------|----------------|
| `fn` | function |
| `var x: i32` | `int32_t x` |
| `class` / `interface` | `class` / pure virtual |
| `impl` | method definitions |
| `package` | namespace/module |

### 4. C++ interop — calling C++ from Carbon

```cpp
// math.h (C++ header)
#pragma once
namespace Math {
    int Add(int a, int b);
}
```

```carbon
// Carbon imports C++ via library directive
package MathInterop api;

import Math;

fn Main() -> i32 {
    var sum: i32 = Math.Add(3, 4);
    return sum;
}
```

Interop uses Clang to parse C++ headers and generate Carbon bindings.

### 5. Carbon.h — exposing Carbon to C++

```carbon
// Exported for C++ consumption
package MyLib api;

export fn PublicApi() -> i32 {
    return 42;
}
```

```cpp
// C++ side includes generated Carbon headers
#include "carbon/generated/MyLib.h"

int main() {
    return MyLib::PublicApi();
}
```

Build system links Carbon object files with C++ via the Carbon toolchain driver.

### 6. Memory safety — checked borrows (experimental)

```carbon
// Conceptual — API evolving
fn Process(data: i32*) -> i32 {
    // Checked borrow: compiler tracks lifetime
    var ref: i32* = data;
    return *ref;
}
```

Carbon aims for memory safety without garbage collection — checked pointers and ownership semantics. Feature maturity varies; check latest design docs.

### 7. Current limitations

- No stable standard library matching C++ `<vector>`, `<thread>`, etc.
- Toolchain APIs change between releases
- IDE support limited compared to C++/Rust
- Cross-compilation story immature
- Community and package ecosystem small

### 8. Carbon vs C++ decision tree

```
Choose Carbon exploration when
├── Large C++ codebase to gradually migrate
├── Team wants improved syntax with C++ interop
└── Can tolerate toolchain churn

Stay on C++ when
├── Production stability required now
├── Need full stdlib, Boost, mature tooling
├── Heavy template metaprogramming investment
└── Platform support beyond Carbon targets
```

### 9. Build a Carbon file

```bash
# Compile and link (toolchain evolving — check docs)
carbon compile sample.carbon --output=sample.o
carbon link sample.o --output=sample

# Typecheck only
carbon compile --phase=check sample.carbon

# Or build from source with Bazel in carbon-lang repo
./scripts/run_bazelisk.py build //toolchain:install --symlink_prefix=carbon/
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Build fails missing LLVM | Wrong LLVM version | Match carbon-lang README LLVM pin |
| C++ import errors | Unsupported C++ features | Simplify header; wrap in C API |
| Syntax changed since tutorial | Pre-1.0 churn | Check latest carbon-lang docs |
| No stdlib for task | Not implemented | Bridge to C++ library temporarily |
| Explorer differs from CLI | Different versions | Use same commit for both |
| Link error with C++ | ABI mismatch | Use Carbon toolchain link driver |

## Related Skills

- `skills/compilers/cpp-templates` — C++ being migrated from
- `skills/compilers/cpp-modules` — C++20 modules comparison
- `skills/compiler-internals/compiler-frontend` — Carbon compiler architecture
- `skills/languages/hare-lang` — alternative systems language
- `skills/compilers/clang` — Clang backend for Carbon
- `skills/compilers/llvm` — LLVM IR pipeline