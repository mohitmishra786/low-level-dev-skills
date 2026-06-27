---
name: triton-lang
description: Triton language skill for Python GPU kernel authoring. Use when writing Triton kernels with @triton.jit, tl.load/store, masking, atomics, benchmarking with triton.testing, or integrating kernels into PyTorch. Activates on queries about Triton, tl.constexpr, block pointers, Triton benchmarking, or PyTorch custom ops.
---

# Triton

## Purpose

Guide agents through writing GPU kernels in OpenAI Triton: the `@triton.jit` decorator, block-oriented `tl.load`/`tl.store` with masking, atomic operations, shared memory via `tl.constexpr`, benchmarking with `triton.testing.Benchmark`, PyTorch integration, and debugging with barriers.

## When to Use

- Writing custom PyTorch ops faster than pure PyTorch but without raw CUDA
- Prototyping fused kernels (e.g., softmax + scale + bias)
- Comparing block sizes and warp counts with Triton's autotuner
- Porting NumPy-style elementwise ops to GPU
- Learning GPU programming with higher-level Python syntax
- Benchmarking kernel variants systematically

## Workflow

### 1. Minimal Triton kernel

```python
import torch
import triton
import triton.language as tl

@triton.jit
def add_kernel(x_ptr, y_ptr, out_ptr, n, BLOCK: tl.constexpr):
    pid = tl.program_id(0)
    offsets = pid * BLOCK + tl.arange(0, BLOCK)
    mask = offsets < n
    x = tl.load(x_ptr + offsets, mask=mask)
    y = tl.load(y_ptr + offsets, mask=mask)
    tl.store(out_ptr + offsets, x + y, mask=mask)

def add(x: torch.Tensor, y: torch.Tensor) -> torch.Tensor:
    n = x.numel()
    out = torch.empty_like(x)
    grid = lambda meta: (triton.cdiv(n, meta["BLOCK"]),)
    add_kernel[grid](x, y, out, n, BLOCK=1024)
    return out
```

Key concepts:
- `tl.program_id(0)` — block index (like `blockIdx.x`)
- `tl.arange(0, BLOCK)` — vector of thread indices within block
- `mask` — predication for tail elements (no separate bounds kernel)
- `BLOCK: tl.constexpr` — compile-time constant, enables unrolling

### 2. Load/store and masking

```python
@triton.jit
def masked_load_example(ptr, n, BLOCK: tl.constexpr):
    pid = tl.program_id(0)
    offs = pid * BLOCK + tl.arange(0, BLOCK)
    mask = offs < n
    # masked load returns 0 for masked-off lanes
    vals = tl.load(ptr + offs, mask=mask, other=0.0)
    return vals
```

Block pointers (Triton 2.x+) for structured 2D access:

```python
@triton.jit
def matvec_kernel(a_ptr, x_ptr, y_ptr, M, N, BLOCK_M: tl.constexpr, BLOCK_N: tl.constexpr):
    pid_m = tl.program_id(0)
    offs_m = pid_m * BLOCK_M + tl.arange(0, BLOCK_M)
    acc = tl.zeros((BLOCK_M,), dtype=tl.float32)
    for start_n in range(0, N, BLOCK_N):
        offs_n = start_n + tl.arange(0, BLOCK_N)
        a = tl.load(a_ptr + offs_m[:, None] * N + offs_n[None, :])
        x = tl.load(x_ptr + offs_n)
        acc += tl.sum(a * x[None, :], axis=1)
    tl.store(y_ptr + offs_m, acc, mask=offs_m < M)
```

### 3. Atomic operations

```python
@triton.jit
def atomic_histogram(data_ptr, hist_ptr, n, BLOCK: tl.constexpr):
    pid = tl.program_id(0)
    offs = pid * BLOCK + tl.arange(0, BLOCK)
    mask = offs < n
    data = tl.load(data_ptr + offs, mask=mask)
    bucket = (data % 256).to(tl.int32)
    tl.atomic_add(hist_ptr + bucket, 1, mask=mask)
```

Use atomics sparingly — they serialize memory updates. Prefer block-level reduction then single atomic per block.

### 4. Shared memory via constexpr

