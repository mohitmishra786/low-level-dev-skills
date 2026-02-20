# Zig Target Triples Reference

## Triple Format

```
<cpu_arch>-<os>-<abi>
```

- `cpu_arch`: x86_64, aarch64, arm, thumb, thumbv6m, thumbv7m, thumbv7em, thumbv8m, riscv32, riscv64, mips, mipsel, wasm32, wasm64, ...
- `os`: linux, windows, macos, ios, freebsd, netbsd, openbsd, dragonfly, solaris, freestanding, wasi, other
- `abi`: none, gnu, gnueabi, gnueabihf, musl, musleabi, musleabihf, eabi, eabihf, msvc, android, ...

## Linux Targets

| Triple | ABI | Notes |
|--------|-----|-------|
| `x86_64-linux-gnu` | glibc | Standard Linux x86-64 |
| `x86_64-linux-musl` | musl | Static, no glibc dep |
| `x86_64-linux-gnux32` | glibc x32 | 32-bit pointers on 64-bit |
| `aarch64-linux-gnu` | glibc | ARM64 Linux |
| `aarch64-linux-musl` | musl | ARM64 static |
| `aarch64_be-linux-gnu` | glibc | ARM64 big-endian |
| `arm-linux-gnueabi` | glibc soft-float | ARM32, no FPU |
| `arm-linux-gnueabihf` | glibc hard-float | ARM32 with FPU |
| `armv7-linux-gnueabihf` | glibc | ARMv7 with FPU (Pi 2/3) |
| `riscv32-linux-gnu` | glibc | RISC-V 32-bit Linux |
| `riscv64-linux-gnu` | glibc | RISC-V 64-bit Linux |
| `mipsel-linux-gnu` | glibc | MIPS little-endian |
| `powerpc64le-linux-gnu` | glibc | POWER little-endian |
| `s390x-linux-gnu` | glibc | IBM Z Series |

## Windows Targets

| Triple | Notes |
|--------|-------|
| `x86_64-windows-gnu` | MinGW ABI, cross-compilable |
| `x86_64-windows-msvc` | MSVC ABI, requires Windows SDK |
| `aarch64-windows-gnu` | ARM64 Windows (MinGW) |
| `i386-windows-gnu` | 32-bit Windows |

## macOS / iOS Targets

| Triple | Notes |
|--------|-------|
| `x86_64-macos-none` | macOS Intel |
| `aarch64-macos-none` | macOS Apple Silicon (M1/M2/M3) |
| `x86_64-ios-none` | iOS Simulator (x86-64) |
| `aarch64-ios-none` | iOS device |

**Note**: Cross-compiling to macOS requires the macOS SDK.

## Embedded (Freestanding) Targets

### ARM Cortex-M

| Triple | MCU Family | Notes |
|--------|-----------|-------|
| `thumb-freestanding-eabi` | Generic Thumb | |
| `thumbv6m-freestanding-eabi` | Cortex-M0/M0+ | RP2040 core |
| `thumbv7m-freestanding-eabi` | Cortex-M3 | STM32F1, LPC17xx |
| `thumbv7em-freestanding-eabi` | Cortex-M4/M7 (soft-float) | |
| `thumbv7em-freestanding-eabihf` | Cortex-M4/M7 (hard-float) | STM32F4/F7, nRF52 |
| `thumbv8m.base-freestanding-eabi` | Cortex-M23 | |
| `thumbv8m.main-freestanding-eabi` | Cortex-M33/M35P | STM32U5, nRF9160 |
| `thumbv8m.main-freestanding-eabihf` | Cortex-M33 with FPU | |

### ARM Cortex-A (freestanding)

| Triple | CPU | Use case |
|--------|-----|----------|
| `aarch64-freestanding-eabi` | Cortex-A (64-bit) | Bare-metal A72 |
| `arm-freestanding-eabihf` | Cortex-A (32-bit) | Bare-metal A9/A15 |

### RISC-V

| Triple | Notes |
|--------|-------|
| `riscv32-freestanding` | RISC-V 32-bit (generic) |
| `riscv32im-freestanding` | With multiply extension |
| `riscv32imc-freestanding` | With multiply and compressed |
| `riscv32imac-freestanding` | With atomics (ESP32-C3) |
| `riscv64-freestanding` | RISC-V 64-bit |
| `riscv64gc-freestanding` | RISC-V 64 with GC extensions |

### Other

| Triple | Notes |
|--------|-------|
| `mips-freestanding-none` | MIPS32 bare metal |
| `avr-freestanding-none` | AVR (Arduino) |
| `bpf-freestanding-none` | eBPF |

## WASM Targets

| Triple | Use case |
|--------|----------|
| `wasm32-freestanding` | Browser (no WASI) |
| `wasm32-wasi` | WASI runtime (wasmtime/wasmer) |
| `wasm64-freestanding` | 64-bit WASM (experimental) |

## CPU Feature Strings

```bash
# x86_64 common features
x86_64                     # baseline (SSE2 only)
x86_64+sse4.2              # SSE 4.2
x86_64+avx                 # AVX (Sandy Bridge)
x86_64+avx2+bmi+bmi2       # AVX2 (Haswell)
x86_64+avx512f             # AVX-512 Foundation
x86_64v2                   # x86-64-v2 microarch level
x86_64v3                   # x86-64-v3 (AVX2, BMI2)

# ARM64 common CPUs
cortex_a53                  # Pi 3, many phones
cortex_a72                  # Pi 4
cortex_a76                  # Snapdragon 855+
apple_m1                    # Apple M1
neoverse_n1                 # AWS Graviton2

# ARM Cortex-M CPUs
cortex_m0                   # Cortex-M0
cortex_m0plus               # Cortex-M0+
cortex_m3                   # Cortex-M3
cortex_m4                   # Cortex-M4 (no FPU)
cortex_m4+vfp4              # Cortex-M4 with FPU
cortex_m7+vfp5_d16          # Cortex-M7 with FPU
cortex_m33                  # Cortex-M33
cortex_m33+vfp5_d16         # Cortex-M33 with FPU

# RISC-V extensions
riscv32i                    # Base integer
riscv32im                   # + Multiply
riscv32imc                  # + Compressed
riscv32imac                 # + Atomics + Compressed
riscv64gc                   # 64-bit general
```
