---
name: assembly-riscv
description: RISC-V assembly skill for RV32/RV64 programming. Use when working with the RISC-V ISA, calling conventions (psABI), inline assembly with GCC/Clang, understanding extension naming (IMAFD), compressed instructions, or simulating RISC-V with QEMU and GDB remote debugging. Activates on queries about RISC-V assembly, RV32, RV64, RISC-V calling convention, RISC-V inline asm, RISC-V extensions, QEMU RISC-V, or RISC-V GDB.
---

# RISC-V Assembly

## Purpose

Guide agents through RISC-V assembly programming: RV32/RV64 instruction sets, register naming and calling conventions (psABI), ISA extension naming, inline assembly with GCC/Clang, compressed (RVC) instructions, and QEMU-based simulation with GDB remote debugging.

## Triggers

- "How do I write RISC-V assembly?"
- "What are the RISC-V calling convention registers?"
- "How do I use inline asm for RISC-V in C?"
- "What do RISC-V extension letters mean (IMAFD)?"
- "How do I simulate RISC-V with QEMU?"
- "How do I debug RISC-V code with GDB?"

## Workflow

### 1. Register file and calling convention

RISC-V has 32 integer registers (x0–x31) with ABI names:

| Register | ABI name | Role | Saved by |
|----------|----------|------|----------|
| x0 | zero | Hard-wired zero | — |
| x1 | ra | Return address | Caller |
| x2 | sp | Stack pointer | Callee |
| x3 | gp | Global pointer | — |
| x4 | tp | Thread pointer | — |
| x5–x7 | t0–t2 | Temporaries | Caller |
| x8 | s0/fp | Frame pointer | Callee |
| x9 | s1 | Saved register | Callee |
| x10–x11 | a0–a1 | Arguments / return values | Caller |
| x12–x17 | a2–a7 | Arguments | Caller |
| x18–x27 | s2–s11 | Saved registers | Callee |
| x28–x31 | t3–t6 | Temporaries | Caller |

Floating-point registers (F extension): f0–f31 (fa0–fa7 for arguments).

### 2. Basic instructions

```asm
# Arithmetic (R and I type)
add   a0, a1, a2      # a0 = a1 + a2
sub   a0, a1, a2      # a0 = a1 - a2
addi  a0, a1, 42      # a0 = a1 + 42 (immediate)
mul   a0, a1, a2      # a0 = a1 * a2 (M extension)
div   a0, a1, a2      # signed divide (M extension)
rem   a0, a1, a2      # remainder (M extension)

# Logical
and   a0, a1, a2      # bitwise AND
or    a0, a1, a2      # bitwise OR
xor   a0, a1, a2      # bitwise XOR
sll   a0, a1, a2      # shift left logical
srl   a0, a1, a2      # shift right logical (unsigned)
sra   a0, a1, a2      # shift right arithmetic (signed)

# Load / store
lw    a0, 0(sp)       # load word (32-bit)
ld    a0, 0(sp)       # load doubleword (64-bit, RV64)
lh    a0, 4(sp)       # load halfword (sign-extended)
lbu   a0, 8(sp)       # load byte (zero-extended)
sw    a0, 0(sp)       # store word
sd    a0, 0(sp)       # store doubleword (RV64)

# Branches (compare and branch)
beq   a0, a1, label   # branch if equal
bne   a0, a1, label   # branch if not equal
blt   a0, a1, label   # branch if less than (signed)
bltu  a0, a1, label   # branch if less than (unsigned)
bge   a0, a1, label   # branch if ≥ (signed)

# Jumps
j     label           # unconditional jump (pseudoinstruction: jal x0, label)
jal   ra, func        # jump and link (call)
jalr  zero, ra, 0     # jump to ra (return: pseudoinstruction: ret)
```

### 3. Minimal function (psABI calling convention)

