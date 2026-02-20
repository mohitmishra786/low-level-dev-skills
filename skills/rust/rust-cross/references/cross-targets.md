# Rust Cross-Compilation Target Reference

## Full Target Triple Format

```
<cpu_arch>-<vendor>-<os>-<abi>
```

- `cpu_arch`: x86_64, aarch64, armv7, thumbv7m, riscv32imac, wasm32, ...
- `vendor`: unknown, pc, apple, (omitted for bare metal)
- `os`: linux, windows, macos, none (bare metal), wasi
- `abi`: gnu, musl, msvc, eabi, eabihf, (omitted for some)

## Tier 1 Targets (guaranteed to work)

| Target | Platform |
|--------|----------|
| `x86_64-unknown-linux-gnu` | Linux 64-bit (glibc) |
| `x86_64-pc-windows-gnu` | Windows 64-bit (MinGW) |
| `x86_64-pc-windows-msvc` | Windows 64-bit (MSVC) |
| `x86_64-apple-darwin` | macOS 64-bit |
| `aarch64-unknown-linux-gnu` | ARM64 Linux |
| `aarch64-apple-darwin` | macOS Apple Silicon |
| `i686-unknown-linux-gnu` | Linux 32-bit |

## Popular Tier 2 Targets

| Target | Platform | Notes |
|--------|----------|-------|
| `x86_64-unknown-linux-musl` | Linux static | No glibc dep |
| `aarch64-unknown-linux-musl` | ARM64 Linux static | |
| `armv7-unknown-linux-gnueabihf` | ARM 32-bit Linux | Raspberry Pi 2/3 (32-bit) |
| `wasm32-unknown-unknown` | WASM browser | No std |
| `wasm32-wasi` | WASM WASI | Some std |
| `x86_64-unknown-freebsd` | FreeBSD | |
| `aarch64-linux-android` | Android ARM64 | |
| `x86_64-linux-android` | Android x86-64 | |

## Bare Metal (Embedded) Targets

| Target | Architecture | Use case |
|--------|-------------|----------|
| `thumbv6m-none-eabi` | Cortex-M0/M0+ | RP2040, lowest-end MCUs |
| `thumbv7m-none-eabi` | Cortex-M3 | STM32F1, LPC1768 |
| `thumbv7em-none-eabi` | Cortex-M4/M7 (no FPU) | STM32F4 without FPU |
| `thumbv7em-none-eabihf` | Cortex-M4/M7 (FPU) | STM32F4/F7 with FPU |
| `thumbv8m.main-none-eabi` | Cortex-M33 | STM32U5, nRF9160 |
| `riscv32imac-unknown-none-elf` | RISC-V 32-bit | ESP32-C3, GD32VF |
| `riscv64imac-unknown-none-elf` | RISC-V 64-bit | SiFive boards |
| `avr-unknown-gnu-atmega328` | AVR | Arduino Uno (nightly only) |

## Glibc Version Targeting (cargo-zigbuild)

```bash
# Format: <target>.<glibc_major>.<glibc_minor>
cargo zigbuild --target aarch64-unknown-linux-gnu.2.17   # Very compatible
cargo zigbuild --target x86_64-unknown-linux-gnu.2.28    # Modern systems
cargo zigbuild --target aarch64-unknown-linux-gnu.2.35   # Ubuntu 22.04+

# Check required glibc version of a binary
objdump -T ./myapp | grep GLIBC
readelf -V ./myapp
```

## cross Docker Images

```bash
# List available images
docker pull ghcr.io/cross-rs/aarch64-unknown-linux-gnu:main

# Available at ghcr.io/cross-rs/<target>:main
# aarch64-unknown-linux-gnu
# x86_64-unknown-linux-musl
# armv7-unknown-linux-gnueabihf
# aarch64-unknown-linux-musl
# x86_64-pc-windows-gnu
# ... (see https://github.com/cross-rs/cross)
```

## OpenSSL Cross-Compilation

OpenSSL is the most common pain point in cross-compilation:

```bash
# Option 1: use rustls instead (no C dependency)
# In Cargo.toml:
# reqwest = { version = "0.11", default-features = false, features = ["rustls-tls"] }

# Option 2: cross with pre-built OpenSSL
# Cross.toml:
# [target.aarch64-unknown-linux-gnu]
# pre-build = ["apt-get install -y libssl-dev:arm64"]

# Option 3: cargo-zigbuild with vendored OpenSSL
OPENSSL_STATIC=1 cargo zigbuild --target aarch64-unknown-linux-gnu

# Option 4: openssl-src crate (builds from source)
# [dependencies]
# openssl = { version = "0.10", features = ["vendored"] }
```

## Embedded Project Structure

```
my-embedded/
├── .cargo/
│   └── config.toml    # default target, runner, linker
├── Cargo.toml
├── memory.x           # Linker script (memory map)
├── build.rs           # Copy memory.x to OUT_DIR
└── src/
    └── main.rs        # #![no_std] #![no_main]
```

```
# .cargo/config.toml for STM32F4
[build]
target = "thumbv7em-none-eabihf"

[target.thumbv7em-none-eabihf]
runner = "probe-run --chip STM32F411CEUx"
rustflags = [
    "-C", "link-arg=-Tlink.x",
    "-C", "link-arg=--nmagic",
]
```

```toml
# Cargo.toml for embedded
[dependencies]
cortex-m = { version = "0.7", features = ["critical-section-single-core"] }
cortex-m-rt = "0.7"
stm32f4xx-hal = { version = "0.20", features = ["stm32f411"] }
panic-probe = { version = "0.3", features = ["print-defmt"] }
defmt = "0.3"
defmt-rtt = "0.4"
```
