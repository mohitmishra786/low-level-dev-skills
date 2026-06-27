---
name: apple-silicon
description: Apple Silicon skill for M-series development and profiling. Use when leveraging unified memory, Metal Performance Shaders, Instruments profiling, sysctl hardware queries, Rosetta 2 behavior, or 16KB page size considerations. Activates on queries about Apple Silicon, unified memory, AMX, MPS, Instruments, Rosetta, or M-series page size.
---

# Apple Silicon

## Purpose

Guide agents through Apple Silicon (M-series) development: unified memory architecture, AMX matrix coprocessor access via Accelerate, Metal Performance Shaders for GPU compute, `sysctl` hardware queries, Instruments profiling, command-line leak tools, Rosetta 2 translation behavior, and 16KB page size implications.

## When to Use

- Optimizing native ARM64 apps on macOS for M1/M2/M3/M4
- Using GPU/NPU compute without discrete GPU PCIe transfers
- Profiling memory and CPU with Instruments or command-line tools
- Understanding Rosetta 2 compatibility for x86 binaries
- Adapting code for 16KB page size on Apple Silicon
- Accessing matrix acceleration via Accelerate/vDSP/BLAS

## Workflow

### 1. Unified memory architecture

```
Apple Silicon SoC
├── CPU cores (P + E cores)
├── GPU cores
├── Neural Engine (NPU)
└── Unified DRAM — single address space, no PCIe copy
```

Implications:
- `cudaMemcpy` equivalent is unnecessary for CPU↔GPU on Metal
- Memory bandwidth shared across agents — profile holistically
- Process memory includes all unified allocations

### 2. Hardware information

```bash
# CPU and chip info
sysctl -n machdep.cpu.brand_string
sysctl hw.physicalcpu hw.logicalcpu
sysctl hw.memsize

# ARM64 features (keys vary by chip — grep if specific FEAT_* is missing)
sysctl -a hw.optional.arm 2>/dev/null | grep -iE 'sve|bf16|mte'

# Cache line size
sysctl hw.cachelinesize

# Page size (16KB on macOS Apple Silicon)
sysctl hw.pagesize    # 16384
getconf PAGESIZE
```

### 3. 16KB page size considerations

macOS on Apple Silicon uses **16KB pages** (not 4KB):

```c
// Align hot buffers to page size
size_t page = sysconf(_SC_PAGESIZE);  // 16384
void *buf = aligned_alloc(page, size);

// mmap alignment must be page-aligned
mmap(NULL, size, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0);
```

Impact:
- `posix_memalign` minimum alignment often 16KB for large allocs
- JVM/Go runtimes auto-tune; custom allocators must adapt
- Test on device — x86 CI may use 4KB pages

### 4. AMX (Apple Matrix Coprocessor)

AMX is undocumented at ISA level; access through frameworks:

```c
// Accelerate framework — uses AMX internally for matrix ops
#include <Accelerate/Accelerate.h>

void matrix_multiply(const float *A, const float *B, float *C,
                     int M, int N, int K) {
    cblas_sgemm(CblasRowMajor, CblasNoTrans, CblasNoTrans,
                M, N, K, 1.0f, A, K, B, N, 0.0f, C, N);
}
```

```bash
# Link Accelerate (default on macOS)
clang -framework Accelerate -o gemm gemm.c -lcblas
```

For custom AMX kernels: study community reverse engineering or use Metal Performance Shaders as supported path.

### 5. Metal Performance Shaders (MPS)

```objc
// Objective-C / Swift — GPU compute via MPS
#import <Metal/Metal.h>
#import <MetalPerformanceShaders/MetalPerformanceShaders.h>

id<MTLDevice> device = MTLCreateSystemDefaultDevice();
id<MTLCommandQueue> queue = [device newCommandQueue];

MPSMatrixMultiplication *gemm = [[MPSMatrixMultiplication alloc]
    initWithDevice:device transposeLeft:NO transposeRight:NO
    resultRows:M columns:N interiorColumns:K alpha:1.0 beta:0.0];
```

Metal provides unified memory path to GPU — no explicit copy for buffers allocated with `MTLResourceStorageModeShared`.

### 6. Instruments profiling

```bash
# Command-line Instruments (xctrace)
xctrace record --template 'Time Profiler' --launch -- /path/to/app
xctrace record --template 'Allocations' --launch -- /path/to/app
xctrace record --template 'Leaks' --launch -- /path/to/app
xctrace export --input trace.trace --toc
```

| Template | Use |
|----------|-----|
| Time Profiler | CPU hotspots, P/E core usage |
| Allocations | Heap growth, allocation call trees |
| Leaks | Retained memory |
| System Trace | Thread scheduling, syscalls |

GUI: Xcode → Product → Profile (⌘I)

### 7. Command-line debugging tools

```bash
# Process memory map
vmmap <pid>

# Heap analysis
heap <pid>
heap <pid> -addresses all  # all allocations

# Leak detection
leaks <pid>
leaks --list <pid>

# Sample call stacks
sample <pid> 5 -file sample.txt
```

### 8. Rosetta 2 translation

```bash
# Check if process runs under Rosetta
sysctl sysctl.proc_translated   # 1 = translated x86

# Force arch
arch -arm64 ./native_binary
arch -x86_64 ./x86_binary

# Universal binary info
lipo -info myapp
file myapp
```

| Runs native ARM64 | Runs under Rosetta |
|-------------------|-------------------|
| ARM64 build | x86_64-only binary |
| `-arch arm64` compile | Downloaded Intel-only app |

Rosetta 2: translates x86_64 to ARM64 with JIT cache. AVX/AVX2 translated but may be slower. Not for kernel extensions or VM guests.

### 9. Memory tagging (ARM MTE)

Future Apple hardware may expose MTE — monitor via:

```bash
sysctl hw.optional.arm.FEAT_MTE  # when available
```

Prepare with pointer authentication already on ARM64e Apple platforms.

### 10. Build and perf tips

```bash
# Native optimized build
clang -arch arm64 -O3 -mcpu=apple-m1 -o app app.c
# Use -mcpu matching target: apple-m1, apple-m2, apple-m3, apple-m4

# P/E core awareness — dispatch heavy work to performance cores
# pthread_set_qos_class_self_np(QOS_CLASS_USER_INITIATED, 0);
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| mmap fails with EINVAL | 4KB alignment on 16KB system | Align to `sysconf(_SC_PAGESIZE)` |
| Slow x86 binary | Rosetta overhead | Ship universal or arm64-only build |
| Metal buffer nil | Simulator vs device | Test GPU on real hardware |
| Accelerate wrong results | Row/column major mismatch | Check BLAS leading dimensions |
| Instruments empty trace | Sandbox/permissions | Run from Xcode or sign app |
| sysctl not found | Wrong key name | `sysctl -a | grep -i feat` |

## Related Skills

- `skills/low-level-programming/assembly-arm` — Darwin ABI, AArch64
- `skills/platform/arm-sve` — SVE2 on M4+
- `skills/gpu/cuda` — NVIDIA not on Apple Silicon; use Metal instead
- `skills/profilers/heaptrack` — cross-platform heap profiling concepts
- `skills/compilers/clang` — Apple Clang flags
- `skills/low-level-programming/cpu-cache-opt` — cache optimization on unified memory