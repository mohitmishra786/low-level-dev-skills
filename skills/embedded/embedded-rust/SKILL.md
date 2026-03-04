---
name: embedded-rust
description: Embedded Rust skill for bare-metal microcontroller development. Use when using probe-rs or cargo-embed for flashing and debugging, setting up defmt logging, using the RTIC framework, configuring cortex-m-rt startup, writing no_std + no_main firmware, or choosing between panic-halt and panic-semihosting. Activates on queries about embedded Rust, probe-rs, cargo-embed, defmt, RTIC, cortex-m-rt, no_std embedded, or panic handling in embedded Rust.
---

# Embedded Rust

## Purpose

Guide agents through embedded Rust development: flashing and debugging with probe-rs/cargo-embed, structured logging with defmt, the RTIC concurrency framework, cortex-m-rt startup, no_std configuration, and panic handler selection.

## Triggers

- "How do I flash my Rust firmware to an MCU?"
- "How do I debug my embedded Rust program?"
- "How do I use defmt for logging in embedded Rust?"
- "How do I use RTIC for interrupt-driven concurrency?"
- "What does #![no_std] #![no_main] mean for embedded Rust?"
- "How do I handle panics in no_std embedded Rust?"

## Workflow

### 1. Project setup

```toml
# Cargo.toml
[package]
name = "my-firmware"
version = "0.1.0"
edition = "2021"

[dependencies]
cortex-m = { version = "0.7", features = ["critical-section-single-core"] }
cortex-m-rt = "0.7"
defmt = "0.3"
defmt-rtt = "0.4"
panic-probe = { version = "0.3", features = ["print-defmt"] }

# Embassy (async embedded) — alternative to RTIC
# embassy-executor = { version = "0.5", features = ["arch-cortex-m"] }

[profile.release]
opt-level = "s"       # size optimization for embedded
lto = true
codegen-units = 1
debug = true          # keep debug info for defmt/probe-rs

# .cargo/config.toml
[build]
target = "thumbv7em-none-eabihf"    # Cortex-M4F / M7

[target.thumbv7em-none-eabihf]
runner = "probe-rs run --chip STM32F411CEUx"    # auto-run after build
rustflags = ["-C", "link-arg=-Tlink.x"]         # cortex-m-rt linker script
```

### 2. Minimal bare-metal program

```rust
// src/main.rs
#![no_std]
#![no_main]

use cortex_m_rt::entry;
use defmt::info;
use defmt_rtt as _;      // RTT transport for defmt
use panic_probe as _;    // panic handler that prints via defmt

#[entry]
fn main() -> ! {
    info!("Booting up!");

    // Access peripherals via PAC or HAL
    let _core = cortex_m::Peripherals::take().unwrap();
    // let dp = stm32f4xx_hal::pac::Peripherals::take().unwrap();

    loop {
        info!("Running...");
        cortex_m::asm::delay(8_000_000);  // rough delay
    }
}
```

Target triples for common MCUs:

| MCU family | Target triple |
|-----------|---------------|
| Cortex-M0/M0+ | `thumbv6m-none-eabi` |
| Cortex-M3 | `thumbv7m-none-eabi` |
| Cortex-M4 (no FPU) | `thumbv7em-none-eabi` |
| Cortex-M4F / M7 | `thumbv7em-none-eabihf` |
| Cortex-M33 | `thumbv8m.main-none-eabihf` |
| RISC-V RV32IMAC | `riscv32imac-unknown-none-elf` |

```bash
rustup target add thumbv7em-none-eabihf
```

### 3. probe-rs — flash and debug

```bash
# Install probe-rs
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/probe-rs/probe-rs/releases/latest/download/probe-rs-tools-installer.sh | sh

# Flash firmware
probe-rs run --chip STM32F411CEUx target/thumbv7em-none-eabihf/release/firmware

# Interactive debug session
probe-rs debug --chip STM32F411CEUx target/thumbv7em-none-eabihf/release/firmware

# List connected probes
probe-rs list

# Supported chips
probe-rs chip list | grep STM32
```

With `cargo`:

```bash
# Using the runner in .cargo/config.toml
cargo run --release           # builds, flashes, and streams defmt logs
cargo build --release         # build only
```

### 4. defmt — efficient logging

defmt (de-formatter) encodes log strings to integers, transmits minimal bytes, decodes on host:

```rust
use defmt::{info, warn, error, debug, trace, Format};

// Basic logging
info!("Temperature: {} °C", temp);
warn!("Stack usage: {}/{}",  used, total);
error!("I2C error: {:?}", err);

// Derive Format for custom types
#[derive(Format)]
struct Packet { id: u8, len: u16 }

info!("Received: {:?}", pkt);

// Assertions (panic with defmt message)
defmt::assert_eq!(result, expected);
defmt::assert!(condition, "message with {}", value);
```

defmt backends (choose one):

```toml
# RTT (fastest, needs debug probe connected)
defmt-rtt = "0.4"

# Semihosting (slower, works without RTT support)
defmt-semihosting = "0.1"
```

### 5. RTIC — Real-Time Interrupt-driven Concurrency

```rust
// Cargo.toml
// rtic = { version = "2", features = ["thumbv7-backend"] }

#[rtic::app(device = stm32f4xx_hal::pac, peripherals = true, dispatchers = [SPI1])]
mod app {
    use stm32f4xx_hal::{pac, prelude::*};
    use defmt::info;

    #[shared]
    struct Shared {
        counter: u32,
    }

    #[local]
    struct Local {}

    #[init]
    fn init(cx: init::Context) -> (Shared, Local) {
        info!("RTIC init");
        periodic_task::spawn().unwrap();
        (Shared { counter: 0 }, Local {})
    }

    #[task(shared = [counter])]
    async fn periodic_task(mut cx: periodic_task::Context) {
        loop {
            cx.shared.counter.lock(|c| *c += 1);
            info!("Count: {}", cx.shared.counter.lock(|c| *c));
            rtic_monotonics::systick::Systick::delay(500.millis()).await;
        }
    }

    #[task(binds = EXTI0, local = [], priority = 2)]
    fn button_isr(cx: button_isr::Context) {
        info!("Button pressed!");
    }
}
```

### 6. Panic handlers

| Crate | Behavior | Use when |
|-------|----------|----------|
| `panic-halt` | Infinite loop | Production, no debug probe |
| `panic-probe` | defmt message + halt | Development with probe-rs |
| `panic-semihosting` | GDB semihosting output | Development with GDB |
| `panic-reset` | Hard reset | Watchdog-style recovery |

```toml
# Choose exactly one panic handler
[dependencies]
panic-halt = "0.2"           # or:
panic-probe = { version = "0.3", features = ["print-defmt"] }
```

For embedded Rust target triples reference, see [references/embedded-rust-targets.md](references/embedded-rust-targets.md).

## Related skills

- Use `skills/embedded/openocd-jtag` for OpenOCD-based debugging alternative to probe-rs
- Use `skills/rust/rust-no-std` for `#![no_std]` patterns and constraints
- Use `skills/embedded/linker-scripts` for memory layout configuration
- Use `skills/rust/rust-cross` for cross-compilation toolchain setup
