# Zig Target Triples Reference

## Triple Format

```
<cpu_arch>-<os>-<abi>
```

- `cpu_arch`: x86_64, x86, aarch64, arm, thumb, riscv32, riscv64, mips, mipsel, bpfel, wasm32, wasm64, ...
  (no `thumbv7em`/`armv7`/`i386`/`riscv32imac`: pick the core or extensions with `-mcpu`)
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
| `arm-linux-gnueabihf` + `-mcpu cortex_a7` | glibc | ARMv7 with FPU (Pi 2/3) |
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
| `x86-windows-gnu` | 32-bit Windows |

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

| Target + CPU | MCU Family | Notes |
|--------------|-----------|-------|
| `thumb-freestanding-eabi -mcpu cortex_m0plus` | Cortex-M0/M0+ | RP2040 core |
| `thumb-freestanding-eabi -mcpu cortex_m3` | Cortex-M3 | STM32F1, LPC17xx |
| `thumb-freestanding-eabi -mcpu cortex_m4` | Cortex-M4 (soft-float) | |
| `thumb-freestanding-eabihf -mcpu cortex_m4+vfp4d16sp` | Cortex-M4F (hard-float) | STM32F4, nRF52 |
| `thumb-freestanding-eabihf -mcpu cortex_m7+fp_armv8d16` | Cortex-M7 with DP FPU | STM32F7/H7 |
| `thumb-freestanding-eabi -mcpu cortex_m23` | Cortex-M23 | |
| `thumb-freestanding-eabi -mcpu cortex_m33` | Cortex-M33 (soft-float) | |
| `thumb-freestanding-eabihf -mcpu cortex_m33+fp_armv8d16sp` | Cortex-M33 with FPU | STM32U5, nRF9160 |

### ARM Cortex-A (freestanding)

| Triple | CPU | Use case |
|--------|-----|----------|
| `aarch64-freestanding-eabi` | Cortex-A (64-bit) | Bare-metal A72 |
| `arm-freestanding-eabihf` | Cortex-A (32-bit) | Bare-metal A9/A15 |

### RISC-V

| Triple | Notes |
|--------|-------|
| `riscv32-freestanding` | RISC-V 32-bit (generic) |
| `riscv32-freestanding -mcpu generic_rv32+m` | With multiply extension |
| `riscv32-freestanding -mcpu generic_rv32+m+c` | With multiply and compressed (ESP32-C3) |
| `riscv32-freestanding -mcpu generic_rv32+m+a+c` | With atomics and compressed |
| `riscv64-freestanding` | RISC-V 64-bit |
| `riscv64-freestanding -mcpu baseline_rv64` | RISC-V 64 with GC extensions |

### Other

| Triple | Notes |
|--------|-------|
| `mips-freestanding-none` | MIPS32 bare metal |
| `avr-freestanding-none` | AVR (Arduino) |
| `bpfel-freestanding-none` | eBPF (little-endian; `bpfeb` for big-endian) |

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
cortex_m4+vfp4d16sp         # Cortex-M4F: single-precision FPU (+vfp4 would emit f64 VFP ops)
cortex_m7+fp_armv8d16       # Cortex-M7 with double-precision FPU
cortex_m7+fp_armv8d16sp     # Cortex-M7 with single-precision FPU
cortex_m33                  # Cortex-M33
cortex_m33+fp_armv8d16sp    # Cortex-M33 with FPU

# RISC-V (with -target riscv32-... / riscv64-...)
generic_rv32                # Base integer (RV32I)
generic_rv32+m              # + Multiply
generic_rv32+m+c            # + Compressed
generic_rv32+m+a+c          # + Atomics + Compressed
baseline_rv64               # RV64GC
```
