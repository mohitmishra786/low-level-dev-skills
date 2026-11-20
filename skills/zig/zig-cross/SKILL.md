---
name: zig-cross
description: Zig cross-compilation skill. Use when cross-compiling Zig programs to different targets, using Zig's built-in cross-compilation for embedded, WASM, Windows, ARM, or using zig cc to cross-compile C code without a system cross-toolchain. Activates on queries about Zig cross-compilation, zig target triples, zig cc cross-compile, Zig embedded targets, or Zig WASM.
---

# Zig Cross-Compilation

## Purpose

Guide agents through Zig's built-in cross-compilation: target triple selection, CPU feature targeting, `zig cc` for cross-compiling C projects, embedded bare-metal targets, and WASM output — all without requiring a system cross-toolchain.

## Triggers

- "How do I cross-compile a Zig program for ARM?"
- "How do I build Zig for a different OS?"
- "How do I use Zig to cross-compile C code for another platform?"
- "How do I build Zig for embedded/bare-metal?"
- "How do I target WebAssembly with Zig?"
- "What Zig target triple do I use for Raspberry Pi?"

## Workflow

### 1. Zig's native cross-compilation

Zig has cross-compilation built in — no cross-toolchain, no Docker, no sysroot needed for pure Zig code:

```bash
# List all supported targets
zig targets | python3 -c "import sys,json; d=json.load(sys.stdin); [print(t) for t in d['libc']]"

# Build for a specific target
zig build-exe src/main.zig -target aarch64-linux-gnu -O ReleaseFast

# With build system (pass target as option)
zig build -Dtarget=aarch64-linux-gnu -Doptimize=ReleaseFast

# Cross-compile for Windows from Linux/macOS
zig build-exe src/main.zig -target x86_64-windows-gnu

# Cross-compile for macOS from Linux (requires macOS SDK)
zig build-exe src/main.zig -target aarch64-macos-none
```

### 2. Common target triples

| Target triple | Platform |
|---------------|----------|
| `x86_64-linux-gnu` | Linux x86-64 (glibc) |
| `x86_64-linux-musl` | Linux x86-64 (musl, static) |
| `aarch64-linux-gnu` | ARM64 Linux (Pi 4, AWS Graviton) |
| `aarch64-linux-musl` | ARM64 Linux static |
| `arm-linux-gnueabihf` | ARM 32-bit Linux (Pi 2/3; add `-mcpu cortex_a7`) |
| `x86_64-windows-gnu` | Windows x86-64 |
| `aarch64-macos-none` | macOS Apple Silicon |
| `x86_64-macos-none` | macOS Intel |
| `wasm32-freestanding` | WASM (browser, no OS) |
| `wasm32-wasi` | WASM with WASI |
| `thumb-freestanding-eabi` | Cortex-M bare metal (pick the core with `-mcpu cortex_m3`) |
| `thumb-freestanding-eabihf` | Cortex-M4F/M7/M33 with FPU (hard-float ABI) |
| `riscv32-freestanding` | RISC-V 32-bit bare metal |

Zig does not use LLVM/Rust arch names such as `thumbv7em`, `armv7`, `i386` or `riscv32imac`.
Use the base arch (`thumb`, `arm`, `x86`, `riscv32`) and select the core or extensions with `-mcpu`.

### 3. CPU feature targeting

```bash
# Native CPU (auto-detect, only for native builds)
zig build-exe src/main.zig -mcpu native

# Baseline for architecture (most compatible)
zig build-exe src/main.zig -target x86_64-linux-gnu -mcpu baseline

# x86-64 with AVX2
zig build-exe src/main.zig -target x86_64-linux-gnu -mcpu x86_64+avx2+bmi2

# Raspberry Pi 4 (Cortex-A72)
zig build-exe src/main.zig -target aarch64-linux-gnu -mcpu cortex_a72

# Cortex-M4 with FPU
zig build-exe src/main.zig \
    -target thumb-freestanding-eabihf \
    -mcpu cortex_m4+vfp4d16sp   # M4F FPU is single-precision only

# List CPU features for a target
zig targets | python3 -c "
import sys,json
d=json.load(sys.stdin)
for c in d['cpus']:
    if 'cortex' in c['name']:
        print(c['name'])
"
```

