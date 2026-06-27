---
name: arm-sve
description: ARM SVE skill for scalable vector extension programming. Use when writing SVE intrinsics, predicate registers, VLA loops with svcnt, auto-vectorization with -march=armv9-a+sve2, or debugging SVE in GDB. Activates on queries about SVE, SVE2, predicate registers, svld1, svcnt, arm_sve.h, or Graviton SVE.
---

# ARM SVE

## Purpose

Guide agents through ARM Scalable Vector Extension (SVE/SVE2) programming: vector-length agnostic (VLA) code, predicate registers, SVE intrinsics via `<arm_sve.h>`, runtime vector length with `svcnt`, compiler flags, platform differences (Graviton3, Apple M4), and GDB debugging of SVE registers.

## When to Use

- Writing high-performance SIMD on AArch64 servers (AWS Graviton3/4)
- Porting fixed-width NEON code to length-agnostic SVE
- Using predicate masks for loop tails instead of separate cleanup loops
- Auto-vectorizing with GCC/Clang `-march=armv9-a+sve2`
- Debugging SVE register state in GDB on hardware with SVE support
- Exploiting SVE2 dot product and crypto extensions

## Workflow

### 1. SVE vs NEON

| | NEON | SVE/SVE2 |
|---|------|----------|
| Vector width | Fixed (128-bit) | Scalable (128–2048 bits, hardware dependent) |
| Predication | Limited | Full predicate registers P0–P15 |
| Portability across ARM CPUs | Same width everywhere | VLA — adapts to hardware VL |
| Apple Silicon | Always available | M4+ has SVE2 |

### 2. Predicate and VLA concepts

```
SVE registers
├── Z0–Z31  — scalable vector data registers
└── P0–P15  — predicate (mask) registers

Vector Length (VL) — determined at runtime per CPU
svcntb() → bytes per vector
svcntw() → 32-bit elements per vector
```

Code written once runs at full width on any SVE-capable CPU.

### 3. SVE intrinsics example

```c
#include <arm_sve.h>
#include <stddef.h>

void saxpy_sve(float *y, const float *x, float alpha, size_t n) {
    svbool_t pg = svwhilelt_b32(0, n);
    size_t i = 0;

    do {
        svfloat32_t vx = svld1_f32(pg, &x[i]);
        svfloat32_t vy = svld1_f32(pg, &y[i]);
        vy = svmla_n_f32_x(pg, vy, vx, alpha);  // y += alpha * x
        svst1_f32(pg, &y[i], vy);

        i += svcntw();  // advance by vector length in 32-bit elements
        pg = svwhilelt_b32(i, n);
    } while (svptest_any(svptrue_b32(), pg));
}
```

```bash
gcc -march=armv9-a+sve2 -O3 -o saxpy saxpy.c
```

### 4. Key intrinsics

| Intrinsic | Purpose |
|-----------|---------|
| `svld1_f32(pg, ptr)` | Masked load |
| `svst1_f32(pg, ptr, val)` | Masked store |
| `svmul_f32_x(pg, a, b)` | Multiply under predicate |
| `svmla_f32_x(pg, acc, a, b)` | Fused multiply-add |
| `svwhilelt_b32(i, n)` | Predicate for active lanes where i < n |
| `svcntw()` | 32-bit lanes per vector |
| `svptrue_b32()` | All-true predicate |

### 5. Loop tail handling

```c
// SVE handles tails via predicates — no separate scalar epilogue
for (size_t i = 0; i < n; ) {
    svbool_t pg = svwhilelt_b32(i, n);
    // ... vector ops with pg ...
    i += svcntw();
}
```

Contrast with NEON: often needs scalar cleanup for `n % 4 != 0`.

### 6. Compiler auto-vectorization

```bash
# GCC vectorization remarks
gcc -march=armv9-a+sve2 -O3 -fopt-info-vec -o app app.c

# Clang
clang -march=armv9-a+sve2 -O3 -Rpass=vectorize -o app app.c
```

```c
#pragma omp simd  // may use SVE when available
for (int i = 0; i < n; i++)
    c[i] = a[i] + b[i];
```

### 7. Platform differences

| Platform | SVE support |
|----------|-------------|
| AWS Graviton3 (Neoverse V1) | SVE (no SVE2) |
| AWS Graviton4 (Neoverse V2) | SVE + SVE2 |
| Apple M4 | SVE2 |
| Apple M1/M2/M3 | NEON only (no SVE) |

```bash
# Check SVE on Linux
grep -i sve /proc/cpuinfo          # "sve" or "sve2" in Features
# Or: cat /sys/devices/system/cpu/cpu0/regs/identification/id_aa64pfr0_el1
```

### 8. SVE2 extras

SVE2 adds integer dot product, crypto, and bitwise operations:

```c
#include <arm_sve.h>

svint32_t dot = svdot_s32(svptrue_b32(),
    svld1_s8(pg, a), svld1_s8(pg, b));
```

Use for ML inference kernels on Graviton.

### 9. GDB debugging

```bash
gcc -g -march=armv9-a+sve2 -o saxpy saxpy.c
gdb ./saxpy
```

```gdb
(gdb) break saxpy_sve
(gdb) run
(gdb) p $z0          # print SVE vector register
(gdb) p $p0          # print predicate register
(gdb) info registers z0 z1 p0
```

Requires GDB 10+ with SVE support and SVE-capable hardware.

### 10. NEON → SVE2 migration

```
Migration checklist
├── Replace fixed loops (i += 4) with svcntw() strides
├── Add svwhilelt predicates for tails
├── Use _x (merging) vs _z (zeroing) predicated ops intentionally
└── Test on multiple VL hardware or use QEMU sve-max-vq
```

```bash
# QEMU SVE emulation
qemu-aarch64 -cpu max ./saxpy
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Illegal instruction | No SVE hardware | Check cpuinfo; use NEON fallback |
| Wrong results in tail | Inactive lanes modified | Use `_x` predicated ops, not unpredicated |
| Slower than NEON | Short arrays | SVE setup cost; scalar for n < VL |
| Auto-vec failed | Unknown trip count | `-fno-trapping-math`; pragma simd |
| Apple M3 build fails | No SVE on M3 | Guard with `__ARM_FEATURE_SVE` |
| GDB can't print Z regs | Old GDB | Upgrade GDB; run on SVE hardware |

## Related Skills

- `skills/low-level-programming/assembly-arm` — AArch64 assembly and NEON
- `skills/low-level-programming/simd-intrinsics` — general SIMD concepts
- `skills/platform/apple-silicon` — Apple M-series specifics
- `skills/compilers/gcc` — `-march` flags
- `skills/compilers/clang` — vectorization remarks
- `skills/low-level-programming/cpu-cache-opt` — memory layout for SIMD