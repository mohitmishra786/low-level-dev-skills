---
name: riscv-vector
description: RISC-V Vector (RVV 1.0) skill for vector-length-agnostic SIMD on RISC-V. Use when writing RVV intrinsics or assembly, choosing SEW and LMUL, checking whether the compiler autovectorized a loop, testing vector code under QEMU with different VLEN values, or targeting the RVA23 profile used by Ubuntu 26.04. Activates on queries about RVV, riscv_vector.h, vsetvli, VLEN, LMUL, __riscv_vle32, rv64gcv, RVA23, rva23u64, or RISC-V SIMD.
---

# RISC-V Vector Extension (RVV 1.0)

## Purpose

Guide agents through RVV 1.0 (checked with GCC 14.2, Clang 23.1 and QEMU 10): the vector-length-agnostic model, intrinsics and assembly, autovectorization, testing under QEMU, and the RVA23 profile.

## Triggers

- "How do I write SIMD code for RISC-V?"
- "What do `vsetvli`, SEW and LMUL mean?"
- "How do I test RVV code without RISC-V hardware?"
- "Did the compiler vectorize my loop for RISC-V?"
- "What is RVA23 and how do I target it?"
- "Why does my RISC-V binary die with an illegal instruction?"

## Workflow

### 1. The vector-length-agnostic model

RVV registers are `VLEN` bits wide, and `VLEN` is a property of the hardware (128 bits and up),
not of the ISA. Code asks the hardware each iteration how many elements it may process:

| Term | Meaning |
|------|---------|
| `VLEN` | Bits per vector register (implementation-defined, power of two ≥ 128 for RVA23) |
| `SEW` | Selected element width: `e8`, `e16`, `e32`, `e64` |
| `LMUL` | Register grouping: `m1`, `m2`, `m4`, `m8` (or fractional `mf2`...); `m8` uses 8 registers as one |
| `VLMAX` | `VLEN / SEW * LMUL` elements |
| `vl` | Elements processed by the current instructions, set by `vsetvli` (≤ VLMAX) |
| `ta`, `ma` | Tail/mask agnostic: inactive elements may be overwritten (faster) |

The same binary runs on any `VLEN`: a loop strip-mines with `vl = vsetvl(remaining)` and needs no
scalar tail. That is the main difference from fixed-width SSE/AVX/NEON code.

### 2. Intrinsics

```c
/* saxpy.c — RVV 1.0 intrinsics: y = a*x + y, vector-length agnostic */
#include <riscv_vector.h>
#include <stddef.h>
#include <stdio.h>

void saxpy_rvv(size_t n, float a, const float *x, float *y)
{
    for (size_t vl; n > 0; n -= vl, x += vl, y += vl) {
        vl = __riscv_vsetvl_e32m8(n);                     /* elements this iteration */
        vfloat32m8_t vx = __riscv_vle32_v_f32m8(x, vl);   /* unit-stride load */
        vfloat32m8_t vy = __riscv_vle32_v_f32m8(y, vl);
        vy = __riscv_vfmacc_vf_f32m8(vy, a, vx, vl);      /* vy += a * vx */
        __riscv_vse32_v_f32m8(y, vy, vl);                 /* store */
    }
}

int main(void)
{
    enum { N = 1003 };                                    /* not a multiple of VLEN */
    static float x[N], y[N];
    for (int i = 0; i < N; i++) { x[i] = (float)i; y[i] = 1.0f; }
    saxpy_rvv(N, 2.0f, x, y);
    int bad = 0;
    for (int i = 0; i < N; i++) bad += y[i] != 2.0f * i + 1.0f;
    printf("VLENB=%zu bytes, e32m8 VLMAX=%zu, errors=%d\n",
           __riscv_vlenb(), __riscv_vsetvlmax_e32m8(), bad);
    return bad != 0;
}
```

Naming: `__riscv_<op>_<form>_<type><lmul>`, e.g. `vle32_v_f32m8` (load, vector, f32, LMUL 8),
`vfmacc_vf` (vector-scalar FMA). All intrinsics take `vl` explicitly. Larger LMUL means fewer
loop iterations but fewer free registers; start with `m1`/`m2` for code with many live values
and `m8` for simple streaming loops.

### 3. Building and running under QEMU

```bash
# GCC cross toolchain (Debian/Ubuntu: gcc-riscv64-linux-gnu, qemu-user)
riscv64-linux-gnu-gcc -march=rv64gcv -O2 -static -o saxpy saxpy.c

# Run the static binary with different vector lengths: results must not change
qemu-riscv64 -cpu rv64,v=true,vlen=128 ./saxpy    # VLENB=16 bytes, e32m8 VLMAX=32, errors=0
qemu-riscv64 -cpu rv64,v=true,vlen=1024 ./saxpy   # VLENB=128 bytes, e32m8 VLMAX=256, errors=0

# Clang with the GCC cross toolchain (dynamic binary: give QEMU the target sysroot with -L)
clang --target=riscv64-linux-gnu -march=rv64gcv -O2 -fuse-ld=lld \
      --gcc-install-dir=/usr/lib/gcc-cross/riscv64-linux-gnu/14 -o saxpy_clang saxpy.c
qemu-riscv64 -L /usr/riscv64-linux-gnu -cpu rv64,v=true,vlen=256 ./saxpy_clang
```

