---
name: memory-hierarchy-and-caches
description: Memory hierarchy skill for caches, coherence, and locality. Use when explaining cache levels, associativity, false sharing, prefetching, or MESI coherence. Activates on queries about cache hierarchy, L1 L2 L3, false sharing, cache line, prefetch, or cache coherence.
---

# Memory Hierarchy and Caches

## Purpose

Teach CPU memory hierarchy: cache levels, associativity, line size, coherence protocols, false sharing, and prefetch behavior — architectural depth complementing optimization practice in `skills/low-level-programming/cpu-cache-opt`.

## When to Use

- Explaining why padding fixes scalability
- Choosing struct layout for multicore
- Interpreting cache miss counters
- Understanding DMA vs CPU cache on embedded SoCs

## Workflow

### 1. Hierarchy (typical desktop/ server)

```
Registers
├── L1d / L1i (per core, ~32 KiB, ~4 cycles)
├── L2 (per core, ~256 KiB – 1 MiB)
├── L3 (shared last-level, MiB – tens of MiB)
├── DRAM (hundreds of cycles)
└── Storage / NUMA remote (much slower)
```

Embedded MCUs may have only tightly-coupled memory (no L2/L3).

### 2. Cache line and associativity

- Line size: commonly **64 bytes** on x86/ARM64 (verify with `getconf LEVEL1_DCACHE_LINESIZE`)
- Set-associative: line maps to one set, competes within ways
- Conflict misses: many aliases same set

### 3. False sharing

```c
/* Bad — two atomics on same cache line */
struct {
    atomic_int counter_a;
    atomic_int counter_b;
} stats;

/* Good — pad to cache line */
struct alignas(64) {
    atomic_int counter_a;
    char pad[64 - sizeof(atomic_int)];
    atomic_int counter_b;
} stats;
```

### 4. Coherence (multicore)

MESI states: Modified, Exclusive, Shared, Invalid. Writes invalidate other cores' copies of the line — why atomics and locks ping cache lines.

### 5. Prefetching

```c
#ifdef __builtin_prefetch
for (int i = 0; i < n; i++) {
    __builtin_prefetch(&data[i + 8], 0, 3);
    process(data[i]);
}
#endif
```

Hardware stride prefetchers detect sequential access; random access misses.

### 6. Measurement

```bash
perf stat -e cache-references,cache-misses,L1-dcache-load-misses ./app
```

### 7. Agent usage

```
/memory-hierarchy-and-caches Diagnose false sharing in this per-thread stats array
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Scaling collapses | False sharing | Line-align per-thread data |
| High LLC misses | Working set > cache | Block algorithms; NUMA pin |
| DMA incoherence | CPU cache vs device | Flush/invalidate on MCU; dma_sync on Linux |
| Prefetch hurt | irregular access | Remove manual prefetch |
| Huge struct copies | AoS cold lines | SoA layout — see cpu-cache-opt |

## Related Skills

- `skills/low-level-programming/cpu-cache-opt` — practical optimization
- `skills/computer-architecture/cpu-pipelines-and-hazards` — load-use stalls
- `skills/computer-architecture/virtual-memory-paging-and-tlb` — TLB misses
- `skills/allocators/numa-programming` — remote memory latency
- `skills/profilers/hardware-counters` — perf counter events