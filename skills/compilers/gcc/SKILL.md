---
name: gcc
description: GCC compiler skill for C/C++ projects. Use when selecting optimization levels, warning flags, debug builds, LTO, sanitizer instrumentation, or diagnosing compilation errors with GCC. Covers flag selection for debug vs release, ABI concerns, preprocessor macros, profile-guided optimization, and integration with build systems. Activates on queries about gcc flags, compilation errors, performance tuning, warning suppression, or cross-standard compilation.
---

# GCC

## Purpose

Guide agents through GCC invocation: flag selection, build modes, warning triage, PGO, LTO, and common error patterns. Assume the project uses GNU Make, CMake, or a shell script.

## Triggers

- "What flags should I use for a release build?"
- "GCC is giving me a warning/error I don't understand"
- "How do I enable LTO / PGO with GCC?"
- "How do I compile with `-fsanitize`?"
- "My binary is too large / too slow"
- Undefined reference errors, ABI mismatch, missing symbols

## Workflow

### 1. Choose a build mode

| Goal | Recommended flags |
|------|-------------------|
| Debug | `-g -O0 -Wall -Wextra` |
| Debug + debuggable optimisation | `-g -Og -Wall -Wextra` |
| Release | `-O2 -DNDEBUG -Wall` |
| Release (max perf, native only) | `-O3 -march=native -DNDEBUG` |
| Release (min size) | `-Os -DNDEBUG` |
| Sanitizer (dev) | `-g -O1 -fsanitize=address,undefined` |

Always pass `-std=c11` / `-std=c++17` (or the required standard) explicitly. Never rely on the implicit default.

### 2. Warning discipline

Start with `-Wall -Wextra`. For stricter standards compliance add `-Wpedantic`. To treat all warnings as errors in CI: `-Werror`.

Suppress a specific warning only in a narrow scope:
```c
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wunused-parameter"
// ...
#pragma GCC diagnostic pop
```

Do not pass `-w` (silences everything) except as a last resort for third-party headers.

### 3. Debug information

- `-g` — DWARF debug info, default level 2
- `-g3` — includes macro definitions (useful with GDB `macro expand`)
- `-ggdb` — DWARF extensions optimal for GDB
- `-gsplit-dwarf` — splits `.dwo` files; reduces link time, needed for `debuginfod`

Pair `-g` with `-Og` (not `-O0`) when you need readable optimised code in GDB.

### 4. Optimisation decision tree

```
Need max throughput on a fixed machine?
  yes -> -O3 -march=native -flto
  no  -> profiling available?
           yes -> -O2 -fprofile-use
           no  -> -O2
Size-constrained (embedded, shared lib)?
  yes -> -Os  (or -Oz with clang)
```

`-O3` vs `-O2`: `-O3` adds aggressive loop transformations (`-funswitch-loops`, `-fpeel-loops`, `-floop-interchange`) and more aggressive inlining. Use `-O3` only after benchmarking; it occasionally regresses due to i-cache pressure.

`-Ofast`: enables `-ffast-math` which breaks IEEE 754 semantics (NaN handling, associativity). Avoid unless the numerical domain explicitly permits it.

### 5. Link-time optimisation (LTO)

```bash
# Compile
gcc -O2 -flto -c foo.c -o foo.o
gcc -O2 -flto -c bar.c -o bar.o
# Link (must pass -flto again)
gcc -O2 -flto foo.o bar.o -o prog
```

Use `gcc-ar` / `gcc-ranlib` instead of `ar` / `ranlib` when archiving LTO objects into static libs.

For parallel LTO: `-flto=auto` (uses `make`-style jobserver) or `-flto=N`.

See [references/flags.md](references/flags.md) for full flag reference. See `skills/binaries/linkers-lto` for linker-level LTO configuration.

### 6. Profile-guided optimisation (PGO)

```bash
# Step 1: instrument
gcc -O2 -fprofile-generate prog.c -o prog_inst
# Step 2: run with representative workload
./prog_inst < workload.input
# Step 3: optimise with profile
gcc -O2 -fprofile-use -fprofile-correction prog.c -o prog
```

`-fprofile-correction` handles profile data inconsistencies from multi-threaded runs.

### 7. Preprocessor and standards

- Inspect macro expansion: `gcc -E file.c | less`
- Dump predefined macros: `gcc -dM -E - < /dev/null`
- Force strict standard: `-std=c11 -pedantic-errors`
- Disable GNU extensions: `-std=c11` (not `-std=gnu11`)

### 8. Common error triage

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `undefined reference to 'foo'` | Missing `-lfoo` or wrong link order | Add `-lfoo`; move `-l` flags after object files |
| `multiple definition of 'x'` | Variable defined (not just declared) in a header | Add `extern` in header, define in one `.c` |
| `implicit declaration of function` | Missing `#include` | Add the header |
| `warning: incompatible pointer types` | Wrong cast or missing prototype | Fix the type; check headers |
| ABI errors with C++ | Mixed `-std=` or different `libstdc++` | Unify `-std=` across all TUs |
| `relocation truncated` | Overflow on a 32-bit relative relocation | Use `-mcmodel=large` or restructure code |

For sanitizer reports, use `skills/runtimes/sanitizers`.

### 9. Useful one-liners

```bash
# Show all flags enabled at -O2
gcc -Q --help=optimizers -O2 | grep enabled

# Preprocess only (check includes/macros)
gcc -E -dD src.c -o src.i

# Assembly output (Intel syntax)
gcc -S -masm=intel -O2 foo.c -o foo.s

# Show include search path
gcc -v -E - < /dev/null 2>&1 | grep -A20 '#include <...>'

# Check if a flag is supported
gcc -Q --help=target | grep march
```

For a complete flag cheatsheet, see [references/flags.md](references/flags.md).
For common error patterns and examples, see [references/examples.md](references/examples.md).

## Related skills

- Use `skills/runtimes/sanitizers` to add `-fsanitize=*` builds
- Use `skills/compilers/clang` when switching to clang/LLVM
- Use `skills/binaries/linkers-lto` for advanced LTO linker flags
- Use `skills/debuggers/gdb` for debugging GCC-built binaries
