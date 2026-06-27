---
name: code-generation-and-backends
description: Code generation and backends skill for LLVM targets. Use when explaining instruction selection, DAG legalization, target lowering, or adding backend support overview. Activates on queries about LLVM backend, instruction selection, target lowering, llc, TableGen, or codegen pipeline.
---

# Code Generation and Backends

## Purpose

Overview LLVM (and general compiler) backend code generation: IR legalization, SelectionDAG instruction selection, register allocation, assembly emission, and what adding a new target entails — complementing IR skills and `skills/compiler-internals/llvm-passes`.

## When to Use

- Reading `llc` output for a specific target
- Understanding why IR type legalizer inserted extra ops
- Evaluating porting compiler to new architecture (high level)
- Debugging wrong code at asm layer (not IR)

## Workflow

### 1. Backend pipeline (LLVM)

```
LLVM IR per function
├── IR legalizer (types/ops target supports)
├── SelectionDAGBuilder
├── LegalizeTypes / LegalizeOps
├── Instruction selection (pattern match TableGen)
├── Scheduling (pre-RA)
├── Register allocation
├── Prolog/epilog insertion
└── AsmPrinter → .s object
```

### 2. llc usage

```bash
clang -c -emit-llvm -O2 -o foo.bc foo.c
llc -march=aarch64 -O2 foo.bc -o foo.s
llc -march=riscv64 -O2 foo.bc -o foo-rv.s
```

### 3. TableGen patterns (conceptual)

```tablegen
def ADD32rr : Pat<(add i32 GPR:$a, GPR:$b),
                  (ADD32rr GPR:$a, GPR:$b)>;
```

Patterns map DAG nodes to machine instructions. `.td` files define registers, calling conv, instr formats.

### 4. Calling convention lowering

ABI rules become `CC_AArch64` / `CC_X86_64` in TableGen — ties to `skills/computer-architecture/abi-and-calling-conventions`.

### 5. Target triple

```bash
clang --target=arm-none-eabi -c -O2 foo.c
llc -mtriple=thumbv7em-none-eabi foo.bc
```

Mismatch between triple and CPU features (`+neon`, `+crc`) causes legalizer failures or suboptimal code.

### 6. Adding a target (outline)

1. Define register classes and instr formats in TableGen
2. Implement lowering hooks (`TargetLowering`)
3. AsmPrinter and MC layer for relocations
4. Builtin calling convention and ELF/COFF object writer

Full port is large — reuse existing backend closest to arch.

### 7. Agent usage

```
/code-generation-and-backends Trace how this IR add becomes AArch64 ADD instruction
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Cannot select` fatal | Unsupported IR op on target | Legalize or expand op |
| Wrong soft-float | ABI mismatch | Set `-mfloat-abi` / triple |
| Huge stack frame | Many spills post-RA | IR-level pressure reduction |
| llc vs clang differ | Different targets passed | Same `-mtriple` |
| TableGen build fail | Syntax in .td | `llvm-tblgen` error line |

## Related Skills

- `skills/compiler-internals/llvm-ir-and-passes` — pre-codegen IR
- `skills/compiler-internals/compiler-optimizations-deep` — RA intuition
- `skills/compilers/cross-gcc` — embedded triples
- `skills/computer-architecture/abi-and-calling-conventions` — call lowering
- `skills/low-level-programming/assembly-arm` — read emitted asm