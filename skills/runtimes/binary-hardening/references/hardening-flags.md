# Binary Hardening Flags Reference

Source: https://best.openssf.org/Compiler-Hardening-Guides/Compiler-Options-Hardening-Guide-for-C-and-C++

## Complete Hardened Build Commands

### GCC (Linux)

```bash
CFLAGS="-O2 -pipe \
  -Wall -Wformat -Wformat-security -Werror=format-security \
  -fstack-protector-strong \
  -fstack-clash-protection \
  -fcf-protection \
  -D_FORTIFY_SOURCE=3 \
  -D_GLIBCXX_ASSERTIONS \
  -fPIE"

CXXFLAGS="${CFLAGS} -D_GLIBCXX_ASSERTIONS"

LDFLAGS="-pie \
  -Wl,-z,relro \
  -Wl,-z,now \
  -Wl,-z,noexecstack \
  -Wl,-z,nodlopen \
  -Wl,-z,nodump \
  -Wl,--as-needed"

gcc ${CFLAGS} ${LDFLAGS} -o prog main.c
```

### Clang (Linux)

```bash
CFLAGS="-O2 \
  -fstack-protector-strong \
  -fstack-clash-protection \
  -D_FORTIFY_SOURCE=3 \
  -fPIE \
  -fsanitize=safe-stack"

LDFLAGS="-pie \
  -Wl,-z,relro -Wl,-z,now -Wl,-z,noexecstack \
  -fsanitize=safe-stack"

clang ${CFLAGS} ${LDFLAGS} -o prog main.c
```

### Shared Libraries

```bash
# Shared library hardening (note: -fPIC not -fPIE)
CFLAGS="-O2 -fPIC -fstack-protector-strong -D_FORTIFY_SOURCE=2"
LDFLAGS="-shared -Wl,-z,relro -Wl,-z,now -Wl,-z,noexecstack"

gcc ${CFLAGS} ${LDFLAGS} -o libfoo.so foo.c
```

## Flag Reference Table

| Flag | Compiler | Linker | Effect |
|------|----------|--------|--------|
| `-fstack-protector-strong` | GCC/Clang | — | Stack canary on at-risk functions |
| `-fstack-protector-all` | GCC/Clang | — | Stack canary on ALL functions (slow) |
| `-fstack-clash-protection` | GCC ≥8/Clang ≥11 | — | Prevents stack-heap collision |
| `-fcf-protection` | GCC ≥8/Clang | — | Intel CET: IBT + shadow stack |
| `-D_FORTIFY_SOURCE=2` | GCC/Clang | — | Checked libc wrappers (level 2) |
| `-D_FORTIFY_SOURCE=3` | GCC ≥12/Clang ≥12 | — | More thorough FORTIFY |
| `-fPIE` | GCC/Clang | — | Compile as PIE (requires `-pie` to link) |
| `-pie` | — | GCC/Clang | Link as position-independent executable |
| `-Wl,-z,relro` | — | GCC/Clang (ld) | Mark GOT read-only after relocation |
| `-Wl,-z,now` | — | GCC/Clang (ld) | Eager binding → Full RELRO |
| `-Wl,-z,noexecstack` | — | GCC/Clang (ld) | Non-executable stack (NX) |
| `-Wl,-z,separate-code` | — | GCC/Clang (ld) | Separate code/data PT_LOAD segments |
| `-fsanitize=cfi` | Clang + LTO | — | Control flow integrity (needs -flto) |
| `-fsanitize=safe-stack` | Clang | — | SafeStack (separate unsafe stack) |
| `-Wformat -Wformat-security` | GCC/Clang | — | Warn on format string issues |
| `-Werror=format-security` | GCC/Clang | — | Error on dangerous format strings |

## Distribution Defaults

| Distro | Default hardening |
|--------|------------------|
| Debian/Ubuntu | PIE, RELRO, canary, FORTIFY=2 |
| Fedora/RHEL | PIE, Full RELRO, canary, FORTIFY=3 (Fedora 38+) |
| Alpine | PIE, RELRO, canary (musl-based) |
| Arch Linux | PIE, RELRO, canary, FORTIFY=2 |

Check what your distro uses:
```bash
dpkg-buildflags --query   # Debian/Ubuntu
rpm --eval "%{build_cflags}"  # Fedora/RHEL
```
