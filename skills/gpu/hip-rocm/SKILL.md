---
name: hip-rocm
description: HIP and ROCm skill for AMD GPU programming. Use when writing HIP kernels with hipcc, porting CUDA code via HIPIFY, profiling with rocprof, debugging with rocgdb, or optimizing for MI300X. Activates on queries about HIP, ROCm, hipify, hipcc, rocprof, or CUDA to AMD porting.
---

# HIP / ROCm

## Purpose

Guide agents through AMD GPU programming with HIP: the HIP runtime API, `hipcc` compilation, porting CUDA code with HIPIFY (`hipify-perl`, `hipify-clang`), ROCm toolchain setup, profiling with `rocprof`, debugging with `rocgdb`, HIP-vs-CUDA API mapping, and MI300X-specific optimizations.

## When to Use

- Porting an existing CUDA codebase to AMD GPUs
- Setting up ROCm on Linux for MI200/MI300 hardware
- Writing native HIP kernels for AMD data center GPUs
- Profiling HIP applications with rocprof or rocprofiler-sdk
- Debugging device faults with rocgdb or compute sanitizers
- Building multi-vendor GPU code with HIP portability macros

## Workflow

### 1. ROCm installation and verification

```bash
# Ubuntu/Debian (check ROCm docs for your distro version)
sudo apt install rocm-dev rocm-libs hip-dev

# Verify
rocminfo | head -30
hipconfig --version
hipcc --version

# List devices
rocm-smi
```

Set GPU target for compilation:

```bash
export AMDGPU_TARGETS=gfx942   # MI300X
export HIP_PLATFORM=amd
```

### 2. Minimal HIP kernel

```cpp
// vector_add.hip
#include <hip/hip_runtime.h>
#include <stdio.h>

__global__ void vector_add(const float *a, const float *b, float *c, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n)
        c[i] = a[i] + b[i];
}

int main(void) {
    const int n = 1 << 20;
    size_t bytes = n * sizeof(float);
    float *d_a, *d_b, *d_c;

    hipMalloc(&d_a, bytes);
    hipMalloc(&d_b, bytes);
    hipMalloc(&d_c, bytes);

    int threads = 256;
    int blocks = (n + threads - 1) / threads;
    hipLaunchKernelGGL(vector_add, dim3(blocks), dim3(threads), 0, 0,
                       d_a, d_b, d_c, n);
    hipDeviceSynchronize();

    hipFree(d_a); hipFree(d_b); hipFree(d_c);
    return 0;
}
```

```bash
hipcc -O3 --offload-arch=gfx942 -o vector_add vector_add.hip
./vector_add
```

### 3. CUDA → HIP porting with HIPIFY

```bash
# Perl-based batch converter (quick port)
hipify-perl cuda_kernel.cu > cuda_kernel.hip

# Clang-based (more accurate, preserves structure)
hipify-clang cuda_project/ -o hip_project/ --cuda-path=/usr/local/cuda

# Convert single file in place
hipify-clang -inplace --cuda-path=/usr/local/cuda main.cu
```

Common API mappings:

| CUDA | HIP |
|------|-----|
| `cudaMalloc` | `hipMalloc` |
| `cudaMemcpy` | `hipMemcpy` |
| `cudaMemcpyAsync` | `hipMemcpyAsync` |
| `cudaStream_t` | `hipStream_t` |
| `<<<grid, block>>>` | `hipLaunchKernelGGL` or `<<<>>>` (HIP supports CUDA syntax) |
| `__syncthreads()` | `__syncthreads()` (same) |
| `threadIdx` / `blockIdx` | Same builtins |

Portability header for dual compilation:

```cpp
#ifdef __HIP_PLATFORM_AMD__
#include <hip/hip_runtime.h>
#else
#include <cuda_runtime.h>
#define hipMalloc cudaMalloc
#define hipMemcpy cudaMemcpy
// ... more macros
#endif
```

