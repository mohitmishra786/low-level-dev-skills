---
name: simd-intrinsics
description: SIMD intrinsics skill for x86 (SSE/AVX) and ARM (NEON) vectorization. Use when reading auto-vectorization reports, writing SSE2/AVX2/NEON intrinsics, checking CPU feature flags at runtime, choosing between compiler builtins and raw intrinsics, or diagnosing why auto-vectorization failed. Activates on queries about SIMD, SSE2, AVX2, NEON, intrinsics, -fopt-info-vec, auto-vectorization, or vectorization failures.
---

# SIMD Intrinsics

## Purpose

Guide agents through SIMD: reading auto-vectorization output, writing SSE2/AVX2/NEON intrinsics, runtime CPU feature detection, and choosing between compiler auto-vectorization and manual intrinsics.

## Triggers

- "How do I check if my loop is being auto-vectorized?"
- "How do I write SSE2/AVX2 intrinsics?"
- "Auto-vectorization failed — how do I fix it?"
- "How do I check for CPU features at runtime?"
- "Should I use intrinsics or let the compiler vectorize?"
- "How do I write NEON intrinsics for ARM?"

## Workflow

### 1. Check auto-vectorization

```bash
# GCC: show vectorization info
gcc -O2 -march=native -fopt-info-vec src/hot.c -o hot

# Verbose: show missed + successful
gcc -O2 -march=native -fopt-info-vec-missed -fopt-info-vec-optimized src/hot.c

# Clang: vectorization remarks
clang -O2 -march=native \
    -Rpass=loop-vectorize \
    -Rpass-missed=loop-vectorize \
    -Rpass-analysis=loop-vectorize \
    src/hot.c -o hot

# Example missed message:
# hot.c:15:5: remark: loop not vectorized: value that could not be identified as
# reduction is used outside the loop [-Rpass-missed=loop-vectorize]
```

Common auto-vectorization blockers:

| Blocker | Fix |
|---------|-----|
| Loop-carried dependency | Restructure to remove dependency |
| Data-dependent exit (early return) | Move exit after loop |
| Non-contiguous memory | Use gather/scatter or restructure |
| Aliasing (pointer may alias) | Add `__restrict__` or `restrict` |
| Unknown trip count | Add `__builtin_expect` or hint |
| Function call in loop body | Inline the function |

```c
// Help the compiler by adding restrict
void add_arrays(float * __restrict__ dst,
                const float * __restrict__ a,
                const float * __restrict__ b,
                size_t n) {
    for (size_t i = 0; i < n; i++)
        dst[i] = a[i] + b[i];  // Now vectorizable
}
```

### 2. Runtime CPU feature detection

```c
// Linux: use __builtin_cpu_supports (GCC/Clang)
if (__builtin_cpu_supports("avx2")) {
    process_avx2(data, len);
} else if (__builtin_cpu_supports("sse4.2")) {
    process_sse42(data, len);
} else {
    process_scalar(data, len);
}

// Check specific features:
__builtin_cpu_supports("sse2")
__builtin_cpu_supports("sse4.1")
__builtin_cpu_supports("sse4.2")
__builtin_cpu_supports("avx")
__builtin_cpu_supports("avx2")
__builtin_cpu_supports("avx512f")
__builtin_cpu_supports("bmi")
__builtin_cpu_supports("bmi2")
__builtin_cpu_supports("fma")
```

```c
// Portable: use CPUID directly
#include <cpuid.h>

static int has_avx2(void) {
    unsigned int eax, ebx, ecx, edx;
    // CPUID leaf 7, subleaf 0
    __cpuid_count(7, 0, eax, ebx, ecx, edx);
    return (ebx >> 5) & 1;  // bit 5 = AVX2
}
```

### 3. SSE2 / SSE4.2 intrinsics (x86)

```c
#include <immintrin.h>  // All x86 intrinsics

// SSE2: 128-bit vectors
// __m128  = 4 floats
// __m128d = 2 doubles
// __m128i = integers (8x16, 4x32, 2x64, 16x8)

void sum_floats_sse2(float *dst, const float *a, const float *b, int n) {
    int i = 0;
    for (; i <= n - 4; i += 4) {
        __m128 va = _mm_loadu_ps(a + i);  // unaligned load
        __m128 vb = _mm_loadu_ps(b + i);
        __m128 vc = _mm_add_ps(va, vb);
        _mm_storeu_ps(dst + i, vc);       // unaligned store
    }
    // Handle remainder
    for (; i < n; i++) dst[i] = a[i] + b[i];
}
```

### 4. AVX2 intrinsics (x86)