Testing at several `vlen` values catches code that silently assumes a register width.

### 4. Assembly

```asm
# void *vmemcpy(void *dst, const void *src, size_t n)  — RVV strip-mined byte copy
    .text
    .globl vmemcpy
    .type vmemcpy, @function
vmemcpy:
    mv      a3, a0                  # keep dst for the return value
1:
    vsetvli t0, a2, e8, m8, ta, ma  # t0 = bytes this round (<= VLMAX for e8/m8)
    vle8.v  v0, (a1)                # load t0 bytes
    vse8.v  v0, (a3)                # store t0 bytes
    add     a1, a1, t0
    add     a3, a3, t0
    sub     a2, a2, t0
    bnez    a2, 1b
    ret
    .size vmemcpy, .-vmemcpy
```

```c
/* vmemcpy_test.c — check the copy against the source buffer */
#include <stdio.h>
#include <string.h>
void *vmemcpy(void *dst, const void *src, size_t n);
int main(void)
{
    static char src[5000], dst[5000];
    for (int i = 0; i < 5000; i++) src[i] = (char)(i * 7);
    vmemcpy(dst, src, sizeof src);
    printf("memcmp=%d\n", memcmp(dst, src, sizeof src));
    return 0;
}
```

```bash
# Save the assembly above as vmemcpy.S
riscv64-linux-gnu-gcc -march=rv64gcv -O2 -static -o vm vmemcpy_test.c vmemcpy.S
qemu-riscv64 -cpu rv64,v=true,vlen=512 ./vm       # memcmp=0
```

Assembling vector code without `v` in `-march` fails with
`extension 'v' or 'zve64x' or 'zve32x' required`.

### 5. Autovectorization

```c
void add(int n, float *restrict c, const float *a, const float *b)
{
    for (int i = 0; i < n; i++) c[i] = a[i] + b[i];
}
```

```bash
riscv64-linux-gnu-gcc -march=rv64gcv -O3 -S -o - add.c | grep -E 'vsetvli|vle32|vfadd'
#   vsetvli a5,a0,e32,m1,ta,ma ... vle32.v ... vfadd.vv   (GCC: LMUL 1, no scalar tail)
clang --target=riscv64-linux-gnu -march=rv64gcv -O3 -S -o - add.c | grep vsetvli
#   vsetvli a4, zero, e32, m2, ta, ma                       (Clang: LMUL 2)

# Why a loop did not vectorize
gcc ... -O3 -fopt-info-vec-missed
clang ... -O3 -Rpass-missed=loop-vectorize
```

`-march=rv64gc` (no `v`) never emits vector instructions; distributions targeting RVA23 enable
it by default.

### 6. The RVA23 profile

RVA23 (ratified 2024) is the application-processor baseline that makes the vector extension
mandatory, along with bit-manipulation, cache-block and hypervisor extensions. Ubuntu 25.10 and
26.04 LTS require RVA23 hardware; first boards include the SpacemiT K3 and Milk-V Jupiter 2.
Older boards (RVA22 and earlier, often without V) need Ubuntu 24.04 or another distribution.

```bash
# Clang 23 accepts the profile name directly (Clang 19 needs -menable-experimental-extensions)
clang --target=riscv64-linux-gnu -march=rva23u64 -O2 ...

# GCC 14 rejects profile names ("ISA string must begin with rv32 or rv64").
# This RVV-capable subset runs on RVA23 hardware but is not the full profile
# (RVA23 also mandates e.g. Zicond, Zvbb, Zfhmin)
riscv64-linux-gnu-gcc -march=rv64gcv_zba_zbb_zbs -O2 ...

# QEMU CPU model with the RVA23 extension set
qemu-riscv64 -cpu rva23s64 ./app
```

### 7. Common problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Illegal instruction` (SIGILL) on start | Binary uses V; CPU or QEMU model lacks it | Check `/proc/cpuinfo` isa string; `qemu-riscv64 -cpu rv64,v=true` |
| Different results at different VLEN | Code assumes a fixed vector width | Derive counts from `vsetvl`/`vlenb`; test several `vlen` values |
| `unrecognized opcode vsetvli ... extension 'v' ... required` | `-march` without `v` | Add `v` (`rv64gcv`) |
| `invalid arch name 'rva23u64'` | Older Clang/GCC without the profile | Clang 23, or list the extensions explicitly |
| Clang cross link: `cannot open crtbeginS.o` | Clang cannot find the GCC cross toolchain | `--gcc-install-dir=/usr/lib/gcc-cross/riscv64-linux-gnu/<ver>` |
| Spills and slow code with `m8` | LMUL too large for the number of live values | Use `m1`/`m2` |

## Related skills

- Use `skills/low-level-programming/assembly-riscv` for scalar RISC-V assembly and the ABI
- Use `skills/low-level-programming/simd-intrinsics` for SSE/AVX/NEON equivalents
- Use `skills/platform/riscv-privileged` for privileged mode and the hypervisor extension
- Use `skills/platform/arm-sve` for Arm's vector-length-agnostic SIMD