### 4. hipcc flags

```bash
# Target specific GPU architecture
hipcc --offload-arch=gfx942 -O3 -o app main.hip

# Multiple architectures
hipcc --offload-arch=gfx90a --offload-arch=gfx942 -o app main.hip

# Debug
hipcc -g -O0 --offload-arch=gfx942 -o app_debug main.hip

# Link with rocBLAS
hipcc -lrocblas -o app main.hip
```

### 5. rocprof profiling

```bash
# Basic kernel trace
rocprof --stats ./app

# CSV metrics output
rocprof -i input.csv -o output.csv ./app

# input.csv example:
# pmc: SQ_INSTS_VALU_ADD_F32,SQ_INSTS_VALU_MUL_F32,GRBM_COUNT
```

```bash
# ROCm 6.x rocprofiler-sdk (preferred for new projects)
rocprofv3 --kernel-trace -- ./app
```

Key metrics (AMD terminology):
- **VALU utilization** — compute unit activity
- **LDS bank conflicts** — shared memory (LDS) stalls
- **Memory throughput** — HBM bandwidth utilization

### 6. rocgdb debugging

```bash
# Build with debug symbols
hipcc -g -O0 --offload-arch=gfx942 -o app_debug main.hip

rocgdb ./app_debug
```

```gdb
(rocgdb) break vector_add
(rocgdb) run
(rocgdb) info rocm kernels
(rocgdb) rocm thread 0 0 0
(rocgdb) print i
```

AMD also supports `compute-sanitizer` equivalents via ROCm's `roc-obj-extract` and memory checking tools where available.

### 7. MI300X optimizations

```bash
# Enable MFMA (matrix fused multiply-add) instructions
hipcc --offload-arch=gfx942 -munsafe-fp-atomics -O3 -o app main.hip
```

| Optimization | MI300X note |
|--------------|-------------|
| Matrix ops | Use rocBLAS/hipBLASLt for GEMM; MFMA intrinsics for custom |
| HBM bandwidth | ~5.3 TB/s peak (MI300X) — maximize memory coalescing to approach it |
| Wavefront size | 64 threads (vs CUDA warp 32) — adjust reduction patterns |
| LDS (shared mem) | 64 KB per CU; watch bank conflicts |

Wavefront-aware reduction:

```cpp
__device__ float warp_reduce_sum(float val) {
    // AMD wavefront = 64 lanes
    for (int offset = 32; offset > 0; offset >>= 1)
        val += __shfl_down(val, offset);
    return val;
}
```

### 8. Library ecosystem

| NVIDIA | AMD ROCm |
|--------|----------|
| cuBLAS | rocBLAS / hipBLAS |
| cuDNN | MIOpen |
| NCCL | rccl |
| Thrust | hipCUB (portable) |
| cuFFT | rocFFT |

```bash
hipcc -lrocblas -o gemm_test gemm.hip
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `hipErrorNoDevice` | ROCm driver not loaded | Check `rocm-smi`; add user to `render` group |
| Wrong architecture binary | Mismatched `gfx*` target | `rocminfo` → set `--offload-arch` |
| hipify incomplete port | CUDA-specific APIs | Manual fix: cooperative groups, texture refs |
| Slower than CUDA reference | Wavefront 64 vs warp 32 | Tune block size to multiples of 64 |
| `HSA_STATUS_ERROR` | GPU busy or OOM | `rocm-smi --showmeminfo`; reduce allocation |
| rocprof empty output | No kernels launched | Verify `hipGetLastError()` after launch |

## Related Skills

- `skills/gpu/cuda` — source CUDA patterns being ported
- `skills/gpu/cuda-profiling` — Nsight concepts map to rocprof
- `skills/gpu/gpu-memory-model` — wavefront vs warp, coalescing rules
- `skills/gpu/triton-lang` — Triton supports AMD via ROCm backend
- `skills/compilers/llvm` — HIP uses Clang/LLVM toolchain