```c
#ifdef __AVX2__
#include <immintrin.h>

// __m256  = 8 floats, __m256d = 4 doubles, __m256i = integers

void sum_floats_avx2(float *dst, const float *a, const float *b, int n) {
    int i = 0;
    for (; i <= n - 8; i += 8) {
        __m256 va = _mm256_loadu_ps(a + i);
        __m256 vb = _mm256_loadu_ps(b + i);
        __m256 vc = _mm256_add_ps(va, vb);
        _mm256_storeu_ps(dst + i, vc);
    }
    // SSE2 tail (4 elements)
    for (; i <= n - 4; i += 4) {
        __m128 va = _mm_loadu_ps(a + i);
        __m128 vb = _mm_loadu_ps(b + i);
        _mm_storeu_ps(dst + i, _mm_add_ps(va, vb));
    }
    // Scalar tail
    for (; i < n; i++) dst[i] = a[i] + b[i];
}

// Fused multiply-add (FMA) — 1 instruction for a*b+c
void fma_avx2(float *dst, const float *a, const float *b, const float *c, int n) {
    for (int i = 0; i <= n - 8; i += 8) {
        __m256 va = _mm256_loadu_ps(a + i);
        __m256 vb = _mm256_loadu_ps(b + i);
        __m256 vc = _mm256_loadu_ps(c + i);
        _mm256_storeu_ps(dst + i, _mm256_fmadd_ps(va, vb, vc)); // dst = a*b + c
    }
}
#endif
```

Compile with: `gcc -O2 -mavx2 -mfma src/simd.c`

### 5. NEON intrinsics (ARM/AArch64)

```c
#include <arm_neon.h>

// float32x4_t = 4 floats (128-bit)
// float32x8_t = 8 floats (ARM SVE — scalable)
// uint8x16_t  = 16 bytes
// int32x4_t   = 4 int32

void sum_floats_neon(float *dst, const float *a, const float *b, int n) {
    int i = 0;
    for (; i <= n - 4; i += 4) {
        float32x4_t va = vld1q_f32(a + i);  // load 4 floats
        float32x4_t vb = vld1q_f32(b + i);
        float32x4_t vc = vaddq_f32(va, vb);  // add
        vst1q_f32(dst + i, vc);               // store 4 floats
    }
    for (; i < n; i++) dst[i] = a[i] + b[i];
}

// AArch64 FMA
void fma_neon(float *dst, const float *a, const float *b, const float *c, int n) {
    for (int i = 0; i <= n - 4; i += 4) {
        float32x4_t va = vld1q_f32(a + i);
        float32x4_t vb = vld1q_f32(b + i);
        float32x4_t vc = vld1q_f32(c + i);
        vst1q_f32(dst + i, vfmaq_f32(vc, va, vb));  // vc + va*vb
    }
}
```

Compile with: `gcc -O2 -march=armv8-a+simd src/simd.c`

### 6. Choose auto-vectorization vs intrinsics

```text
Can the compiler auto-vectorize?
  → Try first: add __restrict__, remove complex control flow, align data
  → Check with -fopt-info-vec or -Rpass=loop-vectorize
  → If vectorized: verify correctness and performance

Still need intrinsics?
  → Prefer compiler builtins: __builtin_popcount, __builtin_ctz
  → Use SIMD intrinsics for: hand-tuned shuffles, gather/scatter, horizontal ops
  → Avoid intrinsics for: simple element-wise ops (let compiler do it)
```

### 7. Alignment and performance

```c
// Aligned allocation (required for _mm256_load_ps, optional for _mm256_loadu_ps)
float *buf = (float *)aligned_alloc(32, n * sizeof(float));
// 32-byte alignment for AVX2, 64 for AVX-512

// Hint alignment to compiler
float *__attribute__((aligned(32))) buf = ...;

// Use aligned loads when data is aligned (faster)
__m256 v = _mm256_load_ps(aligned_ptr);    // requires 32-byte alignment
__m256 v = _mm256_loadu_ps(unaligned_ptr); // any alignment, slightly slower on old CPUs
```

For Intel Intrinsics Guide reference and NEON lookup tables, see [references/intel-intrinsics-guide.md](references/intel-intrinsics-guide.md).

## Related skills

- Use `skills/compilers/gcc` for `-march`, `-msse4.2`, `-mavx2` flags
- Use `skills/compilers/clang` for vectorization remarks and auto-vectorization control
- Use `skills/profilers/linux-perf` to measure SIMD impact with perf stat counters
- Use `skills/low-level-programming/assembly-x86` for reading SIMD assembly output
