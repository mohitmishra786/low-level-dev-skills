# Clang Flag Reference

Source: https://clang.llvm.org/docs/UsersManual.html
Source: https://clang.llvm.org/docs/ClangCommandLineReference.html

## Table of Contents

1. [Optimisation](#optimisation)
2. [Diagnostics](#diagnostics)
3. [Sanitizers](#sanitizers)
4. [LTO / PGO](#lto--pgo)
5. [Code generation](#code-generation)
6. [Target-specific](#target-specific)

---

## Optimisation

| Flag | Effect |
|------|--------|
| `-O0/1/2/3/Os/Oz/Og` | Same semantics as GCC |
| `-Ofast` | `-O3` + `-ffast-math` |
| `-flto` | Full LTO |
| `-flto=thin` | ThinLTO (faster link) |
| `-fwhole-program-vtables` | Devirtualise across modules (requires LTO) |
| `-fvirtual-function-elimination` | Remove unreachable virtual functions (LTO) |
| `-fstrict-aliasing` | Default at `-O2`+ |
| `-fno-strict-aliasing` | Disable strict aliasing |
| `-ffast-math` | Unsafe FP optimisations (implies `-fno-honor-nans` etc.) |
| `-ffp-model=fast/strict/precise` | Clang-specific FP model control |

---

## Diagnostics

| Flag | Effect |
|------|--------|
| `-Wall -Wextra` | Standard warning set |
| `-Weverything` | All warnings (audit use only) |
| `-Wpedantic` | Strict standards conformance warnings |
| `-Werror` | Warnings as errors |
| `-Werror=foo` | Specific warning as error |
| `-ferror-limit=N` | Stop after N errors (default 20) |
| `-ftemplate-backtrace-limit=N` | Template instantiation depth limit |
| `-fno-elide-type` | Print full template types |
| `-fdiagnostics-show-template-tree` | Tree diff for template mismatches |
| `-fdiagnostics-color=auto/always/never` | Colour control |
| `-fdiagnostics-format=clang/msvc/vi` | Output format |
| `--show-fixits` | Show suggested fixes inline |
| `-Rpass=<regex>` | Optimisation remarks (pass did transform) |
| `-Rpass-missed=<regex>` | Remarks for missed transforms |
| `-Rpass-analysis=<regex>` | Analysis remarks |
| `-fsave-optimization-record` | Save remarks to `.opt.yaml` |

---

## Sanitizers

| Flag | Sanitizer |
|------|-----------|
| `-fsanitize=address` | AddressSanitizer (heap/stack/global OOB, UAF) |
| `-fsanitize=undefined` | UndefinedBehaviorSanitizer |
| `-fsanitize=thread` | ThreadSanitizer |
| `-fsanitize=memory` | MemorySanitizer (uninit reads; requires all-clang build) |
| `-fsanitize=leak` | LeakSanitizer (standalone) |
| `-fsanitize-recover=all` | Continue after sanitizer error |
| `-fsanitize-blacklist=file` | Suppress specific functions/files |
| `-fno-omit-frame-pointer` | Needed for good ASan stack traces |

See `skills/runtimes/sanitizers` for full decision tree and report interpretation.

---

## LTO / PGO

| Flag | Phase | Effect |
|------|-------|--------|
| `-flto` | compile+link | Full LTO via LLVM bitcode |
| `-flto=thin` | compile+link | ThinLTO |
| `-fuse-ld=lld` | link | Use lld linker |
| `-fprofile-instr-generate` | compile | LLVM PGO instrumentation |
| `-fprofile-instr-use=file` | compile | Apply PGO profile |
| `-fprofile-generate` | compile | GCC-compatible profiling |
| `-fprofile-use=file` | compile | GCC-compatible profile use |
| `-fprofile-sample-use=file` | compile | AutoFDO (sampling-based) |
| `-fcs-profile-generate` | compile | Context-sensitive PGO |

---

## Code generation

| Flag | Effect |
|------|--------|
| `-fPIC` | Position-independent code |
| `-fPIE` | Position-independent executable |
| `-fvisibility=hidden` | Default to hidden symbol visibility |
| `-fstack-protector-strong` | Stack canary |
| `-fcf-protection=full` | Intel CET (x86) |
| `-fsanitize-cfi-*` | Control Flow Integrity (LTO required) |
| `-mllvm -inline-threshold=N` | Tune inliner threshold directly |

---

## Target-specific

### x86-64
```
-march=x86-64-v2    # SSE4.2, POPCNT (Nehalem+)
-march=x86-64-v3    # AVX2 (Haswell+)
-march=x86-64-v4    # AVX-512
-march=native       # Detect host CPU
```

### AArch64 / ARM
```
-target aarch64-linux-gnu
-mcpu=cortex-a72
-mfloat-abi=hard
```

### WebAssembly
```
--target=wasm32-unknown-unknown
-nostdlib
```
