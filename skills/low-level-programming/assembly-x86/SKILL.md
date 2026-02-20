---
name: assembly-x86
description: x86-64 assembly skill for reading, writing, and debugging assembly code. Use when reading GCC/Clang assembly output, writing inline asm in C/C++, understanding the System V AMD64 ABI calling convention, or debugging register and stack state. Activates on queries about x86-64 assembly, AT&T vs Intel syntax, inline asm, calling conventions, SIMD intrinsics, or reading disassembly output from objdump or GDB.
---

# x86-64 Assembly

## Purpose

Guide agents through x86-64 assembly: reading compiler output, understanding the ABI, writing inline asm, and common patterns.

## Triggers

- "How do I read the assembly GCC generated?"
- "What are the x86-64 registers?"
- "What is the calling convention on Linux/macOS?"
- "How do I write inline assembly in C?"
- "How do I use SSE/AVX intrinsics?"
- "This assembly uses `%rsp` / `%rbp` — what does it mean?"

## Workflow

### 1. Generate and read assembly

```bash
# AT&T syntax (GCC default)
gcc -S -O2 -fverbose-asm foo.c -o foo.s

# Intel syntax
gcc -S -masm=intel -O2 foo.c -o foo.s

# From GDB
(gdb) disassemble /s main    # with source
(gdb) x/20i $rip

# From objdump
objdump -d -M intel -S prog  # Intel + source (needs -g)
```

### 2. x86-64 registers

| 64-bit | 32-bit | 16-bit | 8-bit high | 8-bit low | Purpose |
|--------|--------|--------|-----------|----------|---------|
| `%rax` | `%eax` | `%ax` | `%ah` | `%al` | Return value / accumulator |
| `%rbx` | `%ebx` | `%bx` | `%bh` | `%bl` | Callee-saved |
| `%rcx` | `%ecx` | `%cx` | `%ch` | `%cl` | 4th arg / count |
| `%rdx` | `%edx` | `%dx` | `%dh` | `%dl` | 3rd arg / 2nd return |
| `%rsi` | `%esi` | `%si` | — | `%sil` | 2nd arg |
| `%rdi` | `%edi` | `%di` | — | `%dil` | 1st arg |
| `%rbp` | `%ebp` | `%bp` | — | `%bpl` | Frame pointer (callee-saved) |
| `%rsp` | `%esp` | `%sp` | — | `%spl` | Stack pointer |
| `%r8`–`%r11` | `%r8d`–`%r11d` | `%r8w`–`%r11w` | — | `%r8b`–`%r11b` | 5th–8th args / caller-saved |
| `%r12`–`%r15` | `%r12d`–`%r15d` | `%r12w`–`%r15w` | — | `%r12b`–`%r15b` | Callee-saved |
| `%rip` | | | | | Instruction pointer |
| `%rflags` | `%eflags` | | | | Status flags |
| `%xmm0`–`%xmm7` | | | | | FP/SIMD args and return |
| `%xmm8`–`%xmm15` | | | | | Caller-saved SIMD |
| `%ymm0`–`%ymm15` | | | | | AVX 256-bit |
| `%zmm0`–`%zmm31` | | | | | AVX-512 512-bit |

### 3. System V AMD64 ABI (Linux, macOS, FreeBSD)

**Integer/pointer argument registers (in order):**
`%rdi, %rsi, %rdx, %rcx, %r8, %r9`

**Floating-point argument registers:**
`%xmm0`–`%xmm7`

**Return values:**
- Integer: `%rax` (low), `%rdx` (high if 128-bit)
- Float: `%xmm0` (low), `%xmm1` (high)

**Caller-saved (scratch):** `%rax, %rcx, %rdx, %rsi, %rdi, %r8–%r11, %xmm0–%xmm15`

**Callee-saved (must preserve):** `%rbx, %rbp, %r12–%r15`

**Stack:** 16-byte aligned before `call`; `call` pushes 8 bytes → 16-byte aligned at function entry after prologue.

**Red zone:** 128 bytes below `%rsp` may be used by leaf functions without adjusting `%rsp`. Not available in kernel/signal handlers.

### 4. Common instruction patterns

| Pattern | Meaning |
|---------|---------|
| `mov %rdi, %rax` | Copy rdi to rax |
| `mov (%rdi), %rax` | Load 8 bytes from address in rdi |
| `mov %rax, 8(%rdi)` | Store rax to rdi+8 |
| `lea 8(%rdi), %rax` | Load effective address rdi+8 into rax (no memory access) |
| `push %rbx` | Push rbx; rsp -= 8 |
| `pop %rbx` | Pop into rbx; rsp += 8 |
| `call foo` | Push return addr; jmp foo |
| `ret` | Pop return addr; jmp to it |
| `xor %eax, %eax` | Zero rax (smaller encoding than `mov $0, %rax`) |
| `test %rax, %rax` | Set ZF if rax == 0 (cheaper than `cmp $0, %rax`) |
| `cmp $5, %rdi` | Set flags for rdi - 5 |
| `jl label` | Jump if signed less than |

### 5. AT&T vs Intel syntax

| Feature | AT&T | Intel |
|---------|------|-------|
| Operand order | source, dest | dest, source |
| Register prefix | `%rax` | `rax` |
| Immediate prefix | `$42` | `42` |
| Memory operand | `8(%rdi)` | `[rdi+8]` |
| Size suffix | `movl`, `movq` | — (inferred) |

GCC emits AT&T by default. Use `-masm=intel` for Intel syntax.

### 6. Inline assembly (GCC extended asm)

```c
// Basic: increment a register
int x = 5;
__asm__ volatile (
    "incl %0"
    : "=r"(x)   // outputs: =r means write-only register
    : "0"(x)    // inputs: 0 means same as output 0
    : // clobbers: none
);

// CPUID example
uint32_t eax, ebx, ecx, edx;
__asm__ volatile (
    "cpuid"
    : "=a"(eax), "=b"(ebx), "=c"(ecx), "=d"(edx)
    : "a"(1)    // input: leaf 1
);

// Atomic increment
static inline int atomic_inc(volatile int *p) {
    int ret;
    __asm__ volatile (
        "lock; xaddl %0, %1"
        : "=r"(ret), "+m"(*p)
        : "0"(1)
        : "memory"
    );
    return ret + 1;
}
```

Constraint codes:
- `"r"` — any general register
- `"m"` — memory operand
- `"i"` — immediate integer
- `"a"`, `"b"`, `"c"`, `"d"` — specific registers (%rax, %rbx, %rcx, %rdx)
- `"="` prefix — output (write-only)
- `"+"` prefix — read-write
- `"memory"` clobber — tells compiler memory may be modified (barrier)

### 7. SSE/AVX intrinsics (preferred over inline asm)

```c
#include <immintrin.h>   // includes all x86 SIMD headers

// Add 8 floats at once with AVX
__m256 a = _mm256_loadu_ps(arr_a);   // load 8 floats (unaligned)
__m256 b = _mm256_loadu_ps(arr_b);
__m256 c = _mm256_add_ps(a, b);
_mm256_storeu_ps(result, c);
```

Check CPU support at compile time: `-mavx2` or `-march=native`.
Check at runtime: `__builtin_cpu_supports("avx2")`.

For a full register and instruction reference, see [references/reference.md](references/reference.md).

## Related skills

- Use `skills/low-level-programming/assembly-arm` for AArch64/ARM assembly
- Use `skills/compilers/gcc` for `-S -masm=intel` flag details
- Use `skills/debuggers/gdb` for stepping through assembly (`si`, `ni`, `x/i`)
