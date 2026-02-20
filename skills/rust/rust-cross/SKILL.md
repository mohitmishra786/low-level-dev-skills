---
name: rust-cross
description: Rust cross-compilation skill. Use when building Rust binaries for a different target architecture or OS, using cross or cargo-zigbuild for hermetic cross-compilation, configuring .cargo/config.toml for cross targets, or targeting embedded and bare-metal systems. Activates on queries about Rust cross-compilation, rustup targets, cross tool, cargo-zigbuild, aarch64-unknown-linux-gnu, thumbv7m-none-eabi, or building for embedded.
---

# Rust Cross-Compilation

## Purpose

Guide agents through Rust cross-compilation: adding rustup targets, using `cross` for hermetic Docker-based cross-builds, `cargo-zigbuild` for zero-setup cross-compilation, `.cargo/config.toml` configuration, and embedded bare-metal targets.

## Triggers

- "How do I cross-compile Rust for ARM/aarch64?"
- "How do I build a Rust binary for a different OS?"
- "How do I use the cross tool for Rust cross-compilation?"
- "How do I build Rust for embedded (no_std) targets?"
- "How do I use cargo-zigbuild?"
- "My cross-compiled Rust binary won't run on the target"

## Workflow

### 1. Add a rustup target

```bash
# List installed targets
rustup target list --installed

# List all available targets
rustup target list

# Add a target
rustup target add aarch64-unknown-linux-gnu
rustup target add x86_64-unknown-linux-musl   # static Linux
rustup target add wasm32-unknown-unknown       # WASM
rustup target add thumbv7m-none-eabi          # Cortex-M

# Build for target
cargo build --target aarch64-unknown-linux-gnu --release
```

### 2. Common target triples

| Target | Use case |
|--------|----------|
| `x86_64-unknown-linux-gnu` | Linux x86-64 (glibc) |
| `x86_64-unknown-linux-musl` | Linux x86-64 (musl, static) |
| `aarch64-unknown-linux-gnu` | ARM64 Linux (Raspberry Pi 4, AWS Graviton) |
| `aarch64-unknown-linux-musl` | ARM64 Linux static |
| `x86_64-pc-windows-gnu` | Windows x86-64 (MinGW) |
| `x86_64-pc-windows-msvc` | Windows x86-64 (MSVC) |
| `x86_64-apple-darwin` | macOS x86-64 |
| `aarch64-apple-darwin` | macOS Apple Silicon |
| `wasm32-unknown-unknown` | WASM (browser) |
| `wasm32-wasi` | WASM with WASI |
| `thumbv7m-none-eabi` | Cortex-M3 bare metal |
| `thumbv7em-none-eabihf` | Cortex-M4/M7 with FPU |
| `riscv32imac-unknown-none-elf` | RISC-V 32-bit bare metal |

### 3. cross tool (Docker-based, easiest)

`cross` uses pre-built Docker images with the correct cross-toolchain:

```bash
# Install
cargo install cross

# Build (drop-in replacement for cargo)
cross build --target aarch64-unknown-linux-gnu --release
cross test --target aarch64-unknown-linux-gnu

# Cross.toml — project configuration
```

```toml
# Cross.toml
[target.aarch64-unknown-linux-gnu]
image = "ghcr.io/cross-rs/aarch64-unknown-linux-gnu:main"
pre-build = [
    "apt-get update && apt-get install -y libssl-dev:arm64"
]

[build.env]
passthrough = ["PKG_CONFIG_PATH", "OPENSSL_DIR"]
```

### 4. cargo-zigbuild (zero-setup, uses zig cc)

`zig cc` ships a complete C cross-toolchain — no system cross-compiler needed:

```bash
# Install
cargo install cargo-zigbuild
# Also needs zig installed: https://ziglang.org/download/

# Build (no Docker, no system cross-compiler)
cargo zigbuild --target aarch64-unknown-linux-gnu --release
cargo zigbuild --target x86_64-unknown-linux-musl --release

# Target with glibc version (important for compatibility)
cargo zigbuild --target aarch64-unknown-linux-gnu.2.17 --release
# This builds against glibc 2.17 (very compatible)

# Windows from Linux/macOS
cargo zigbuild --target x86_64-pc-windows-gnu --release
```

`cargo-zigbuild` advantages over `cross`:
- No Docker required
- Faster (no container startup)
- Works for most targets out of the box
- Supports precise glibc version targeting

### 5. .cargo/config.toml for cross targets

```toml
# .cargo/config.toml

[target.aarch64-unknown-linux-gnu]
linker = "aarch64-linux-gnu-gcc"    # System cross-linker
# or with zig:
# linker = "zig"
# rustflags = ["-C", "link-arg=cc", "-C", "link-arg=-target", "-C", "link-arg=aarch64-linux-gnu"]

[target.x86_64-unknown-linux-musl]
linker = "x86_64-linux-musl-gcc"
rustflags = ["-C", "target-feature=+crt-static"]

[target.wasm32-unknown-unknown]
runner = "wasmtime"    # Run WASM tests with wasmtime

[target.thumbv7m-none-eabi]
runner = "qemu-arm -cpu cortex-m3"
```

### 6. Static binaries with musl

```bash
# Add musl target
rustup target add x86_64-unknown-linux-musl

# Build statically linked binary
cargo build --target x86_64-unknown-linux-musl --release

# Verify it's static
file target/x86_64-unknown-linux-musl/release/myapp
# → ELF 64-bit, statically linked, not stripped

# Or with cargo-zigbuild (easier musl)
cargo zigbuild --target x86_64-unknown-linux-musl --release
```

### 7. Embedded bare-metal (#[no_std])

```toml
# .cargo/config.toml
[build]
target = "thumbv7em-none-eabihf"   # Set default target

[target.'cfg(target_arch = "arm")']
runner = "probe-run --chip STM32F411CE"
```

```rust
// src/main.rs
#![no_std]
#![no_main]

use core::panic::PanicInfo;

#[cortex_m_rt::entry]
fn main() -> ! {
    loop {}
}

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}
```

```toml
# Cargo.toml
[dependencies]
cortex-m = "0.7"
cortex-m-rt = "0.7"

[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
panic = "abort"
```

```bash
cargo build --release  # Uses default target from .cargo/config.toml
```

For target triple reference and embedded setup details, see [references/](references/).

## Related skills

- Use `skills/rust/rustc-basics` for compiler and profile configuration
- Use `skills/compilers/cross-gcc` for the underlying cross-compiler setup
- Use `skills/zig/zig-cross` for Zig's native cross-compilation approach
- Use `skills/build-systems/cmake` when Rust is part of a CMake cross-build
