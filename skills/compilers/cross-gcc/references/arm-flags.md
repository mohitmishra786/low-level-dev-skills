# ARM / AArch64 GCC Flags Reference

Source: https://gcc.gnu.org/onlinedocs/gcc/ARM-Options.html
Source: https://gcc.gnu.org/onlinedocs/gcc/AArch64-Options.html

## AArch64 (64-bit ARM)

| Flag | Effect |
|------|--------|
| `-march=armv8-a` | ARMv8-A baseline |
| `-march=armv8.2-a+fp16` | ARMv8.2 + FP16 |
| `-mcpu=cortex-a72` | Tune for Cortex-A72 |
| `-mcpu=native` | Detect host CPU (for native AArch64 builds) |
| `-moutline-atomics` | Outline atomic operations for better LSE compatibility |

## 32-bit ARM

| Flag | Effect |
|------|--------|
| `-march=armv7-a` | ARMv7-A (Cortex-A series) |
| `-march=armv7-m` | ARMv7-M (Cortex-M3/M4) |
| `-mcpu=cortex-m4` | Tune for Cortex-M4 |
| `-mthumb` | Thumb instruction set (16/32-bit mixed) |
| `-mthumb-interwork` | Allow switching between ARM and Thumb |
| `-mfloat-abi=soft` | Software FP emulation |
| `-mfloat-abi=softfp` | HW FPU, soft-float ABI (pass floats in int regs) |
| `-mfloat-abi=hard` | HW FPU, hard-float ABI (pass floats in FP regs) |
| `-mfpu=fpv4-sp-d16` | Cortex-M4 FPU (single precision) |
| `-mfpu=fpv5-d16` | Cortex-M7 FPU (double precision) |
| `-mfpu=neon` | NEON SIMD |
| `-mfpu=neon-vfpv4` | NEON + VFPv4 |

## Bare-metal / embedded

```bash
arm-none-eabi-gcc \
  -mcpu=cortex-m4 \
  -mthumb \
  -mfloat-abi=hard \
  -mfpu=fpv4-sp-d16 \
  -ffreestanding \
  -nostdlib \
  -nostartfiles \
  -T linker.ld \
  -o firmware.elf \
  startup.s main.c
```

Key flags explained:
- `-ffreestanding`: no hosted C library assumed
- `-nostdlib`: don't link standard libraries
- `-nostartfiles`: don't use standard startup files (`crt0.o`, etc.)
- `-T linker.ld`: use custom linker script

## RISC-V

| Flag | Effect |
|------|--------|
| `-march=rv64gc` | 64-bit, general + compressed + float |
| `-march=rv32imc` | 32-bit, int + multiply + compressed |
| `-mabi=lp64d` | 64-bit LP64 with double FP |
| `-mabi=ilp32` | 32-bit ILP32, soft FP |
| `-mcpu=sifive-u74` | SiFive U74 core |
