# SIMD Intrinsics Quick Reference

## x86 Header Files

```c
#include <immintrin.h>   // All x86 SIMD (recommended single include)
#include <xmmintrin.h>   // SSE
#include <emmintrin.h>   // SSE2
#include <pmmintrin.h>   // SSE3
#include <tmmintrin.h>   // SSSE3
#include <smmintrin.h>   // SSE4.1
#include <nmmintrin.h>   // SSE4.2
#include <avxintrin.h>   // AVX
#include <avx2intrin.h>  // AVX2
#include <avx512fintrin.h> // AVX-512
#include <arm_neon.h>    // ARM NEON
```

## x86 Vector Types

| Type | Width | Elements | Description |
|------|-------|----------|-------------|
| `__m64` | 64-bit | varies | MMX (legacy) |
| `__m128` | 128-bit | 4x f32 | SSE float |
| `__m128d` | 128-bit | 2x f64 | SSE double |
| `__m128i` | 128-bit | int variants | SSE integer |
| `__m256` | 256-bit | 8x f32 | AVX float |
| `__m256d` | 256-bit | 4x f64 | AVX double |
| `__m256i` | 256-bit | int variants | AVX2 integer |
| `__m512` | 512-bit | 16x f32 | AVX-512 float |
| `__m512d` | 512-bit | 8x f64 | AVX-512 double |
| `__m512i` | 512-bit | int variants | AVX-512 integer |

## SSE2 / AVX2 Float Intrinsics

| Operation | SSE2 (4xf32) | AVX2 (8xf32) |
|-----------|-------------|-------------|
| Load (aligned) | `_mm_load_ps` | `_mm256_load_ps` |
| Load (unaligned) | `_mm_loadu_ps` | `_mm256_loadu_ps` |
| Store (aligned) | `_mm_store_ps` | `_mm256_store_ps` |
| Store (unaligned) | `_mm_storeu_ps` | `_mm256_storeu_ps` |
| Add | `_mm_add_ps` | `_mm256_add_ps` |
| Sub | `_mm_sub_ps` | `_mm256_sub_ps` |
| Mul | `_mm_mul_ps` | `_mm256_mul_ps` |
| Div | `_mm_div_ps` | `_mm256_div_ps` |
| FMA (a*b+c) | `_mm_fmadd_ps` (FMA) | `_mm256_fmadd_ps` |
| FMA (a*b-c) | `_mm_fmsub_ps` | `_mm256_fmsub_ps` |
| Min | `_mm_min_ps` | `_mm256_min_ps` |
| Max | `_mm_max_ps` | `_mm256_max_ps` |
| Sqrt | `_mm_sqrt_ps` | `_mm256_sqrt_ps` |
| Abs (mask) | `_mm_andnot_ps(sign, v)` | `_mm256_andnot_ps` |
| Set all | `_mm_set1_ps(x)` | `_mm256_set1_ps(x)` |
| Set elements | `_mm_set_ps(d,c,b,a)` | `_mm256_set_ps(...)` |
| Zero | `_mm_setzero_ps()` | `_mm256_setzero_ps()` |
| Compare eq | `_mm_cmpeq_ps` | `_mm256_cmp_ps(..., _CMP_EQ_OQ)` |
| Blend | `_mm_blend_ps` | `_mm256_blend_ps` |
| Shuffle | `_mm_shuffle_ps` | `_mm256_shuffle_ps` |
| Horizontal add | `_mm_hadd_ps` (SSE3) | `_mm256_hadd_ps` |

## AVX2 Integer Intrinsics (Common)

| Operation | 32-bit int (8x32) |
|-----------|------------------|
| Load | `_mm256_loadu_si256` |
| Store | `_mm256_storeu_si256` |
| Add | `_mm256_add_epi32` |
| Sub | `_mm256_sub_epi32` |
| Mul low | `_mm256_mullo_epi32` |
| And | `_mm256_and_si256` |
| Or | `_mm256_or_si256` |
| Xor | `_mm256_xor_si256` |
| Shift left | `_mm256_slli_epi32(v, n)` |
| Shift right | `_mm256_srli_epi32(v, n)` |
| Gather (32-bit idx) | `_mm256_i32gather_epi32(base, idx, scale)` |
| Set1 | `_mm256_set1_epi32(x)` |
| Compare eq | `_mm256_cmpeq_epi32` |
| Blend | `_mm256_blendv_epi8` |

## ARM NEON Types

| Type | Elements | Width |
|------|----------|-------|
| `uint8x8_t` | 8x u8 | 64-bit |
| `uint8x16_t` | 16x u8 | 128-bit |
| `uint16x4_t` | 4x u16 | 64-bit |
| `uint16x8_t` | 8x u16 | 128-bit |
| `uint32x2_t` | 2x u32 | 64-bit |
| `uint32x4_t` | 4x u32 | 128-bit |
| `uint64x1_t` | 1x u64 | 64-bit |
| `uint64x2_t` | 2x u64 | 128-bit |
| `float32x2_t` | 2x f32 | 64-bit |
| `float32x4_t` | 4x f32 | 128-bit |
| `float64x2_t` | 2x f64 | 128-bit |

## NEON Load/Store/Arithmetic

| Operation | NEON (4xf32) |
|-----------|-------------|
| Load | `vld1q_f32(ptr)` |
| Store | `vst1q_f32(ptr, v)` |
| Add | `vaddq_f32(a, b)` |
| Sub | `vsubq_f32(a, b)` |
| Mul | `vmulq_f32(a, b)` |
| FMA | `vfmaq_f32(acc, a, b)` — acc + a*b |
| Min | `vminq_f32(a, b)` |
| Max | `vmaxq_f32(a, b)` |
| Abs | `vabsq_f32(v)` |
| Sqrt | `vsqrtq_f32(v)` |
| Set1 | `vdupq_n_f32(x)` |
| Zero | `vdupq_n_f32(0.0f)` |
| Reduce add | `vaddvq_f32(v)` — horizontal sum |

## Compiler Feature Guards

```c
// Compile specific functions with target attribute (GCC/Clang)
__attribute__((target("avx2,fma")))
void process_avx2(float *dst, const float *src, int n) {
    // Can use AVX2 and FMA intrinsics here
    // Even if not compiling with -mavx2
}

__attribute__((target("sse4.2")))
uint32_t checksum_sse42(const char *data, size_t len) {
    // Use _mm_crc32_u8() etc.
}

// Dispatch based on CPU features
__attribute__((ifunc("resolve_process")))
void process(float *dst, const float *src, int n);

static typeof(process) *resolve_process(void) {
    if (__builtin_cpu_supports("avx2")) return process_avx2;
    if (__builtin_cpu_supports("sse4.2")) return process_sse42;
    return process_scalar;
}
```

## Online Resources

- Intel Intrinsics Guide: <https://www.intel.com/content/www/us/en/docs/intrinsics-guide/>
- ARM NEON Reference: <https://developer.arm.com/architectures/instruction-sets/intrinsics/>
- Compiler Explorer (Godbolt): <https://godbolt.org/> — see assembly output
- uops.info: instruction latency/throughput data
