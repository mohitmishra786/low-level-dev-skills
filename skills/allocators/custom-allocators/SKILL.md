---
name: custom-allocators
description: Custom allocator skill for memory allocation strategies. Use when implementing pool/slab/arena allocators, tuning jemalloc/mimalloc, writing Rust GlobalAlloc, or benchmarking allocator performance. Activates on queries about jemalloc, mimalloc, tcmalloc, arena allocator, GlobalAlloc, or fragmentation.
---

# Custom Allocators

## Purpose

Guide agents through memory allocator design and tuning: pool/slab/arena/buddy taxonomy, jemalloc internals and `MALLOC_CONF`, mimalloc design, tcmalloc thread-caching, writing a simple pool allocator in C, Rust `GlobalAlloc` trait, fragmentation metrics, and benchmarking.

## When to Use

- Replacing malloc for latency-sensitive or embedded workloads
- Tuning jemalloc/mimalloc for server heap behavior
- Implementing arena allocation for request-scoped or frame-based lifetimes
- Writing a Rust custom global allocator for `no_std` or performance
- Diagnosing heap fragmentation (internal vs external)
- Benchmarking allocator throughput and latency

## Workflow

### 1. Allocator taxonomy

```
Allocator types
├── Pool/fixed-size — O(1) alloc/free, fixed block sizes
├── Slab — kernel-style, cache-friendly size classes
├── Arena/bump — fast alloc, bulk free (reset arena)
├── Buddy — power-of-two blocks, low fragmentation for large allocs
└── General (malloc) — jemalloc, mimalloc, tcmalloc
```

### 2. Simple pool allocator in C

```c
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>

typedef struct pool_block {
    struct pool_block *next;
} pool_block_t;

typedef struct {
    void   *memory;
    size_t  block_size;
    size_t  num_blocks;
    pool_block_t *free_list;
} pool_t;

int pool_init(pool_t *p, size_t block_size, size_t num_blocks) {
    p->block_size = block_size < sizeof(pool_block_t) ?
        sizeof(pool_block_t) : block_size;
    p->num_blocks = num_blocks;
    p->memory = aligned_alloc(64, p->block_size * num_blocks);
    if (!p->memory) return -1;
    p->free_list = NULL;
    for (size_t i = 0; i < num_blocks; i++) {
        pool_block_t *blk = (pool_block_t *)((char *)p->memory + i * p->block_size);
        blk->next = p->free_list;
        p->free_list = blk;
    }
    return 0;
}

void *pool_alloc(pool_t *p) {
    if (!p->free_list) return NULL;
    pool_block_t *blk = p->free_list;
    p->free_list = blk->next;
    return blk;
}

void pool_free(pool_t *p, void *ptr) {
    pool_block_t *blk = (pool_block_t *)ptr;
    blk->next = p->free_list;
    p->free_list = blk;
}
```

### 3. Arena allocator

```c
typedef struct {
    char  *base;
    size_t capacity;
    size_t offset;
} arena_t;

void *arena_alloc(arena_t *a, size_t size, size_t align) {
    uintptr_t cur = (uintptr_t)(a->base + a->offset);
    uintptr_t aligned = (cur + align - 1) & ~(align - 1);
    size_t padding = aligned - cur;
    if (a->offset + padding + size > a->capacity)
        return NULL;
    a->offset += padding + size;
    return (void *)aligned;
}

void arena_reset(arena_t *a) { a->offset = 0; }
```

Use per-request arenas in servers — reset after response, no per-object free.

### 4. jemalloc tuning

```bash
# Use jemalloc as system allocator
LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2 ./myapp

# Runtime tuning
export MALLOC_CONF="background_thread:true,dirty_decay_ms:1000,muzzy_decay_ms:1000"

# Profiling build
# ./configure --enable-prof
export MALLOC_CONF="prof:true,prof_active:true,lg_prof_sample:19"
```

jemalloc concepts:
- **Size classes** — rounded allocation sizes
- **tcache** — per-thread cache for hot sizes
- **arenas** — reduce contention across threads

```bash
# Statistics
export MALLOC_CONF="stats_print:true"
# prints on exit, or:
mallctl("epoch", ...); mallctl("stats.allocated", ...);
```

### 5. mimalloc

```bash
# Use mimalloc
LD_PRELOAD=/usr/lib/libmimalloc.so ./myapp

# Environment options
export MIMALLOC_SHOW_STATS=1
export MIMALLOC_PAGE_RESET=1
```

mimalloc hierarchy: segment → page → block. Generally lower metadata overhead than jemalloc.

```bash
# Statistics at exit
MIMALLOC_SHOW_STATS=1 ./myapp
```

### 6. tcmalloc thread-caching

```bash
LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libtcmalloc.so.4 ./myapp

# Environment
export TCMALLOC_SAMPLE_PARAMETER=524288  # sampling profiler
```

Per-thread caches for small objects; central heap for larger allocations.

### 7. Rust GlobalAlloc

```rust
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};

struct TrackingAllocator;

static ALLOCATED: AtomicUsize = AtomicUsize::new(0);

unsafe impl GlobalAlloc for TrackingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let ptr = System.alloc(layout);
        if !ptr.is_null() {
            ALLOCATED.fetch_add(layout.size(), Ordering::Relaxed);
        }
        ptr
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        System.dealloc(ptr, layout);
        ALLOCATED.fetch_sub(layout.size(), Ordering::Relaxed);
    }
}

#[global_allocator]
static GLOBAL: TrackingAllocator = TrackingAllocator;
```

For `#![no_std]` with `alloc` crate, implement `GlobalAlloc` without `System`.

### 8. Fragmentation metrics

| Type | Definition | Detection |
|------|------------|-----------|
| Internal | Allocated block larger than requested | Allocator stats; size class rounding |
| External | Free memory not usable for request | `mallinfo`/`malloc_info`; RSS vs heap |

```bash
# glibc malloc_info
malloc_info(0, stdout);

# jemalloc
jeprof --show_bytes ./myapp jeprof.heap
```

### 9. Benchmarking

```bash
# mimalloc bench (if built from source)
cd mimalloc && mkdir build && cd build
cmake .. && make
./mimalloc-bench

# Custom microbenchmark pattern
perf stat -e cycles,instructions ./allocator_bench --threads 8 --size 64
```

Compare: single-thread alloc/free, multi-thread contention, mixed size distribution.

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Pool alloc returns NULL | Free list exhausted | Increase pool size; leak check |
| jemalloc RSS won't drop | Dirty page decay slow | Lower `dirty_decay_ms`; `madvise` |
| Arena OOM | No reset between phases | `arena_reset` or chain arenas |
| Rust allocator UB | Wrong Layout in dealloc | Store size/align with allocation |
| Worse perf with mimalloc | Wrong workload fit | Benchmark; try jemalloc |
| High external fragmentation | Long-lived mixed sizes | Segregate by lifetime; pools |

## Related Skills

- `skills/allocators/numa-programming` — NUMA-aware allocation
- `skills/rust/rust-no-std` — custom allocators in embedded Rust
- `skills/profilers/heaptrack` — allocation hotspot profiling
- `skills/profilers/valgrind` — heap leak detection
- `skills/low-level-programming/cpu-cache-opt` — allocator alignment and false sharing
- `skills/kernel/kernel-internals` — SLUB/buddy kernel allocators