# Linker and LTO Flags Reference

Source: https://sourceware.org/binutils/docs/ld/Options.html
Source: https://clang.llvm.org/docs/ThinLTO.html
Source: https://gcc.gnu.org/onlinedocs/gcc/Optimize-Options.html (LTO section)
Source: https://lld.llvm.org/

## Table of Contents
1. [Linker selection](#linker-selection)
2. [GNU ld / gold flags](#gnu-ld--gold-flags)
3. [lld flags](#lld-flags)
4. [GCC LTO flags](#gcc-lto-flags)
5. [Clang LTO flags](#clang-lto-flags)
6. [MSVC LTCG](#msvc-ltcg)
7. [Linker scripts basics](#linker-scripts-basics)
8. [Common linker errors](#common-linker-errors)

---

## Linker selection

```bash
# Via GCC/Clang driver
gcc -fuse-ld=gold  main.c -o prog
gcc -fuse-ld=lld   main.c -o prog
clang -fuse-ld=lld main.c -o prog

# Check which linker is in use
gcc -v main.c -o /dev/null 2>&1 | grep 'Invoking\|collect2\|ld\b'

# mold (very fast alternative to lld)
gcc -fuse-ld=mold  main.c -o prog
```

---

## GNU ld / gold flags

Pass via `-Wl,flag` or after `-Wl,` prefix (no spaces).

### Basics

| Flag | Effect |
|------|--------|
| `-o file` | Output filename |
| `-e symbol` | Entry point |
| `-L dir` | Add library search directory |
| `-l name` | Link library `libname.so` or `libname.a` |
| `-rpath dir` | Runtime library search path (embedded in ELF) |
| `-rpath-link dir` | Search for indirect deps (not embedded) |
| `-soname name` | Set the SONAME of a shared library |
| `-shared` | Build a shared library |
| `-static` | Force static linking |
| `-pie` | Build a position-independent executable |
| `-no-pie` | Force non-PIE |

### Symbol control

| Flag | Effect |
|------|--------|
| `--export-dynamic` | Add all symbols to dynamic table (needed for `dlopen`) |
| `--dynamic-list=file` | Specify dynamic symbol list |
| `--version-script=file` | Control symbol versioning and visibility |
| `--retain-symbols-file=file` | Keep only listed symbols |
| `--strip-all` | Strip all symbols at link |
| `--strip-debug` | Strip debug symbols at link |

### Dead-code removal

```bash
# Requires -ffunction-sections -fdata-sections at compile time
-Wl,--gc-sections            # remove unused sections
-Wl,--print-gc-sections      # print what was removed (debug)
-Wl,--icf=safe               # Identical Code Folding (gold/lld)
-Wl,--icf=all                # Aggressive ICF (may affect function pointers)
```

### Hardening

```bash
-Wl,-z,relro                 # Mark relocations read-only after startup
-Wl,-z,now                   # Resolve all PLT entries at startup (full RELRO)
-Wl,-z,noexecstack           # Mark stack non-executable
-Wl,-z,separate-code         # Separate code from data segments
```

### Diagnostics

```bash
-Wl,--as-needed              # Only link libs that are actually needed
-Wl,--no-as-needed           # Always link specified libs (default on some systems)
-Wl,--warn-common            # Warn about tentative definitions
-Wl,--warn-unresolved-symbols   # Warn (not error) on unresolved symbols
-Wl,-Map=prog.map            # Generate linker map file
-Wl,--print-map              # Print map to stdout
-Wl,--stats                  # Print linker statistics (gold)
-Wl,--verbose                # Verbose linker output
```

### Group / circular deps

```bash
-Wl,--start-group -lA -lB -Wl,--end-group
# Repeats search of A and B until no new symbols are resolved
# Resolves circular dependencies between static archives
```

---

## lld flags

lld (LLVM linker) accepts most GNU ld flags plus:

```bash
# ThinLTO cache
-Wl,--thinlto-cache-dir=/tmp/thinlto-cache
-Wl,--thinlto-cache-policy=cache_size_bytes=1g

# Parallel LTO jobs
-Wl,--thinlto-jobs=8

# ICF (Identical Code Folding)
-Wl,--icf=safe
-Wl,--icf=all

# Print statistics
-Wl,-stats

# LLD-specific symbol ordering for startup perf
-Wl,--call-graph-profile-sort      # sort functions by call graph

# Reproduce a link failure
-Wl,--reproduce=repro.tar
```

---

## GCC LTO flags

```bash
# Compile phase (generates GIMPLE IR alongside object)
gcc -O2 -flto -ffunction-sections -fdata-sections -c foo.c -o foo.o

# Link phase (must repeat -flto and -O level)
gcc -O2 -flto -Wl,--gc-sections foo.o bar.o -o prog

# Parallel LTO
gcc -O2 -flto=auto  ...   # uses jobserver parallelism
gcc -O2 -flto=4     ...   # exactly 4 threads

# Static archives: must use gcc-ar / gcc-ranlib
gcc-ar  rcs libfoo.a foo.o bar.o
gcc-ranlib libfoo.a

# Diagnose LTO decisions
gcc -O2 -flto -fdump-ipa-all foo.c -o prog   # dump IPA analysis
```

LTO object files contain both machine code and GIMPLE IR. Plain `ar` can archive them, but only `gcc-ar` creates the special index needed for LTO linking.

---

## Clang LTO flags

### Full LTO

```bash
clang -O2 -flto -fuse-ld=lld foo.c bar.c -o prog
```

### ThinLTO (preferred for large projects)

```bash
# Compile
clang -O2 -flto=thin -c foo.c -o foo.o
clang -O2 -flto=thin -c bar.c -o bar.o

# Link
clang -O2 -flto=thin -fuse-ld=lld foo.o bar.o -o prog \
    -Wl,--thinlto-cache-dir=/tmp/thinlto-cache

# ThinLTO cache greatly speeds up incremental links
```

### LTO in CMake

```cmake
# Enable for all targets
set(CMAKE_INTERPROCEDURAL_OPTIMIZATION ON)

# Or per-target (CMake 3.9+)
set_target_properties(myapp PROPERTIES INTERPROCEDURAL_OPTIMIZATION ON)
```

---

## MSVC LTCG

```cmd
REM Compile with whole-program optimisation
cl /GL /O2 /c foo.cpp /Fo:foo.obj

REM Link with LTCG
link /LTCG foo.obj bar.obj /OUT:prog.exe

REM Or with MSBuild property:
<WholeProgramOptimization>true</WholeProgramOptimization>
```

`/GL` at compile + `/LTCG` at link = MSVC equivalent of `-flto`.

---

## Linker scripts basics

Rarely hand-written, but essential for embedded systems:

```ld
/* Minimal linker script for Cortex-M */
MEMORY {
    FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 512K
    RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 128K
}

SECTIONS {
    .text : {
        KEEP(*(.isr_vector))   /* interrupt vector must be first */
        *(.text*)
        *(.rodata*)
    } > FLASH

    .data : {
        _sdata = .;
        *(.data*)
        _edata = .;
    } > RAM AT > FLASH        /* LMA in FLASH, VMA in RAM */

    .bss : {
        _sbss = .;
        *(.bss*)
        *(COMMON)
        _ebss = .;
    } > RAM

    _estack = ORIGIN(RAM) + LENGTH(RAM);
}
```

Key concepts:
- `MEMORY`: defines address regions with permissions
- `SECTIONS`: maps sections to regions
- `AT > FLASH`: load address in FLASH, run address in RAM (copy at startup)
- `KEEP(...)`: prevent `--gc-sections` from removing this

---

## Common linker errors

| Error | Cause | Fix |
|-------|-------|-----|
| `undefined reference to 'foo'` | Missing library | Add `-lfoo`; move `-l` after objects |
| `cannot find -lfoo` | Library not in search path | Add `-L/path`; install `-dev` package |
| `multiple definition of 'x'` | Defined in multiple TUs | Make one `static`; or use `extern` in header |
| `relocation truncated` | Address too far for relocation | Use `-mcmodel=large`; or restructure |
| `version GLIBC_2.33 not found` | Binary needs newer glibc | Build on older host; link statically |
| `circular reference` | Archives depend on each other | Use `--start-group`/`--end-group` |
| LTO mismatch error | Mixed LTO and non-LTO objects | Recompile all with `-flto` consistently |
| `file format not recognized` | Wrong architecture object | Check cross-compiler used for all objects |
