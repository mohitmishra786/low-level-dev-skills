# AArch64 / ARM Assembly Reference

Source: https://developer.arm.com/documentation/ddi0487/latest (ARM Architecture Reference Manual)
Source: https://developer.arm.com/documentation/ihi0055/latest (AAPCS64)

## Table of Contents
1. [Condition codes](#condition-codes)
2. [Key instructions by category](#key-instructions-by-category)
3. [Memory ordering](#memory-ordering)
4. [NEON data types](#neon-data-types)
5. [Thumb-2 notes](#thumb-2-notes)

---

## Condition codes

| Code | Meaning | Flags |
|------|---------|-------|
| `EQ` | Equal | Z=1 |
| `NE` | Not equal | Z=0 |
| `CS/HS` | Carry set / Unsigned ≥ | C=1 |
| `CC/LO` | Carry clear / Unsigned < | C=0 |
| `MI` | Minus (negative) | N=1 |
| `PL` | Plus (non-negative) | N=0 |
| `VS` | Overflow | V=1 |
| `VC` | No overflow | V=0 |
| `HI` | Unsigned > | C=1, Z=0 |
| `LS` | Unsigned ≤ | C=0 or Z=1 |
| `GE` | Signed ≥ | N=V |
| `LT` | Signed < | N≠V |
| `GT` | Signed > | Z=0, N=V |
| `LE` | Signed ≤ | Z=1 or N≠V |
| `AL` | Always (default) | — |

Conditional branches: `b.eq`, `b.ne`, `b.lt`, `b.ge`, `b.hi`, `b.ls`, etc.

---

## Key instructions by category

### Loads and stores

```asm
ldr  x0, [x1]           ; load 64-bit
ldr  w0, [x1]           ; load 32-bit, zero-extend
ldrb w0, [x1]           ; load 8-bit, zero-extend
ldrsb w0, [x1]          ; load 8-bit, sign-extend
ldrh w0, [x1]           ; load 16-bit, zero-extend

str  x0, [x1]           ; store 64-bit
strb w0, [x1]           ; store byte

; Pre-index: update base before access
ldr  x0, [x1, #8]!     ; x0 = [x1+8]; x1 += 8

; Post-index: update base after access
ldr  x0, [x1], #8      ; x0 = [x1]; x1 += 8

; Pair operations
ldp  x0, x1, [x2]      ; load pair
stp  x0, x1, [x2, #-16]!  ; store pair, pre-decrement

; Exclusive access (for atomics)
ldxr x0, [x1]          ; load exclusive
stxr w2, x0, [x1]      ; store exclusive; w2=0 on success

; Acquire/release (for lock-free)
ldar  x0, [x1]         ; load-acquire
stlr  x0, [x1]         ; store-release
```

### Arithmetic and logic

```asm
add  x0, x1, x2         ; x0 = x1 + x2
add  x0, x1, x2, lsl #2 ; x0 = x1 + (x2 << 2)
adds x0, x1, x2          ; add, set flags
adc  x0, x1, x2          ; add with carry

sub  x0, x1, x2
subs x0, x1, x2          ; sub, set flags
sbc  x0, x1, x2          ; sub with carry

mul   x0, x1, x2
madd  x0, x1, x2, x3    ; x0 = x1*x2 + x3
msub  x0, x1, x2, x3    ; x0 = x3 - x1*x2

and  x0, x1, x2
orr  x0, x1, x2
eor  x0, x1, x2         ; XOR
bic  x0, x1, x2         ; x0 = x1 & ~x2

lsl  x0, x1, #3         ; logical shift left 3
lsr  x0, x1, #3         ; logical shift right 3
asr  x0, x1, #3         ; arithmetic shift right 3
ror  x0, x1, #3         ; rotate right

clz  x0, x1             ; count leading zeros
rbit x0, x1             ; reverse bits
rev  x0, x1             ; reverse bytes (endian swap 64-bit)
```

### Branches and system

```asm
b    label              ; unconditional branch
bl   label              ; branch and link (call)
blr  x0                 ; branch and link to register (indirect call)
br   x0                 ; branch to register (indirect jump)
ret                     ; return (branch to x30)

cbz  x0, label          ; branch if x0 == 0
cbnz x0, label          ; branch if x0 != 0
tbz  x0, #3, label      ; branch if bit 3 of x0 == 0
tbnz x0, #3, label      ; branch if bit 3 != 0

nop                     ; no operation
wfe                     ; wait for event
wfi                     ; wait for interrupt
isb                     ; instruction sync barrier
dsb  sy                 ; data sync barrier
dmb  ish                ; data memory barrier (inner shareable)

mrs  x0, cntvct_el0     ; read virtual timer count
mrs  x0, nzcv           ; read flags register
msr  nzcv, x0           ; write flags register
```

---

## Memory ordering

| Instruction | Ordering |
|-------------|---------|
| `ldar` | Load-Acquire (reads after this are ordered after) |
| `stlr` | Store-Release (writes before this are ordered before) |
| `ldaxr` | Load-Acquire Exclusive |
| `stlxr` | Store-Release Exclusive |
| `dmb ish` | Data Memory Barrier (inner shareable domain) |
| `dmb ishld` | DMB for loads only |
| `dmb ishst` | DMB for stores only |
| `dsb ish` | Data Synchronization Barrier |
| `isb` | Instruction Synchronization Barrier |

---

## NEON data types

| C type | Lanes | Element |
|--------|-------|---------|
| `uint8x8_t` | 8 | uint8 |
| `uint8x16_t` | 16 | uint8 |
| `int16x4_t` | 4 | int16 |
| `int16x8_t` | 8 | int16 |
| `int32x2_t` | 2 | int32 |
| `int32x4_t` | 4 | int32 |
| `int64x1_t` | 1 | int64 |
| `int64x2_t` | 2 | int64 |
| `float32x2_t` | 2 | float |
| `float32x4_t` | 4 | float |
| `float64x2_t` | 2 | double |

Common intrinsic categories (prefix `v`):
- Load: `vld1q_f32`, `vld2q_u8` (interleaved)
- Store: `vst1q_f32`
- Arithmetic: `vaddq_f32`, `vsubq_s32`, `vmulq_f32`
- Comparison: `vcgeq_f32`, `vceqq_u8`
- Shift: `vshlq_n_u32`, `vshrq_n_s16`
- Reorder: `vuzpq_u8`, `vzipq_u8`, `vtrn1q_u32`
- Horizontal: `vpaddq_s32`, `vaddvq_f32`

---

## Thumb-2 notes

32-bit ARM with Thumb-2 ISA (Cortex-M, Cortex-A in Thumb state):

- Most 32-bit ARM instructions available as Thumb-2 (32-bit encoding)
- Compact 16-bit encodings for common ops
- `it` (If-Then) block for conditional execution without branches
- No condition codes on most instructions by default; use `s` suffix to update flags
- `bl` range: ±16 MB; use `blx` for ARM↔Thumb interworking
