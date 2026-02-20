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
| `armv7-linux-gnueabihf` | ARM 32-bit Linux (Pi 2/3) |
| `x86_64-windows-gnu` | Windows x86-64 |
| `aarch64-macos-none` | macOS Apple Silicon |
| `x86_64-macos-none` | macOS Intel |
| `wasm32-freestanding` | WASM (browser, no OS) |
| `wasm32-wasi` | WASM with WASI |
| `thumbv7m-freestanding-eabi` | Cortex-M3 bare metal |
| `thumbv7em-freestanding-eabihf` | Cortex-M4/M7 with FPU |
| `riscv32-freestanding` | RISC-V 32-bit bare metal |

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
    -target thumbv7em-freestanding-eabihf \
    -mcpu cortex_m4+vfp4

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
        const target = b.resolveTargetQuery(t);
        const exe = b.addExecutable(.{
            .name = b.fmt("myapp-{s}", .{@tagName(t.cpu_arch.?)}),
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = .ReleaseFast,
        });
        b.installArtifact(exe);
    }
}
```

```bash
# Build all targets
zig build
# Creates: zig-out/bin/myapp-x86_64, myapp-aarch64, myapp-x86_64.exe, myapp-aarch64
```

### 6. Embedded (bare-metal) targets

```bash
# Cortex-M4 with FPU (STM32F4xx)
zig build-exe src/main.zig \
    -target thumbv7em-freestanding-eabihf \
    -mcpu cortex_m4+vfp4 \
    -O ReleaseSmall \
    --script linker.ld
```

```zig
// src/main.zig — bare metal entry point
const std = @import("std");

// Custom panic handler for embedded (no OS)
pub fn panic(msg: []const u8, _: ?*std.builtin.StackTrace, _: ?usize) noreturn {
    // Toggle LED or halt
    while (true) {}
}

// Entry point (matches linker script)
export fn _start() void {
    main() catch |err| {
        _ = err;
        while (true) {}
    };
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
