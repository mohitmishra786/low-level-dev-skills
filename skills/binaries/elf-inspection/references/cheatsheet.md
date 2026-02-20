# ELF Inspection Cheatsheet

Source: <https://man7.org/linux/man-pages/man1/readelf.1.html>
Source: <https://man7.org/linux/man-pages/man1/objdump.1.html>
Source: <https://man7.org/linux/man-pages/man1/nm.1.html>
Source: <https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html-single/developing_c_and_cpp_applications_in_rhel_8/index>

## Quick reference

| Task | Command |
|------|---------|
| File type | `file prog` |
| Section sizes | `size prog` / `size --format=sysv prog` |
| Dynamic deps | `ldd prog` |
| All symbols | `nm prog` |
| Dynamic symbols | `nm -D lib.so` |
| Demangle C++ | `nm -C prog` |
| Undefined symbols | `nm -u prog` |
| ELF header | `readelf -h prog` |
| Sections | `readelf -S prog` |
| Segments | `readelf -l prog` |
| Dynamic section | `readelf -d prog` |
| Symbol table | `readelf -s prog` |
| Relocations | `readelf -r prog` |
| Notes (Build ID) | `readelf -n prog` |
| Disassemble | `objdump -d prog` |
| Intel syntax | `objdump -d -M intel prog` |
| Source + asm | `objdump -d -S prog` |
| Strings | `strings prog` |
| Hex dump section | `objdump -s -j .rodata prog` |

---

## nm symbol types

| Code | Meaning |
|------|---------|
| `T` | Global function (text) |
| `t` | Local function (text) |
| `D` | Global initialized data |
| `d` | Local initialized data |
| `B` | Global uninitialized data (BSS) |
| `b` | Local uninitialized data |
| `R` | Global read-only data |
| `r` | Local read-only data |
| `U` | Undefined (external dependency) |
| `W` | Weak global symbol |
| `w` | Weak local symbol |
| `V` | Weak object (C++) |
| `I` | Indirect reference |
| `A` | Absolute symbol |
| `C` | Common symbol |

---

## readelf sections

Key sections in a typical ELF:

| Section | Content |
|---------|---------|
| `.text` | Executable code |
| `.data` | Initialized global/static variables |
| `.bss` | Uninitialized globals (zero at startup) |
| `.rodata` | Read-only data (string literals, consts) |
| `.plt` | Procedure Linkage Table (lazy binding) |
| `.got` | Global Offset Table |
| `.got.plt` | GOT for PLT entries |
| `.dynsym` | Dynamic symbol table |
| `.dynstr` | Dynamic symbol strings |
| `.rela.dyn` | Relocations for `.data`/`.got` |
| `.rela.plt` | Relocations for PLT |
| `.debug_*` | DWARF debug information |
| `.note.gnu.build-id` | Build ID (SHA1 of content) |
| `.gnu.hash` | Hash table for fast symbol lookup |

---

## Hardening checks

```bash
# PIE: ET_DYN = PIE executable (position-independent)
readelf -h prog | grep 'Type:'

# RELRO
readelf -l prog | grep 'GNU_RELRO'
readelf -d prog | grep BIND_NOW   # full RELRO requires BIND_NOW

# NX (non-executable stack)
readelf -l prog | grep 'GNU_STACK'
# Flags should be 'RW' not 'RWE'

# Stack protector
nm prog | grep __stack_chk_fail

# FORTIFY_SOURCE
nm prog | grep __memcpy_chk

# checksec (comprehensive)
checksec --file=prog --output=json
```

---

## Shared library SONAME

```bash
# Check SONAME
readelf -d libfoo.so | grep SONAME
objdump -p libfoo.so | grep SONAME

# Create symlinks correctly
ln -sf libfoo.so.1.2.3 libfoo.so.1
ln -sf libfoo.so.1 libfoo.so
```
