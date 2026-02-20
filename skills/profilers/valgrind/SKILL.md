---
name: valgrind
description: Valgrind profiler skill for memory error detection and cache profiling. Use when running Memcheck to find heap corruption, use-after-free, memory leaks, or uninitialised reads; or Cachegrind/Callgrind for cache simulation and function-level profiling. Activates on queries about valgrind, memcheck, heap leaks, use-after-free without sanitizers, cachegrind, callgrind, KCachegrind, or massif memory profiling.
---

# Valgrind

## Purpose

Guide agents through Valgrind tools: Memcheck for memory errors, Cachegrind for cache simulation, Callgrind for call graphs, and Massif for heap profiling.

## Triggers

- "My program has a memory leak / use-after-free"
- "I can't use ASan — can I use Valgrind instead?"
- "How do I profile cache behaviour without perf?"
- "How do I visualize call graphs with Callgrind?"
- "How do I profile heap allocation patterns?"
- "Valgrind reports errors in third-party code I can't fix"

## Workflow

### 1. Memcheck — memory error detection

Compile with `-g -O1` for best results. `-O0` is also fine; avoid `-O2`+ which can produce false positives.

```bash
valgrind --tool=memcheck \
         --leak-check=full \
         --show-leak-kinds=all \
         --track-origins=yes \
         --error-exitcode=1 \
         ./prog [args]
```

Key flags:

| Flag | Default | Effect |
|------|---------|--------|
| `--leak-check=full` | summary | Full leak details |
| `--show-leak-kinds=all` | definite | Show all leak kinds |
| `--track-origins=yes` | no | Show where uninit values came from (slow) |
| `--error-exitcode=N` | 0 | Exit N if errors found (CI integration) |
| `--log-file=file` | stderr | Save report to file |
| `--suppressions=file` | none | Suppress known FPs |
| `--gen-suppressions=yes` | no | Print suppression directives for errors |
| `--max-stackframe=N` | 2000000 | Increase for deep stacks |
| `--malloc-fill=0xAB` | off | Fill allocated memory (detect uninit use) |
| `--free-fill=0xCD` | off | Fill freed memory (detect use-after-free) |

### 2. Understanding Memcheck output

```
==12345== Invalid read of size 4
==12345==    at 0x4007A2: foo (main.c:15)
==12345==    by 0x400846: main (main.c:30)
==12345==  Address 0x5204040 is 0 bytes after a block of size 40 alloc'd
==12345==    at 0x4C2FB0F: malloc (in /usr/lib/valgrind/vgpreload_memcheck.so)
==12345==    by 0x40074B: main (main.c:25)
```

- **Invalid read/write**: out-of-bounds access; check array bounds
- **Use of uninitialised value**: read before write; use `--track-origins=yes`
- **Invalid free / double free**: mismatched malloc/free; check ownership
- **Definitely lost**: reachable via no pointers; clear leak
- **Indirectly lost**: lost through a chain; usually means one root leak
- **Possibly lost**: might be pointing into the middle of a block; often FP with custom allocators

### 3. Leak kinds

| Kind | Meaning |
|------|---------|
| Definitely lost | No pointer to block |
| Indirectly lost | Lost via another lost block |
| Possibly lost | Pointer into middle of block |
| Still reachable | Pointer exists at exit; not a leak but never freed |

For library code: `--show-leak-kinds=definite,indirect` reduces noise from still-reachable.

### 4. Suppressions

```bash
# Generate suppression for current error
valgrind --gen-suppressions=yes ./prog 2>&1 | grep -A20 '{'

# Example suppression file (valgrind.supp)
{
   openssl_uninit
   Memcheck:Cond
   fun:SHA256_Init
   ...
}

# Use suppression file
valgrind --suppressions=valgrind.supp ./prog
```

### 5. Cachegrind — cache simulation

```bash
valgrind --tool=cachegrind ./prog

# Output: cachegrind.out.PID
# Annotate source
cg_annotate cachegrind.out.12345 --auto=yes

# Diff two runs
cg_diff cachegrind.out.before cachegrind.out.after
```

Key metrics:
- `I1mr` / `ILmr`: L1/LL instruction cache miss rate
- `D1mr` / `DLmr`: L1/LL data read miss rate
- `D1mw` / `DLmw`: L1/LL data write miss rate

### 6. Callgrind — call graph profiling

```bash
valgrind --tool=callgrind --callgrind-out-file=callgrind.out ./prog

# Analyse
callgrind_annotate callgrind.out

# Visualise in KCachegrind (GUI)
kcachegrind callgrind.out
```

Callgrind is slower than `perf` but works without root and provides exact call counts.

### 7. Massif — heap profiling

```bash
valgrind --tool=massif ./prog

# Visualise
ms_print massif.out.PID | less

# GUI
massif-visualizer massif.out.PID
```

Massif shows heap usage over time; useful for finding peak allocation sites and tracking gradual leaks.

### 8. Performance considerations

Valgrind Memcheck runs ~10-50x slower than native. Mitigations:
- Use a shorter representative workload
- Use `--error-exitcode=1` to fail fast in CI
- Use ASan (`-fsanitize=address`) for faster memory checking during development
- Reserve Valgrind for cases where ASan can't be used (old toolchains, production-like environments)

For a comparison of Valgrind vs ASan, see [references/valgrind-vs-asan.md](references/valgrind-vs-asan.md).

## Related skills

- Use `skills/runtimes/sanitizers` for faster ASan/UBSan alternatives
- Use `skills/profilers/linux-perf` for CPU-level profiling (faster than Cachegrind)
- Use `skills/profilers/flamegraphs` to visualise Callgrind output
