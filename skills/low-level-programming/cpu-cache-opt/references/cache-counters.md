# Cache Performance Counters Reference

## perf stat Cache Events

### Generic (portable across CPUs)

```bash
perf stat -e cache-references,cache-misses ./prog
```

| Event | Meaning |
|-------|---------|
| `cache-references` | Last-level cache accesses |
| `cache-misses` | Last-level cache misses |

### x86 Intel PMU Events

```bash
# Full L1/L2/L3 breakdown
perf stat -e \
    L1-dcache-loads,L1-dcache-load-misses,\
    L1-dcache-stores,L1-dcache-store-misses,\
    L2-dcache-loads,L2-dcache-load-misses,\
    LLC-loads,LLC-load-misses,LLC-stores,LLC-store-misses \
    ./prog
```

```bash
# Advanced Intel events (Skylake/Icelake)
perf stat -e \
    mem_load_retired.l1_miss,\
    mem_load_retired.l2_miss,\
    mem_load_retired.l3_miss,\
    mem_inst_retired.all_loads,\
    mem_load_l3_hit_retired.xsnp_hitm \
    ./prog
```

### False Sharing Detection

```bash
# HITM = cache line modified and hit in another core (false sharing indicator)
perf stat -e \
    mem_load_l3_hit_retired.xsnp_hitm,\
    mem_load_l3_miss_retired.remote_hitm,\
    machine_clears.memory_ordering \
    ./prog
```

High `xsnp_hitm` or `remote_hitm` = false sharing.

### ARM Cache Events

```bash
# ARM64 cache events
perf stat -e \
    L1-dcache-load-misses,\
    L1-dcache-loads,\
    cache-misses,cache-references \
    ./prog

# ARM PMU specific
perf stat -e \
    r0003,\   # L1D_CACHE
    r0006,\   # BUS_ACCESS
    r0017     # L2D_CACHE
    ./prog
```

## Interpreting Cache Rates

| Metric | Formula | Healthy | Warning |
|--------|---------|---------|---------|
| L1 miss rate | L1-misses / L1-loads | < 1% | > 5% |
| LLC miss rate | LLC-misses / LLC-loads | < 1% | > 5% |
| Cache miss rate | cache-misses / cache-references | < 1% | > 5% |

## valgrind cachegrind

```bash
# Simulate cache behaviour (no real hardware needed)
valgrind --tool=cachegrind --cache-sim=yes \
         --I1=32768,8,64 --D1=32768,8,64 \
         --LL=6291456,12,64 \
         ./prog

# Annotate source with cache events
cg_annotate cachegrind.out.* --auto=yes

# Compare two runs
cg_diff cachegrind.out.before cachegrind.out.after
```

Output format:

```text
=============================================================
I   refs:      1,234,567
I1  misses:        1,234
LLi misses:          123
I1  miss rate:      0.10%
LLi miss rate:      0.01%

D   refs:      2,345,678  (1,234,567 rd + 1,111,111 wr)
D1  misses:       23,456  (   12,345 rd +    11,111 wr)
LLd misses:        2,345  (    1,234 rd +     1,111 wr)
D1  miss rate:      1.00% (    1.00% + 1.00%)
LLd miss rate:      0.10% (    0.10% + 0.10%)
```

## Struct Layout Analysis

```bash
# GCC: show struct padding
gcc -g -O0 -Wpadded src/hot.c 2>&1 | grep "Wpadded"

# pahole tool: show struct layout
pahole -C MyStruct ./myapp

# Output:
struct MyStruct {
    int                        x;        /*     0     4 */
    /* XXX 4 bytes hole, try to pack */
    double                     y;        /*     8     8 */
    int                        z;        /*    16     4 */
    /* size: 24, cachelines: 1 */
};
```

## Cache-Friendly Allocation Patterns

```c
// Aligned allocation for cache lines
#include <stdlib.h>

// C11
void *buf = aligned_alloc(64, 1024 * sizeof(float));

// POSIX
void *buf;
posix_memalign(&buf, 64, 1024 * sizeof(float));

// C++ (C++17)
#include <memory>
auto buf = std::make_unique<float[]>(1024);  // heap, may not be aligned
// Or:
alignas(64) float buf[1024];  // Stack aligned

// Custom aligned allocator for STL containers
template<typename T, size_t Align = 64>
struct AlignedAllocator {
    using value_type = T;
    T* allocate(size_t n) {
        return static_cast<T*>(aligned_alloc(Align, n * sizeof(T)));
    }
    void deallocate(T* p, size_t) { free(p); }
};

std::vector<float, AlignedAllocator<float>> vec(1024);
```

## Hardware Prefetcher Behavior

Modern CPUs have hardware prefetchers that detect:

- Sequential access patterns (stride 1)
- Constant stride patterns (stride 2, 4, ...)
- Pointer chasing (limited)

Hardware prefetcher cannot help with:

- Irregular access (random, linked list traversal)
- Access pattern dependent on computed index

When to use manual prefetch:

- Stride known at compile time but too large for hw prefetcher
- Pointer chasing through linked data structures
- Software pipeline with known future addresses

```c
// Linked list prefetch pattern
Node *next = head;
while (next) {
    Node *curr = next;
    next = curr->next;
    if (next) __builtin_prefetch(next, 0, 1);  // Prefetch next node
    process(curr->data);
}
```
