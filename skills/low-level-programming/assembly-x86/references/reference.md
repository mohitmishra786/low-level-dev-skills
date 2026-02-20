# x86-64 Assembly Reference

Source: <https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html>
Source: <https://gitlab.com/x86-psABIs/x86-64-ABI> (System V AMD64 ABI)

## Table of Contents

1. [Instruction set quick reference](#instruction-set-quick-reference)
2. [RFLAGS bits](#rflags-bits)
3. [Conditional jump codes](#conditional-jump-codes)
4. [SIMD header files](#simd-header-files)
5. [Prologue / epilogue patterns](#prologue--epilogue-patterns)

---

## Instruction set quick reference

### Data movement

| Instruction | Effect |
|-------------|--------|
| `mov src, dst` | Copy |
| `movzx src, dst` | Copy with zero-extend |
| `movsx src, dst` | Copy with sign-extend |
| `movq xmm, r64` | Move 64-bit integer from XMM to GPR |
| `lea mem, dst` | Load effective address (no memory access) |
| `push r64` | `rsp -= 8; [rsp] = r64` |
| `pop r64` | `r64 = [rsp]; rsp += 8` |
| `xchg src, dst` | Swap (with implicit LOCK for mem operand) |
| `cmpxchg src, dst` | Compare and swap (needs LOCK prefix) |

### Arithmetic

| Instruction | Effect |
|-------------|--------|
| `add src, dst` | `dst += src` |
| `sub src, dst` | `dst -= src` |
| `mul r/m` | `rdx:rax = rax * r/m` (unsigned) |
| `imul r/m` | `rdx:rax = rax * r/m` (signed) |
| `imul src, dst` | `dst *= src` (2-operand) |
| `imul imm, src, dst` | `dst = src * imm` (3-operand) |
| `div r/m` | `rax = rdx:rax / r/m; rdx = remainder` |
| `inc dst` | `dst++` |
| `dec dst` | `dst--` |
| `neg dst` | `dst = -dst` |
| `idiv r/m` | Signed division |

### Bit operations

| Instruction | Effect |
|-------------|--------|
| `and src, dst` | Bitwise AND |
| `or src, dst` | Bitwise OR |
| `xor src, dst` | Bitwise XOR |
| `not dst` | Bitwise NOT |
| `shl/sal cnt, dst` | Shift left |
| `shr cnt, dst` | Shift right (logical) |
| `sar cnt, dst` | Shift right (arithmetic, sign-extends) |
| `rol/ror cnt, dst` | Rotate left/right |
| `bsf src, dst` | Bit scan forward (index of lowest set bit) |
| `bsr src, dst` | Bit scan reverse (index of highest set bit) |
| `tzcnt src, dst` | Count trailing zeros |
| `lzcnt src, dst` | Count leading zeros |
| `popcnt src, dst` | Count set bits |
| `bt src, idx` | Bit test |
| `bts/btr/btc` | Bit test and set/reset/complement |

### Comparison and branching

| Instruction | Effect |
|-------------|--------|
| `cmp a, b` | Set flags for `b - a` without storing result |
| `test a, b` | Set flags for `a & b` without storing result |
| `jmp target` | Unconditional jump |
| `jcc target` | Conditional jump (see table below) |
| `cmovcc src, dst` | Conditional move |
| `setcc dst` | Set byte to 0 or 1 based on condition |

---

## RFLAGS bits

| Flag | Name | Set when |
|------|------|---------|
| CF | Carry | Unsigned overflow |
| ZF | Zero | Result is zero |
| SF | Sign | Result is negative |
| OF | Overflow | Signed overflow |
| PF | Parity | Low byte has even number of 1s |
| AF | Auxiliary carry | Carry from bit 3 to bit 4 |
| DF | Direction | Controls string instruction direction |

---

## Conditional jump codes

| Instruction | Condition | Flags |
|-------------|-----------|-------|
| `je / jz` | Equal / Zero | ZF=1 |
| `jne / jnz` | Not equal | ZF=0 |
| `jl / jnge` | Signed less | SF≠OF |
| `jle / jng` | Signed ≤ | ZF=1 or SF≠OF |
| `jg / jnle` | Signed > | ZF=0 and SF=OF |
| `jge / jnl` | Signed ≥ | SF=OF |
| `jb / jnae / jc` | Unsigned < | CF=1 |
| `jbe / jna` | Unsigned ≤ | CF=1 or ZF=1 |
| `ja / jnbe` | Unsigned > | CF=0 and ZF=0 |
| `jae / jnb / jnc` | Unsigned ≥ | CF=0 |
| `js` | Negative | SF=1 |
| `jns` | Non-negative | SF=0 |
| `jo` | Overflow | OF=1 |
| `jno` | No overflow | OF=0 |

---

## SIMD header files

| Header | What it provides |
|--------|-----------------|
| `<xmmintrin.h>` | SSE (`__m128`, float ops) |
| `<emmintrin.h>` | SSE2 (int ops, double) |
| `<pmmintrin.h>` | SSE3 |
| `<tmmintrin.h>` | SSSE3 |
| `<smmintrin.h>` | SSE4.1 |
| `<nmmintrin.h>` | SSE4.2 |
| `<immintrin.h>` | AVX, AVX2, FMA, AVX-512 (includes all above) |
| `<x86intrin.h>` | All x86 intrinsics including BMI, ADX |

---

## Prologue / epilogue patterns

### With frame pointer (default at -O0, -Og)

```asm
push   %rbp
mov    %rsp, %rbp
sub    $N, %rsp        ; allocate N bytes for locals
; ... body ...
leave                  ; mov %rbp, %rsp; pop %rbp
ret
```

### Without frame pointer (-fomit-frame-pointer, default at -O1+)

```asm
sub    $N, %rsp        ; allocate locals + align stack
; ... body ...
add    $N, %rsp
ret
```

### Saving callee-saved registers

```asm
push   %rbx
push   %r12
push   %r13
; ... body that uses rbx, r12, r13 ...
pop    %r13
pop    %r12
pop    %rbx
ret
```

Always restore in reverse push order.
