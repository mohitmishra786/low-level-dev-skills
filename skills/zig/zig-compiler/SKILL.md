---
name: zig-compiler
description: Zig compiler skill for systems programming. Use when compiling Zig programs, selecting optimization modes, using zig cc as a C compiler, reading Zig error messages, or understanding Zig's compilation model. Activates on queries about zig build-exe, zig build-lib, optimize modes, ReleaseSafe, ReleaseFast, ReleaseSmall, zig cc, zig ast-check, or Zig compilation errors.
---

# Zig Compiler

## Purpose

Guide agents through Zig compiler invocation: optimization modes, output types, `zig cc` as a C compiler drop-in, error message interpretation, and the Zig compilation pipeline.

## Triggers

- "How do I compile a Zig program?"
- "What are Zig's optimization modes and when do I use each?"
- "How do I use zig cc to compile C code?"
- "How do I read Zig error messages?"
- "How do I compile a Zig library?"
- "What is zig ast-check?"

## Workflow

### 1. Basic compilation

```bash
# Compile and run a single file
zig run src/main.zig

# Compile to executable
zig build-exe src/main.zig

# Compile to static library
zig build-lib src/mylib.zig

# Compile to shared library
zig build-lib src/mylib.zig -dynamic

# Compile to object file
zig build-obj src/main.zig

# Output name
zig build-exe src/main.zig -femit-bin=myapp
```

### 2. Optimization modes

| Mode | Flag | `-O` equiv | Purpose |
|------|------|-----------|---------|
| `Debug` (default) | `-O Debug` | `-O0 -g` | Fast compile, all safety checks, debug info |
| `ReleaseSafe` | `-O ReleaseSafe` | `-O2 + checks` | Optimized with safety checks retained |
| `ReleaseFast` | `-O ReleaseFast` | `-O3` | Maximum speed, safety checks removed |
| `ReleaseSmall` | `-O ReleaseSmall` | `-Os` | Minimize binary size |

```bash
zig build-exe src/main.zig -O Debug        # dev builds
zig build-exe src/main.zig -O ReleaseSafe  # production with safety
zig build-exe src/main.zig -O ReleaseFast  # max performance
zig build-exe src/main.zig -O ReleaseSmall # embedded/WASM
```

Safety checks in `Debug` and `ReleaseSafe`:
- Integer overflow → detected and panics with source location
- Array bounds checking → panics on OOB
- Null pointer dereference → panic (not crash)
- `unreachable` → panic
- Enum tag validation → panic on bad cast

`ReleaseFast`: turns safety checks into `undefined behaviour` (same semantics as C `-O3`). Use only when you've validated with `ReleaseSafe` first.

### 3. Target specification

```bash
# List all supported targets
zig targets

# Cross-compile for specific target
zig build-exe src/main.zig \
    -target aarch64-linux-gnu \
    -O ReleaseFast

# Embedded (no OS)
zig build-exe src/main.zig \
    -target thumb-freestanding-eabi \
    -O ReleaseSmall

# WebAssembly
zig build-exe src/main.zig \
    -target wasm32-freestanding \
    -O ReleaseSmall \
    --export=main

# Common target triples: cpu-os-abi
# x86_64-linux-gnu, x86_64-windows-gnu, aarch64-macos-none
# thumbv7m-freestanding-eabi, wasm32-wasi, wasm32-freestanding
```

### 4. zig cc — C compiler drop-in

Zig ships a C/C++ compiler (`zig cc` / `zig c++`) backed by Clang and musl. It is hermetic — no system libc required.

```bash
# Compile C code
zig cc -O2 -Wall main.c -o myapp

# Compile C++ code
zig c++ -std=c++17 -O2 main.cpp -o myapp

# Cross-compile C for ARM (no cross toolchain needed!)
zig cc -target aarch64-linux-gnu -O2 main.c -o myapp-arm

# Statically link with musl
zig cc -target x86_64-linux-musl main.c -o myapp-static

# Use in CMake (override compiler)
CC="zig cc" CXX="zig c++" cmake -S . -B build
cmake --build build

# Use in Makefile
CC="zig cc" make
```

`zig cc` advantages over gcc/clang:
- No system toolchain required (fully hermetic)
- Built-in cross-compilation for any supported target
- Always ships with a recent clang version
- musl libc bundled for static Linux builds

### 5. Emit formats

```bash
# Emit LLVM IR
zig build-exe src/main.zig --emit-llvm-ir

# Emit assembly
zig build-exe src/main.zig --emit-asm
cat main.s

# Emit binary and assembly
zig build-exe src/main.zig -femit-bin=myapp -femit-asm=myapp.s
```

### 6. AST check and syntax validation

```bash
# Check syntax without compiling
zig ast-check src/main.zig

# Format code
zig fmt src/main.zig
zig fmt src/          # format entire directory

# Check formatting without modifying
zig fmt --check src/

# Tokenize (debugging zig fmt)
zig tokenize src/main.zig
```

### 7. Reading Zig error messages

Zig error messages include:
- Source file and line
- Column indicator with arrow
- Note messages for context

```
src/main.zig:10:5: error: expected type 'u32', found 'i32'
    x: i32 = 5,
    ^
src/main.zig:7:5: note: struct field 'x' declared here
    x: u32,
    ^
```

Key error patterns:
| Error | Meaning |
|-------|---------|
| `error: expected type 'X', found 'Y'` | Type mismatch |
| `error: use of undeclared identifier 'X'` | Missing import or typo |
| `error: integer overflow` | Comptime overflow (caught at compile) |
| `error: cannot assign to constant` | Mutating a `const` variable |
| `error: unused variable 'x'` | All variables must be used |
| `error: unused function parameter 'x'` | Use `_ = x;` to suppress |

Suppress "unused" errors:
```zig
_ = unused_variable;  // explicitly discard
```

### 8. Version and environment

```bash
# Check Zig version
zig version

# Show build configuration
zig env

# Show standard library location
zig env | grep lib_dir
```

For optimization mode details and target triple reference, see [references/zig-optimize-modes.md](references/zig-optimize-modes.md).

## Related skills

- Use `skills/zig/zig-build-system` for multi-file projects with build.zig
- Use `skills/zig/zig-cinterop` for calling C from Zig and vice versa
- Use `skills/zig/zig-cross` for cross-compilation targets and sysroots
- Use `skills/zig/zig-debugging` for GDB/LLDB with Zig binaries
