---
name: cuda-tile
description: CUDA Tile skill for tile-based GPU kernels with cuTile Python and the CUDA Tile C++ API. Use when writing cuTile kernels with ct.load/ct.store/ct.mma, compiling C++ tile kernels with nvcc --enable-tile, exporting Tile IR or cubins ahead of time, choosing between tiles, SIMT CUDA and Triton, or debugging tileiras errors. Activates on queries about CUDA Tile, cuTile, cuda.tile, Tile IR, tileiras, __tile_global__, cuda::tiles, partition_view, ct.kernel, or ct.launch.
---

# CUDA Tile

## Purpose

Guide agents through NVIDIA's tile programming model (checked with CUDA 13.5 and cuda-tile 1.8.1): cuTile Python kernels, the C++ Tile API, ahead-of-time export, and when tiles are the right tool.

## Triggers

- "How do I write a kernel with cuTile Python?"
- "What is CUDA Tile / Tile IR and how is it different from SIMT CUDA?"
- "How do I compile a C++ tile kernel with nvcc?"
- "Can I compile a cuTile kernel to a cubin without a GPU?"
- "Should I use cuTile or Triton?"
- "Which GPUs support CUDA Tile?"

## Workflow

### 1. The model

In SIMT CUDA you write one thread's work and manage threads, warps and shared memory. In
CUDA Tile you write one *block's* work on whole tiles (small arrays); the compiler maps tiles to
threads, tensor cores, TMA and shared memory.

| | SIMT CUDA | CUDA Tile |
|-|-----------|-----------|
| Unit of code | One thread | One block, operating on tiles |
| Memory movement | Manual (shared memory, `__syncthreads`) | `load`/`store` of tiles; compiler stages data |
| Tensor cores | `wmma`/`mma` PTX or CUTLASS | `ct.mma` / `ct::mma` on tiles |
| IR | PTX | Tile IR (bytecode), lowered by `tileiras` |
| Hardware | All supported GPUs | Compute capability 8.0+ (Ampere and newer) |

```text
New GPU kernel?
├── Dense tensor math (GEMM, attention, reductions) → CUDA Tile or Triton
├── Irregular control flow, per-thread logic, atomics everywhere → SIMT CUDA
├── Python stack, want NVIDIA's own compiler and Tile IR → cuTile Python
├── Existing C++/CUDA codebase → CUDA Tile C++ (nvcc --enable-tile)
└── Need AMD/Intel portability → Triton (also has a Tile IR backend for NVIDIA)
```

### 2. cuTile Python

```bash
pip install cuda-tile               # with a CUDA Toolkit installed (see table below)
pip install "cuda-tile[tileiras]"   # no toolkit: pulls tileiras, nvcc and NVVM wheels
pip install cupy-cuda13x            # device arrays for the examples (not a cuda-tile dependency)
# Needs driver r580+, Linux x86_64/aarch64 or Windows x86_64, Python 3.11+
```

| GPU generation | Minimum toolkit / tileiras for Tile |
|----------------|-------------------------------------|
| Blackwell (`sm_100`, `sm_120`) | 13.1 |
| Ampere, Ada (`sm_80`, `sm_86`, `sm_89`) | 13.2 (FP8 on Ada: 13.5) |
| Hopper (`sm_90`) | 13.3 |

```python
import cupy as cp
import cuda.tile as ct

TILE = 1024


@ct.kernel
def vector_add(a, b, c, tile: ct.Constant[int]):
    pid = ct.bid(0)                                   # this block's index along axis 0
    ta = ct.load(a, index=(pid,), shape=(tile,))      # load one tile from each input
    tb = ct.load(b, index=(pid,), shape=(tile,))
    ct.store(c, index=(pid,), tile=ta + tb)          # element-wise add, store the tile


n = 1 << 20
a = cp.random.rand(n, dtype=cp.float32)
b = cp.random.rand(n, dtype=cp.float32)
c = cp.empty_like(a)

grid = (ct.cdiv(n, TILE), 1, 1)                       # one block per tile
ct.launch(cp.cuda.get_current_stream(), grid, vector_add, (a, b, c, TILE))
assert cp.allclose(c, a + b)
```

