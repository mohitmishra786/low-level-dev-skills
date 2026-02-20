# PGO Workflow Reference

## GCC Profile Data Formats

| Format | Flag | Notes |
|--------|------|-------|
| GCOV (classic) | `-fprofile-generate` / `-fprofile-use` | `.gcda` + `.gcno` files |
| AutoFDO | `-fauto-profile=file` | Converted from perf data via `create_gcov` |

## Clang Profile Data Formats

| Format | Flag | Notes |
|--------|------|-------|
| IR-based (instrumented) | `-fprofile-instr-generate` / `-fprofile-instr-use` | `.profraw` → merge → `.profdata` |
| Sampling (SamplePGO) | `-fprofile-sample-use` | From perf/DTrace, no overhead |
| Context-sensitive PGO | `-fcs-profile-generate` | Two-stage IR-PGO for deeper context |

## llvm-profdata Commands

```bash
# Merge multiple raw profiles
llvm-profdata merge -output=merged.profdata *.profraw

# Merge with weights (run workload A more than B)
llvm-profdata merge -output=merged.profdata \
    -weighted-input=3,workloadA.profraw \
    -weighted-input=1,workloadB.profraw

# Show profile stats
llvm-profdata show --all-functions merged.profdata | head -50

# Overlap between two profiles (check representativeness)
llvm-profdata overlap profile1.profdata profile2.profdata
```

## Context-Sensitive PGO (CS-PGO) Workflow

CS-PGO provides more precise inlining by tracking call-site context:

```bash
# Stage 1: Regular PGO
clang -O2 -fprofile-instr-generate prog.c -o prog.instr1
./prog.instr1 < workload.input
llvm-profdata merge -output=stage1.profdata *.profraw

# Stage 2: CS-PGO instrumentation using stage1 profile
clang -O2 -fprofile-use=stage1.profdata \
      -fcs-profile-generate prog.c -o prog.instr2
./prog.instr2 < workload.input
llvm-profdata merge -output=cs.profdata *.profraw

# Final build
clang -O2 -fprofile-use=cs.profdata prog.c -o prog.cspgo
```

## Workload Representativeness

A PGO build is only as good as the workload used to collect profiles.

Checklist:

- [ ] Workload covers all major code paths (hot loops, branches)
- [ ] Workload duration: at least 30 seconds of representative execution
- [ ] Multi-workload merge: weight production-like scenarios higher
- [ ] Avoid one-off startup paths unless startup matters

Red flags:

- Training on a tiny synthetic benchmark and deploying for general use
- Only training on error paths
- Profile collected from a debug build (use `-O2` for instrumentation)

## BOLT Configuration Reference

```bash
llvm-bolt prog -data prof.fdata -o prog.bolt \
    -reorder-blocks=ext-tsp     # Best block reordering algorithm
    -reorder-functions=hfsort   # Hutch-sort for function layout
    -split-functions             # Split hot/cold function portions
    -split-all-cold              # Move all cold code to .cold section
    -eliminate-unreachable       # Remove dead code
    -frame-opt=hot               # Optimize frame pointer usage in hot funcs
    -use-gnu-stack               # For GNU stack compatibility
    -dyno-stats                  # Print optimisation statistics
```

## Benchmarking Template

```bash
#!/bin/bash
set -e
WORKLOAD="./bench_input"
RUNS=5

hyperfine --runs $RUNS "./prog_baseline $WORKLOAD" \
          "./prog_pgo $WORKLOAD" \
          "./prog_bolt $WORKLOAD" \
          --export-markdown results.md
```
