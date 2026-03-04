---
name: dwarf-debug-format
description: DWARF debug format skill for understanding debug information. Use when inspecting DWARF sections with dwarfdump, working with split DWARF (.dwo files), setting up debuginfod for remote symbol resolution, or understanding how DWARF interacts with LTO and symbol stripping. Activates on queries about DWARF, .debug_info, .debug_line, dwarfdump, split DWARF, .dwo files, debuginfod, or debug info stripping.
---

# DWARF Debug Format

## Purpose

Guide agents through understanding and working with DWARF debug information: the key DWARF sections, using `dwarfdump` and `readelf` for inspection, split DWARF (`.dwo` files), `debuginfod` for remote symbol servers, and how LTO and stripping affect debug info.

## Triggers

- "What are the DWARF sections in an ELF binary?"
- "How do I inspect DWARF debug info in a binary?"
- "How does split DWARF work?"
- "How do I set up debuginfod for automatic debug symbols?"
- "Why does GDB say 'no debugging symbols found'?"
- "How does LTO affect DWARF debug information?"

## Workflow

### 1. DWARF sections overview

```bash
# Show all sections in a binary (including DWARF)
readelf -S prog | grep "\.debug"

# Common DWARF sections:
# .debug_info      — types, variables, functions (DIEs — Debug Info Entries)
# .debug_abbrev    — abbreviation table for .debug_info encoding
# .debug_line      — line number table (source line → address mapping)
# .debug_str       — string table for identifiers
# .debug_loc       — location expressions (where variables live)
# .debug_ranges    — non-contiguous address ranges for CUs
# .debug_aranges   — fast lookup: address → compilation unit
# .debug_pubnames  — global variable and function names
# .debug_frame     — call frame information (for unwinding)
# .debug_types     — type unit entries (DWARF 4+)
# .debug_rnglists  — range lists (DWARF 5)
# .debug_loclists  — location lists (DWARF 5)
# .debug_addr      — address table (DWARF 5)
# .debug_line_str  — line number string table (DWARF 5)
```

### 2. Inspecting DWARF with dwarfdump

```bash
# Install dwarfdump
apt-get install dwarfdump    # Ubuntu (part of libdwarf)
brew install libdwarf        # macOS

# Dump all DWARF info
dwarfdump prog

# Dump specific sections
dwarfdump --debug-info prog        # types, variables, functions
dwarfdump --debug-line prog        # line number table
dwarfdump --debug-loc prog         # variable locations
dwarfdump --debug-frame prog       # call frame info

# readelf alternatives (less verbose)
readelf --debug-dump=info prog | head -100
readelf --debug-dump=lines prog | head -50

# llvm-dwarfdump (more readable output)
llvm-dwarfdump prog
llvm-dwarfdump --debug-info prog | grep "DW_AT_name"
llvm-dwarfdump --statistics prog   # summarize DWARF sizes
```

### 3. Reading DWARF DIE structure

```text
# Sample dwarfdump output for a variable
DW_TAG_compile_unit
  DW_AT_producer  : "GNU C17 13.2.0"
  DW_AT_language  : DW_LANG_C11
  DW_AT_name      : "main.c"
  DW_AT_comp_dir  : "/home/user/project"

  DW_TAG_subprogram
    DW_AT_name    : "add"
    DW_AT_type    : <0x42>  → points to int type DIE
    DW_AT_low_pc  : 0x401130  ← function start address
    DW_AT_high_pc : 0x401150  ← function end address

    DW_TAG_formal_parameter
      DW_AT_name  : "a"
      DW_AT_type  : <0x42>
      DW_AT_location : DW_OP_reg5 (rdi)   ← lives in register rdi

    DW_TAG_formal_parameter
      DW_AT_name  : "b"
      DW_AT_location : DW_OP_reg4 (rsi)   ← lives in register rsi
```

Tags (DW_TAG_*): `compile_unit`, `subprogram`, `variable`, `formal_parameter`, `typedef`, `structure_type`, `member`, `array_type`, `pointer_type`, `base_type`

