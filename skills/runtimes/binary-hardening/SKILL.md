---
name: binary-hardening
description: Binary hardening skill for security-hardened C/C++ builds. Use when enabling RELRO, PIE, stack canaries, FORTIFY_SOURCE, CFI sanitizers, shadow stack, or seccomp-bpf syscall filtering. Covers checksec analysis, compiler and linker flags for hardened builds, and NSA/CISA-recommended mitigations. Activates on queries about binary hardening, checksec, RELRO, PIE, stack canaries, FORTIFY_SOURCE, CFI, shadow stack, or seccomp.
---

# Binary Hardening

## Purpose

Guide agents through enabling and verifying binary security mitigations: checksec analysis, compiler and linker hardening flags (RELRO, PIE, stack canaries, FORTIFY_SOURCE, CFI), hardware shadow stack, and seccomp-bpf syscall filtering for defense-in-depth.

## Triggers

- "How do I harden my binary against exploits?"
- "How do I check what security mitigations my binary has?"
- "What does checksec output mean?"
- "How do I enable RELRO, PIE, and stack canaries?"
- "How do I use seccomp to restrict syscalls?"
- "How do I enable CFI (control flow integrity)?"

## Workflow

### 1. Analyze existing binary with checksec

```bash
# Install checksec
pip install checksec.py   # or: apt install checksec

# Check a binary
checksec --file=./mybinary
checksec --file=/usr/bin/ssh

# Output example
# RELRO          STACK CANARY   NX    PIE    RPATH  RUNPATH  Symbols  FORTIFY  Fortified  Fortifiable  FILE
# Full RELRO     Canary found   NX    PIE    No RPATH  No RUNPATH  No Symbols  Yes   6   10   ./mybinary

# Check all binaries in a directory
checksec --dir=/usr/bin
```

| Protection | Good value | Concern |
|-----------|-----------|---------|
| RELRO | Full RELRO | Partial / No RELRO |
| Stack Canary | Canary found | No canary |
| NX | NX enabled | NX disabled |
| PIE | PIE enabled | No PIE |
| FORTIFY | Yes | No |

### 2. Hardening compiler and linker flags

```bash
# Full hardened build (GCC or Clang)
CFLAGS="-O2 -pipe \
  -fstack-protector-strong \
  -fstack-clash-protection \
  -fcf-protection \
  -D_FORTIFY_SOURCE=3 \
  -D_GLIBCXX_ASSERTIONS \
  -fPIE \
  -Wformat -Wformat-security -Werror=format-security"

LDFLAGS="-pie \
  -Wl,-z,relro \
  -Wl,-z,now \
  -Wl,-z,noexecstack \
  -Wl,-z,separate-code"

gcc ${CFLAGS} -o prog main.c ${LDFLAGS}
```

Flag reference:

| Flag | Protection | Notes |
|------|-----------|-------|
| `-fstack-protector-strong` | Stack canary | Stronger than `-fstack-protector` |
| `-fstack-clash-protection` | Stack clash | Prevents huge stack allocations |
| `-fcf-protection` | Intel CET (IBT+SHSTK) | x86 hardware CFI (kernel+CPU required) |
| `-D_FORTIFY_SOURCE=2` | Buffer overflow checks | Adds bounds checks to string/mem functions |
| `-D_FORTIFY_SOURCE=3` | Enhanced FORTIFY | GCC ≥12, Clang ≥12 |
| `-fPIE` + `-pie` | PIE/ASLR | Position independent executable |
| `-Wl,-z,relro` | Partial RELRO | Makes GOT read-only before `main` |
| `-Wl,-z,now` | Full RELRO | Resolves all PLT at startup → GOT fully RO |
| `-Wl,-z,noexecstack` | NX stack | Marks stack non-executable |

### 3. Control Flow Integrity (CFI)

Clang's CFI prevents calling virtual functions through wrong types (vtable CFI) and indirect calls to mismatched functions:

```bash
# Clang CFI — requires LTO and visibility
clang -fsanitize=cfi -fvisibility=hidden -flto \
      -O2 -fPIE -pie main.cpp -o prog

# Specific CFI checks
clang -fsanitize=cfi-vcall          # virtual call type check
clang -fsanitize=cfi-icall          # indirect call type check
clang -fsanitize=cfi-derived-cast   # derived-to-base cast
clang -fsanitize=cfi-unrelated-cast # unrelated type cast

# Cross-DSO CFI (across shared libraries — more complex)
clang -fsanitize=cfi -fsanitize-cfi-cross-dso -flto -fPIC -shared
```

```bash
# Microsoft CFG (Windows equivalent)
cl /guard:cf prog.c
link /guard:cf prog.obj
```

### 4. Stack canaries in depth

```bash
# GCC canary options
-fno-stack-protector       # disabled
-fstack-protector          # protect functions with alloca or buffers > 8 bytes
-fstack-protector-strong   # protect functions with local arrays/addresses taken
-fstack-protector-all      # protect all functions (slowest, most complete)

# Verify canary presence
objdump -d prog | grep -A5 "__stack_chk"
readelf -s prog | grep "stack_chk"
```

### 5. FORTIFY_SOURCE

FORTIFY_SOURCE wraps unsafe libc functions (memcpy, strcpy, sprintf) with bounds-checked versions when the buffer size can be determined at compile time:

```bash
# Level 2 (GCC/Clang default for hardened builds)
-D_FORTIFY_SOURCE=2
# Runtime check: abort() on overflow

# Level 3 (GCC ≥12, catches more cases)
-D_FORTIFY_SOURCE=3
# Adds dynamic buffer size tracking for more coverage

# Check FORTIFY coverage
objdump -d prog | grep "__.*_chk"     # fortified variants
checksec --file=prog | grep FORTIFY
```

### 6. seccomp-bpf syscall filtering

```c
#include <seccomp.h>

void apply_seccomp_filter(void) {
    scmp_filter_ctx ctx;

    // Default: kill process on any non-allowlisted syscall
    ctx = seccomp_init(SCMP_ACT_KILL_PROCESS);

    // Allowlist needed syscalls
    seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(read), 0);
    seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(write), 0);
    seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(exit_group), 0);
    seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(brk), 0);
    seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(mmap), 0);

    // Apply filter (irreversible after this point)
    seccomp_load(ctx);
    seccomp_release(ctx);
}

// Call early in main(), after all setup
int main(void) {
    // ... initialization ...
    apply_seccomp_filter();
    // ... restricted operation ...
}
```

```bash
# Test seccomp filter with strace
strace -e trace=all ./prog 2>&1 | grep "killed by SIGSYS"

# Profile syscalls to build allowlist
strace -c ./prog    # count all syscalls used
```

### 7. Shadow stack (Intel CET / Hardware SHSTK)

```bash
# Enable on supported x86 hardware (Intel Tiger Lake+, kernel ≥6.6)
# -fcf-protection=full enables both IBT and SHSTK
clang -fcf-protection=full -O2 -o prog main.c

# Check CET support in binary
readelf -n prog | grep "NT_GNU_PROPERTY"
objdump -d prog | grep "endbr64"   # IBT end-branch instructions

# Kernel support
cat /proc/cpuinfo | grep shstk     # CPU support
```

For the full hardening flags reference, see [references/hardening-flags.md](references/hardening-flags.md).

## Related skills

- Use `skills/runtimes/sanitizers` for ASan/UBSan during development
- Use `skills/observability/ebpf` for seccomp-bpf program writing with libbpf
- Use `skills/rust/rust-security` for Rust's memory-safety hardening approach
- Use `skills/binaries/elf-inspection` to verify mitigations in ELF binaries
