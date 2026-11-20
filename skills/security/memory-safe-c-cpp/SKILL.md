---
name: memory-safe-c-cpp
description: Memory-safe C and C++ skill for hardening existing code without a rewrite. Use when choosing between -fhardened, FORTIFY, bounds annotations, library hardening, Arm MTE, hardened allocators, Fil-C or CHERI, deciding whether to harden in place or rewrite in Rust, or explaining which bug classes each mitigation catches. Activates on queries about -fhardened, _FORTIFY_SOURCE=3, counted_by, -fsanitize=bounds, -ftrivial-auto-var-init, _GLIBCXX_ASSERTIONS, libc++ hardening, MTE, memory tagging, Scudo, hardened_malloc, Fil-C, CHERI, or memory safety roadmaps.
---

# Memory-Safe C and C++

## Purpose

Guide agents through making existing C and C++ safer (checked with GCC 16.2, Clang 23.1 and Fil-C 0.687): what each mitigation actually catches, how to enable it, and when a rewrite is the better answer.

## Triggers

- "How do I harden a C codebase without rewriting it?"
- "What does `-fhardened` turn on?"
- "Does FORTIFY catch heap overflows?"
- "How do I use Arm MTE or a hardened allocator?"
- "What is Fil-C and should I use it?"
- "Harden, sanitize, or rewrite in Rust?"

## Workflow

### 1. What catches what

Measured on one program with a heap overflow (writing 17 bytes into `malloc(16)`), a
use-after-free read and a `strcpy` into `char small[8]`:

| Build | Heap OOB write | UAF read | `strcpy` stack overflow |
|-------|----------------|----------|-------------------------|
| `gcc -O2` | not caught | not caught | not caught |
| `gcc -O2 -fhardened` | not caught | not caught | caught (`*** buffer overflow detected ***`) |
| Scudo allocator (`clang -fsanitize=scudo`) | not caught (slack in chunk) | not caught | n/a; double free caught |
| Fil-C | caught (`filc safety error`) | caught | caught when it leaves the allocation |
| ASan (testing only) | caught | caught | caught |

Mitigations that run in production reduce exploitability; they do not find all bugs. Use
sanitizers and fuzzing in CI, and a safe language or Fil-C where you need guarantees.

```text
Goal?
├── Cheap, ship today → -fhardened + library hardening + -ftrivial-auto-var-init (sections 2-3)
├── Catch bounds bugs on flexible arrays → counted_by + -fsanitize=bounds (section 4)
├── Probabilistic detection in production on Arm → MTE (section 5)
├── Heap metadata attacks → hardened allocator (section 6)
├── Full memory safety, accept slowdown → Fil-C (section 7) or CHERI hardware (section 8)
└── New component → write it in Rust (skills/rust/rust-ffi for the boundary)
```

### 2. `-fhardened` and friends (GCC 14+)

```bash
gcc -O2 -fhardened app.c -o app
```

On GCC 16.2 (aarch64) `-fhardened` defines `_FORTIFY_SOURCE=3`, `_GLIBCXX_ASSERTIONS`,
enables `-fstack-protector-strong` (`__SSP_STRONG__`), PIE, and links with
`-pie -z now -z relro`. On x86 it also enables `-fcf-protection=full` (`__CET__` = 3). Without optimization FORTIFY is
skipped: `'_FORTIFY_SOURCE' is not enabled by '-fhardened' because optimizations are turned off`.

Flags you set yourself win, and GCC says so with `-Whardened`:

```text
warning: '_FORTIFY_SOURCE' is not enabled by '-fhardened' because it was specified in '-D' or '-U' [-Whardened]
warning: '-fstack-protector-strong' is not enabled by '-fhardened' because it was specified on the command line [-Whardened]
```

Clang has no `-fhardened`; spell the pieces out:

```bash
clang -O2 -D_FORTIFY_SOURCE=3 -fstack-protector-strong -fstack-clash-protection \
      -ftrivial-auto-var-init=zero -fPIE -pie -Wl,-z,relro,-z,now app.c
```

### 3. Uninitialized memory and library hardening

```bash
# Zero (or pattern-fill) every uninitialized local: removes a whole class of info leaks
gcc -ftrivial-auto-var-init=zero ...        # GCC 12+, Clang 16+
gcc -ftrivial-auto-var-init=pattern ...     # debugging: GCC fills 0xfe, Clang 0xaa

# C++ standard library precondition checks
g++ -D_GLIBCXX_ASSERTIONS ...                                        # libstdc++: abort with message
clang++ -stdlib=libc++ -D_LIBCPP_HARDENING_MODE=_LIBCPP_HARDENING_MODE_FAST ...   # libc++: trap
```

A function that returns an uninitialized `int` after another call left `0x41414141` on the stack
returned `0x41414141` with Clang by default, `0` with `=zero`, and `0xaaaaaaaa` with `=pattern`.

### 4. Bounds annotations: `counted_by`

```c
/* cb.c — counted_by lets -fsanitize=bounds check a flexible array member */
#include <stdio.h>
#include <stdlib.h>

struct packet {
    size_t len;
    unsigned char data[] __attribute__((counted_by(len)));
};

int main(int argc, char **argv)
{
    (void)argv;
    struct packet *p = malloc(sizeof *p + 4);
    p->len = 4;
    int idx = argc + 3;              /* 4 when run without arguments: one past the end */
    p->data[idx] = 1;
    printf("wrote data[%d]\n", idx);
    free(p);
    return 0;
}
```

```bash
gcc -fsanitize=bounds cb.c                          # GCC 15+ (GCC 14 ignores counted_by); Clang 23 too
# runtime error: index 4 out of bounds for type 'unsigned char [*]'
gcc -fsanitize=bounds -fsanitize-trap=bounds cb.c   # production: trap instead of report
```

