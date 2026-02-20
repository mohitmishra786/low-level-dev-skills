# GCC Flag Reference

Source: <https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html>
Source: <https://gcc.gnu.org/onlinedocs/gcc/Warning-Options.html>
Source: <https://gcc.gnu.org/onlinedocs/gcc/Debugging-Options.html>

## Table of Contents

1. [Optimisation flags](#optimisation-flags)
2. [Debug flags](#debug-flags)
3. [Warning flags](#warning-flags)
4. [Hardening flags](#hardening-flags)
5. [Code generation flags](#code-generation-flags)
6. [LTO / PGO flags](#lto--pgo-flags)
7. [Diagnostic flags](#diagnostic-flags)

---

## Optimisation flags

| Flag | Enables | Notes |
|------|---------|-------|
| `-O0` | Nothing | Default; best for debugging |
| `-O1` | Basic DCE, CSE, register allocation | ~40 sub-passes |
| `-O2` | `-O1` + vectorisation, inlining, devirtualisation | Standard release |
| `-O3` | `-O2` + loop transformations, aggressive inlining | Benchmark before using |
| `-Os` | `-O2` minus size-increasing passes + `-finline-functions` | Shared libs, embedded |
| `-Og` | Subset of `-O1` safe for debugging | Use with `-g` in debug cycle |
| `-Ofast` | `-O3` + `-ffast-math` + `-fallow-store-data-races` | Breaks IEEE 754; avoid unless sure |
| `-Oz` | More aggressive than `-Os` | clang only; GCC has `-Os` |

### Key sub-flags (fine-tuning)

| Flag | Default at | Effect |
|------|-----------|--------|
| `-march=native` | off | Tune for host CPU; not portable |
| `-mtune=native` | off | Schedule for host without changing ISA |
| `-fomit-frame-pointer` | `-O1`+ | Frees one register; breaks naive profiling |
| `-funroll-loops` | off | Unroll loops; often hurts i-cache |
| `-fstrict-aliasing` | `-O2`+ | Assume no aliasing across types (C §6.5p7) |
| `-fno-strict-aliasing` | off | Disable; needed for some legacy C code |
| `-fvisibility=hidden` | off | Default symbol visibility; reduces DSO size |
| `-ffunction-sections -fdata-sections` | off | One section per symbol; enable dead-code stripping with `--gc-sections` |

---

## Debug flags

| Flag | Effect |
|------|--------|
| `-g` | DWARF level 2 (default) |
| `-g1` | Minimal debug (function names, line numbers only) |
| `-g2` | Default; local vars, types |
| `-g3` | Includes macro definitions |
| `-ggdb` | DWARF extensions for GDB |
| `-ggdb3` | GDB extensions + macros |
| `-gsplit-dwarf` | Separate `.dwo` files; faster linking |
| `-gz` | Compress debug sections (zlib) |
| `-fno-eliminate-unused-debug-types` | Keep all types in DWARF |
| `-fdebug-prefix-map=old=new` | Remap paths in debug info (reproducible builds) |

---

## Warning flags

### Recommended baseline

```bash
-Wall -Wextra -Wpedantic
```

### Additional useful warnings

| Flag | Catches |
|------|---------|
| `-Wshadow` | Local variable shadows outer scope |
| `-Wcast-align` | Unaligned pointer casts |
| `-Wcast-qual` | Casting away `const`/`volatile` |
| `-Wconversion` | Implicit narrowing conversions |
| `-Wdouble-promotion` | `float` implicitly promoted to `double` |
| `-Wformat=2` | Printf/scanf format string issues (stricter than `-Wformat`) |
| `-Wnull-dereference` | Pointer deref that could be NULL |
| `-Wstack-usage=N` | Functions using more than N bytes of stack |
| `-Wundef` | Undefined identifiers used in `#if` |
| `-Wunreachable-code` | Code after return/break (GCC extension) |
| `-fanalyzer` | GCC 10+ static analyser; slow but finds real bugs |

### C++-specific

| Flag | Catches |
|------|---------|
| `-Woverloaded-virtual` | Hiding base class virtual function |
| `-Wnon-virtual-dtor` | Class with virtual functions but non-virtual destructor |
| `-Weffc++` | Effective C++ guidelines (noisy) |
| `-Wold-style-cast` | C-style casts in C++ code |

---

## Hardening flags

For production binaries (defence-in-depth):

```bash
-D_FORTIFY_SOURCE=2          # Buffer overflow detection in libc calls
-fstack-protector-strong      # Stack canary (balanced: protects most frames)
-fstack-protector-all         # Every function (slower)
-fPIE -pie                    # Position-independent executable (ASLR)
-Wl,-z,relro -Wl,-z,now      # Read-only relocations, bind now (RELRO full)
-fcf-protection=full          # Intel CET shadow stack + IBT (x86 only)
```

Do NOT combine `-fstack-protector-strong` with `-fno-stack-protector` on the same TU.

---

## Code generation flags

| Flag | Effect |
|------|--------|
| `-fPIC` | Position-independent code (shared library objects) |
| `-fPIE` | Position-independent executable |
| `-shared` | Build a shared library |
| `-static` | Link statically |
| `-nostdlib` | Do not link standard libraries (embedded/freestanding) |
| `-ffreestanding` | Freestanding environment; no hosted stdlib assumed |
| `-mcmodel=small/medium/large` | x86-64 code model; use `large` if >2 GB image |
| `-mno-red-zone` | Disable x86-64 128-byte red zone (needed in kernel code) |

---

## LTO / PGO flags

| Flag | Phase | Effect |
|------|-------|--------|
| `-flto` | compile+link | Enable LTO |
| `-flto=auto` | compile+link | Parallel LTO via jobserver |
| `-flto=N` | compile+link | N parallel LTO jobs |
| `-fprofile-generate` | compile | Instrument for PGO |
| `-fprofile-use` | compile | Apply `.gcda` profile data |
| `-fprofile-correction` | compile | Handle inconsistent profiles (parallel workloads) |
| `-fauto-profile=file` | compile | AutoFDO from `perf` sampling (Linux only) |

Use `gcc-ar` / `gcc-ranlib` when creating archives of LTO objects.

---

## Diagnostic flags

| Flag | Effect |
|------|--------|
| `-fdiagnostics-color=auto` | Colour output when terminal supports it |
| `-fmax-errors=N` | Stop after N errors |
| `-Q --help=optimizers -O2` | List all optimisation passes enabled at `-O2` |
| `-v` | Verbose: show subcommands, include paths, library paths |
| `-###` | Show subcommands without executing |
| `-save-temps` | Keep `.i`, `.s` intermediates |
| `-Wa,-adhln=foo.lst` | Produce assembly listing alongside object |
| `-Rpass=inline` | (clang-style; GCC does not have `-Rpass` directly) |
