---
name: elf-inspection
description: ELF binary inspection skill for Linux. Use when examining ELF executables or shared libraries with readelf, objdump, nm, or ldd to understand symbol visibility, section layout, dynamic dependencies, build IDs, or relocation entries. Activates on queries about ELF format, shared library dependencies, symbol tables, section sizes, DWARF debug info in binaries, binary bloat analysis, or undefined symbol errors.
---

# ELF Inspection

## Purpose

Guide agents through inspecting Linux ELF binaries: symbol tables, section layout, dynamic linking, debug info, and diagnosing linker errors.

## Triggers

- "What libraries does this binary depend on?"
- "Why is this binary so large?"
- "I have an `undefined reference` or symbol not found at runtime"
- "How do I check if debug info is in this binary?"
- "How do I find what symbols a library exports?"
- "How do I check if a binary is PIE / has RELRO?"

## Workflow

### 1. Quick overview: `file` and `size`

```bash
file prog                    # type, arch, linkage, stripped or not
size prog                    # section sizes: text, data, bss
size --format=sysv prog      # detailed per-section breakdown
```

### 2. Dynamic dependencies: `ldd`

```bash
ldd ./prog                   # show all shared lib dependencies
ldd -v ./prog                # verbose: include symbol versions

# Check why a library is loaded
ldd ./prog | grep libssl

# For a library (not an executable)
ldd ./libfoo.so
```

If `ldd` shows `not found`, the shared library is missing from `LD_LIBRARY_PATH` or `/etc/ld.so.conf`.

Fix:

```bash
export LD_LIBRARY_PATH=/path/to/libs:$LD_LIBRARY_PATH
# Or install the library and run ldconfig
sudo ldconfig
```

### 3. Symbols: `nm`

```bash
nm prog                       # all symbols (T=text, D=data, U=undefined, etc.)
nm -D ./libfoo.so             # dynamic symbols only
nm -C prog                    # demangle C++ symbols
nm --defined-only prog        # only defined symbols
nm -u prog                    # only undefined (needed) symbols
nm -S prog                    # include symbol size

# Search for a symbol
nm -D /usr/lib/libssl.so | grep SSL_read
```

Symbol type codes:

- `T` / `t` — text (code): global / local
- `D` / `d` — data (initialised): global / local
- `B` / `b` — BSS (uninitialised): global / local
- `R` / `r` — read-only data: global / local
- `U` — undefined (needs to be provided at link time)
- `W` / `w` — weak symbol

### 4. Sections: `readelf`

```bash
readelf -h prog               # ELF header (arch, type, entry point)
readelf -S prog               # all sections
readelf -l prog               # program headers (segments)
readelf -d prog               # dynamic section (like ldd but raw)
readelf -s prog               # symbol table
readelf -r prog               # relocations
readelf -n prog               # notes (build ID, ABI tag)
readelf --debug-dump=info prog | head -100  # DWARF info
readelf -a prog               # all of the above
```

### 5. Disassembly and source: `objdump`

```bash
# Disassemble all code sections
objdump -d prog
objdump -d -M intel prog      # Intel syntax

# Disassemble + intermix source (needs -g at compile time)
objdump -d -S prog

# Disassemble specific symbol
objdump -d prog | awk '/^[0-9a-f]+ <main>:/,/^$/'

# All sections (including data)
objdump -D prog

# Header info
objdump -f prog
objdump -p prog               # private headers (including needed libs)
```

### 6. Binary hardening check

```bash
# Check for PIE, RELRO, stack canary, NX
# Use checksec (install separately)
checksec --file=prog

# Manual checks:
readelf -h prog | grep Type           # ET_DYN = PIE, ET_EXEC = non-PIE
readelf -d prog | grep GNU_RELRO      # RELRO present
readelf -d prog | grep BIND_NOW       # full RELRO
readelf -s prog | grep __stack_chk    # stack protector
readelf -l prog | grep GNU_STACK      # NX bit (RW = no exec, RWE = exec stack)
```

### 7. Section size analysis (binary bloat)

```bash
# Detailed section sizes
size --format=sysv prog | sort -k2 -nr | head -20

# Per-object contribution (with -Wl,--print-map or bloaty)
# Bloaty (install separately): https://github.com/google/bloaty
bloaty prog

# Check stripped vs not
file prog
strip --strip-all -o prog.stripped prog
ls -lh prog prog.stripped
```

### 8. Build ID

Build IDs uniquely identify a binary/library build, enabling `debuginfod` lookups.

```bash
readelf -n prog | grep 'Build ID'
# or
file prog | grep BuildID
```

### 9. Common diagnosis flows

**"undefined symbol at runtime"**

```bash
# Which library was expected to provide it?
nm -D libfoo.so | grep mysymbol
# Is the library in the runtime path?
ldd ./prog | grep libfoo
# Check LD_PRELOAD / LD_LIBRARY_PATH
```

**"binary is too large"**

```bash
size --format=sysv prog | sort -k2 -nr | head
nm -S --defined-only prog | sort -k2 -nr | head -20
objdump -d prog | awk '/^[0-9a-f]+ </{fn=$2} /^[0-9a-f]/{count[fn]++} END{for(f in count) print count[f], f}' | sort -nr | head -20
```

For a quick reference, see [references/cheatsheet.md](references/cheatsheet.md).

## Related skills

- Use `skills/binaries/linkers-lto` for linker flags and LTO
- Use `skills/binaries/binutils` for `ar`, `strip`, `objcopy`, `addr2line`
- Use `skills/debuggers/core-dumps` for build ID and debuginfod usage
