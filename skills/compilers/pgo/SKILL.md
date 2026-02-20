---
name: pgo
description: Profile-guided optimisation skill for C/C++ with GCC and Clang. Use when squeezing maximum runtime performance after standard optimisation plateaus, implementing two-stage PGO builds, collecting profile data, or applying BOLT for post-link optimisation. Activates on queries about PGO, profile-guided optimization, fprofile-generate, fprofile-use, instrumented builds, or BOLT.
---

# PGO (Profile-Guided Optimisation)

## Purpose

Guide agents through the full PGO workflow: instrument build → representative workload → collect profile → optimised build, covering both GCC and Clang, plus BOLT for post-link optimisation.

## Triggers

- "How do I use PGO to speed up my binary?"
- "What is profile-guided optimization and when should I use it?"
- "How do I use `-fprofile-generate` and `-fprofile-use`?"
- "My `-O3` build isn't fast enough — what next?"
- "How does BOLT differ from PGO?"
- "How do I collect representative profile data?"

## Workflow

### 1. When to use PGO

```text
Is -O3 -march=native already applied?
  no  → apply standard optimisation first
  yes → is workload branch-heavy or has irregular call patterns?
          yes → PGO will likely help 5-30%
          no  → PGO may not help; profile first with linux-perf
```

PGO helps most with:

- Large binaries with many cold/hot code paths (compilers, databases, servers)
- Branch-heavy code where static prediction is wrong
- Function call-heavy code where inlining decisions improve with profile data

### 2. GCC PGO workflow

```bash
# Step 1: Build with instrumentation
gcc -O2 -fprofile-generate -fprofile-dir=./pgo-data \
    prog.c -o prog_instr

# Step 2: Run with representative workload(s)
./prog_instr < workload1.input
./prog_instr < workload2.input
# Generates .gcda files in ./pgo-data/

# Step 3: Build optimised binary using profile
gcc -O2 -fprofile-use -fprofile-dir=./pgo-data \
    -fprofile-correction \
    prog.c -o prog_pgo
```

`-fprofile-correction`: handles profile count inconsistencies from parallel or nondeterministic runs. Always include it.

### 3. Clang PGO workflow (IR-based, preferred)

```bash
# Step 1: Instrument build
clang -O2 -fprofile-instr-generate prog.c -o prog_instr

# Step 2: Run workload (generates default.profraw)
./prog_instr < workload.input
LLVM_PROFILE_FILE="prog-%p.profraw" ./prog_instr  # per-PID files for parallel runs

# Step 3: Merge raw profiles
llvm-profdata merge -output=prog.profdata *.profraw

# Step 4: Optimised build
clang -O2 -fprofile-instr-use=prog.profdata prog.c -o prog_pgo
```

Clang's IR PGO is more accurate than GCC's and supports `SamplePGO` (sampling-based, no instrumentation overhead).

### 4. Clang SamplePGO (sampling, no instrumentation)

```bash
# Step 1: Build with frame pointers for accurate stacks
clang -O2 -fno-omit-frame-pointer prog.c -o prog

# Step 2: Sample with perf
perf record -b -e cycles:u ./prog < workload.input
perf script -F ip,brstack > perf.script  # or use perf2bolt

# Step 3: Convert perf data
llvm-profgen --binary=./prog --perf-script=perf.script \
             --output=prog.profdata

# Step 4: Optimised build
clang -O2 -fprofile-sample-use=prog.profdata prog.c -o prog_spgo
```

SamplePGO is ideal for production profiling without instrumentation overhead.

### 5. CMake integration

```cmake
option(PGO_INSTRUMENT "Build with PGO instrumentation" OFF)
option(PGO_USE "Build with PGO profile data" OFF)

if(PGO_INSTRUMENT)
    add_compile_options(-fprofile-instr-generate)
    add_link_options(-fprofile-instr-generate)
endif()

if(PGO_USE)
    add_compile_options(-fprofile-instr-use=${CMAKE_SOURCE_DIR}/prog.profdata)
    add_link_options(-fprofile-instr-use=${CMAKE_SOURCE_DIR}/prog.profdata)
endif()
```

Build script:

```bash
# Phase 1: instrument
cmake -S . -B build-pgo-instr -DPGO_INSTRUMENT=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build-pgo-instr -j$(nproc)

# Collect profile
./build-pgo-instr/prog < workload.input
llvm-profdata merge -output=prog.profdata *.profraw

# Phase 2: optimised
cmake -S . -B build-pgo -DPGO_USE=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build-pgo -j$(nproc)
```

### 6. BOLT (post-link binary optimisation)

BOLT reorders functions and basic blocks in the final binary based on profile data, improving instruction cache locality. Works after PGO for additional 5-15%.

```bash
# Step 1: Build with relocation support
clang -O2 -Wl,--emit-relocs prog.c -o prog

# Step 2: Collect profile with perf
perf record -e cycles:u -b ./prog < workload.input
perf2bolt prog -p perf.data -o prog.fdata

# Or use instrumented BOLT
llvm-bolt prog -instrument -o prog.instr
./prog.instr < workload.input
# Generates /tmp/prof.fdata

# Step 3: Apply BOLT optimisation
llvm-bolt prog -data prog.fdata -o prog.bolt \
    -reorder-blocks=ext-tsp \
    -reorder-functions=hfsort \
    -split-functions \
    -split-all-cold \
    -dyno-stats
```

### 7. Verifying PGO impact

```bash
# Compare perf of instrumented vs PGO build
perf stat ./prog_baseline < workload.input
perf stat ./prog_pgo < workload.input

# Check which functions are hot in each
perf record ./prog_pgo < workload.input
perf report --stdio | head -30
```

For full workflow details and Clang vs GCC profile format notes, see [references/pgo-workflow.md](references/pgo-workflow.md).

## Related skills

- Use `skills/compilers/gcc` for GCC flag context
- Use `skills/compilers/clang` for Clang PGO and SamplePGO setup
- Use `skills/profilers/linux-perf` for collecting SamplePGO perf data
- Use `skills/profilers/flamegraphs` to identify hot paths before applying PGO