`-fstrict-flex-arrays=3` makes only `[]` count as a flexible array, so `buf[1]`-style fake
flexible arrays get bounds checks and FORTIFY coverage. Upstream Clang 23 has no
`-fbounds-safety` driver flag; that extension is still being upstreamed from Apple's fork.

### 5. Arm Memory Tagging Extension (MTE)

MTE stores a 4-bit tag per 16-byte granule and in the top byte of pointers; a mismatch faults.
It runs at near-native speed on Armv8.5+ CPUs that implement it (Pixel 8 and later, some servers).

```c
/* Linux user-space MTE: tagged mmap memory, synchronous faults */
#include <arm_acle.h>
#include <sys/mman.h>
#include <sys/prctl.h>

prctl(PR_SET_TAGGED_ADDR_CTRL,
      PR_TAGGED_ADDR_ENABLE | PR_MTE_TCF_SYNC | (0xfffeUL << PR_MTE_TAG_SHIFT), 0, 0, 0);
char *mem = mmap(NULL, 4096, PROT_READ | PROT_WRITE | PROT_MTE,
                 MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
char *p = __arm_mte_create_random_tag(mem, 0);   /* pointer with a random tag */
__arm_mte_set_tag(p);                            /* colour the first 16-byte granule */
p[15] = 1;                                       /* same granule: OK */
p[16] = 1;                                       /* next granule: SIGSEGV, si_code SEGV_MTESERR */
```

```bash
clang -O1 -march=armv8.5-a+memtag mte.c -o mte
qemu-aarch64 -cpu max ./mte       # QEMU emulates MTE when the host CPU lacks it
# On a CPU without MTE, the prctl fails with EINVAL

# Compiler-inserted stack tagging (needs MTE-enabled runtime, e.g. Android)
clang -march=armv8.5-a+memtag -fsanitize=memtag-stack ...
```

Android exposes heap MTE through the system allocator; on Linux glibc, `GLIBC_TUNABLES=glibc.mem.tagging=1`
tags malloc memory on MTE hardware.

### 6. Hardened allocators

| Allocator | How to use | Notes |
|-----------|-----------|-------|
| Scudo (LLVM) | `clang -fsanitize=scudo` or link `libclang_rt.scudo_standalone` | Default on Android; detects double free and invalid free (`Scudo ERROR: invalid chunk state when deallocating`) |
| hardened_malloc (GrapheneOS) | `LD_PRELOAD=libhardened_malloc.so` | Guard slabs, quarantines, canaries, zero on free |
| GWP-ASan | Built into Scudo, Android, Chrome | Samples a few allocations into guarded pages: catches OOB/UAF probabilistically in production |
| glibc malloc | default | Detects some double frees (`free(): double free detected in tcache 2`) |

Allocators protect heap metadata and make reuse less predictable; small overflows inside a
chunk's slack and UAF reads usually go unnoticed.

### 7. Fil-C: memory-safe C on stock hardware

Fil-C is a Clang 20-based compiler and runtime (musl or glibc) that gives every pointer an
invisible capability and uses a concurrent garbage collector. Every access is checked.

```bash
# Linux x86_64 or ARM64 binary release
tar -xJf filc-0.687-linux-aarch64.tar.xz && cd filc-0.687-linux-aarch64
./setup.sh                       # needs patchelf, kernel headers; system ld for linking
./build/bin/filcc -O2 -o app app.c   # also fil++ for C++
```

```text
filc safety error: cannot write pointer with ptr >= upper.
filc safety error: cannot access pointer to free object.
```

- Catches heap/stack out-of-bounds, use-after-free, pointer/integer type confusion, `va_list`
  misuse and pointer races; buffers passed to system calls are checked too.
- Checks are per allocation: a 12-byte `strcpy` into `char[8]` that stays inside the object's
  16-byte allocation was not reported; a longer overflow was.
- Not ABI-compatible with normal C: the whole program and its libraries must be built with Fil-C.
- Slowdown ranges from about none (SIMD-heavy code) to several times slower; memory use is higher.
- One developer's project; large software (CPython, OpenSSH, a full userland) builds with it.

### 8. CHERI capability hardware

CHERI replaces pointers with hardware capabilities (address + bounds + permissions + validity
tag, 128 bits on 64-bit systems). Out-of-bounds and forged pointers trap in hardware.

- Platforms: Arm Morello (research boards), CHERIoT (RISC-V microcontrollers, open source).
- Porting: most C builds unchanged; code that stores pointers in integers must use `intptr_t`/`uintptr_t`, and pointer arithmetic outside an object's bounds breaks.
- Toolchain and OS: CheriBSD, CHERI-LLVM, `cheribuild` to set up both.

### 9. Harden, sanitize, or rewrite?

| Situation | Approach |
|-----------|----------|
| Existing product, limited budget | `-fhardened`/equivalents + library hardening + auto-var-init now; sanitizers and fuzzing in CI |
| Parsers of untrusted input | Fuzz + `counted_by`/bounds sanitizer; consider rewriting the parser in Rust |
| Arm devices with MTE | Enable MTE (async in production, sync in testing) |
| Need guarantees, can rebuild everything, can afford slowdown | Fil-C |
| New code | Rust, with a narrow C ABI at the boundary |

## Related skills

- Use `skills/runtimes/binary-hardening` for RELRO, PIE, CFI, shadow stacks and checksec
- Use `skills/runtimes/sanitizers` for ASan/UBSan/MSan in testing
- Use `skills/allocators/custom-allocators` for allocator internals
- Use `skills/compilers/modern-c-cpp-standards` for C23 checked arithmetic and library hardening
- Use `skills/rust/rust-ffi` for moving components to Rust behind a C ABI
