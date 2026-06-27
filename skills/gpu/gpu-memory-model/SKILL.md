---
name: gpu-memory-model
description: GPU memory model skill for SIMT execution and memory hierarchy. Use when analyzing warp divergence, memory coalescing, shared memory bank conflicts, cache behavior, atomics, or occupancy tradeoffs. Activates on queries about SIMT, warp coalescing, bank conflicts, wavefront, GPU occupancy, or memory-bound kernels.
---

# GPU Memory Model

## Purpose

Explain the GPU execution and memory model for agents optimizing kernels: SIMT execution, warp (32) vs wavefront (64) divergence costs, global memory coalescing rules, shared memory bank conflicts, L1/L2 cache behavior, atomic memory ordering, and the occupancy-vs-latency-hiding tradeoff.

## When to Use

- Diagnosing why a kernel is memory-bound despite high theoretical bandwidth
- Understanding warp divergence from branching
- Fixing shared memory bank conflicts in tiled algorithms
- Choosing block size for occupancy vs register pressure
- Porting kernels between NVIDIA (warp 32) and AMD (wavefront 64)
- Reasoning about atomic contention in parallel reductions

## Workflow

### 1. SIMT execution model

```
GPU hardware
├── Device
│   └── SM / CU (Streaming Multiprocessor / Compute Unit)
│       ├── Warp schedulers (NVIDIA) or Wavefront schedulers (AMD)
│       │   └── Warp/Wavefront (32 or 64 threads in lockstep)
│       ├── Register file (partitioned per thread)
│       ├── Shared memory / LDS (per SM)
│       └── L1 cache (often shared with shared memory)
└── L2 cache (device-wide) → DRAM/HBM
```

**SIMT** (Single Instruction, Multiple Threads): one instruction stream drives a warp/wavefront; each thread has its own registers and thread ID but executes the same instruction in lockstep.

### 2. Warp vs wavefront

| Vendor | Unit size | Name |
|--------|-----------|------|
| NVIDIA | 32 threads | Warp |
| AMD | 64 threads | Wavefront |

Implications:
- Reduction trees: NVIDIA halves at 16→8→4→2→1; AMD at 32→16→8→4→2→1
- Block sizes: prefer multiples of 32 (NVIDIA) or 64 (AMD)
- Occupancy counters report active warps/wavefronts per SM

### 3. Warp divergence cost model

When threads in a warp take different branches, the hardware serializes paths:

```c
// Divergent: half warp does A, half does B → 2x instruction issue
if (threadIdx.x % 2 == 0) {
    result = expensive_a(data[idx]);
} else {
    result = expensive_b(data[idx]);
}

// Non-divergent: all threads same path
result = expensive_a(data[idx]);
```

Mitigations:
- **Predication**: compute both, select with `?:` (trade compute for uniformity)
- **Separate kernels** for different code paths
- **Branch only on block-level** data (uniform within warp)
- **Loop over bins** instead of `if (data[i] < threshold)` per thread with scattered outcomes

Divergence cost ≈ sum of paths taken (not max).

### 4. Global memory coalescing

NVIDIA coalescing rule (simplified): threads in a warp accessing consecutive 4-byte words → single 128-byte transaction.

```c
// Coalesced: consecutive threads → consecutive addresses
int idx = blockIdx.x * blockDim.x + threadIdx.x;
float val = data[idx];

// Uncoalesced: stride access
float val = data[threadIdx.x * stride];  // stride > 1

// Partially coalesced: misaligned start
float val = data[base + threadIdx.x * 3];
```

AoS vs SoA impact:

```c
// AoS — poor coalescing when reading one field
struct Particle { float x, y, z; };
float x = particles[i].x;  // threads read with stride 3

// SoA — coalesced
float x = pos_x[i];
```

### 5. Shared memory bank conflicts

Shared memory is divided into 32 banks (4-byte words). Simultaneous accesses to different addresses in the same bank serialize.

```c
__shared__ float tile[32][32];

// Bank conflict: all threads access tile[threadIdx.x][0]
// 32 threads, 32 banks, but column 0 → same bank per row offset
float val = tile[threadIdx.x][0];

// Fix: pad columns to break bank alignment
__shared__ float tile[32][33];  // +1 padding
```