- `index` is in tile units: `index=(pid,)` with `shape=(1024,)` covers elements `pid*1024 ... pid*1024+1023`.
- `ct.Constant[int]` parameters are compile-time constants; each distinct value compiles a new variant.
- Arrays are device arrays such as CuPy's (as in NVIDIA's quickstart); the runtime looks for
  `__cuda_array_interface__` / `__dlpack__`.

### 3. Matrix multiply with tensor cores

```python
@ct.kernel
def matmul(A, B, C, tm: ct.Constant[int], tn: ct.Constant[int], tk: ct.Constant[int]):
    bm, bn = ct.bid(0), ct.bid(1)                     # output tile coordinates
    acc = ct.full((tm, tn), 0, dtype=ct.float32)      # fp32 accumulator tile
    for k in range(ct.cdiv(A.shape[1], tk)):
        # Zero-pad the partial last K tile so out-of-range elements add nothing
        a = ct.load(A, index=(bm, k), shape=(tm, tk), padding_mode=ct.PaddingMode.ZERO)
        b = ct.load(B, index=(k, bn), shape=(tk, tn), padding_mode=ct.PaddingMode.ZERO)
        acc = ct.mma(a, b, acc)                       # tensor-core multiply-accumulate
    ct.store(C, index=(bm, bn), tile=ct.astype(acc, C.dtype))

# fp16 inputs, 128x128 output tiles, K step 64
grid = (ct.cdiv(M, 128), ct.cdiv(N, 128), 1)
ct.launch(cp.cuda.get_current_stream(), grid, matmul, (A, B, C, 128, 128, 64))
```

Other tile operations: `ct.sum`, `ct.max`, `ct.exp`, `ct.where`, `ct.matmul`, `ct.zeros`,
`ct.astype`, `ct.num_blocks(axis)`. Tile dimensions must be powers of two
(`Dimension #0 of shape (1000,) is not a power of two`).

### 4. Ahead-of-time export (no GPU needed)

```python
import cuda.tile as ct
from cuda.tile.compilation import (ArrayConstraint, ConstantConstraint, KernelSignature,
                                   CallingConvention, export_kernel)

def f32_1d():
    return ArrayConstraint(ct.float32, 1, index_dtype=ct.int32, stride_lower_bound_incl=0,
                           alias_groups=(), may_alias_internally=False)

sig = KernelSignature([f32_1d(), f32_1d(), f32_1d(), ConstantConstraint(1024)],
                      CallingConvention.cutile_python_v1())

# Portable Tile IR bytecode (no gpu_code) needs bytecode version 13.3+, i.e. a 13.3+ toolkit;
# with 13.1/13.2, export a cubin for a specific target instead
export_kernel(vector_add, [sig], "vector_add.tilebc", output_format="tileir_bytecode")
export_kernel(vector_add, [sig], "vector_add_sm100.cubin", gpu_code="sm_100", output_format="cubin")
```

`gpu_code` accepts `sm_80` and newer; exporting for `sm_75` fails in `tileiras`. The bytecode
can be lowered later with `tileiras --gpu-name=sm_120 file.tilebc -o file.cubin` and
inspected with `tileirdisasm file.tilebc`.

### 5. CUDA Tile C++ (CUDA 13.3+)

