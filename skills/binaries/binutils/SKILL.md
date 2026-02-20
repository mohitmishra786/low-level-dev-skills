---
name: binutils
description: GNU binutils skill for binary manipulation and analysis. Use when using ar for static libraries, strip or objcopy for binary processing, addr2line for converting addresses to source locations, strings for text extraction, or c++filt for C++ name demangling. Activates on queries about ar, strip, objcopy, addr2line, strings, c++filt, ranlib, or binary post-processing tasks.
---

# GNU Binutils

## Purpose

Guide agents through the binutils toolset for binary manipulation: static libraries, stripping, address-to-source mapping, and symbol demangling.

## Triggers

- "How do I create a static library?"
- "How do I strip a binary but keep a debug file?"
- "I have an address from a crash — how do I find the source line?"
- "How do I demangle a C++ symbol name?"
- "How do I extract/replace sections in a binary?"

## Workflow

### 1. `ar` — static library management

```bash
# Create static library
ar rcs libfoo.a foo.o bar.o baz.o

# List contents
ar t libfoo.a

# Extract an object
ar x libfoo.a foo.o

# Add/replace an object
ar r libfoo.a newbar.o

# Delete an object
ar d libfoo.a oldbar.o

# Show symbol index
nm libfoo.a

# Rebuild symbol index (after modifying archive externally)
ranlib libfoo.a
```

For LTO archives: use `gcc-ar`/`gcc-ranlib` or `llvm-ar` instead of plain `ar`.

### 2. `strip` — remove debug info

```bash
# Strip all debug info (reduce binary size)
strip --strip-all prog

# Strip only debug sections (keep symbol table)
strip --strip-debug prog

# Strip unneeded symbols (keep needed for linking)
strip --strip-unneeded prog

# In-place
strip prog

# To a new file
strip -o prog.stripped prog
```

### 3. `objcopy` — binary section manipulation

```bash
# Separate debug info from binary
objcopy --only-keep-debug prog prog.debug
objcopy --strip-debug prog

# Add debuglink (GDB finds prog.debug automatically)
objcopy --add-gnu-debuglink=prog.debug prog

# Convert binary to another format
objcopy -O binary prog prog.bin      # raw binary (embedded)
objcopy -O srec prog prog.srec       # Motorola S-record

# Add a section from a file
objcopy --add-section .resources=data.bin prog

# Remove a section
objcopy --remove-section .comment prog

# Change section flags
objcopy --set-section-flags .data=alloc,contents,load,readonly prog

# Embed a binary file as a symbol
objcopy -I binary -O elf64-x86-64 \
    --rename-section .data=.rodata,alloc,load,readonly,data,contents \
    data.bin data.o
# Then link data.o; access via _binary_data_bin_start / _binary_data_bin_end
```

### 4. `addr2line` — address to source

```bash
# Convert a crash address to source:line
addr2line -e prog -f 0x400a12
# Output:
# my_function
# /home/user/src/main.c:42

# Multiple addresses
addr2line -e prog -f 0x400a12 0x400b34 0x400c56

# Inline frames (-i)
addr2line -e prog -f -i 0x400a12

# Common use: pipe from backtrace output
cat crash.log | grep '0x[0-9a-f]' | grep -o '0x[0-9a-f]*' | \
  addr2line -e prog -f -i
```

Requires the binary to have debug info (compiled with `-g`). For stripped binaries, use the unstripped version or a `.debug` file.

### 5. `c++filt` — demangle C++ symbols

```bash
# Demangle a single symbol
c++filt _ZN3foo3barEv
# Output: foo::bar()

# Demangle from nm output
nm prog | c++filt

# Demangle from crash log
cat crash.log | c++filt
```

Alternative: `nm -C prog` (demangle directly in nm).

### 6. `strings` — extract printable strings

```bash
strings prog                    # all strings >= 4 chars
strings -n 8 prog               # minimum length 8
strings -t x prog               # with offset (hex)
strings -t d prog               # with offset (decimal)

# Search for specific strings
strings prog | grep "version"
strings prog | grep "Copyright"
```

### 7. `readelf` and `objdump` quick reference

(Full coverage in `skills/binaries/elf-inspection`)

```bash
# Symbol lookup for crash address (alternative to addr2line)
objdump -d -M intel prog | grep -A5 "400a12:"

# Find which object file defines a symbol
objdump -t prog | grep my_function
```

### 8. Cross-binutils

For cross-compilation, use the target-prefixed versions:

```bash
aarch64-linux-gnu-strip prog
aarch64-linux-gnu-objcopy --only-keep-debug prog prog.debug
aarch64-linux-gnu-addr2line -e prog 0x400a12
arm-none-eabi-nm libfirmware.a
```

For a complete command cheatsheet covering all tools (ar, strip, objcopy, addr2line, strings, c++filt), see [references/cheatsheet.md](references/cheatsheet.md).

## Related skills

- Use `skills/binaries/elf-inspection` for `readelf`, `nm`, `ldd`, `objdump` inspection
- Use `skills/binaries/linkers-lto` for linker flags and LTO
- Use `skills/debuggers/core-dumps` for debug file management with `objcopy --add-gnu-debuglink`
