---
name: cuda-profiling
description: CUDA profiling skill for NVIDIA GPU performance analysis. Use when profiling kernels with Nsight Systems or Nsight Compute, interpreting roofline models, diagnosing memory-bound vs compute-bound kernels, or annotating code with NVTX ranges. Activates on queries about Nsight, NCU, ncu CLI, GPU roofline, occupancy metrics, or CUDA profiling workflow.
---

# CUDA Profiling

## Purpose

Guide agents through profiling CUDA applications with Nsight Systems (timeline-level) and Nsight Compute (kernel-level metrics), using the NCU CLI for automated metric collection, interpreting roofline models, and diagnosing whether kernels are memory-bound or compute-bound.

## When to Use

- A CUDA kernel is slower than expected and you need bottleneck identification
- Comparing kernel variants (tiling strategies, block sizes)
- Building CI performance regression checks with `ncu` metrics
- Correlating CPU and GPU activity in multi-stream pipelines
- Annotating application phases with NVTX for timeline visibility
- Interpreting occupancy, memory throughput, and SM utilization metrics

## Workflow

### 1. Choose profiling tool

```
What do you need?
├── System-wide timeline (CPU+GPU+CUDA API) → Nsight Systems (nsys)
├── Per-kernel deep metrics (occupancy, memory) → Nsight Compute (ncu)
└── Quick metric from CLI in CI → ncu --metrics ...
```

### 2. Nsight Systems — timeline profiling

```bash
# Profile entire application
nsys profile --trace=cuda,nvtx,osrt --output=report ./my_cuda_app

# Open report
nsys-ui report.nsys-rep

# CLI summary
nsys stats report.nsys-rep
```

What to look for in the timeline:
- Gaps between kernel launches (CPU bottleneck or sync points)
- `cudaDeviceSynchronize` stalls
- Overlap between H2D copies and kernel execution across streams
- CUDA API call overhead

```bash
# Capture with CUDA graph info
nsys profile --capture-range=cudaProfilerApi ./my_cuda_app
```

### 3. NVTX range annotations

```cpp
#include <nvtx3/nvToolsExt.h>

void pipeline(void) {
    nvtxRangePushA("H2D copy");
    cudaMemcpyAsync(d_in, h_in, size, cudaMemcpyHostToDevice, stream);
    nvtxRangePop();

    nvtxRangePushA("kernel");
    my_kernel<<<grid, block, 0, stream>>>(d_in, d_out, n);
    nvtxRangePop();

    nvtxRangePushA("D2H copy");
    cudaMemcpyAsync(h_out, d_out, size, cudaMemcpyDeviceToHost, stream);
    nvtxRangePop();
}
```

Compile with `-lnvToolsExt` or link nvtx3 header-only. Ranges appear as colored bands in Nsight Systems.

### 4. Nsight Compute — kernel analysis

```bash
# Profile all kernels, save report
ncu -o kernel_report ./my_cuda_app

# Profile specific kernel by name
ncu --kernel-name regex:matmul_tiled ./my_cuda_app

# Launch UI
ncu-ui kernel_report.ncu-rep
```

Key sections in NCU report:
- **Speed of Light**: SM throughput vs memory throughput vs peak
- **Occupancy**: Active warps vs hardware limit
- **Memory Workload Analysis**: L1/L2 hit rates, coalescing efficiency
- **Warp State Statistics**: Stall reasons (memory, barrier, dispatch)

### 5. NCU CLI metrics

```bash
# Essential metrics set
ncu --metrics \
  sm__throughput.avg.pct_of_peak_sustained_elapsed,\
  dram__throughput.avg.pct_of_peak_sustained_elapsed,\
  sm__warps_active.avg.pct_of_peak_sustained_active,\
  l1tex__t_sectors_pipe_lsu_mem_global_op_ld.sum,\
  smsp__sass_thread_inst_executed_op_ffma_pred_on.sum \
  ./my_cuda_app

# CSV export for CI
ncu --csv --metrics dram__bytes_read.sum,dram__bytes_write.sum ./my_cuda_app

# Set kernel replay mode for accurate counters
ncu --kernel-replay-mode application ./my_cuda_app
```

### 6. Memory-bound vs compute-bound diagnosis

```
Roofline interpretation
├── dram__throughput near peak AND sm__throughput low → memory-bound
│   └── Fix: coalescing, shared mem tiling, reduce traffic
├── sm__throughput near peak AND dram low → compute-bound
│   └── Fix: tensor cores, loop unrolling, ILP
└── Both low → launch config, occupancy, or sync overhead
```

Roofline model (conceptual):

```
Performance (GFLOP/s)
    |     /\  compute roof
    |    /  \
    |   /    \____ memory roof (bandwidth-limited region)
    |  /
    +------------------ Arithmetic Intensity (FLOP/byte)
```

Measure arithmetic intensity: `smsp__sass_thread_inst_executed_op_ffma_pred_on.sum * 2 / dram__bytes.sum`

### 7. Occupancy analysis

```bash
ncu --metrics sm__warps_active.avg.pct_of_peak_sustained_active,\
launch__occupancy_limit_registers,\
launch__occupancy_limit_shared_mem,\
launch__occupancy_limit_block_size \
./my_cuda_app
```

| Limiting factor | Typical fix |
|-----------------|-------------|
| Registers | `-maxrregcount`, simplify kernel |
| Shared memory | Reduce tile size, split phases |
| Block size | Try 128 or 256 instead of 512+ |

### 8. Profiling workflow checklist

```bash
# 1. Build with line info (not -G unless debugging)
nvcc -lineinfo -O3 -arch=sm_80 -o app main.cu

# 2. Timeline first
nsys profile --trace=cuda,nvtx -o timeline ./app

# 3. Deep dive on hot kernel
ncu --kernel-name regex:hot_kernel --set full ./app

# 4. Compare before/after
ncu --csv --metrics sm__throughput.avg.pct_of_peak_sustained_elapsed ./app_v1 > v1.csv
ncu --csv --metrics sm__throughput.avg.pct_of_peak_sustained_elapsed ./app_v2 > v2.csv
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ERR_NVGPUCTRPERM` | Insufficient profiling permissions | Run with sudo or set `NVreg_RestrictProfilingToAdminUsers=0` |
| All metrics show zero | Profiling disabled or wrong GPU | Check `CUDA_VISIBLE_DEVICES`; use `--target-processes all` |
| NCU report empty | Kernel too short or not launched | Increase workload; verify `cudaGetLastError()` |
| Huge profiling overhead | Full metric sets on many kernels | Use `--kernel-name` filter; `--launch-skip` |
| Timeline shows no overlap | Single default stream | Create multiple streams; use async copies |
| Occupancy looks fine but kernel slow | Memory latency not hidden | Check memory coalescing; increase active warps |

## Related Skills

- `skills/gpu/cuda` — kernel writing, occupancy tuning, nvcc flags
- `skills/gpu/gpu-memory-model` — coalescing, bank conflicts, SIMT model
- `skills/gpu/cuda-debugging` — correctness before performance tuning
- `skills/profilers/intel-vtune-amd-uprof` — CPU-side roofline and hotspot analysis
- `skills/profilers/flamegraphs` — CPU flamegraphs complementary to nsys timeline
- `skills/profilers/hardware-counters` — general perf stat concepts