# Valgrind vs AddressSanitizer

## Comparison

| Feature | Valgrind Memcheck | AddressSanitizer (ASan) |
|---------|-------------------|------------------------|
| Slowdown | 10-50x | 2x |
| Memory overhead | 2-4x | ~2x |
| Requires recompile | No | Yes |
| Root required | No | No |
| Heap OOB | Yes | Yes |
| Stack OOB | Limited | Yes |
| Global OOB | No | Yes |
| Use-after-free | Yes | Yes |
| Use-after-return | No | Yes (with flag) |
| Uninit reads | Yes | No (use MSan) |
| Leak detection | Yes | Yes (with LeakSanitizer) |
| Platform | Linux/macOS/FreeBSD | GCC/Clang on Linux/macOS/Windows |
| Kernel/unmodified bins | Yes | No (need instrumented build) |

## When to use which

**Use ASan when:**

- You control the build process
- You want fast iteration in development
- You need to catch stack overflows and global OOB
- CI/CD integration (speed matters)

**Use Valgrind when:**

- You cannot recompile (testing pre-built binaries)
- You need uninitialised value detection (use `--track-origins=yes`)
- You need cache profiling (Cachegrind) or call graphs (Callgrind)
- You need heap usage profiling (Massif)
- You are on an older toolchain that doesn't support sanitizers

## Both together

Running ASan + Valgrind on the same binary is not recommended (both intercept `malloc`/`free`). Choose one per run.

However: compile with ASan for dev CI, run Valgrind Memcheck as a separate nightly check on a non-instrumented binary for uninit-value detection.

## Combining sanitizers for maximum coverage

```bash
# ASan + UBSan + LeakSanitizer (all Clang/GCC)
clang -fsanitize=address,undefined -g -O1 -o prog main.c

# MemorySanitizer (uninit reads; Clang only; all-clang build required)
clang -fsanitize=memory -g -O1 -o prog main.c

# ThreadSanitizer (data races)
clang -fsanitize=thread -g -O1 -o prog main.c
```
