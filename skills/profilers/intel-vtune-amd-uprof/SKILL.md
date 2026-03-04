---
name: intel-vtune-amd-uprof
description: Intel VTune and AMD uProf profiling skill for microarchitecture analysis. Use when analyzing hotspots, microarchitecture bottlenecks, memory access patterns, pipeline stalls, or using the roofline model. Covers VTune Community Edition (free) and AMD uProf as a free alternative. Activates on queries about VTune, uProf, microarchitecture analysis, pipeline stalls, memory bandwidth, roofline model, or hardware performance analysis.
---

# Intel VTune & AMD uProf

## Purpose

Guide agents through CPU microarchitecture profiling with Intel VTune Profiler (free Community Edition) and AMD uProf: hotspot identification, microarchitecture analysis, memory access pattern optimization, pipeline stall diagnosis, and roofline model analysis.

## Triggers

- "How do I use Intel VTune to profile my code?"
- "What are pipeline stalls and how do I reduce them?"
- "How do I analyze memory bandwidth with VTune?"
- "What is the roofline model and how do I use it?"
- "How do I use AMD uProf as a free alternative to VTune?"
- "My code has good cache hit rates but is still slow"

## Workflow

### 1. VTune setup (free Community Edition)

```bash
# Download Intel VTune Profiler (Community Edition — free)
# https://www.intel.com/content/www/us/en/developer/tools/oneapi/vtune-profiler.html

# Install on Linux
source /opt/intel/oneapi/vtune/latest/env/vars.sh

# CLI usage
vtune -collect hotspots ./prog
vtune -collect microarchitecture-exploration ./prog
vtune -collect memory-access ./prog

# View results in GUI
vtune-gui &
# File → Open Result → select .vtune directory

# Or use amplxe-cl (legacy CLI)
amplxe-cl -collect hotspots ./prog
amplxe-cl -report hotspots -r result/
```

### 2. Analysis types

| Analysis | What it finds | When to use |
|----------|--------------|-------------|
| Hotspots | CPU-bound functions | First step — find where time is spent |
| Microarchitecture Exploration | IPC, pipeline stalls, retired instructions | After hotspot — why is the hotspot slow? |
| Memory Access | Cache misses, DRAM bandwidth, NUMA | Memory-bound code |
| Threading | Lock contention, parallel efficiency | Multithreaded code |
| HPC Performance | Vectorization, memory, roofline | HPC / scientific code |
| I/O | Disk and network bottlenecks | I/O-bound code |

### 3. Hotspot analysis

```bash
# Collect and report hotspots
vtune -collect hotspots -result-dir hotspots_result ./prog

# Report top functions by CPU time
vtune -report hotspots -r hotspots_result -format csv | head -20

# CLI output example:
# Function       CPU Time  Module
# compute_fft    4.532s    libfft.so
# matrix_mult    2.108s    prog
# parse_input    0.234s    prog
```

Build with debug info for meaningful symbols:
```bash
gcc -O2 -g ./prog.c -o prog     # symbols visible in VTune
gcc -O2 -g -gsplit-dwarf -fno-omit-frame-pointer ./prog.c -o prog  # better stacks
```

### 4. Microarchitecture exploration — pipeline stalls

```bash
vtune -collect microarchitecture-exploration -r micro_result ./prog
vtune -report summary -r micro_result
```

Key metrics to examine:

| Metric | Meaning | Good value |
|--------|---------|-----------|
| IPC (Instructions Per Clock) | How many instructions retire per cycle | x86: aim for > 2.0 |
| CPI (Clocks Per Instruction) | Inverse of IPC | Lower is better |
| Bad Speculation | Branch mispredictions | < 5% |
| Front-End Bound | Instruction decode bottleneck | < 15% |
| Back-End Bound | Execution unit or memory stall | < 30% |
| Retiring | Useful work fraction | > 70% ideal |
| Memory Bound | % cycles waiting for memory | < 20% |

```
Pipeline Analysis (Top-Down Methodology):
├── Retiring (good, useful work)
├── Bad Speculation (branch mispredictions)
├── Front-End Bound
│   ├── Fetch Latency (I-cache misses, branch mispredicts)
│   └── Fetch Bandwidth
└── Back-End Bound
    ├── Memory Bound
    │   ├── L1 Bound → L1 cache misses
    │   ├── L2 Bound → L2 cache misses
    │   ├── L3 Bound → L3 cache misses
    │   └── DRAM Bound → main memory bandwidth limited
    └── Core Bound → ALU/compute bound
```

### 5. Memory access analysis

```bash
# Collect memory access profile
vtune -collect memory-access -r mem_result ./prog

# Key output sections:
# - Memory Bound: % time waiting for memory
# - LLC (Last Level Cache) Miss Rate
# - DRAM Bandwidth: GB/s achieved vs theoretical peak
# - NUMA: cross-socket accesses (for multi-socket systems)
```

Reading DRAM bandwidth:
```
DRAM Bandwidth: 18.4 GB/s
Peak Theoretical: 51.2 GB/s
Utilization: 36% — likely not DRAM-bound
```

If DRAM-bound: optimize data layout (AoS → SoA), reduce working set, improve spatial locality.

### 6. AMD uProf — free alternative for AMD CPUs

```bash
# Download AMD uProf
# https://www.amd.com/en/developer/uprof.html

# CLI profiling
AMDuProfCLI collect --config tbp ./prog          # time-based profiling
AMDuProfCLI collect --config assess ./prog       # microarchitecture assessment
AMDuProfCLI collect --config memory ./prog       # memory access

# Generate report
AMDuProfCLI report -i /tmp/uprof_result/ -o report.html

# Open GUI
AMDuProf &
```

AMD uProf metrics map to VTune equivalents:
- `Retired Instructions` → IPC analysis
- `Branch Mispredictions` → Bad Speculation
- `L1/L2/L3 Cache Misses` → Memory Bound levels
- `Data Cache Accesses` → Cache efficiency

### 7. Roofline model

The roofline model shows whether code is compute-bound or memory-bound by comparing achieved performance against hardware limits:

```
Performance (GFLOPS/s)
     |                    _______________
Peak |                 /
Perf |              /  compute bound
     |           /
     |        /
     |     /  memory bandwidth bound
     |  /
     +------------------------------→
        Arithmetic Intensity (FLOPS/Byte)
```

```bash
# VTune roofline collection
vtune -collect hpc-performance -r roofline_result ./prog
# Then: VTune GUI → Roofline view

# For manual calculation:
# Arithmetic Intensity = FLOPS / memory_bytes_accessed
# Peak FLOPS = CPUs × cores × freq × FLOPS_per_cycle_per_core
# Peak BW = from hardware spec (e.g., 51.2 GB/s for DDR4-3200 dual channel)

# likwid-perfctr for manual roofline data (Linux)
likwid-perfctr -C 0 -g FLOPS_DP ./prog          # double-precision FLOPS
likwid-perfctr -C 0 -g MEM ./prog               # memory bandwidth
```

## Related skills

- Use `skills/profilers/hardware-counters` for raw PMU event collection with perf stat
- Use `skills/profilers/linux-perf` for perf-based profiling on Linux
- Use `skills/low-level-programming/cpu-cache-opt` for memory access pattern optimization
- Use `skills/low-level-programming/simd-intrinsics` for vectorization to increase FLOPS
