# GNU Binutils Cheatsheet

Source: https://sourceware.org/binutils/docs/binutils/
Source: https://man7.org/linux/man-pages/man1/objcopy.1.html

## Table of Contents
1. [ar — static archives](#ar--static-archives)
2. [strip — remove symbols](#strip--remove-symbols)
3. [objcopy — binary transformation](#objcopy--binary-transformation)
4. [addr2line — address to source](#addr2line--address-to-source)
5. [strings — extract text](#strings--extract-text)
6. [c++filt — demangle symbols](#cfilt--demangle-symbols)
7. [ranlib — archive index](#ranlib--archive-index)
8. [Cross-binutils naming](#cross-binutils-naming)

---

## ar — static archives

```bash
# Create archive (r=insert, c=create, s=index)
ar rcs libfoo.a foo.o bar.o baz.o

# List contents
ar t libfoo.a
ar tv libfoo.a           # verbose (with sizes and dates)

# Extract all objects
ar x libfoo.a

# Extract specific object
ar x libfoo.a foo.o

# Add / replace an object
ar r libfoo.a newbar.o

# Delete an object
ar d libfoo.a oldbar.o

# Move object to end
ar m libfoo.a foo.o

# Print an object to stdout
ar p libfoo.a foo.o

# Show symbol index
ar s libfoo.a            # rebuild index
nm libfoo.a              # print symbols across all objects
```

**ar operation codes:**

| Code | Meaning |
|------|---------|
| `r` | Insert/replace files in archive |
| `d` | Delete files from archive |
| `t` | List table of contents |
| `x` | Extract files |
| `p` | Print file to stdout |
| `m` | Move files within archive |
| `s` | Write an object-file index |

**ar modifier codes (append to operation):**

| Modifier | Meaning |
|----------|---------|
| `c` | Create archive if it doesn't exist |
| `s` | Write index (same as running ranlib) |
| `v` | Verbose |
| `u` | Only update files newer than archive copy |
| `D` | Deterministic mode (zero timestamps/UIDs — reproducible builds) |

For LTO archives, replace `ar` with `gcc-ar` or `llvm-ar`.

---

## strip — remove symbols

```bash
# Remove all symbols and debug info (smallest file)
strip --strip-all prog

# Remove only debug sections (keep symbol table for crash reports)
strip --strip-debug prog

# Remove unused symbols only (keep dynamic symbols for shared libs)
strip --strip-unneeded prog

# Strip to a new output file (preserve original)
strip -o prog.stripped prog

# Strip a shared library (keep exported symbols)
strip --strip-unneeded libfoo.so

# Strip specific section
strip --remove-section=.comment prog

# Verbose: show what was removed
strip -v prog
```

**Recommended workflow for distribution:**
```bash
# 1. Build with full symbols
gcc -g -O2 -o prog main.c

# 2. Save debug info separately
objcopy --only-keep-debug prog prog.debug

# 3. Strip the distribution binary
strip --strip-debug prog

# 4. Add debuglink so GDB can find prog.debug
objcopy --add-gnu-debuglink=prog.debug prog
```

---

## objcopy — binary transformation

```bash
# Separate debug info from binary
objcopy --only-keep-debug prog prog.debug
objcopy --strip-debug prog

# Add debuglink (GDB auto-finds debug file)
objcopy --add-gnu-debuglink=prog.debug prog

# Convert ELF to raw binary (embedded systems)
objcopy -O binary prog prog.bin

# Convert ELF to Intel HEX (embedded systems)
objcopy -O ihex prog prog.hex

# Convert ELF to Motorola S-record
objcopy -O srec prog prog.srec

# Add a binary file as a named section
objcopy --add-section .firmware=firmware.bin \
        --set-section-flags .firmware=alloc,load,readonly,contents \
        prog prog_with_fw

# Remove a section
objcopy --remove-section .comment prog

# Rename a section
objcopy --rename-section .text=.boot_text prog

# Change section flags
objcopy --set-section-flags .data=alloc,contents,load prog

# Embed a binary blob as accessible symbols
objcopy -I binary -O elf64-x86-64 \
        --rename-section .data=.rodata,alloc,load,readonly,data,contents \
        data.bin data_blob.o
# Provides: _binary_data_bin_start, _binary_data_bin_end, _binary_data_bin_size

# Adjust ELF entry point
objcopy --adjust-start=0x1000 prog

# Change architecture (rarely needed; use carefully)
objcopy -O elf64-little prog

# Compress debug sections
objcopy --compress-debug-sections prog
```

**-I / -O / -B flags:**

| Flag | Meaning |
|------|---------|
| `-I binary` | Input is raw binary |
| `-I elf64-x86-64` | Input is 64-bit ELF |
| `-O binary` | Output as raw binary |
| `-O ihex` | Output as Intel HEX |
| `-O srec` | Output as Motorola SREC |
| `-O elf32-littlearm` | Output as 32-bit LE ARM ELF |
| `-B i386:x86-64` | Set architecture |

---

## addr2line — address to source

```bash
# Single address
addr2line -e prog 0x400a12
# Output: /home/user/src/main.c:42

# With function name
addr2line -e prog -f 0x400a12
# Output:
# my_function
# /home/user/src/main.c:42

# Multiple addresses
addr2line -e prog -f 0x400a12 0x400b34 0x401000

# Show inline frames (important for inlined functions)
addr2line -e prog -f -i 0x400a12

# Pretty-print (combines function + file:line)
addr2line -e prog -p -f -i 0x400a12
# Output: my_function at /home/user/src/main.c:42
#          (inlined by) caller at /home/user/src/main.c:100

# Use with a crash log
grep -oP '0x[0-9a-f]+' crash.log | addr2line -e prog -f -i

# Use with gdb backtrace addresses
# Copy raw addresses from bt output and pipe through addr2line
```

Requires the binary to be built with `-g`. For stripped binaries, point `-e` at the unstripped debug build or `.debug` file.

---

## strings — extract text

```bash
# Default: print strings >= 4 chars from all sections
strings prog

# Minimum length 8
strings -n 8 prog

# Show file offset (hex)
strings -t x prog

# Show file offset (decimal)
strings -t d prog

# Search a specific section
strings -j .rodata prog       # GNU strings with section filter (some versions)
objdump -s -j .rodata prog    # more portable alternative

# Common uses
strings prog | grep -i "version"
strings prog | grep -i "copyright"
strings prog | grep -i "password"   # security audit
strings /lib/x86_64-linux-gnu/libc.so.6 | grep "GLIBC_"  # check glibc symbol versions
```

---

## c++filt — demangle symbols

```bash
# Demangle a single symbol
c++filt _ZN3foo3barEv
# Output: foo::bar()

# Demangle from stdin (reads line by line)
echo "_ZN3foo3barEv" | c++filt

# Demangle nm output
nm prog | c++filt

# Demangle crash log
cat crash.log | c++filt

# Demangle linker error (undefined reference)
# Copy the symbol from the error and pass it:
c++filt _ZNSt3__112basic_stringIcNS_11char_traitsIcEENS_9allocatorIcEEE6appendEPKcm

# Alternative: nm with -C flag (demangles inline)
nm -C prog
```

---

## ranlib — archive index

```bash
# Rebuild symbol index for an archive
ranlib libfoo.a

# Same as: ar s libfoo.a

# For LTO archives, use the toolchain-specific version:
gcc-ranlib libfoo.a    # GCC LTO
llvm-ranlib libfoo.a   # LLVM/Clang LTO
```

---

## Cross-binutils naming

Prefix all tools with the target triplet:

```bash
aarch64-linux-gnu-ar       rcs libfoo.a foo.o
aarch64-linux-gnu-strip    prog
aarch64-linux-gnu-objcopy  -O binary prog prog.bin
aarch64-linux-gnu-addr2line -e prog -f 0x400a12
aarch64-linux-gnu-nm       libfoo.a
aarch64-linux-gnu-ranlib   libfoo.a
aarch64-linux-gnu-strings  prog

arm-none-eabi-objcopy  -O binary firmware.elf firmware.bin
arm-none-eabi-objcopy  -O ihex   firmware.elf firmware.hex
arm-none-eabi-size     firmware.elf     # check text/data/bss sizes
```
