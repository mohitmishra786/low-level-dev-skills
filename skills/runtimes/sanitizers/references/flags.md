# Sanitizer Flags Reference

Source: <https://clang.llvm.org/docs/UsersManual.html#controlling-code-generation>
Source: <https://clang.llvm.org/docs/AddressSanitizer.html>
Source: <https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html>
Source: <https://clang.llvm.org/docs/ThreadSanitizer.html>
Source: <https://clang.llvm.org/docs/MemorySanitizer.html>

## Quick reference table

| Sanitizer | Flag | GCC | Clang | Notes |
|-----------|------|-----|-------|-------|
| ASan | `-fsanitize=address` | 4.8+ | 3.1+ | |
| UBSan | `-fsanitize=undefined` | 4.9+ | 3.3+ | |
| TSan | `-fsanitize=thread` | 4.8+ | 3.1+ | Incompatible with ASan/MSan |
| MSan | `-fsanitize=memory` | No | 3.3+ | All-clang build required |
| LSan | `-fsanitize=leak` | 4.8+ | 3.1+ | Standalone or via ASan |
| CFI | `-fsanitize=cfi-*` | No | LTO required | |

## Compiler flags

### Required alongside sanitizer flags

```bash
-fno-omit-frame-pointer   # accurate stack traces in ASan
-g                         # source locations in reports
-O1                        # recommended: keeps code reasonable, better than -O0
```

### Recovery control

```bash
-fno-sanitize-recover=all         # abort on first error (CI recommended)
-fno-sanitize-recover=undefined   # abort only on UBSan errors
-fsanitize-recover=all            # continue after errors (log all)
```

### Individual UBSan checks

```bash
# Enable all undefined behaviour
-fsanitize=undefined

# Specific checks (can add to -fsanitize=undefined)
-fsanitize=integer                # overflow, division, shift
-fsanitize=signed-integer-overflow
-fsanitize=unsigned-integer-overflow  # not in 'undefined' by default
-fsanitize=float-divide-by-zero
-fsanitize=float-cast-overflow
-fsanitize=null
-fsanitize=alignment
-fsanitize=bounds                 # array index (compile-time bounds only)
-fsanitize=vptr                   # C++ virtual call type mismatch
-fsanitize=pointer-overflow
-fsanitize=builtin                # __builtin_* misuse
```

### ASan-specific options

```bash
-fsanitize-address-use-after-scope   # detect use-after-scope bugs
-fsanitize-address-use-after-return  # detect use-after-return (slow)
```

## Runtime options (environment variables)

### ASAN_OPTIONS

```bash
ASAN_OPTIONS=key=value:key2=value2 ./prog
```

| Key | Default | Effect |
|-----|---------|--------|
| `detect_leaks` | 1 | Enable LeakSanitizer |
| `abort_on_error` | 0 | abort() instead of _exit() |
| `exitcode` | 1 | Exit code on error |
| `log_path` | stderr | Write report here |
| `symbolize` | 1 | Symbolize (needs llvm-symbolizer) |
| `fast_unwind_on_malloc` | 1 | Fast (less accurate) stack traces |
| `quarantine_size_mb` | 256 | Delay reuse of freed memory |
| `max_uar_stack_size_log` | 20 | Use-after-return stack size |
| `handle_segv` | 1 | ASan handles SIGSEGV |
| `print_stats` | 0 | Print memory stats on exit |
| `check_initialization_order` | 0 | Detect initialisation order bugs |

### UBSAN_OPTIONS

| Key | Effect |
|-----|--------|
| `print_stacktrace=1` | Include stack trace |
| `halt_on_error=1` | Stop on first error |
| `suppressions=file` | Load suppression file |
| `log_path=file` | Write to file |

### TSAN_OPTIONS

| Key | Effect |
|-----|--------|
| `history_size=N` | Memory access history (0-7, default 1) |
| `halt_on_error=1` | Stop on first race |
| `suppressions=file` | Suppress known races |
| `report_signal_unsafe=0` | Suppress signal-handler race warnings |

### LSAN_OPTIONS

| Key | Effect |
|-----|--------|
| `suppressions=file` | Suppress known leaks |
| `report_objects=1` | Print leaked object addresses |
| `max_leaks=N` | Max leaks to report |
