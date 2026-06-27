---
name: cuda
description: CUDA C/C++ skill for NVIDIA GPU kernel programming. Use when writing CUDA kernels, managing thread/block/grid hierarchy, optimizing memory access patterns, using streams and async copies, configuring nvcc flags, or integrating Thrust. Activates on queries about CUDA kernels, nvcc, shared memory, warp divergence, occupancy, or Thrust.
---

# CUDA

## Purpose

Guide agents through NVIDIA CUDA C/C++ development: kernel launch configuration, the memory hierarchy from registers through global memory, asynchronous execution with streams, nvcc compilation flags, Thrust library usage, and diagnosing common performance pitfalls like warp divergence and uncoalesced memory access.

## When to Use

- Writing or optimizing a CUDA kernel for matrix multiply, reduction, or stencil operations
- Choosing block/grid dimensions and estimating occupancy
- Debugging slow kernels due to memory access patterns or low occupancy
- Setting up multi-stream pipelines with async `cudaMemcpyAsync`
- Compiling with nvcc and selecting architecture flags (`-gencode`)
- Using Thrust for parallel primitives instead of hand-written kernels

## Workflow

### 1. Minimal kernel and launch

CUDA organizes work as threads grouped into blocks, blocks grouped into a grid.

```
Thread hierarchy
├── grid (1D/2D/3D)
│   └── block (1D/2D/3D, max 1024 threads)
│       └── thread (threadIdx, blockIdx, blockDim, gridDim)
```

```c
// vector_add.cu
#include <cuda_runtime.h>
#include <stdio.h>

__global__ void vector_add(const float *a, const float *b, float *c, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n)
        c[i] = a[i] + b[i];
}

int main(void) {
    const int n = 1 << 20;
    size_t bytes = n * sizeof(float);
    float *h_a, *h_b, *h_c, *d_a, *d_b, *d_c;

    cudaMalloc(&d_a, bytes);
    cudaMalloc(&d_b, bytes);
    cudaMalloc(&d_c, bytes);
    // ... host init and cudaMemcpy H2D ...

    int threads = 256;
    int blocks = (n + threads - 1) / threads;
    vector_add<<<blocks, threads>>>(d_a, d_b, d_c, n);
    cudaDeviceSynchronize();

    cudaMemcpy(h_c, d_c, bytes, cudaMemcpyDeviceToHost);
    cudaFree(d_a); cudaFree(d_b); cudaFree(d_c);
    return 0;
}
```

### 2. Memory hierarchy

| Memory | Scope | Latency | Typical use |
|--------|-------|---------|-------------|
| Registers | Per-thread | ~1 cycle | Local scalars, loop indices |
| Shared (`__shared__`) | Per-block | ~5 cycles | Tile data, halo exchange |
| Global | All threads | ~400+ cycles | Large arrays, coalesced access |
| Constant (`__constant__`) | Read-only, cached | Fast broadcast | Kernel parameters, lookup tables |
| Texture | Cached 2D access | Cached | Image sampling, irregular reads |

Shared memory example (matrix tile):

```c
#define TILE 16

__global__ void matmul_tiled(const float *A, const float *B, float *C, int N) {
    __shared__ float As[TILE][TILE];
    __shared__ float Bs[TILE][TILE];

    int row = blockIdx.y * TILE + threadIdx.y;
    int col = blockIdx.x * TILE + threadIdx.x;
    float sum = 0.0f;

    for (int t = 0; t < (N + TILE - 1) / TILE; t++) {
        As[threadIdx.y][threadIdx.x] = (row < N && t * TILE + threadIdx.x < N)
            ? A[row * N + t * TILE + threadIdx.x] : 0.0f;
        Bs[threadIdx.y][threadIdx.x] = (col < N && t * TILE + threadIdx.y < N)
            ? B[(t * TILE + threadIdx.y) * N + col] : 0.0f;
        __syncthreads();

        for (int k = 0; k < TILE; k++)
            sum += As[threadIdx.y][k] * Bs[k][threadIdx.x];
        __syncthreads();
    }
    if (row < N && col < N)
        C[row * N + col] = sum;
}
```

### 3. Streams and async copies

```c
cudaStream_t stream1, stream2;
cudaStreamCreate(&stream1);
cudaStreamCreate(&stream2);

cudaMemcpyAsync(d_a, h_a, bytes, cudaMemcpyHostToDevice, stream1);
cudaMemcpyAsync(d_b, h_b, bytes, cudaMemcpyHostToDevice, stream2);
vector_add<<<blocks, threads, 0, stream1>>>(d_a, d_b, d_c, n);
cudaMemcpyAsync(h_c, d_c, bytes, cudaMemcpyDeviceToHost, stream1);
cudaStreamSynchronize(stream1);
```

