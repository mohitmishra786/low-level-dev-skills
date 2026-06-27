---
name: cuda-debugging
description: CUDA debugging skill for GPU program correctness. Use when debugging with cuda-gdb, running NVIDIA Compute Sanitizer memcheck/racecheck, analyzing GPU core dumps, or interpreting CUDA error codes 700/702. Activates on queries about cuda-gdb, compute-sanitizer, illegal memory access, launch timeout, or device printf.
---

# CUDA Debugging

## Purpose

Guide agents through debugging CUDA programs with cuda-gdb for interactive GPU thread inspection, NVIDIA Compute Sanitizer for automated memory and race detection, GPU core dump analysis, device-side `printf`, and triaging common CUDA runtime error codes.

## When to Use

- `cudaErrorIllegalAddress` (700) or segmentation fault on device
- Intermittent correctness failures in multi-threaded GPU code
- Debugging race conditions between warps or between host and device
- Stepping through kernel code line-by-line with cuda-gdb
- Validating uninitialized memory reads with initcheck
- Kernel hang or `cudaErrorLaunchTimeout` (702)

## Workflow

### 1. Build for debugging

```bash
# Debug build — disables optimizations, enables device debug
nvcc -G -g -O0 -arch=sm_80 -o app_debug main.cu

# Sanitizer-friendly build (lineinfo helps reports)
nvcc -lineinfo -g -O2 -arch=sm_80 -o app_san main.cu
```

`-G` is required for cuda-gdb source-level stepping. Sanitizers work with optimized builds but `-G` gives clearer line numbers.

### 2. Compute Sanitizer — automated checks

```bash
# Memory errors (OOB, misaligned, leak)
compute-sanitizer --tool memcheck ./app_san

# Shared memory and global memory races
compute-sanitizer --tool racecheck ./app_san

# Uninitialized memory reads
compute-sanitizer --tool initcheck ./app_san

# Synchronization errors (missing __syncthreads)
compute-sanitizer --tool synccheck ./app_san

# Verbose with source correlation
compute-sanitizer --tool memcheck --show-reachable=yes --log-file san.log ./app_san
```

Typical memcheck output:

```
======== Invalid __global__ write of size 4
========     at 0x1a0 in vector_add(vector_add.cu:12)
========     by thread (0,0,0) in block (0,0,0)
======== Address 0x7f... is out of bounds
```

### 3. cuda-gdb interactive session

```bash
# Launch under cuda-gdb
cuda-gdb ./app_debug

# Or attach to running process
cuda-gdb -p <pid>
```

Essential commands:

```gdb
# Break at kernel entry
(cuda-gdb) break vector_add
(cuda-gdb) run

# Focus on GPU threads
(cuda-gdb) info cuda kernels
(cuda-gdb) cuda kernel 0
(cuda-gdb) cuda thread (0,0,0)   # block (x,y,z), thread (x,y,z)

# Inspect device memory
(cuda-gdb) print data[i]
(cuda-gdb) x/10f d_ptr

# Step in kernel
(cuda-gdb) cuda step
(cuda-gdb) cuda next

# All threads in block
(cuda-gdb) info cuda threads
(cuda-gdb) cuda thread (0,0,5)
```

### 4. Device printf

```c
__global__ void debug_kernel(float *data, int n) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i < n) {
        if (i < 5)  // limit output
            printf("thread %d: data[%d] = %f\n", i, i, data[i]);
        data[i] *= 2.0f;
    }
}
```

```bash
# Buffer size for printf (default may truncate)
cuda-gdb) set cuda printf_buffer_size 16777216
```

Flush with `cudaDeviceSynchronize()` before checking output. Excessive printf from all threads will overwhelm the buffer.

### 5. Error code triage

| Code | Name | Common cause |
|------|------|--------------|
| 700 | `cudaErrorIllegalAddress` | OOB access, use-after-free, bad pointer |
| 701 | `cudaErrorLaunchOutOfResources` | Too much shared mem or registers per block |
| 702 | `cudaErrorLaunchTimeout` | Infinite loop, TDR watchdog (Windows/default Linux) |
| 719 | `cudaErrorLaunchFailure` | Assert in kernel, stack overflow |

```c
// Always check after launch
kernel<<<grid, block>>>(args);
cudaError_t err = cudaGetLastError();
if (err != cudaSuccess)
    fprintf(stderr, "launch: %s\n", cudaGetErrorString(err));
cudaDeviceSynchronize();
err = cudaGetLastError();
if (err != cudaSuccess)
    fprintf(stderr, "exec: %s\n", cudaGetErrorString(err));
```

### 6. GPU core dumps

```bash
# Enable coredump (driver 450+)
export CUDA_ENABLE_COREDUMP_ON_EXCEPTION=1
export CUDA_COREDUMP_FILE=/tmp/cuda_coredump_%h.%p

./app_san   # crash generates dump

# Analyze with cuda-gdb
cuda-gdb ./app_san /tmp/cuda_coredump_hostname.pid
(cuda-gdb) cuda coredump load /tmp/cuda_coredump_hostname.pid
(cuda-gdb) bt
(cuda-gdb) info cuda kernels
```

### 7. Debugging decision tree

```
Crash or wrong results?
├── Consistent wrong values → logic bug; use printf or cuda-gdb
├── Intermittent / depends on size → OOB or race
│   ├── compute-sanitizer --tool memcheck
│   └── compute-sanitizer --tool racecheck
├── Hang / timeout 702 → infinite loop or barrier mismatch
│   └── synccheck; audit __syncthreads paths
└── Works in debug (-G), fails in release → uninitialized mem or race
    └── initcheck + racecheck on release build
```

### 8. Multi-GPU and MIG notes

```bash
# Isolate GPU
CUDA_VISIBLE_DEVICES=0 compute-sanitizer --tool memcheck ./app

# MIG instances appear as separate devices
nvidia-smi -L
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| cuda-gdb can't break in kernel | Built without `-G` | Rebuild with `nvcc -G -g -O0` |
| Sanitizer reports no errors but crash persists | Async error delayed | Add `cudaDeviceSynchronize()` after kernel |
| `printf` shows nothing | Buffer full or no sync | Limit prints; increase buffer; sync |
| racecheck false positive on atomics | Non-atomic RMW | Use `atomicAdd`/`atomicCAS` |
| Attach fails | Process not in CUDA context | Break after first `cudaMalloc` |
| TDR timeout on Windows | Long-running kernel | Split kernel; `cudaDeviceSetLimit` or regedit TDR |

## Related Skills

- `skills/gpu/cuda` — kernel patterns, memory hierarchy, launch config
- `skills/gpu/cuda-profiling` — performance after correctness is verified
- `skills/gpu/gpu-memory-model` — understanding races and coalescing
- `skills/debuggers/gdb` — host-side GDB commands shared with cuda-gdb
- `skills/runtimes/sanitizers` — ASan/TSan concepts for host code
- `skills/kernel/kernel-debugging` — kgdb/kprobes for driver-level issues