Detection: Nsight Compute `l1tex__data_bank_conflicts_pipe_lsu_mem_shared_op_ld.sum` or NCU shared load conflict metrics.

### 6. L1/L2 cache behavior

| Level | Scope | Notes |
|-------|-------|-------|
| L1 | Per-SM | Often unified with shared mem; configurable split |
| L2 | Device-wide | Cache lines typically 128 bytes |
| Texture/L1 readonly | Per-SM | Cached read-only path for uniform access |

Cache-friendly patterns:
- **Spatial locality**: consecutive threads access consecutive memory
- **Temporal locality**: reuse data in shared memory before re-fetching global
- **Avoid random scatter**: atomic updates and pointer chasing defeat caches

```c
// Cache-friendly tile load
for (int t = 0; t < num_tiles; t++) {
    __shared__ float smem[TILE][TILE];
    smem[ty][tx] = global[row * N + t * TILE + tx];
    __syncthreads();
    // compute from smem — L1/L2 only hit on first load per tile
}
```

### 7. Atomics and memory ordering

GPU atomics (`atomicAdd`, `atomicCAS`, `atomicExch`) provide sequential consistency among threads targeting the same address, but high contention serializes execution.

```c
// Bad: all threads atomic to one counter
atomicAdd(&global_sum, local_val);

// Better: per-block reduction, one atomic per block
__shared__ float block_sum;
// ... warp reduce to block_sum ...
if (threadIdx.x == 0)
    atomicAdd(&global_sum, block_sum);
```

HIP/CUDA memory fences:

```c
__threadfence_block();  // visible to threads in same block
__threadfence();        // visible to all threads on device
__threadfence_system(); // visible to host (expensive)
```

### 8. Occupancy vs latency hiding

```
Occupancy tradeoff
├── High occupancy → more warps to hide memory latency
│   └── Costs: fewer registers/SM, less shared mem per block
└── Low occupancy + high ILP → enough independent instructions per warp
    └── Works for compute-bound kernels with deep pipelines
```

Decision tree:

```
Memory-bound kernel?
├── Yes → maximize active warps (occupancy), coalesce, tile with shared mem
└── No (compute-bound) → may lower occupancy if registers enable more ILP
```

```bash
# Measure achieved occupancy
ncu --metrics sm__warps_active.avg.pct_of_peak_sustained_active ./app
```

Rule of thumb: memory-bound kernels need occupancy ≥ 50%; compute-bound may run well at 25% with sufficient instruction-level parallelism.

### 9. Quick reference table

| Symptom | Likely cause | Check |
|---------|--------------|-------|
| Low DRAM throughput | Uncoalesced access | NCU memory workload analysis |
| Shared load stalls | Bank conflicts | Pad arrays; change access pattern |
| High stall: barrier | Missing `__syncthreads` or divergence at barrier | synccheck |
| Atomic bottleneck | Too many contended atomics | Hierarchical reduction |
| Low occupancy | Register/shared mem pressure | `launch__occupancy_limit_*` metrics |

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| 10x slower after SoA→AoS change | Strided coalescing broken | Keep hot fields in SoA layout |
| Tiled matmul slower than naive | Bank conflicts in shared tile | Pad shared array columns |
| Identical code, different perf NVIDIA vs AMD | Warp 32 vs wavefront 64 | Retune block size and reductions |
| Atomics correct but slow | Global contention | Block-level reduce first |
| High L2 hit but still slow | L2 bandwidth saturated | Reduce total bytes moved |

## Related Skills

- `skills/gpu/cuda` — practical kernel patterns using this model
- `skills/gpu/cuda-profiling` — metrics to validate coalescing and occupancy
- `skills/gpu/hip-rocm` — AMD wavefront-specific tuning
- `skills/low-level-programming/cpu-cache-opt` — CPU cache concepts (analogous)
- `skills/low-level-programming/simd-intrinsics` — vector width on CPU side
- `skills/profilers/hardware-counters` — general cache miss measurement