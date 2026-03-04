---
name: hardware-counters
description: Hardware performance counter skill for low-level CPU analysis. Use when collecting PMU events with perf stat, using the PAPI library, measuring cache miss rates and branch misprediction ratios, computing IPC, or correlating PMU events to source lines. Activates on queries about hardware counters, PMU events, perf stat -e, PAPI, cache miss rate, branch misprediction, IPC measurement, or CPU performance events.
---

# Hardware Performance Counters

## Purpose

Guide agents through hardware performance counter analysis: collecting PMU events with `perf stat -e`, using the PAPI library for portable counter access, interpreting cache miss rates and branch misprediction ratios, computing IPC, and correlating events to source lines with `perf annotate`.

## Triggers

- "How do I measure cache miss rate with perf?"
- "How do I count branch mispredictions?"
- "How do I compute IPC (instructions per clock) with perf?"
- "How do I use the PAPI library for hardware counters?"
- "How do I see which source lines cause the most cache misses?"
- "How do I measure memory bandwidth with performance counters?"

## Workflow

### 1. perf stat — basic counter collection

```bash
# Basic hardware event summary
perf stat ./prog

# Output:
#  Performance counter stats for './prog':
#
#      1,234,567,890      instructions
#        456,789,012      cycles
#         12,345,678      cache-misses         #    1.23 % of all cache refs
#         23,456,789      branch-misses        #    2.34 % of all branches
#
#       0.456789012 seconds time elapsed

# Derived metrics (computed from the output)
# IPC = instructions / cycles = 1,234,567,890 / 456,789,012 ≈ 2.70
# CPI = cycles / instructions ≈ 0.37
```

### 2. Specifying PMU events with -e

```bash
# Specific hardware events
perf stat -e instructions,cycles,cache-misses,branch-misses ./prog

# L1/L2/L3 cache events
perf stat -e \
  L1-dcache-loads,L1-dcache-load-misses,\
  L2-loads,L2-load-misses,\
  LLC-loads,LLC-load-misses \
  ./prog

# Memory bandwidth (Intel)
perf stat -e \
  uncore_imc/cas_count_read/,\
  uncore_imc/cas_count_write/ \
  ./prog

# TLB misses
perf stat -e dTLB-loads,dTLB-load-misses,iTLB-loads,iTLB-load-misses ./prog

# Branch misprediction rate
perf stat -e branches,branch-misses ./prog
# Rate = branch-misses / branches × 100%

# Available events (varies by CPU)
perf list hardware          # generic hardware events
perf list cache             # cache events
perf list pmu               # raw PMU events for your CPU
```

### 3. Key metrics and thresholds

| Metric | Formula | Healthy | Concerning |
|--------|---------|---------|-----------|
| IPC | instructions / cycles | > 2.0 (modern x86) | < 1.0 |
| L1 miss rate | L1-misses / L1-accesses | < 1% | > 5% |
| LLC miss rate | LLC-misses / LLC-accesses | < 1% | > 10% |
| Branch miss rate | branch-misses / branches | < 1% | > 5% |
| MPKI | misses per 1K instructions | — | L3 MPKI > 10 = memory bound |

```bash
# Compute MPKI (Misses Per Kilo-Instructions)
perf stat -e instructions,LLC-load-misses ./prog
# MPKI = LLC-load-misses / (instructions / 1000)
```

### 4. Raw PMU events (CPU-specific)

For events not in the generic aliases, use raw event codes:

```bash
# Intel: use perf list or look up in Intel SDM
# Format: rXXYY where XX=umask, YY=event code
perf stat -e r0124 ./prog    # example Intel raw event

# List Intel events with ocperf (OpenCL Perf Events)
pip install ocperf
ocperf.py list | grep "mem_load"

# Use libpfm4 for event names
pfm_ls | grep "MEM_LOAD"
perf stat -e $(pfm_ls | grep "MEM_LOAD_RETIRED.L3_MISS") ./prog

# AMD: similar approach
perf stat -e r04041 ./prog   # AMD raw event
```

### 5. Source-level annotation with perf record/annotate

```bash
# Record with hardware events
perf record -e LLC-load-misses -g ./prog

# Annotate: show source lines sorted by cache miss count
perf annotate --stdio

# Interactive (requires debug symbols)
perf report
# Press 'a' on a function to annotate it

# Combined: record hotspot + annotate
perf record -e cycles:u -g ./prog
perf annotate --symbol=my_function --stdio 2>/dev/null | head -40

# Example annotate output:
# Percent | Source code
#   45.23 |     for (int i = 0; i < N; i++)
#    3.12 |         sum += data[i];   ← cache miss here (strided access)
```

### 6. PAPI — Portable API for hardware counters

PAPI provides a portable C API across different CPU architectures:

```c
#include <papi.h>
#include <stdio.h>

int main(void) {
    int Events[] = {PAPI_TOT_INS, PAPI_TOT_CYC,
                    PAPI_L2_TCM,  PAPI_BR_MSP};
    long long values[4];

    if (PAPI_library_init(PAPI_VER_CURRENT) != PAPI_VER_CURRENT) {
        fprintf(stderr, "PAPI init failed\n");
        return 1;
    }

    PAPI_start_counters(Events, 4);

    // --- Code to measure ---
    do_work();
    // -----------------------

    PAPI_stop_counters(values, 4);

    printf("Instructions:      %lld\n", values[0]);
    printf("Cycles:            %lld\n", values[1]);
    printf("IPC:               %.2f\n", (double)values[0]/values[1]);
    printf("L2 cache misses:   %lld\n", values[2]);
    printf("Branch mispred:    %lld\n", values[3]);

    return 0;
}
```

```bash
# Build with PAPI
gcc -O2 -g -o prog prog.c -lpapi

# Available PAPI events on your system
papi_avail -a | head -30
papi_native_avail | grep "L3"    # native events with "L3"
```

Common PAPI presets:

| Preset | Event |
|--------|-------|
| `PAPI_TOT_INS` | Total instructions |
| `PAPI_TOT_CYC` | Total cycles |
| `PAPI_L1_DCM` | L1 data cache misses |
| `PAPI_L2_TCM` | L2 total cache misses |
| `PAPI_L3_TCM` | L3 total cache misses |
| `PAPI_BR_MSP` | Branch mispredictions |
| `PAPI_TLB_DM` | Data TLB misses |
| `PAPI_FP_INS` | Floating point instructions |
| `PAPI_VEC_INS` | Vector/SIMD instructions |

### 7. Intel PCM (Performance Counter Monitor)

```bash
# Intel PCM — system-wide counters, no root required on modern kernels
git clone https://github.com/intel/pcm
cd pcm && cmake -S . -B build && cmake --build build

# Measure memory bandwidth
./build/bin/pcm-memory 1    # sample every 1 second

# Core utilization + IPC
./build/bin/pcm 1

# Cache miss breakdown per socket
./build/bin/pcm 1 -csv | head -20
```

## Related skills

- Use `skills/profilers/intel-vtune-amd-uprof` for guided microarchitecture analysis
- Use `skills/profilers/linux-perf` for perf record/report and flamegraph generation
- Use `skills/low-level-programming/cpu-cache-opt` for applying cache optimization patterns
- Use `skills/low-level-programming/simd-intrinsics` for improving FLOPS/cycle metrics