```asm
.section .text
.global add_numbers
# int add_numbers(int a, int b);  — a in a0, b in a1, return in a0
add_numbers:
    add   a0, a0, a1   # result = a + b
    ret                # return (jalr zero, ra, 0)

.global factorial
# long factorial(int n);  — n in a0
factorial:
    addi  sp, sp, -16      # allocate stack frame
    sd    ra, 8(sp)        # save return address (RV64)
    sd    s0, 0(sp)        # save s0 (callee-saved)

    mv    s0, a0           # s0 = n
    li    a0, 1            # default return 1
    blez  s0, .done        # if n <= 0, return 1

    addi  a0, s0, -1      # a0 = n - 1
    call  factorial        # recursive call: factorial(n-1)
    mul   a0, a0, s0       # a0 = result * n

.done:
    ld    ra, 8(sp)        # restore ra
    ld    s0, 0(sp)        # restore s0
    addi  sp, sp, 16       # deallocate
    ret
```

### 4. ISA extension naming

RISC-V extensions are combined as a string after the base ISA:

| Letter | Extension | Description |
|--------|-----------|-------------|
| I | Integer | Base 32/64-bit integer (RV32I, RV64I) |
| M | Multiply | Integer multiply and divide |
| A | Atomic | Atomic memory operations (lr/sc, AMOs) |
| F | Float | Single-precision float |
| D | Double | Double-precision float |
| C | Compressed | 16-bit compressed instructions |
| G | General | = IMAFD (shorthand) |
| V | Vector | Vector instructions (SIMD) |
| Zicsr | CSR | Control/status register access |
| Zifencei | Fence.i | Instruction-fetch fence |
| Zba/Zbb/Zbc/Zbs | Bit manipulation | Bit ops (B extension set) |
| Ztso | TSO | Total Store Ordering memory model |

Common targets:
- Embedded: `rv32imac` — no floating point, with atomics and compressed
- Linux app: `rv64gc` — full general + compressed
- High performance: `rv64gcv` — + vector

### 5. Inline assembly (GCC/Clang)

```c
// Read a CSR register (e.g., cycle counter)
static inline uint64_t read_cycle(void) {
    uint64_t val;
    asm volatile ("rdcycle %0" : "=r"(val));
    return val;
}

// Atomic swap
static inline int atomic_swap(int *ptr, int new_val) {
    int old;
    asm volatile (
        "amoswap.w.aqrl %0, %2, (%1)"
        : "=r"(old)
        : "r"(ptr), "r"(new_val)
        : "memory"
    );
    return old;
}

// Memory fence
static inline void memory_fence(void) {
    asm volatile ("fence rw, rw" ::: "memory");
}

// CSR read/write
#define csr_read(csr) ({                    \
    uint64_t _v;                            \
    asm volatile ("csrr %0, " #csr : "=r"(_v)); \
    _v;                                     \
})

uint64_t mstatus = csr_read(mstatus);
```

### 6. Compressed instructions (RVC)

RVC replaces common 32-bit instructions with 16-bit versions when:
- Register is in x8–x15 (for `c.` versions)
- Immediate fits in smaller field
- Specific instruction patterns match

```bash
# Enable C extension in GCC
riscv64-linux-gnu-gcc -march=rv64gc prog.c -o prog

# Check if compressed instructions were generated
riscv64-linux-gnu-objdump -d prog | grep "c\."
# c.addi, c.ld, c.sw, c.j, etc.

# Disable compressed (for debugging or targets without C)
riscv64-linux-gnu-gcc -march=rv64g prog.c -o prog
```

### 7. QEMU simulation and GDB

```bash
# Install QEMU RISC-V
apt-get install qemu-user qemu-system-riscv64

# User-mode emulation (run RV64 binary on x86 host)
qemu-riscv64 ./prog

# System emulation (full bare-metal VM)
qemu-system-riscv64 \
  -machine virt \
  -nographic \
  -kernel firmware.elf \
  -gdb tcp::1234 \
  -S     # start paused

# GDB remote session
riscv64-linux-gnu-gdb prog
(gdb) target remote :1234
(gdb) load
(gdb) break main
(gdb) continue
```

For the RISC-V psABI calling convention details, see [references/riscv-abi.md](references/riscv-abi.md).

## Related skills

- Use `skills/low-level-programming/assembly-arm` for AArch64 comparison
- Use `skills/low-level-programming/assembly-x86` for x86-64 assembly
- Use `skills/embedded/openocd-jtag` for real hardware RISC-V debugging
- Use `skills/compilers/cross-gcc` for RISC-V cross-compilation setup