Attributes (DW_AT_*): `name`, `type`, `location`, `low_pc`, `high_pc`, `byte_size`, `encoding`, `file`, `line`

### 4. Split DWARF (.dwo files)

Split DWARF separates debug info from the linked binary into `.dwo` sidecar files, reducing linker input size:

```bash
# Compile with split DWARF
gcc -g -gsplit-dwarf -O2 -c main.c -o main.o
# Creates: main.o (object without full DWARF) + main.dwo (debug info)

# Link (linker only processes small .o files, not large DWARF)
gcc main.o -o prog
# prog references main.dwo but doesn't embed it

# GDB finds .dwo files via DW_AT_GNU_dwo_name attribute in prog
gdb prog    # works if main.dwo is in the same directory

# Inspect the split reference
readelf -S prog | grep "\.gnu_debuglink\|dwo"
dwarfdump prog | grep "dwo_name"    # shows path to .dwo files

# Package .dwo files into a single .dwp for distribution
dwp -o prog.dwp prog        # GNU dwp tool
llvm-dwp -o prog.dwp prog   # LLVM version
# With .dwp next to prog, GDB finds all debug info
```

### 5. debuginfod — remote debug symbol server

`debuginfod` serves debug symbols, source code, and executables via HTTP:

```bash
# Client: configure to use a debuginfod server
export DEBUGINFOD_URLS="https://debuginfod.elfutils.org/"

# GDB uses it automatically when symbols are missing
gdb /usr/bin/git
# GDB will fetch debug symbols from debuginfod if not locally installed

# Explicit fetch
debuginfod-find debuginfo /usr/bin/git     # fetch debug info
debuginfod-find source /usr/bin/git        # fetch source

# Distribution servers
# Fedora:  https://debuginfod.fedoraproject.org/
# Ubuntu:  https://debuginfod.ubuntu.com/
# Debian:  https://debuginfod.debian.net/
# elfutils: https://debuginfod.elfutils.org/

# Configure in GDB
(gdb) set debuginfod enabled on
(gdb) set debuginfod verbose 1

# Set up your own debuginfod server
debuginfod -d /var/cache/debuginfod -p 8002 /path/to/binaries/
export DEBUGINFOD_URLS="http://localhost:8002"
```

### 6. LTO and DWARF

LTO affects DWARF debug information significantly:

```bash
# Full LTO: DWARF is generated after link-time optimization
# Variables and functions may be merged, inlined, or eliminated
gcc -flto -O2 -g main.c util.c -o prog
# DWARF in prog reflects post-LTO state (may lose some info)

# Thin LTO (better for debug info preservation)
clang -flto=thin -O2 -g main.c util.c -o prog

# For best debug info with LTO: use -Og or separate debug build
gcc -Og -g main.c util.c -o prog_debug     # no LTO, full debug
gcc -O2 -flto main.c util.c -o prog_fast   # LTO, limited debug

# Rust: LTO discard debug info by default in non-release profiles
[profile.dev]
lto = "off"    # preserves debug info
```

### 7. Stripping and separate debug files

```bash
# Strip binary (remove DWARF for distribution)
strip --strip-debug prog -o prog.stripped

# Keep separate debug file
objcopy --only-keep-debug prog prog.debug
strip --strip-debug prog
# Link stripped binary to its debug file
objcopy --add-gnu-debuglink=prog.debug prog

# GDB finds debug file automatically
gdb prog    # loads prog.debug via .gnu_debuglink

# Or use eu-strip (elfutils) — creates both in one step
eu-strip -f prog.debug prog

# Verify debug link
readelf -n prog | grep "Debug\|debuglink"

# Check DWARF size contribution
llvm-dwarfdump --statistics prog | grep "file size"
size --format=SysV prog | sort -k2rn | head -15
```

## Related skills

- Use `skills/debuggers/debug-optimized-builds` for debugging with split-DWARF builds
- Use `skills/debuggers/core-dumps` for using debuginfod with core dump analysis
- Use `skills/binaries/elf-inspection` for general ELF section inspection
- Use `skills/build-systems/build-acceleration` for split-DWARF to speed up linking
