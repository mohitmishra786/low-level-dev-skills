---
name: abi-and-calling-conventions
description: ABI and calling conventions skill for cross-language boundaries. Use when explaining System V AMD64, ARM AAPCS, RISC-V psABI, stack frames, variadic calls, or FFI register rules. Activates on queries about calling convention, ABI, System V AMD64, AAPCS, stack frame, variadic function, or FFI registers.
---

# ABI and Calling Conventions

## Purpose

Document application binary interface (ABI) rules: register roles, stack alignment, argument passing, return values, and variadic conventions across System V AMD64, ARM AAPCS, and RISC-V — essential for assembly, FFI, and debugging.

## When to Use

- Writing assembly thunks or inline asm clobbers
- Debugging corrupted stack in mixed C/asm
- FFI between Rust/C/Zig (`skills/rust/rust-ffi`, `skills/zig/zig-cinterop`)
- Reading disassembly from `skills/debuggers/gdb`

## Workflow

### 1. System V AMD64 (Linux/macOS)

| Item | Rule |
|------|------|
| Integer args | `rdi, rsi, rdx, rcx, r8, r9` |
| XMM args | `xmm0`–`xmm7` (float) |
| Return int/ptr | `rax` (+ `rdx` for 128-bit) |
| Stack alignment | 16-byte before `call` |
| Red zone | 128 bytes below `rsp` (Linux) |
| Callee-saved | `rbx, rbp, r12–r15` |

```c
/* void foo(int a, int b, int c, int d, int e, int f, int g); */
/* a–f in regs, g on stack */
```

Windows x64 differs — see `skills/compilers/msvc-cl`.

### 2. ARM AAPCS (AArch32/AArch64)

**AArch64:**

| Item | Rule |
|------|------|
| Integer args | `x0`–`x7` |
| Float args | `v0`–`v7` |
| Return | `x0`/`x1` or `v0` |
| Stack align | 16-byte |
| Callee-saved | `x19`–`x28`, `fp` (`x29`), `lr` (`x30`) |

Thumb interworking: LSB of function pointer set for Thumb code.

See `skills/low-level-programming/assembly-arm`.

### 3. RISC-V psABI (RV64)

| Item | Rule |
|------|------|
| Integer args | `a0`–`a7` |
| Callee-saved | `s0`–`s11`, `sp` |
| Return | `a0`, `a1` |
| Stack align | 16-byte |

See `skills/low-level-programming/assembly-riscv`.

### 4. Stack frame layout (conceptual)

```
high addresses
├── return address
├── saved frame pointer
├── local variables
├── spill slots / alignment padding
└── outgoing args (if any)
low addresses (rsp)
```

### 5. Variadic functions

System V: `al` holds number of vector args used; `register_save_area` on stack for `va_start`. Prefer typed wrappers over raw `va_arg` in portable FFI.

### 6. Verify in compiler output

```bash
gcc -O2 -S -o - foo.c   # study .cfi_* and mov args
objdump -d -M intel ./a.out
```

### 7. Agent usage

```
/abi-and-calling-conventions Which registers hold args 5–8 in AArch64 for my C function?
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Crash on `call` | Stack misaligned | Align `rsp` mod 16 |
| Wrong float arg | XMM vs GPR mismatch | Match prototype |
| Corrupt callee-saved | Asm clobber missing | List in clobber or save |
| FFI garbage | Windows vs SysV mix | Match toolchain ABI |
| Variadic UB | Wrong type to `va_arg` | Cast to promoted type |

## Related Skills

- `skills/low-level-programming/assembly-x86` — x86-64 asm
- `skills/low-level-programming/assembly-arm` — AAPCS examples
- `skills/low-level-programming/assembly-riscv` — RISC-V asm
- `skills/rust/rust-ffi` — `extern "C"` guarantees
- `skills/binaries/elf-inspection` — symbol and relocation views