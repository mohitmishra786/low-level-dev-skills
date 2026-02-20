---
name: cpu-cache-opt
description: CPU cache optimization skill for C/C++ and Rust. Use when diagnosing cache misses, improving data layout for cache efficiency, using perf stat cache counters, understanding false sharing, prefetching, or structuring AoS vs SoA data layouts. Activates on queries about cache misses, cache lines, false sharing, perf cache counters, data layout optimization, prefetch, AoS vs SoA, or L1/L2/L3 cache performance.
---

# CPU Cache Optimization

## Purpose

Guide agents through cache-aware programming: diagnosing cache misses with perf, data layout transformations (AoS→SoA), false sharing detection and fixes, prefetching, and cache-friendly algorithm design.

## Triggers

- "My program has high cache miss rates — how do I fix it?"
- "What is false sharing and how do I detect it?"
- "Should I use AoS or SoA data layout?"
- "How do I measure cache performance with perf?"
- "How do I use __builtin_prefetch?"
- "My multithreaded program is slower than single-threaded due to cache"

## Workflow

### 1. Measure cache performance

```bash
# Basic cache counters
perf stat -e cache-references,cache-misses,cycles,instructions ./prog

# L1/L2/L3 miss breakdown
perf stat -e \
    L1-dcache-load-misses,\
    L1-dcache-loads,\
    L2-dcache-load-misses,\
    LLC-load-misses,\
    LLC-loads \
    ./prog

# Cache miss rate = L1-dcache-load-misses / L1-dcache-loads
# > 5% is concerning; > 20% is severe

# False sharing detection
perf stat -e \
    machine_clears.memory_ordering,\
    mem_load_l3_hit_retired.xsnp_hitm \
    ./prog
```

### 2. Cache line basics

- Cache line size: **64 bytes** on x86-64, ARM (most platforms)
- L1 cache: 32–64 KB, ~4 cycles latency
- L2 cache: 256 KB–1 MB, ~12 cycles latency
- L3 cache: 6–64 MB, ~40 cycles latency
- Main memory: ~200–300 cycles latency

```c
// Check cache line size
long cache_line = sysconf(_SC_LEVEL1_DCACHE_LINESIZE);

// Align data to cache line
struct alignas(64) HotData {
    int counter;
    // ... 60 bytes of data that fit in one line
};

// C
typedef struct {
    int x;
} __attribute__((aligned(64))) AlignedData;
```

### 3. AoS vs SoA data layout

```c
// AoS (Array of Structures) — default layout
struct Particle {
    float x, y, z;     // position (12 bytes)
    float vx, vy, vz;  // velocity (12 bytes)
    float mass;         // (4 bytes)
    int   flags;        // (4 bytes)
};
Particle particles[N];  // Bad for loops that only need position

// Problem: accessing particles[i].x loads x,y,z,vx,vy,vz,mass,flags
// But we only need x,y,z → 75% of loaded data is wasted

// SoA (Structure of Arrays) — cache-friendly for SIMD + sequential access
struct ParticlesSoA {
    float *x, *y, *z;
    float *vx, *vy, *vz;
    float *mass;
    int   *flags;
};

// Accessing x[i] for i=0..N loads 16 consecutive x values → 0% waste
// Also auto-vectorizes better
```

### 4. Common cache-unfriendly patterns

```c
// BAD: random access (linked list traversal)
Node *node = head;
while (node) {
    process(node->data);
    node = node->next;  // pointer chasing = cache miss per node
}

// BETTER: pool allocate nodes contiguously
// Or: rewrite as contiguous array with indices

// BAD: stride > cache line in matrix traversal
for (int i = 0; i < N; i++)
    for (int j = 0; j < M; j++)
        sum += matrix[j][i];  // column-major access on row-major array

// GOOD: row-major access
for (int i = 0; i < N; i++)
    for (int j = 0; j < M; j++)
        sum += matrix[i][j];

// BAD: large struct with hot + cold fields
struct Record {
    int id;           // hot: accessed every iteration
    char name[128];   // cold: accessed rarely
    int value;        // hot
    char desc[256];   // cold
};

// GOOD: separate hot and cold data
struct RecordHot { int id; int value; };
struct RecordCold { char name[128]; char desc[256]; };
RecordHot hot_data[N];
RecordCold cold_data[N];
```

### 5. False sharing

False sharing occurs when two threads write to different variables that share a cache line, causing constant cache-line invalidations.

```c
// BAD: counters likely on same cache line (8 bytes each, line = 64 bytes)
int counter_a;  // thread A's counter
int counter_b;  // thread B's counter

// Both on the same cache line → every write invalidates the other thread's cache

// GOOD: pad to separate cache lines
struct alignas(64) PaddedCounter {
    int value;
    char padding[60];  // Ensure next counter is on different cache line
};

PaddedCounter counters[NUM_THREADS];
// Thread i: counters[i].value++

// C++ standard approach
struct alignas(std::hardware_destructive_interference_size) PaddedCounter {
    int value;
};
```

### 6. Prefetching

Manual prefetch hints to hide memory latency:

```c
#include <immintrin.h>  // or <xmmintrin.h>

// Prefetch for read (locality 0=non-temporal, 3=high temporal)
__builtin_prefetch(ptr, 0, 3);  // prefetch for read, high locality
__builtin_prefetch(ptr, 1, 3);  // prefetch for write, high locality

// SSE prefetch (x86)
_mm_prefetch((char*)ptr, _MM_HINT_T0);   // L1
_mm_prefetch((char*)ptr, _MM_HINT_T1);   // L2
_mm_prefetch((char*)ptr, _MM_HINT_T2);   // L3
_mm_prefetch((char*)ptr, _MM_HINT_NTA);  // non-temporal (streaming)

// Typical pattern: prefetch N iterations ahead
#define PREFETCH_DIST 8
for (int i = 0; i < N; i++) {
    if (i + PREFETCH_DIST < N)
        __builtin_prefetch(&data[i + PREFETCH_DIST], 0, 3);
    process(data[i]);
}
```

Prefetching rules:

- Prefetch too early = cache evicted before use
- Prefetch too late = no benefit
- Prefetch distance = memory latency / time per iteration (typically 8–32 elements)

### 7. Cache-friendly algorithm design

```c
// Loop blocking / tiling for matrix operations
// Process cache-fitting blocks instead of full rows/columns
#define BLOCK 64  // tuned to L1 cache size

void matrix_mult_blocked(float *C, float *A, float *B, int N) {
    for (int i = 0; i < N; i += BLOCK)
    for (int k = 0; k < N; k += BLOCK)
    for (int j = 0; j < N; j += BLOCK)
    // Inner block fits in L1 cache
    for (int ii = i; ii < i + BLOCK && ii < N; ii++)
    for (int kk = k; kk < k + BLOCK && kk < N; kk++)
    for (int jj = j; jj < j + BLOCK && jj < N; jj++)
        C[ii*N+jj] += A[ii*N+kk] * B[kk*N+jj];
}
```

For perf cache event reference and false sharing detection patterns, see [references/cache-counters.md](references/cache-counters.md).

## Related skills

- Use `skills/profilers/linux-perf` for `perf stat` and `perf record` cache measurements
- Use `skills/profilers/valgrind` — cachegrind simulates cache behaviour
- Use `skills/low-level-programming/simd-intrinsics` — SoA layout pairs with SIMD vectorization
- Use `skills/low-level-programming/memory-model` for false sharing in concurrent contexts
