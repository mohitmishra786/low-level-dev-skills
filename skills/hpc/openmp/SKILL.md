---
name: openmp
description: OpenMP skill for shared-memory parallel programming. Use when writing parallel for loops, reductions, task parallelism, SIMD directives, GPU offloading, or profiling with Score-P/TAU. Activates on queries about OpenMP, pragma omp, schedule static dynamic, reduction, false sharing, or OMP_NUM_THREADS.
---

# OpenMP

## Purpose

Guide agents through OpenMP shared-memory parallelism: `#pragma omp parallel for` with scheduling clauses, reductions, data-sharing attributes, SIMD hints, task parallelism, OpenMP 5.x GPU `target` offloading, common pitfalls (false sharing, data races), environment tuning, and profiling with Score-P or TAU.

## When to Use

- Parallelizing C/C++/Fortran loops on multicore CPUs
- Implementing reductions (sum, max, custom)
- Task parallelism for irregular workloads
- Offloading compute to GPU with OpenMP target directives
- Diagnosing scaling failures (false sharing, load imbalance)
- Tuning thread count and spin behavior

## Workflow

### 1. Basic parallel for

```c
#include <omp.h>
#include <stdio.h>

int main(void) {
    const int n = 1000000;
    double sum = 0.0;

    #pragma omp parallel for reduction(+:sum)
    for (int i = 0; i < n; i++)
        sum += i * 0.001;

    printf("sum = %f, threads = %d\n", sum, omp_get_max_threads());
    return 0;
}
```

```bash
gcc -fopenmp -O3 -o omp_sum omp_sum.c
export OMP_NUM_THREADS=8
./omp_sum
```

### 2. Schedule clauses

```c
#pragma omp parallel for schedule(static)          // equal chunks, low overhead
#pragma omp parallel for schedule(dynamic, 64)     // dynamic chunks of 64
#pragma omp parallel for schedule(guided)          // decreasing chunk size
#pragma omp parallel for schedule(auto)            // compiler/runtime decides
```

| Schedule | Best for |
|----------|----------|
| `static` | Uniform work per iteration |
| `dynamic` | Variable iteration cost |
| `guided` | Decreasing iteration cost |
| `static,1` | Cache blocking with interleaved chunks |

### 3. Data sharing attributes

```c
int shared_var = 0;
#pragma omp parallel private(i) shared(shared_var)
{
    int i = omp_get_thread_num();
    #pragma omp atomic
    shared_var += i;
}

// firstprivate — copy in; lastprivate — copy out after loop
#pragma omp parallel for firstprivate(offset) lastprivate(result)
for (int i = 0; i < n; i++) { ... }
```

| Clause | Meaning |
|--------|---------|
| `private` | Uninitialized per-thread copy |
| `shared` | One variable, all threads |
| `reduction(op:var)` | Combine at end (+, *, max, &&, \|\|) |
| `firstprivate` | Initialize from master |
| `lastprivate` | Master gets last iteration value |

### 4. SIMD vectorization hint

```c
#pragma omp simd
for (int i = 0; i < n; i++)
    c[i] = a[i] + b[i];

// SIMD + parallel
#pragma omp parallel for simd
for (int i = 0; i < n; i++)
    c[i] = a[i] * b[i];
```

Requires `-fopenmp-simd` or `-fopenmp` with compiler SIMD support. Check with `-fopt-info-vec`.

### 5. Task parallelism

```c
#pragma omp parallel
{
    #pragma omp single
    {
        for (int i = 0; i < 10; i++) {
            #pragma omp task firstprivate(i)
            process_subtree(i);
        }
        #pragma omp taskwait
    }
}
```

Tasks suit recursive algorithms (quicksort, tree traversal) where loop parallelism doesn't fit.

### 6. Timing

```c
double start = omp_get_wtime();
#pragma omp parallel for
for (int i = 0; i < n; i++) work(i);
double elapsed = omp_get_wtime() - start;
printf("elapsed: %f s\n", elapsed);
```

### 7. GPU target offloading (OpenMP 5.x)

```c
#pragma omp target teams distribute parallel for map(to:a[0:n]) map(from:c[0:n])
for (int i = 0; i < n; i++)
    c[i] = a[i] * 2.0f;
```

```bash
# NVIDIA offload
gcc -fopenmp -foffload=-march=sm_80 -o offload offload.c

# Check device
export OMP_DEFAULT_TARGET_DEVICE=1
```

Requires compiler offload support (GCC offload, Clang/OpenMP, NVIDIA HPC SDK).

### 8. Environment variables

```bash
export OMP_NUM_THREADS=16
export OMP_PROC_BIND=close        # bind threads to nearby cores
export OMP_PLACES=cores
export GOMP_SPINCOUNT=2000        # spin before sleep
export OMP_WAIT_POLICY=active     # active vs passive waiting
export OMP_DISPLAY_ENV=true       # print config at startup
```

### 9. Profiling

```bash
# Score-P (compile with wrapper)
scorep gcc -fopenmp -o app app.c
export SCOREP_METRIC_MANAGER=1
scorep ./app
scorep-score -f scorep_*/profile.cubex

# TAU
tau_cc.sh -fopenmp -o app app.c
export TAU_TRACE=1
./app
pprof app profile.*
```

### 10. Pitfalls

**False sharing**: threads modify adjacent cache lines.

```c
// Bad: sum_array[tid] on same cache line
#pragma omp parallel
{
    int tid = omp_get_thread_num();
    sum_array[tid] += local_sum;  // pad to 64 bytes between elements
}

// Fix: padding
double sum_padded[MAX_THREADS][8];  // 8 doubles = 64 bytes
```

**Nested parallelism**:

```bash
export OMP_MAX_ACTIVE_LEVELS=2
export OMP_NESTED=true   # deprecated; use MAX_ACTIVE_LEVELS
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| No speedup | Loop too small | Increase work; check `if` clause threshold |
| Wrong reduction result | Race on non-reduction var | Use `reduction` or `atomic` |
| Slower with more threads | False sharing | Pad per-thread arrays |
| GPU offload fails | No target device | Check `-foffload`; `nvidia-smi` |
| Threads not bound | Default spread | `OMP_PROC_BIND=close` |
| Nested deadlock | Oversubscription | Limit `OMP_NUM_THREADS` per level |

## Related Skills

- `skills/hpc/mpi` — distributed memory complement
- `skills/low-level-programming/cpu-cache-opt` — false sharing deep dive
- `skills/gpu/cuda` — GPU programming alternative to target offload
- `skills/profilers/intel-vtune-amd-uprof` — OpenMP region analysis in VTune
- `skills/compilers/gcc` — `-fopenmp` flags
- `skills/allocators/numa-programming` — NUMA-aware thread binding