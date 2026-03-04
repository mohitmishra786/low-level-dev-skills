# RISC-V psABI Reference

Source: https://github.com/riscv-non-isa/riscv-elf-psabi-doc

## Integer Calling Convention

### Register Usage

```
Integer registers:
 x0 / zero — constant 0 (cannot write)
 x1 / ra   — return address (caller-saved)
 x2 / sp   — stack pointer (callee-saved, 16-byte aligned at calls)
 x3 / gp   — global pointer (linker-managed)
 x4 / tp   — thread pointer (for TLS)
 x5-x7 / t0-t2   — temporaries (caller-saved)
 x8 / s0/fp      — frame pointer or saved reg (callee-saved)
 x9 / s1         — saved register (callee-saved)
 x10-x11 / a0-a1 — args and return values (caller-saved)
 x12-x17 / a2-a7 — args (caller-saved)
 x18-x27 / s2-s11 — saved registers (callee-saved)
 x28-x31 / t3-t6 — temporaries (caller-saved)
```

### Function Call Sequence

```
Caller responsibilities:
1. Place args in a0-a7 (up to 8 integer args)
   - Args > 64 bits: passed by reference to caller-allocated memory
   - More than 8 args: extra args on stack (in order, aligned)
2. Save caller-saved regs (a0-a7, t0-t6, ra) if needed
3. Execute jal ra, target

Callee responsibilities:
1. Save callee-saved regs (s0-s11, sp) if used
2. Allocate stack frame
3. Execute function body
4. Place return value in a0 (and a1 for 128-bit)
5. Restore saved regs
6. Execute ret (jalr zero, ra, 0)
```

### Stack Frame Layout

```
High address
+------------------+
| incoming args    |  (if > 8 args)
+------------------+  ← old sp
| return address   |  (if leaf: not always saved)
| saved registers  |  (s0-s11 used by this function)
| local variables  |
| outgoing args    |  (if > 8 args for callees)
+------------------+  ← sp (16-byte aligned)
Low address
```

## Floating-Point Calling Convention

```
Floating-point registers (F/D extensions):
 f0-f7 / ft0-ft7   — temporaries (caller-saved)
 f8-f9 / fs0-fs1   — saved registers (callee-saved)
 f10-f11 / fa0-fa1 — args and return values
 f12-f17 / fa2-fa7 — args
 f18-f27 / fs2-fs11 — saved registers (callee-saved)
 f28-f31 / ft8-ft11 — temporaries (caller-saved)
```

ABI variants:
- `ilp32` — 32-bit, no hardware float
- `ilp32f` — 32-bit + single-precision FP in float regs
- `ilp32d` — 32-bit + double-precision FP in float regs
- `lp64` — 64-bit, no hardware float in regs
- `lp64f` — 64-bit + single-precision in float regs
- `lp64d` — 64-bit + double-precision in float regs (default for rv64gc)

## Atomic Operations

```asm
# Load-reserved / store-conditional (for lock-free structures)
lr.w   t0, (a0)           # load reserved word
sc.w   t1, t1, (a0)       # store conditional (t1=0 if success)
bnez   t1, retry          # retry if failed

# Atomic memory operations (AMOs)
amoswap.w  a0, a1, (a2)   # atomic swap
amoadd.w   a0, a1, (a2)   # atomic add, return old value
amoand.w   a0, a1, (a2)   # atomic AND
amoor.w    a0, a1, (a2)   # atomic OR
amoxor.w   a0, a1, (a2)   # atomic XOR
amomin.w   a0, a1, (a2)   # atomic min (signed)
amominu.w  a0, a1, (a2)   # atomic min (unsigned)
amomax.w   a0, a1, (a2)   # atomic max (signed)
amomaxu.w  a0, a1, (a2)   # atomic max (unsigned)

# Ordering suffixes
# .aq  — acquire (loads after this are not reordered before)
# .rl  — release (stores before this are not reordered after)
# .aqrl — sequentially consistent (both)
amoswap.w.aq   t0, t1, (a0)   # acquire semantics
amoswap.w.rl   t0, t1, (a0)   # release semantics
amoswap.w.aqrl t0, t1, (a0)   # full barrier

# Memory fences
fence         # full fence (all device/memory before/after)
fence rw, rw  # equivalent to C++ seq_cst
fence.i       # instruction fetch fence (needed after self-modifying code)
```
