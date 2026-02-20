---
name: sanitizers
description: Compiler sanitizer skill for runtime bug detection in C/C++. Use when enabling and interpreting AddressSanitizer (ASan), UndefinedBehaviorSanitizer (UBSan), ThreadSanitizer (TSan), MemorySanitizer (MSan), or LeakSanitizer (LSan) with GCC or Clang. Activates on queries about sanitizer flags, sanitizer reports, ASAN_OPTIONS, memory errors, data races, undefined behaviour, uninitialised reads, or choosing which sanitizer to use for a given bug class.
---

# Sanitizers

## Purpose

Guide agents through choosing, enabling, and interpreting compiler runtime sanitizers for finding memory errors, undefined behaviour, data races, and memory leaks.

## Triggers

- "My program has a memory error — which sanitizer do I use?"
- "How do I enable ASan?"
- "How do I interpret an ASan/UBSan/TSan report?"
- "ASan says heap-buffer-overflow — what does that mean?"
- "How do I suppress false positives in sanitizers?"
- "Can I use sanitizers in CI?"

## Workflow

### 1. Decision tree: which sanitizer?

```bash
Bug class?
├── Memory OOB, use-after-free, double-free → AddressSanitizer (ASan)
├── Stack OOB, global OOB → ASan (all three covered)
├── Uninitialised reads → MemorySanitizer (MSan, Clang only, requires all-clang build)
├── Undefined behaviour (int overflow, null deref, bad cast) → UBSan
├── Data races (multi-thread) → ThreadSanitizer (TSan)
├── Memory leaks only → LeakSanitizer (LSan, standalone or via ASan)
└── Multiple classes → ASan + UBSan (common combo); cannot combine with TSan or MSan
```

### 2. AddressSanitizer (ASan)

```bash
# GCC or Clang
gcc -fsanitize=address -fno-omit-frame-pointer -g -O1 -o prog main.c
# Or
clang -fsanitize=address -fno-omit-frame-pointer -g -O1 -o prog main.c
```

Runtime options (via `ASAN_OPTIONS`):

```bash
ASAN_OPTIONS=detect_leaks=1:abort_on_error=1:log_path=/tmp/asan.log ./prog
```

| `ASAN_OPTIONS` key | Effect |
|--------------------|--------|
| `detect_leaks=0/1` | Enable LeakSanitizer (default 1 on Linux) |
| `abort_on_error=1` | Call `abort()` instead of `_exit()` (for core dumps) |
| `log_path=path` | Write report to file |
| `symbolize=1` | Symbolize addresses (needs `llvm-symbolizer` in PATH) |
| `fast_unwind_on_malloc=0` | More accurate stacks (slower) |
| `quarantine_size_mb=256` | Delay reuse of freed memory |

**Interpreting ASan output:**

```text
==12345==ERROR: AddressSanitizer: heap-buffer-overflow on address 0x602000000050
READ of size 4 at 0x602000000050 thread T0
    #0 0x401234 in foo /home/user/src/main.c:15
    #1 0x401567 in main /home/user/src/main.c:42

0x602000000050 is located 0 bytes after a 40-byte region
[0x602000000028, 0x602000000050) allocated at:
    #0 0x7f12345 in malloc ...
    #1 0x401234 in main /home/user/src/main.c:10
```

Reading: the top frame in `WRITE/READ` is the access site; the `allocated at` stack shows the allocation. The region is 40 bytes at `[start, end)` and the access is at `end` = one byte past the end (classic off-by-one).

### 3. UndefinedBehaviorSanitizer (UBSan)

```bash
gcc -fsanitize=undefined -g -O1 -o prog main.c
# More complete: add specific checks
gcc -fsanitize=undefined,integer -g -O1 -o prog main.c
```

Common UBSan checks:

