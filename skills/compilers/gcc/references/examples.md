# GCC Examples and Error Patterns

## Table of Contents

1. [Standard build recipes](#standard-build-recipes)
2. [Common error patterns](#common-error-patterns)
3. [Preprocessor inspection](#preprocessor-inspection)
4. [Assembly output](#assembly-output)

---

## Standard build recipes

### Debug build
```bash
gcc -std=c11 -g -Og -Wall -Wextra -Wpedantic -o prog src/*.c
```

### Release build
```bash
gcc -std=c11 -O2 -DNDEBUG -Wall -fstack-protector-strong -D_FORTIFY_SOURCE=2 \
    -o prog src/*.c
```

### Shared library
```bash
gcc -std=c11 -O2 -fPIC -Wall -shared -Wl,-soname,libfoo.so.1 \
    -o libfoo.so.1.0 foo.c
ln -sf libfoo.so.1.0 libfoo.so.1
ln -sf libfoo.so.1   libfoo.so
```

### Freestanding (embedded)
```bash
arm-none-eabi-gcc -std=c11 -O2 -g -Wall \
    -mcpu=cortex-m4 -mthumb -mfloat-abi=hard -mfpu=fpv4-sp-d16 \
    -ffreestanding -nostdlib \
    -T linker.ld -o firmware.elf startup.s main.c
```

---

## Common error patterns

### undefined reference to 'foo'

**Cause:** Linker cannot find the symbol. Most common reasons:
1. Missing `-lfoo` flag
2. Library listed before the object that needs it

```bash
# Wrong: library before object
gcc main.o -lz -o prog       # if main.o uses zlib this can fail
# Correct
gcc main.o -o prog -lz       # -l flags go after objects
```

### multiple definition of 'x'

A variable is *defined* (not just declared) in a header included by multiple TUs.

```c
// header.h — wrong
int counter = 0;    // definition

// header.h — correct
extern int counter; // declaration only

// counter.c
int counter = 0;    // one definition
```

### implicit declaration of function (C99+: error)

Missing `#include`. Add the header or forward-declare the function.

```bash
# Find which header declares a function
man 3 strdup | grep SYNOPSIS
```

### relocation truncated to fit: R_X86_64_PC32

Binary exceeds 2 GB or a symbol is out of range for a 32-bit-relative relocation.

```bash
# Fix: use large code model
gcc -mcmodel=large -O2 -o prog ...
```

### ABI mismatch (C++)

Mixing objects compiled with different `-std=c++NN` or different `libstdc++` versions. Symptoms: `std::string` or `std::list` methods missing at link time.

Fix: compile all TUs with the same `-std=` and link against the same runtime.

### Stack overflow / SIGSEGV in signal handler

Red zone use in signal handlers on x86-64. Fix: `-mno-red-zone` for kernel/signal code.

---

## Preprocessor inspection

```bash
# Full preprocessed output
gcc -E src.c -o src.i

# Show all predefined macros
gcc -dM -E - < /dev/null

# Show macros + includes in order
gcc -dD -E src.c

# Check what __GNUC__ is
gcc -dM -E - < /dev/null | grep GNUC

# Find include search paths
gcc -v -E - < /dev/null 2>&1 | sed -n '/#include </,/End of search/p'
```

---

## Assembly output

```bash
# Default (AT&T) syntax
gcc -S -O2 foo.c -o foo.s

# Intel syntax
gcc -S -masm=intel -O2 foo.c -o foo.s

# Interleaved C source + assembly
gcc -S -O2 -fverbose-asm foo.c -o foo.s

# From object: disassemble with objdump
objdump -d -M intel -S foo.o   # -S intermixes source (needs -g)
```
