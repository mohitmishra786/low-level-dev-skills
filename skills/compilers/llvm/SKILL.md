---
name: llvm
description: LLVM IR and pass pipeline skill. Use when working directly with LLVM Intermediate Representation (IR), running opt passes, generating IR with llc, inspecting or writing LLVM IR for custom passes, or understanding how the LLVM backend lowers IR to assembly. Activates on queries about LLVM IR, opt, llc, llvm-dis, LLVM passes, IR transformations, or building LLVM-based tools.
---

# LLVM IR and Tooling

## Purpose

Guide agents through the LLVM IR pipeline: generating IR, running optimisation passes with `opt`, lowering to assembly with `llc`, and inspecting IR for debugging or performance work.

## Triggers

- "Show me the LLVM IR for this function"
- "How do I run an LLVM optimisation pass?"
- "What does this LLVM IR instruction mean?"
- "How do I write a custom LLVM pass?"
- "Why isn't auto-vectorisation happening in LLVM?"

## Workflow

### 1. Generate LLVM IR

```bash
# Emit textual IR (.ll)
clang -O0 -emit-llvm -S src.c -o src.ll

# Emit bitcode (.bc)
clang -O2 -emit-llvm -c src.c -o src.bc

# Disassemble bitcode to text
llvm-dis src.bc -o src.ll
```

### 2. Run optimisation passes with `opt`

```bash
# Apply a specific pass
opt -passes='mem2reg,instcombine,simplifycfg' src.ll -S -o out.ll

# Standard optimisation pipelines
opt -passes='default<O2>' src.ll -S -o out.ll
opt -passes='default<O3>' src.ll -S -o out.ll

# List available passes
opt --print-passes 2>&1 | less

# Print IR before and after a pass
opt -passes='instcombine' --print-before=instcombine --print-after=instcombine src.ll -S -o out.ll 2>&1 | less
```

### 3. Lower IR to assembly with `llc`

```bash
# Compile IR to object file
llc -filetype=obj src.ll -o src.o

# Compile to assembly
llc -filetype=asm -masm-syntax=intel src.ll -o src.s

# Target a specific CPU
llc -mcpu=skylake -mattr=+avx2 src.ll -o src.s

# Show available targets
llc --version
```

### 4. Inspect IR

Key IR constructs to understand:

| Construct | Meaning |
|-----------|---------|
| `alloca` | Stack allocation (pre-SSA; `mem2reg` promotes to registers) |
| `load`/`store` | Memory access |
| `getelementptr` (GEP) | Pointer arithmetic / field access |
| `phi` | SSA φ-node: merges values from predecessor blocks |
| `call`/`invoke` | Function call (`invoke` has exception edges) |
| `icmp`/`fcmp` | Integer/float comparison |
| `br` | Branch (conditional or unconditional) |
| `ret` | Return |
| `bitcast` | Reinterpret bits (no-op in codegen) |
| `ptrtoint`/`inttoptr` | Pointer↔integer (avoid where possible) |

### 5. Key passes

| Pass | Effect |
|------|--------|
| `mem2reg` | Promote alloca to SSA registers |
| `instcombine` | Instruction combining / peephole |
| `simplifycfg` | CFG cleanup, dead block removal |
| `loop-vectorize` | Auto-vectorisation |
| `slp-vectorize` | Superword-level parallelism (straight-line vectorisation) |
| `inline` | Function inlining |
| `gvn` | Global value numbering (common subexpression elimination) |
| `licm` | Loop-invariant code motion |
| `loop-unroll` | Loop unrolling |
| `argpromotion` | Promote pointer args to values |
| `sroa` | Scalar Replacement of Aggregates |

### 6. Debugging missed optimisations

```bash
# Why was a loop not vectorised?
clang -O2 -Rpass-missed=loop-vectorize -Rpass-analysis=loop-vectorize src.c

# Dump pass pipeline
clang -O2 -mllvm -debug-pass=Structure src.c -o /dev/null 2>&1 | less

# Print IR after each pass (very verbose)
opt -passes='default<O2>' -print-after-all src.ll -S 2>&1 | less
```

### 7. Useful llvm tools

| Tool | Purpose |
|------|---------|
| `llvm-dis` | Bitcode → textual IR |
| `llvm-as` | Textual IR → bitcode |
| `llvm-link` | Link multiple bitcode files |
| `llvm-lto` | Standalone LTO |
| `llvm-nm` | Symbols in bitcode/object |
| `llvm-objdump` | Disassemble objects |
| `llvm-profdata` | Merge/show PGO profiles |
| `llvm-cov` | Coverage reporting |
| `llvm-mca` | Machine code analyser (throughput/latency) |

For binutils equivalents, see `skills/binaries/binutils`.

## Related skills

- Use `skills/compilers/clang` for source-level Clang flags
- Use `skills/binaries/linkers-lto` for LTO at link time
- Use `skills/profilers/linux-perf` combined with `llvm-mca` for micro-architectural analysis