- `signed-integer-overflow`
- `unsigned-integer-overflow` (not in `undefined` by default)
- `null` — null pointer dereference
- `bounds` — array index OOB (compile-time knowable bounds)
- `alignment` — misaligned pointer access
- `float-cast-overflow` — float-to-int conversion overflow
- `vptr` — C++ vtable type mismatch
- `shift-exponent` — shift >= bit width

```bash
# Enable everything including integer overflow
gcc -fsanitize=undefined \
    -fsanitize=signed-integer-overflow,unsigned-integer-overflow,float-cast-overflow \
    -fno-sanitize-recover=all \   # abort instead of continue
    -g -O1 -o prog main.c
```

`-fno-sanitize-recover=all`: makes UBSan abort on first error (important for CI).

**Interpreting UBSan output:**

```text
src/main.c:15:12: runtime error: signed integer overflow: 2147483647 + 1 cannot be represented in type 'int'
```

### 4. ThreadSanitizer (TSan)

```bash
# Clang or GCC (GCC ≥ 4.8)
clang -fsanitize=thread -g -O1 -o prog main.c

# TSan is incompatible with ASan and MSan
```

**Interpreting TSan output:**

```text
WARNING: ThreadSanitizer: data race (pid=12345)
  Write of size 4 at 0x7f... by thread T2:
    #0 increment /home/user/src/counter.c:8
  Previous read of size 4 at 0x7f... by thread T1:
    #0 read_counter /home/user/src/counter.c:3
```

### 5. MemorySanitizer (MSan)

MSan detects reads of uninitialised memory. **Clang only. Requires all-instrumented build** (no mixing of MSan and non-MSan objects).

```bash
clang -fsanitize=memory -fno-omit-frame-pointer -g -O1 -o prog main.c
# With origin tracking (slower but shows where uninit value came from)
clang -fsanitize=memory -fsanitize-memory-track-origins=2 -g -O1 -o prog main.c
```

System libraries must be rebuilt with MSan or substituted with MSan-instrumented wrappers. Use `msan-libs` toolchain from LLVM.

### 6. ASan + UBSan combined

```bash
gcc -fsanitize=address,undefined -fno-sanitize-recover=all \
    -fno-omit-frame-pointer -g -O1 -o prog main.c
```

Do not combine with TSan or MSan.

### 7. Suppressions

```bash
# ASan suppression file
cat > asan.supp << 'EOF'
# Suppress leaks from OpenSSL init
leak:CRYPTO_malloc
EOF

LSAN_OPTIONS=suppressions=asan.supp ./prog

# UBSan suppression
cat > ubsan.supp << 'EOF'
signed-integer-overflow:third_party/fast_math.c
EOF
UBSAN_OPTIONS=suppressions=ubsan.supp:print_stacktrace=1 ./prog
```

### 8. CMake integration

```cmake
option(SANITIZE "Enable sanitizers" OFF)
if(SANITIZE)
    set(san_flags -fsanitize=address,undefined -fno-sanitize-recover=all
                  -fno-omit-frame-pointer -g -O1)
    add_compile_options(${san_flags})
    add_link_options(${san_flags})
endif()
```

### 9. CI integration

```yaml
# GitHub Actions example
- name: Build with ASan+UBSan
  run: |
    cmake -S . -B build -DSANITIZE=ON
    cmake --build build -j$(nproc)

- name: Run tests under sanitizers
  run: |
    ASAN_OPTIONS=abort_on_error=1:detect_leaks=1 \
    UBSAN_OPTIONS=print_stacktrace=1:halt_on_error=1 \
    ctest --test-dir build -j$(nproc) --output-on-failure
```

For a quick flag reference, see [references/flags.md](references/flags.md).
For report interpretation examples, see [references/reports.md](references/reports.md).

## Related skills

- Use `skills/profilers/valgrind` for Memcheck when ASan is unavailable
- Use `skills/runtimes/fuzzing` to auto-generate inputs that trigger sanitizer errors
- Use `skills/compilers/gcc` or `skills/compilers/clang` for build flag context
