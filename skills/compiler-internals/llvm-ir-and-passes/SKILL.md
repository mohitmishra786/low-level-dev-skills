---
name: llvm-ir-and-passes
description: LLVM IR and passes skill for reading compiler IR. Use when analyzing LLVM IR, understanding SSA, pass pipeline order, or running opt on bitcode. Activates on queries about LLVM IR, SSA form, opt passes, llvm-dis, pass pipeline, or reading .ll files.
---

# LLVM IR and Passes

## Purpose

Teach agents to read and reason about LLVM IR (SSA, types, terminators), navigate the standard pass pipeline, and use `opt`/`llvm-dis` for inspection. Complements `skills/compilers/llvm` (toolchain) and `skills/compiler-internals/llvm-passes` (writing plugins) — not merged.

## When to Use

- Understanding what `-O2` changed in generated IR
- Triaging miscompiles between Clang versions
- Preparing to write a custom pass
- Teaching SSA and dominance without writing C++ passes yet

## Workflow

### 1. LLVM IR structure

```llvm
; Function in SSA form
define i32 @add(i32 %a, i32 %b) {
entry:
  %sum = add i32 %a, %b
  ret i32 %sum
}
```

Key concepts: basic blocks, PHI nodes at merges, typed values (`i32`, `ptr`, vectors).

### 2. Emit IR from Clang

```bash
clang -S -emit-llvm -O0 -o foo.ll foo.c
clang -c -emit-llvm -O2 -o foo.bc foo.c
llvm-dis foo.bc -o foo.ll
```

### 3. Standard optimization pipeline (New PM)

Clang `-O2` roughly runs:

```
SimplifyCFG → InstCombine → GVN → LICM → LoopVectorize → ...
```

Inspect with:

```bash
opt -passes='default<O2>' -S foo.ll -o foo-opt.ll
opt -passes='default<O2>' -print-passes foo.ll 2>&1 | head
```

### 4. Useful analysis passes

| Pass | Shows |
|------|-------|
| `-passes=print<domtree>` | Dominator tree |
| `-passes=print<loops>` | Loop nests |
| `-passes=print-alias-sets` | Alias sets |

```bash
opt -passes='print<domtree>' -disable-output foo.ll
```

### 5. Reading PHI and UB

```llvm
merge:
  %v = phi i32 [ %a, %then ], [ %b, %else ]
```

`undef` and `poison` in IR model LLVM poison semantics — distinct from C UB but related.

### 6. Compare before/after

```bash
opt -passes='instcombine,simplifycfg' -S foo.ll -o - | diff -u foo.ll -
```

### 7. Agent usage

```
/llvm-ir-and-passes Explain this PHI node and which pass likely created it
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Pass not found | LLVM version rename | `opt --print-passes` for your build |
| IR mismatch | Different LLVM major | Match clang/opt versions |
| "optnone" blocks opts | `-O0` attribute | Compile with `-O1+` |
| Huge IR | Inlined headers | `-fno-discard-value-names` off; filter function |
| Wrong pipeline | Legacy vs NPM | Use `-passes=` syntax |

## Related Skills

- `skills/compilers/llvm` — toolchain overview
- `skills/compiler-internals/llvm-passes` — writing PassPlugins
- `skills/compiler-internals/compiler-optimizations-deep` — RA and ISel
- `skills/compiler-internals/compiler-frontend` — IR generation
- `skills/rust/rustc-basics` — `rustc --emit=llvm-ir`