```cpp
// vadd_tile.cu — one block processes one 1024-element tile
#include <cstdio>
#include "cuda_tile.h"

__tile_global__ void vectorAdd(float* __restrict__ a, float* __restrict__ b,
                               float* __restrict__ out, std::size_t n)
{
    namespace ct = cuda::tiles;
    using namespace ct::literals;

    a = assume_aligned(a, 16_ic);            // lets the compiler use vector loads
    b = assume_aligned(b, 16_ic);
    out = assume_aligned(out, 16_ic);

    auto idx = ct::bid().x;                  // tile index = block index

    // View each array as a sequence of 1024-element tiles
    auto view_a = ct::partition_view{ct::tensor_span{a, ct::extents{n}}, ct::shape{1024_ic}};
    auto view_b = ct::partition_view{ct::tensor_span{b, ct::extents{n}}, ct::shape{1024_ic}};
    auto view_out = ct::partition_view{ct::tensor_span{out, ct::extents{n}}, ct::shape{1024_ic}};

    auto tile_a = view_a.load_masked(idx);   // masked: the last tile may be partial
    auto tile_b = view_b.load_masked(idx);
    view_out.store_masked(tile_a + tile_b, idx);
}

int main()
{
    const std::size_t n = 1 << 20;
    float *a, *b, *out;
    if (cudaMallocManaged(&a, n * sizeof(float)) != cudaSuccess ||
        cudaMallocManaged(&b, n * sizeof(float)) != cudaSuccess ||
        cudaMallocManaged(&out, n * sizeof(float)) != cudaSuccess) {
        fprintf(stderr, "no usable GPU\n");
        return 1;
    }
    for (std::size_t i = 0; i < n; i++) { a[i] = 1.0f; b[i] = 2.0f; }

    unsigned tiles = (n + 1023) / 1024;
    vectorAdd<<<tiles, 1>>>(a, b, out, n);   // tile kernels launch with a block size of 1
    cudaError_t err = cudaDeviceSynchronize();
    if (err != cudaSuccess) {
        fprintf(stderr, "kernel failed: %s\n", cudaGetErrorString(err));
        return 1;
    }
    printf("out[0]=%f\n", out[0]);
    return 0;
}
```

```bash
# Set -arch to your GPU: sm_80 (Ampere), sm_90 (Hopper), sm_100 / sm_120 (Blackwell)
nvcc -std=c++20 --enable-tile -arch=sm_100 -o vadd vadd_tile.cu
# Without --enable-tile: error: calling a __tile__ function ... from a __host__ function is not allowed
```

- `__tile_global__` marks a tile kernel; `_ic` literals are compile-time integers (tile shapes).
- `partition_view` splits a `tensor_span` into tiles; `load`/`store` take tile indices.
- 13.5 adds `ct::scaled_mma()` (block-scaled MMA) and `return` inside loops in tile code.

### 6. Debugging and profiling

```bash
# Print the Tile IR that cuTile generates (needs CUDA 13.4+)
CUDA_TILE_LOGS=TILEIR python app.py

# Write Tile IR (MLIR text) for each compiled kernel to a directory
CUDA_TILE_DUMP_TILEIR=/tmp/tileir python app.py

# Nsight Compute: the Details page has a "Tile Statistics" section for tile kernels
ncu --set full -o tile_report python app.py
```

| Symptom | Cause | Fix |
|---------|-------|-----|
| `TileCompilerExecutionError` when exporting or launching | `tileiras` rejected the target or the kernel | Use `sm_80`+; read the stderr from `tileiras` in the exception |
| `tileiras` not found | No CUDA 13.1+ toolkit on PATH | `pip install "cuda-tile[tileiras]"` or install the toolkit |
| C++ errors about `__tile__` from `__host__` | Missing `--enable-tile` | `nvcc -std=c++20 --enable-tile` |
| Many recompiles | A `ct.Constant` parameter takes many values | Make it a runtime argument, or bucket the values |
| Wrong results at array edges | Unmasked access on a partial tile | C++: `load_masked`/`store_masked`; Python: pad or use a size that is a multiple of the tile |

## Related skills

- Use `skills/gpu/cuda` for SIMT CUDA, nvcc targets and CUDA 13 architecture support
- Use `skills/gpu/triton-lang` for Triton, the main alternative tile DSL
- Use `skills/gpu/cuda-profiling` for Nsight Compute and Nsight Systems
- Use `skills/gpu/gpu-memory-model` for the memory hierarchy tiles map onto