### 4. zig cc for C cross-compilation

`zig cc` cross-compiles C without a system cross-toolchain:

```bash
# Cross-compile C for ARM64 Linux
zig cc -target aarch64-linux-gnu -O2 -o myapp-arm64 main.c

# Cross-compile C for Windows
zig cc -target x86_64-windows-gnu main.c -o myapp.exe

# Cross-compile C with static musl linking
zig cc -target x86_64-linux-musl -static main.c -o myapp-static

# Use in Makefile for all platforms
CC_LINUX_AMD64 = zig cc -target x86_64-linux-gnu
CC_LINUX_ARM64 = zig cc -target aarch64-linux-gnu
CC_WINDOWS     = zig cc -target x86_64-windows-gnu
```

### 5. Build system cross-compilation

```zig
// build.zig — cross-build all targets
pub fn build(b: *std.Build) void {
    const targets = [_]std.Target.Query{
        .{ .cpu_arch = .x86_64, .os_tag = .linux, .abi = .gnu },
        .{ .cpu_arch = .aarch64, .os_tag = .linux, .abi = .gnu },
        .{ .cpu_arch = .x86_64, .os_tag = .windows, .abi = .gnu },
        .{ .cpu_arch = .aarch64, .os_tag = .macos },
    };

    for (targets) |t| {
        const exe = b.addExecutable(.{
            // include the OS: arch alone gives two "myapp-aarch64" artifacts
            .name = b.fmt("myapp-{s}-{s}", .{ @tagName(t.cpu_arch.?), @tagName(t.os_tag.?) }),
            .root_module = b.createModule(.{
                .root_source_file = b.path("src/main.zig"),
                .target = b.resolveTargetQuery(t),
                .optimize = .ReleaseFast,
            }),
        });
        b.installArtifact(exe);
    }
}
```

```bash
# Build all targets
zig build
# Creates: zig-out/bin/myapp-x86_64-linux, myapp-aarch64-linux,
#          myapp-x86_64-windows.exe, myapp-aarch64-macos
```

### 6. Embedded (bare-metal) targets

```bash
# Cortex-M4 with FPU (STM32F4xx)
zig build-exe src/main.zig \
    -target thumb-freestanding-eabihf \
    -mcpu cortex_m4+vfp4d16sp \
    -O ReleaseSmall \
    --script linker.ld
```

```zig
// src/main.zig — bare metal entry point
const std = @import("std");

// Custom panic handler for embedded (no OS): a namespace built with FullPanic
pub const panic = std.debug.FullPanic(struct {
    fn panic(msg: []const u8, first_trace_addr: ?usize) noreturn {
        _ = msg;
        _ = first_trace_addr;
        while (true) {}  // toggle an LED or halt
    }
}.panic);

// Entry point (name must match ENTRY() in the linker script)
export fn _start() callconv(.c) noreturn {
    main() catch {};
    while (true) {}
}

fn main() !void {
    // Hardware initialization...
}
```

### 7. WebAssembly

```bash
# WASM freestanding (browser)
zig build-exe src/main.zig \
    -target wasm32-freestanding \
    -O ReleaseSmall \
    --export=init \
    --export=update \
    -fno-entry

# WASM WASI (wasmtime, wasmer)
zig build-exe src/main.zig \
    -target wasm32-wasi \
    -O ReleaseSafe
wasmtime myapp.wasm

# Optimize WASM size
wasm-opt -Oz myapp.wasm -o myapp.opt.wasm
```

For target triple reference and embedded linker script setup, see [references/zig-target-triples.md](references/zig-target-triples.md).

## Related skills

- Use `skills/zig/zig-compiler` for single-file compilation flags
- Use `skills/zig/zig-build-system` for multi-target build.zig configuration
- Use `skills/compilers/cross-gcc` for system cross-toolchain setup when needed
- Use `skills/rust/rust-cross` for Rust's cross-compilation approach comparison