```python
@triton.jit
def reduce_kernel(x_ptr, out_ptr, n, BLOCK: tl.constexpr):
    pid = tl.program_id(0)
    offs = pid * BLOCK + tl.arange(0, BLOCK)
    mask = offs < n
    x = tl.load(x_ptr + offs, mask=mask, other=0.0)
    # Block reduction
    x = tl.sum(x, axis=0)
    tl.atomic_add(out_ptr, x)
```

`BLOCK` as `tl.constexpr` lets the compiler allocate shared memory and unroll loops at compile time.

### 5. Autotuning

```python
@triton.autotune(
    configs=[
        triton.Config({"BLOCK": 128}, num_warps=4),
        triton.Config({"BLOCK": 256}, num_warps=4),
        triton.Config({"BLOCK": 512}, num_warps=8),
    ],
    key=["n"],
)
@triton.jit
def tuned_kernel(x_ptr, y_ptr, out_ptr, n, BLOCK: tl.constexpr):
    # ... kernel body ...
    pass
```

Autotuner benchmarks configs on first run and caches the best for each `key` shape.

### 6. Benchmarking

```python
from triton.testing import Benchmark

def benchmark_add():
    n = 1024 * 1024
    x = torch.randn(n, device="cuda")
    y = torch.randn(n, device="cuda")

    def triton_add():
        return add(x, y)

    def torch_add():
        return x + y

    bench = Benchmark(
        x_names=["n"],
        x_vals=[2**i for i in range(10, 24)],
        line_arg="provider",
        line_vals=["triton", "torch"],
        line_names=["Triton", "PyTorch"],
        plot_name="add-bench",
        args={},
    )
    bench.run(lambda n, provider: {
        "triton": lambda: add(x[:n], y[:n]),
        "torch": lambda: x[:n] + y[:n],
    }[provider](), quantiles=[0.5, 0.9])
```

```bash
# Quick timing in REPL
import triton.testing as tt
ms = tt.do_bench(lambda: add(x, y))
print(f"{ms:.3f} ms")
```

### 7. PyTorch integration

```python
import torch
from torch.library import custom_op

@custom_op("mylib::triton_add", mutates_args=())
def triton_add_op(x: torch.Tensor, y: torch.Tensor) -> torch.Tensor:
    return add(x, y)

@triton_add_op.register_fake
def _(x, y):
    return torch.empty_like(x)

# Use in model
class MyModule(torch.nn.Module):
    def forward(self, x, y):
        return triton_add_op(x, y)
```

For `torch.compile` compatibility, register fake/meta kernels and avoid Python side effects in the JIT function.

### 8. Debugging

```python
@triton.jit
def debug_kernel(x_ptr, n, BLOCK: tl.constexpr):
    pid = tl.program_id(0)
    offs = pid * BLOCK + tl.arange(0, BLOCK)
    mask = offs < n
    x = tl.load(x_ptr + offs, mask=mask)
    # Synchronize threads within block for inspection
    tl.debug_barrier()
    tl.store(x_ptr + offs, x * 2.0, mask=mask)
```

```bash
# Dump generated PTX/LLVM IR
TRITON_PRINT_AUTOTUNING=1 python script.py
# Set cache dir to inspect compiled kernels
export TRITON_CACHE_DIR=/tmp/triton_cache
```

Compare against PyTorch reference on small inputs before scaling up.

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `OutOfResources` | BLOCK too large | Reduce BLOCK or num_warps |
| Wrong results on tail | Missing mask | Add `mask=offs < n` to load/store |
| Slower than PyTorch | Suboptimal BLOCK | Use `@triton.autotune` |
| `CompilationError` | Type mismatch | Ensure consistent dtypes; use `.to(tl.float32)` |
| NaN in output | Uninitialized masked lanes | Pass `other=0.0` to masked loads |
| torch.compile fails | No fake kernel | Register `register_fake` meta function |

## Related Skills

- `skills/gpu/cuda` — underlying CUDA concepts when Triton limits are hit
- `skills/gpu/cuda-profiling` — Nsight profiling of Triton-compiled kernels
- `skills/gpu/gpu-memory-model` — coalescing and occupancy theory
- `skills/gpu/hip-rocm` — AMD GPU path (Triton supports ROCm)
- `skills/hpc/openmp` — CPU parallelism alongside GPU kernels