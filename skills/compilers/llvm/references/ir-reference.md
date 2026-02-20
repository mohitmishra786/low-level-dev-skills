# LLVM IR Reference

Source: <https://llvm.org/docs/LangRef.html>

## Table of Contents

1. [Types](#types)
2. [Instructions](#instructions)
3. [Attributes and metadata](#attributes-and-metadata)
4. [Opt pass names](#opt-pass-names)

---

## Types

| Type | Description |
|------|-------------|
| `i1` | 1-bit integer (boolean) |
| `i8`, `i16`, `i32`, `i64` | Integer of N bits |
| `float` | 32-bit IEEE 754 |
| `double` | 64-bit IEEE 754 |
| `ptr` | Opaque pointer (LLVM 15+) |
| `[N x T]` | Array of N elements of type T |
| `{T1, T2, ...}` | Struct (packed: `<{...}>`) |
| `<N x T>` | Vector of N elements |
| `void` | No value |

---

## Instructions

### Memory

```llvm
%ptr = alloca i32, align 4           ; stack allocation
%val = load i32, ptr %ptr, align 4   ; load
store i32 42, ptr %ptr, align 4      ; store
%p2 = getelementptr i32, ptr %ptr, i64 1  ; pointer arithmetic
```

### Arithmetic

```llvm
%sum  = add  i32 %a, %b
%diff = sub  i32 %a, %b
%prod = mul  i32 %a, %b
%quot = sdiv i32 %a, %b   ; signed divide
%quot = udiv i32 %a, %b   ; unsigned divide
%rem  = srem i32 %a, %b   ; signed remainder
%shl  = shl  i32 %a, 3    ; shift left
%lsr  = lshr i32 %a, 3    ; logical shift right
%asr  = ashr i32 %a, 3    ; arithmetic shift right
%and  = and  i32 %a, %b
%or   = or   i32 %a, %b
%xor  = xor  i32 %a, %b
```

### Comparison

```llvm
%c = icmp eq  i32 %a, %b   ; integer compare: eq ne slt sle sgt sge ult ule ugt uge
%c = fcmp oeq float %a, %b  ; float compare: oeq one olt ole ogt oge ord uno
```

### Control flow

```llvm
br label %next                        ; unconditional branch
br i1 %cond, label %true, label %false  ; conditional branch
ret i32 %val
ret void
%ret = call i32 @foo(i32 %a, i32 %b)
switch i32 %val, label %default [ i32 0, label %case0
                                   i32 1, label %case1 ]
```

### PHI nodes (SSA merging)

```llvm
%result = phi i32 [ %val_from_block_a, %block_a ],
                   [ %val_from_block_b, %block_b ]
```

### Type conversion

```llvm
%i = trunc i64 %x to i32        ; truncate
%x = zext i32 %i to i64         ; zero-extend
%x = sext i32 %i to i64         ; sign-extend
%p = inttoptr i64 %addr to ptr   ; integer to pointer
%n = ptrtoint ptr %p to i64      ; pointer to integer
%f = sitofp i32 %i to float      ; signed int to float
%i = fptosi float %f to i32      ; float to signed int
%d = fpext float %f to double    ; float extend
%f = fptrunc double %d to float  ; float truncate
```

---

## Attributes and metadata

```llvm
; Function attributes
define i32 @foo(i32 %x) noinline nounwind readonly {

; Parameter attributes
define void @bar(i32 noundef %x, ptr nocapture nonnull %p) {

; Inline hint
define i32 @hot() alwaysinline {

; Alignment
%val = load i32, ptr %ptr, align 16
```

Common function attributes:

- `noinline` — never inline
- `alwaysinline` — always inline
- `noreturn` — never returns (like `abort`)
- `nounwind` — never throws an exception
- `readonly` — only reads memory
- `readnone` — does not access memory

---

## Opt pass names (LLVM 14+ new pass manager)

| Pass name | Effect |
|-----------|--------|
| `mem2reg` | Promote alloca to SSA |
| `instcombine` | Instruction combining |
| `simplifycfg` | CFG simplification |
| `gvn` | Global value numbering |
| `licm` | Loop-invariant code motion |
| `loop-vectorize` | Auto-vectorisation |
| `slp-vectorize` | SLP vectorisation |
| `inline` | Function inlining |
| `early-cse` | Early common subexpression elimination |
| `dce` | Dead code elimination |
| `sroa` | Scalar Replacement of Aggregates |
| `loop-unroll` | Loop unrolling |
| `tailcallelim` | Tail call elimination |
| `reassociate` | Reassociation for better constant folding |

Pipeline example:

```bash
opt -passes='mem2reg,instcombine,simplifycfg,gvn,licm' input.ll -S -o out.ll
```
