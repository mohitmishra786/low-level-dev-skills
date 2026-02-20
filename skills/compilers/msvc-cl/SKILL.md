---
name: msvc-cl
description: MSVC cl.exe and clang-cl skill for Windows C/C++ projects. Use when configuring Visual Studio builds, MSBuild, or clang-cl as a drop-in MSVC replacement. Covers translating GCC/Clang flags to MSVC equivalents, runtime library selection, Windows SDK setup, and diagnosing MSVC-specific errors. Activates on queries about cl.exe, clang-cl, /O flags, /MT vs /MD, PDB files, Windows ABI, or MSVC project settings.
---

# MSVC cl.exe and clang-cl

## Purpose

Guide agents through Windows C/C++ compilation: MSVC `cl.exe`, `clang-cl` as MSVC-compatible driver, MSBuild project settings, and runtime library choices.

## Triggers

- "How do I compile with MSVC from the command line?"
- "What is the MSVC equivalent of `-O2`?"
- "/MT vs /MD — which do I use?"
- "How do I use clang-cl instead of cl.exe?"
- "I'm getting LNK errors on Windows"
- "How do I generate PDB files?"

## Workflow

### 1. Set up the environment

MSVC requires the Visual Studio environment variables. Use the Developer Command Prompt or set up manually:

```cmd
REM x64 native
"C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"

REM x86 cross (host x64, target x86)
"...\vcvarsamd64_x86.bat"

REM Check compiler version
cl /?
```

In CMake, use the "Visual Studio 17 2022" generator or pass `-DCMAKE_GENERATOR="Visual Studio 17 2022"`.

### 2. Flag translation: GCC → MSVC

| GCC/Clang | MSVC cl.exe | Notes |
|-----------|-------------|-------|
| `-O0` | `/Od` | Debug, no optimisation |
| `-O1` | `/O1` | Minimise size |
| `-O2` | `/O2` | Maximise speed |
| `-O3` | `/Ox` | Full optimisation |
| `-Os` | `/Os` | Favour size |
| `-g` | `/Zi` | PDB debug info |
| `-g` (embedded) | `/Z7` | Debug info in object file |
| `-Wall` | `/W3` or `/W4` | Warning level |
| `-Werror` | `/WX` | Warnings as errors |
| `-std=c++17` | `/std:c++17` | Standard selection |
| `-DFOO=1` | `/DFOO=1` | Preprocessor define |
| `-I path` | `/I path` | Include path |
| `-c` | `/c` | Compile only (no link) |
| `-o out` | `/Fe:out.exe` or `/Fo:out.obj` | Output file |
| `-shared` | `/LD` | Build DLL |
| `-fPIC` | (implicit on Windows) | Not needed on Windows |
| `-flto` | `/GL` (compile) + `/LTCG` (link) | Whole program optimisation |

### 3. Runtime library selection

This is the most common source of LNK errors on Windows.

| Flag | Runtime | Use case |
|------|---------|---------|
| `/MD` | `MSVCRT.dll` (dynamic) | Release, DLL linkage (recommended default) |
| `/MDd` | `MSVCRTd.dll` (debug dynamic) | Debug builds |
| `/MT` | Static CRT | Standalone exe; avoid mixing with DLLs |
| `/MTd` | Static CRT debug | Debug + static |

**Rule:** All objects and libraries in a link must use the same runtime. Mixing `/MT` and `/MD` causes `LNK2038: mismatch detected`.

### 4. clang-cl

`clang-cl` is Clang's MSVC-compatible driver. It accepts `cl.exe`-style flags and can replace `cl.exe` in most MSBuild/CMake projects.

```cmd
REM Install: part of LLVM Windows release or VS "LLVM" component

REM Basic usage (MSVC-style flags)
clang-cl /O2 /std:c++17 /MD src.cpp /Fe:prog.exe

REM Pass Clang-native flags with /clang:
clang-cl /O2 /clang:-Rpass=inline src.cpp /Fe:prog.exe

REM Use in CMake
cmake -DCMAKE_C_COMPILER=clang-cl -DCMAKE_CXX_COMPILER=clang-cl ..
```

Minimum Clang version for MSVC STL compatibility: Clang 8+. For C++20 features with MSVC STL: Clang 14+.

Source: https://learn.microsoft.com/en-us/cpp/build/clang-support-msbuild

### 5. PDB files and debugging

```cmd
REM Compile with /Zi (external PDB) and /Fd (PDB name)
cl /Zi /Fd:prog.pdb /O2 src.cpp /link /DEBUG

REM /Z7: debug info embedded in .obj (no separate PDB for objects)
cl /Z7 /O2 src.cpp /link /DEBUG /PDB:prog.pdb
```

For WinDbg or VS debugger, ensure the PDB is alongside the executable or set the symbol path.

### 6. Common LNK errors

| Error | Cause | Fix |
|-------|-------|-----|
| `LNK2019: unresolved external` | Missing `.lib` | Add library in project settings or `/link foo.lib` |
| `LNK2038: mismatch detected for 'RuntimeLibrary'` | Mixed `/MT` and `/MD` | Unify all to `/MD` or `/MT` |
| `LNK1104: cannot open file 'foo.lib'` | Library not in search path | Add path via `/LIBPATH:` or `LIB` env var |
| `LNK2005: already defined` | Multiple definitions | Use `__declspec(selectany)` or check for duplicate definitions |
| `LNK4098: defaultlib 'LIBCMT' conflicts` | Runtime mismatch | Explicitly pass `/NODEFAULTLIB:LIBCMT` or unify runtimes |

### 7. Useful cl.exe flags

```cmd
REM Preprocessed output
cl /P src.cpp       # produces src.i

REM Assembly output
cl /FA /O2 src.cpp  # produces src.asm (MASM syntax)
cl /FAs             # interleave source + asm

REM Show include files
cl /showIncludes src.cpp

REM Compiler version
cl /?  2>&1 | findstr /i "version"
```

For flag details, see [references/flags.md](references/flags.md).

## Related skills

- Use `skills/compilers/clang` for clang-cl's Clang-native diagnostics
- Use `skills/build-systems/cmake` for CMake toolchain configuration on Windows
- Use `skills/debuggers/lldb` or WinDbg for debugging MSVC-built binaries
