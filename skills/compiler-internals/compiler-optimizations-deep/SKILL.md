---
name: compiler-optimizations-deep
description: Deep compiler optimizations skill for RA, ISel, and PGO. Use when explaining register allocation, instruction selection, LICM, vectorization limits, or profile-guided optimization beyond -O3. Activates on queries about register allocation, instruction selection, LICM, auto-vectorization failure, PGO, or BOLT.
---

# Compiler Optimizations (Deep)

## Purpose

Explain optimization phases beyond flags: mid-level IR opts, register allocation, instruction selection/scheduling, vectorization boundaries, PGO, and post-link BOLT — bridging `skills/compilers/pgo` and LLVM/GCC internals.

## When to Use

- `-O3` did not vectorize a hot loop
- Teaching why register pressure causes spills
- Planning PGO or BOLT deployment
- Understanding pass interaction (e.g., LICM before vectorize)

## Workflow

### 1. Compiler pipeline map

```
Frontend → LLVM IR / GCC GIMPLE
├── Mid-level: DCE, GVN, LICM, inlining
├── Loop opts: unroll, vectorize
├── Codegen prep: legalize types
├── Instruction selection (DAG → machine ops)
├── Register allocation (greedy, linear scan)
└── Peephole / scheduling
```

### 2. Vectorization failure triage

```bash
clang -O3 -Rpass=loop-vectorize -Rpass-missed=loop-vectorize foo.c
```

| Miss reason | Typical fix |
|-------------|-------------|
| Unknown trip count | peel loop; assert count |
| Dependence | reorder / separate accumulators |
| Function call in loop | inline or outline |
| Alignment unknown | `__builtin_assume_aligned` |

### 3. Register allocation intuition

When live ranges exceed physical registers, the allocator **spills** to stack slots — costly loads/stores. Reducing live ranges (splitting variables, rematerialization) helps.

GCC/LLVM both use graph coloring variants (LLVM "greedy regalloc").

### 4. PGO workflow (Clang)

```bash
clang -fprofile-instr-generate -O2 -o app foo.c
./app   # training workload
llvm-profdata merge default.profraw -o default.profdata
clang -fprofile-instr-use=default.profdata -O2 -o app_pgo foo.c
```

Improves branch layout, inlining, and vectorization thresholds.

See `skills/compilers/pgo` for GCC and BOLT.

### 5. BOLT (post-link)

```bash
llvm-bolt -instrument app -o app.inst
./app.inst
llvm-bolt -data=perf.fdata -reorder-blocks=+ -o app.bolt app
```

Optimizes layout after linker — needs relocations (`-Wl,--emit-relocs`).

### 6. LICM example

Loop-invariant code motion hoists `x * scale` out of inner loop when legal — reduces work per iteration.

### 7. Agent usage

```
/compiler-optimizations-deep Why did LLVM fail to vectorize this reduction loop?
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| PGO no gain | Unrepresentative training | Match production input |
| BOLT crash | Stripped binary | Keep symbols + relocs |
| Spills in asm | Register pressure | Simplify live ranges |
| `-O3` slower | Code bloat / cache | Try `-O2` or PGO |
| Different GCC/Clang | Pass ordering differs | Compare IR + asm |

## Related Skills

- `skills/compilers/pgo` — PGO and BOLT detail
- `skills/compiler-internals/llvm-ir-and-passes` — IR-level opts
- `skills/compiler-internals/code-generation-and-backends` — ISel and backends
- `skills/computer-architecture/cpu-pipelines-and-hazards` — scheduling context
- `skills/low-level-programming/simd-intrinsics` — manual vectorization