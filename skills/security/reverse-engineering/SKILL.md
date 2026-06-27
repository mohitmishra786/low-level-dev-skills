---
name: reverse-engineering
description: Reverse engineering skill for binary analysis. Use when decompiling with Ghidra, analyzing with radare2, scripting RE tools, triaging with strings/file/xxd, or diffing binaries. Activates on queries about Ghidra, radare2, r2, decompiler, Binary Ninja, Diaphora, or stripped binary analysis.
---

# Reverse Engineering

## Purpose

Guide agents through reverse engineering binaries: Ghidra project setup and decompilation, radare2 analysis workflow, Binary Ninja scripting, initial triage with `strings`/`file`/`xxd`, identifying C++ patterns (vtables, RAII), analyzing stripped binaries, and diffing with Diaphora or BinDiff.

## When to Use

- Analyzing an unknown binary without source code
- Recovering algorithm logic from compiled executables
- Comparing two firmware versions for vulnerability patches
- Understanding malware or CTF challenge binaries
- Recovering symbols from stripped ELF/PE files
- Automating analysis with Ghidra or r2 scripts

## Workflow

### 1. Initial triage

```bash
file suspicious_binary
strings -n 8 suspicious_binary | head -50
strings -el suspicious_binary          # UTF-16 LE
xxd suspicious_binary | head -20
readelf -h suspicious_binary           # ELF
objdump -d -M intel suspicious_binary | head -40

# Check protections
checksec --file=suspicious_binary
```

| Command | Reveals |
|---------|---------|
| `file` | Architecture, static/dynamic, stripped |
| `strings` | URLs, paths, error messages, keys |
| `readelf -s` | Symbol table (if not stripped) |
| `nm -D` | Dynamic symbols |
| `checksec` | RELRO, NX, PIE, canary |

### 2. Ghidra workflow

```bash
# Headless analysis
analyzeHeadless /tmp/ghidra_projects MyProject \
  -import suspicious_binary \
  -postScript ExportDecompile.java

# GUI: File → New Project → Import File → Analyze (Yes)
```

Key steps:
1. **Auto-analysis** — let Ghidra complete disassembly
2. **Define functions** — `F` at entry points if missed
3. **Decompiler** — Window → Decompiler (C-like output)
4. **Rename** — `L` on variables/functions for clarity
5. **Cross-references** — `Ctrl+Shift+F` on function/data

```java
// Ghidra script (Java) — list functions > 100 bytes
import ghidra.program.model.listing.*;

FunctionManager fm = currentProgram.getFunctionManager();
for (Function f : fm.getFunctions(true)) {
    if (f.getBody().getNumAddresses() > 100)
        println(f.getName() + " @ " + f.getEntryPoint());
}
```

```python
# Ghidra Python (Jython)
from ghidra.program.model.listing import FunctionManager
fm = currentProgram.getFunctionManager()
for f in fm.getFunctions(True):
    print(f.getName(), f.getEntryPoint())
```

### 3. radare2 workflow

```bash
r2 suspicious_binary
```

```
[0x00001000]> aaa          # analyze all
[0x00001000]> afl          # list functions
[0x00001000]> pdf @ main   # disassemble function
[0x00001000]> VV           # visual graph mode
[0x00001000]> iz           # strings in data sections
[0x00001000]> s sym.main; pdf
```

Patching:

```
[0x00001000]> wx 9090 @ 0x401234   # write NOPs
[0x00001000]> wci 0x401234         # insert instruction
[0x00001000]> wt modified_binary
```

```bash
# r2 scripting
r2 -qc 'aaa; afl' suspicious_binary
r2 -i analysis.r2 suspicious_binary
```

### 4. Binary Ninja scripting

```python
# BN Python API
import binaryninja as bn

bv = bn.load("suspicious_binary")
for func in bv.functions:
    if func.name.startswith("sub_"):
        hlil = func.hlil
        for block in hlil:
            print(block)
```

### 5. C++ pattern recognition

```cpp
// Vtable pattern in disassembly
// mov rax, [rdi]      ; load vtable pointer
// call [rax+0x10]     ; virtual call at offset

// Constructor pattern
// mov [obj], offset vtable
```

| Pattern | Indicator |
|---------|-----------|
| Vtable | `.data.rel.ro` section, array of function pointers |
| RAII | paired ctor/dtor calls, exception landing pads |
| Templates | Mangled names `_Z...`, duplicate logic per type |
| std::string | SSO buffer inline or heap pointer at offset 0 |

```bash
# Demangle C++ symbols
c++filt _ZN4Math3addEii
```

### 6. Stripped binary recovery

```bash
# Find main via __libc_start_main
readelf -s binary | grep -E 'main|start'
# Or r2: afl~entry

# FLIRT signatures (Ghidra/BN) — match libc patterns
# Stack string analysis in Ghidra decompiler
```

Strategies:
- Identify `main` via libc init or entry point
- Find syscalls (`syscall` insn on Linux)
- String xref to locate error handlers
- Entropy analysis for encrypted sections

### 7. Binary diffing

```bash
# Diaphora (Ghidra/IDA plugin)
# Export from both binaries, run diff

# BinDiff (commercial, IDA/Ghidra)
bindiff old.i64 new.i64

# Simple hash diff
sha256sum firmware_v1 firmware_v2
diff <(objdump -d v1) <(objdump -d v2) | head
```

Use diffing to find patched vulnerability functions after updates.

### 8. RE decision tree

```
Binary type?
├── ELF/Linux → Ghidra + r2 + readelf
├── PE/Windows → Ghidra + PE-bear + x64dbg reference
├── Firmware → binwalk extract → Ghidra on architecture
└── Obfuscated → dynamic analysis (gdb/ltrace) first
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Ghidra decompiler fails | Indirect jumps, bad types | Fix function signature; define struct |
| r2 analysis incomplete | Large binary | `aaa` then `aac` ; increase analysis depth |
| Wrong architecture | ARM vs Thumb, MIPS | Set `-a arm` or correct Ghidra language |
| Anti-debug trap | ptrace check | Patch or use `-gdb` in QEMU |
| Packed binary | UPX/etc. | `upx -d` or manual unpack |
| No xrefs to string | PIE/RELRO | Follow GOT; runtime analysis |

## Related Skills

- `skills/binaries/elf-inspection` — ELF structure analysis
- `skills/debuggers/gdb` — dynamic analysis complement
- `skills/runtimes/binary-hardening` — understanding mitigations being bypassed
- `skills/security/kernel-security` — kernel RE and CVE analysis
- `skills/low-level-programming/assembly-x86` — reading disassembly
- `skills/low-level-programming/assembly-arm` — ARM binary analysis