Pinned host memory (`cudaMallocHost`) enables true async DMA overlap with kernel execution.

### 4. nvcc compilation

```bash
# Single architecture (local GPU)
nvcc -O3 -arch=sm_80 -o prog vector_add.cu

# Fat binary for multiple GPUs
nvcc -O3 \
  -gencode arch=compute_80,code=sm_80 \
  -gencode arch=compute_90,code=sm_90 \
  -o prog vector_add.cu

# Debug symbols for cuda-gdb
nvcc -G -g -O0 -arch=sm_80 -o prog_debug vector_add.cu

# Show PTX/SASS
nvcc -arch=sm_80 -ptx vector_add.cu
nvcc -arch=sm_80 -cubin vector_add.cu
cuobjdump -sass prog
```

Common flags:

| Flag | Effect |
|------|--------|
| `-O3` | Aggressive optimization |
| `-G` | Disable optimizations for debugging |
| `-lineinfo` | Source-line correlation in profiles |
| `-Xcompiler -fopenmp` | Host-side OpenMP with CUDA |
| `--use_fast_math` | Faster, less precise math intrinsics |
| `-maxrregcount=N` | Cap registers to raise occupancy |

### 5. Occupancy estimation

```bash
# CUDA Occupancy Calculator (spreadsheet) or programmatic:
./occupancy_tool --kernel vector_add --block-size 256 --regs 16 --smem 0
```

Decision tree:

```
Kernel slow?
├── Low occupancy (< 25%) → reduce registers, shared mem, or block size
├── Memory-bound → check coalescing, use shared memory tiling
└── Compute-bound → increase arithmetic intensity, use tensor cores
```

Use `cudaOccupancyMaxActiveBlocksPerMultiprocessor` API or Nsight Compute `sm__warps_active.avg.pct_of_peak_sustained_active` metric.

### 6. Thrust basics

```cpp
#include <thrust/device_vector.h>
#include <thrust/sort.h>
#include <thrust/reduce.h>

thrust::device_vector<int> d_vec(1000000);
thrust::sort(d_vec.begin(), d_vec.end());
int sum = thrust::reduce(d_vec.begin(), d_vec.end());
```

Thrust handles temporary storage and kernel launches internally. Prefer Thrust for sort/scan/reduce; write custom kernels for domain-specific fused operations.

### 7. Common pitfalls

**Warp divergence**: Threads in a warp (32) execute in SIMT lockstep. Branching on `threadIdx` causes serialization.

```c
// Bad: divergent branch
if (threadIdx.x % 2 == 0) { heavy_a(); } else { heavy_b(); }

// Better: separate kernels or predication
```

**Uncoalesced access**: Consecutive threads should access consecutive addresses.

```c
// Bad: strided access
float val = data[threadIdx.x * stride];

// Good: coalesced
float val = data[blockIdx.x * blockDim.x + threadIdx.x];
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `cudaErrorIllegalAddress` (700) | Out-of-bounds device pointer | Run `compute-sanitizer --tool memcheck`; add bounds checks |
| `cudaErrorLaunchTimeout` (702) | Kernel exceeds watchdog limit | Reduce work; split kernel; disable TDR on dev GPU |
| Low occupancy warning | Too many registers or shared mem | Reduce `__shared__` size; `-maxrregcount`; smaller blocks |
| Correctness differs CPU vs GPU | Race on shared/global mem | Add `__syncthreads()`; use atomics for reductions |
| `no kernel image available` | Wrong `-arch=sm_XX` | Match GPU compute capability: `nvidia-smi --query-gpu=compute_cap` |
| Slow H2D/D2H copies | Pageable host memory | Use `cudaMallocHost` for pinned buffers |

## Related Skills

- `skills/gpu/cuda-profiling` — Nsight Systems/Compute for kernel performance diagnosis
- `skills/gpu/cuda-debugging` — cuda-gdb and compute-sanitizer for correctness
- `skills/gpu/gpu-memory-model` — SIMT execution, coalescing rules, bank conflicts
- `skills/gpu/hip-rocm` — porting CUDA kernels to AMD HIP
- `skills/gpu/triton-lang` — Python DSL alternative for custom kernels
- `skills/hpc/openmp` — host-side parallelism alongside CUDA