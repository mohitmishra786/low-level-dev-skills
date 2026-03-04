# Embedded Rust Target Reference

Source: https://docs.rust-embedded.org/book/

## Target Triples

| Architecture | Target Triple | Notes |
|-------------|--------------|-------|
| Cortex-M0, M0+ | `thumbv6m-none-eabi` | ARMv6-M, no hardware divide |
| Cortex-M3 | `thumbv7m-none-eabi` | ARMv7-M |
| Cortex-M4, M7 (no FPU) | `thumbv7em-none-eabi` | ARMv7E-M |
| Cortex-M4F, M7F | `thumbv7em-none-eabihf` | ARMv7E-M + hardware float |
| Cortex-M23 | `thumbv8m.base-none-eabi` | ARMv8-M Baseline |
| Cortex-M33, M55 | `thumbv8m.main-none-eabihf` | ARMv8-M Mainline + FPU |
| RISC-V RV32I | `riscv32i-unknown-none-elf` | Bare-metal RISC-V 32-bit |
| RISC-V RV32IMAC | `riscv32imac-unknown-none-elf` | With multiply + atomic |
| RISC-V RV32GC | `riscv32gc-unknown-none-elf` | Full standard extensions |
| RISC-V RV64GC | `riscv64gc-unknown-none-elf` | 64-bit RISC-V |
| AVR (experimental) | `avr-unknown-gnu-atmega328` | Arduino/ATmega |
| MSP430 | `msp430-none-elf` | TI MSP430 |
| Xtensa LX6 (ESP32) | `xtensa-esp32-none-elf` | Requires espup toolchain |

## Installing Targets

```bash
# Standard targets (rustup)
rustup target add thumbv7em-none-eabihf
rustup target add riscv32imac-unknown-none-elf

# Xtensa (ESP32) — requires esp-rs toolchain
curl -LO https://github.com/esp-rs/espup/releases/latest/download/espup-x86_64-unknown-linux-gnu
chmod +x espup-x86_64-unknown-linux-gnu
./espup-x86_64-unknown-linux-gnu install
source ~/export-esp.sh
```

## Common HAL Crates by MCU Family

| MCU | Crate |
|-----|-------|
| STM32F4 | `stm32f4xx-hal` |
| STM32L4 | `stm32l4xx-hal` |
| STM32H7 | `stm32h7xx-hal` |
| nRF52840 | `nrf52840-hal` |
| nRF9160 | `nrf9160-hal` |
| RP2040 | `rp2040-hal` |
| ESP32-C3 | `esp32c3-hal` (via esp-idf-hal) |
| STM32 all | `embassy-stm32` (async HAL) |
| nRF all | `embassy-nrf` |
| RP2040 | `embassy-rp` |

## Memory Configuration

```toml
# memory.x — place next to Cargo.toml for cortex-m-rt
MEMORY
{
  FLASH : ORIGIN = 0x08000000, LENGTH = 512K
  RAM   : ORIGIN = 0x20000000, LENGTH = 128K
}
```

```toml
# .cargo/config.toml
[target.thumbv7em-none-eabihf]
rustflags = [
    "-C", "link-arg=-Tlink.x",      # cortex-m-rt linker script
    "-C", "link-arg=--nmagic",       # disable page alignment (saves space)
]
```

## probe-rs Chip Names

```bash
# Find chip name
probe-rs chip list | grep -i "stm32f4"
probe-rs chip list | grep -i "nrf52"
probe-rs chip list | grep -i "rp2040"

# Common names
# STM32F411CEUx, STM32F407VGTx, STM32L476RGTx
# nRF52840_xxAA, nRF9160_xxAA
# RP2040
# ESP32C3        (via espflash, not probe-rs)
```
