---
name: clang
description: Clang/LLVM compiler skill for C/C++ projects. Use when working with clang or clang++ for diagnostics, sanitizer instrumentation, optimization remarks, static analysis with clang-tidy, LTO via lld, or when migrating from GCC to Clang. Activates on queries about clang flags, clang-tidy, clang-format, better error messages, Apple/FreeBSD toolchains, or LLVM-specific optimizations. Covers flag selection, diagnostic tuning, and integration with LLVM tooling.
---

# Clang

## Purpose

Guide agents through Clang-specific features: superior diagnostics, sanitizer integration, optimization remarks, static analysis, and LLVM tooling. Covers divergences from GCC and Apple/FreeBSD specifics.

## Triggers

- "I want better compiler diagnostics/errors"
- "How do I use clang-tidy / clang-format?"
- "How do I see what the compiler optimised or didn't?"
- "I'm on macOS / FreeBSD using clang"
- "clang-cl for MSVC-compatible builds" — see `skills/compilers/msvc-cl`
- Sanitizer queries — see `skills/runtimes/sanitizers`

## Workflow

### 1. Build mode flags (identical to GCC)

Clang accepts most GCC flags. Key differences:

| Feature | GCC | Clang |
|---------|-----|-------|
| Min size | `-Os` | `-Os` or `-Oz` (more aggressive) |
| Optimise only hot | — | `-fprofile-instr-use` (LLVM PGO) |
| Thin LTO | `-flto` | `-flto=thin` (faster) |
| Static analyser | `-fanalyzer` | `clang --analyze` or `clang-tidy` |

### 2. Clang-specific diagnostic flags

```bash
# Show fix-it hints inline
clang -Wall -Wextra --show-fixits src.c

# Limit error count
clang -ferror-limit=5 src.c

# Verbose template errors (disable elision)
clang -fno-elide-type src.cpp

# Show tree diff for template mismatch
clang -fdiagnostics-show-template-tree src.cpp
```

Clang's diagnostics include exact range highlighting and fix-it suggestions that GCC lacks.

### 3. Optimization remarks

Optimization remarks let you see what Clang did or refused to do:

```bash
# Inliner decisions
clang -O2 -Rpass=inline src.c

# Missed vectorisation
clang -O2 -Rpass-missed=loop-vectorize src.c

# Why a loop was not vectorized
clang -O2 -Rpass-analysis=loop-vectorize src.c

# Save all remarks to YAML for post-processing
clang -O2 -fsave-optimization-record src.c
# Produces src.opt.yaml
```

Interpret remarks:

- `remark: foo inlined into bar` — inlining happened; good for hot paths
- `remark: loop not vectorized: loop control flow is not understood` — restructure the loop
- `remark: not vectorized: cannot prove it is safe to reorder...` — add `__restrict__` or `#pragma clang loop vectorize(assume_safety)`

### 4. Static analysis

```bash
# Built-in analyser (CSA)
clang --analyze -Xanalyzer -analyzer-output=text src.c

# clang-tidy (separate tool, richer checks)
clang-tidy src.c -- -std=c++17 -I/usr/include

# Enable specific check families
clang-tidy -checks='clang-analyzer-*,modernize-*,bugprone-*' src.cpp --

# Apply fixits automatically
clang-tidy -fix src.cpp --
```

Common `clang-tidy` check families:

- `bugprone-*`: real bugs (use-after-move, dangling, etc.)
- `clang-analyzer-*`: CSA checks (memory, null deref)
- `modernize-*`: C++11/14/17 modernisation
- `performance-*`: unnecessary copies, move candidates
- `readability-*`: naming, complexity

### 5. LTO with lld

```bash
# Full LTO
clang -O2 -flto -fuse-ld=lld src.c -o prog

# Thin LTO (faster link, nearly same quality)
clang -O2 -flto=thin -fuse-ld=lld src.c -o prog

# Check lld is available
clang -fuse-ld=lld -Wl,--version 2>&1 | head -1
```

For large projects, ThinLTO is preferred: link times 5-10x faster than full LTO with comparable code quality.

### 6. PGO (LLVM instrumentation)

```bash
# Step 1: instrument
clang -O2 -fprofile-instr-generate prog.c -o prog_inst

# Step 2: run with representative input
./prog_inst < workload.input
# Generates default.profraw

# Step 3: merge profiles
llvm-profdata merge -output=prog.profdata default.profraw

# Step 4: use profile
clang -O2 -fprofile-instr-use=prog.profdata prog.c -o prog
```

AutoFDO (sampling-based, less intrusive): collect with `perf`, convert with `create_llvm_prof`, use with `-fprofile-sample-use`. See `skills/profilers/linux-perf`.

### 7. GCC compatibility

Clang is intentionally GCC-compatible for driver flags. Key differences:

- Clang does not support all GCC-specific attributes; check with `__has_attribute(foo)`
- `-Weverything` enables all Clang warnings (no GCC equivalent); too noisy for production, useful for one-off audits
- Some GCC intrinsics need `#include <x86intrin.h>` on Clang too
- `__int128` is supported; `__float128` requires `-lquadmath` on some targets

### 8. macOS specifics

On macOS, `clang` is the system compiler (Apple LLVM). Key points:

- `ld64` is the default linker; `lld` requires explicit `-fuse-ld=lld` and Homebrew LLVM
- Use `-mmacosx-version-min=X.Y` to set deployment target
- Sanitizers on macOS use `DYLD_INSERT_LIBRARIES`; do not strip the binary
- `xcrun clang` resolves to the Xcode toolchain clang

For flag reference, see [references/flags.md](references/flags.md).
For clang-tidy config examples, see [references/clang-tidy.md](references/clang-tidy.md).

## Related skills

- Use `skills/compilers/gcc` for GCC-equivalent flag mapping
- Use `skills/runtimes/sanitizers` for `-fsanitize=*` workflows
- Use `skills/compilers/llvm` for IR-level work (`opt`, `llc`, `llvm-dis`)
- Use `skills/compilers/msvc-cl` for `clang-cl` on Windows
- Use `skills/binaries/linkers-lto` for linker-level LTO details
