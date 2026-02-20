---
name: assembly-arm
description: AArch64 and ARM assembly skill for reading and writing ARM assembly code. Use when reading GCC/Clang output for AArch64 or ARM Thumb targets, writing inline asm in C/C++, understanding the ARM ABI (AAPCS64/AAPCS), or debugging register and stack state on ARM hardware or QEMU. Activates on queries about AArch64 assembly, ARM Thumb, NEON/SVE SIMD, ARM calling convention, inline asm for ARM, or reading ARM disassembly.
---

# ARM / AArch64 Assembly

## Purpose

Guide agents through AArch64 (64-bit) and ARM (32-bit Thumb) assembly: registers, calling conventions, inline asm, and NEON/SVE SIMD patterns.

## Triggers

- "How do I read ARM64 assembly output?"
- "What are the AArch64 registers and calling convention?"
- "How do I write inline asm for ARM?"
- "What is the difference between AArch64 and ARM Thumb?"
- "How do I use NEON intrinsics?"

## Workflow

### 1. Generate ARM assembly

```bash
# AArch64 (native or cross-compile)
aarch64-linux-gnu-gcc -S -O2 foo.c -o foo.s

# 32-bit ARM Thumb
arm-linux-gnueabihf-gcc -S -O2 -mthumb foo.c -o foo.s

# From objdump
aarch64-linux-gnu-objdump -d -S prog

# From GDB on target
(gdb) disassemble /s main
```

### 2. AArch64 registers (AAPCS64)

| Register | Alias | Role |
|----------|-------|------|
| `x0`–`x7` | — | Arguments 1–8 and return values |
| `x8` | `xr` | Indirect result location (struct return) |
| `x9`–`x15` | — | Caller-saved temporaries |
| `x16`–`x17` | `ip0`, `ip1` | Intra-procedure-call temporaries (used by linker) |
| `x18` | `pr` | Platform register (reserved on some OS) |
| `x19`–`x28` | — | Callee-saved |
| `x29` | `fp` | Frame pointer (callee-saved) |
| `x30` | `lr` | Link register (return address) |
| `sp` | — | Stack pointer (must be 16-byte aligned at call) |
| `pc` | — | Program counter (not directly accessible) |
| `xzr` | `wzr` | Zero register (reads as 0, writes discarded) |
| `v0`–`v7` | `q0`–`q7` | FP/SIMD args and return |
| `v8`–`v15` | — | Callee-saved SIMD (lower 64 bits only) |
| `v16`–`v31` | — | Caller-saved temporaries |

Width variants: `x0` (64-bit), `w0` (32-bit, zero-extends to 64), `h0` (16), `b0` (8).

### 3. AAPCS64 calling convention

**Integer/pointer args:** `x0`–`x7`
**Float/SIMD args:** `v0`–`v7`
**Return:** `x0` (int), `x0`+`x1` (128-bit), `v0` (float/SIMD)
**Callee-saved:** `x19`–`x28`, `x29` (fp), `x30` (lr), `v8`–`v15` (lower 64 bits)
**Caller-saved:** everything else

Stack must be 16-byte aligned at any `bl` or `blr` instruction.

### 4. Common AArch64 instructions

| Instruction | Effect |
|-------------|--------|
| `mov x0, x1` | Copy register |
| `mov x0, #42` | Load immediate |
| `movz x0, #0x1234, lsl #16` | Move zero-extended with shift |
| `movk x0, #0xabcd` | Move with keep (partial update) |
| `ldr x0, [x1]` | Load 64-bit from address in x1 |
| `ldr x0, [x1, #8]` | Load from x1+8 |
| `str x0, [x1, #8]` | Store x0 to x1+8 |
| `ldp x0, x1, [sp, #16]` | Load pair (two regs at once) |
| `stp x29, x30, [sp, #-16]!` | Store pair, pre-decrement sp |
| `add x0, x1, x2` | x0 = x1 + x2 |
| `add x0, x1, #8` | x0 = x1 + 8 |
| `sub x0, x1, x2` | x0 = x1 - x2 |
| `mul x0, x1, x2` | x0 = x1 * x2 |
| `sdiv x0, x1, x2` | Signed divide |
| `udiv x0, x1, x2` | Unsigned divide |
| `cmp x0, x1` | Set flags for x0 - x1 |
| `cbz x0, label` | Branch if x0 == 0 |
| `cbnz x0, label` | Branch if x0 != 0 |
| `bl func` | Branch with link (call) |
| `blr x0` | Branch with link to address in x0 |
| `ret` | Return (branch to x30) |
| `ret x0` | Return to address in x0 |
| `adrp x0, symbol` | PC-relative page address |
| `add x0, x0, :lo12:symbol` | Low 12 bits of symbol offset |

### 5. Typical function prologue/epilogue

```asm
// Non-leaf function
stp  x29, x30, [sp, #-32]!   // save fp, lr; allocate 32 bytes
mov  x29, sp                  // set frame pointer
stp  x19, x20, [sp, #16]     // save callee-saved registers
// ... body ...
ldp  x19, x20, [sp, #16]     // restore
ldp  x29, x30, [sp], #32     // restore fp, lr; deallocate
ret

// Leaf function (no calls, no callee-saved regs needed)
// Can use red zone (no rsp adjustment) — but AArch64 has no red zone
sub  sp, sp, #16             // allocate locals
// ... body ...
add  sp, sp, #16
ret
```

### 6. Inline assembly (GCC/Clang)

```c
// Barrier
__asm__ volatile ("dmb ish" ::: "memory");

// Load acquire
static inline int load_acquire(volatile int *p) {
    int val;
    __asm__ volatile ("ldar %w0, %1" : "=r"(val) : "Q"(*p));
    return val;
}

// Store release
static inline void store_release(volatile int *p, int val) {
    __asm__ volatile ("stlr %w1, %0" : "=Q"(*p) : "r"(val));
}

// Read system counter
static inline uint64_t read_cntvct(void) {
    uint64_t val;
    __asm__ volatile ("mrs %0, cntvct_el0" : "=r"(val));
    return val;
}
```

AArch64-specific constraints:

- `"Q"` — memory operand suitable for exclusive/acquire/release instructions
- `"r"` — any general-purpose register
- `"w"` — any FP/SIMD register

### 7. NEON SIMD intrinsics

```c
#include <arm_neon.h>

// Add 4 floats at once
float32x4_t a = vld1q_f32(arr_a);   // load 4 floats
float32x4_t b = vld1q_f32(arr_b);
float32x4_t c = vaddq_f32(a, b);
vst1q_f32(result, c);

// Horizontal sum
float32x4_t sum = vpaddq_f32(c, c);
sum = vpaddq_f32(sum, sum);
float total = vgetq_lane_f32(sum, 0);
```

Naming convention: `v<op><q>_<type>`

- `q` suffix: 128-bit (quad) vector
- `_f32`: float32, `_s32`: int32, `_u8`: uint8, etc.

For a register reference, see [references/reference.md](references/reference.md).

## Related skills

- Use `skills/low-level-programming/assembly-x86` for x86-64 assembly
- Use `skills/compilers/cross-gcc` for cross-compilation toolchain
- Use `skills/debuggers/gdb` for debugging ARM code with gdbserver
