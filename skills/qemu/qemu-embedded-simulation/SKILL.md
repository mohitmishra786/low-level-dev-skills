---
name: qemu-embedded-simulation
description: QEMU embedded simulation skill for bare-metal MCU testing. Use when running ARM/RISC-V firmware in QEMU, selecting machine models, loading -kernel ELF, or GDB debugging without hardware. Activates on queries about QEMU bare metal, qemu-system-arm -kernel, STM32 QEMU machine, RISC-V virt, or firmware simulation.
---

# QEMU Embedded Simulation

## Purpose

Guide agents through QEMU for bare-metal and RTOS firmware: machine selection, loading ELF images, semihosting, peripheral models, and GDB debug — distinct from Linux-focused `skills/virtualization/qemu-kvm` and `skills/kernel-dev/qemu-for-kernel-development`.

## When to Use

- Test Cortex-M firmware without board
- CI smoke test for linker script / startup
- GDB single-step before OpenOCD on hardware
- RISC-V bring-up on `virt` machine

## Workflow

### 1. ARM Cortex-M (QEMU STM32 boards)

QEMU models a **subset** of STM32 boards (see [qemu.org STM32 docs](https://www.qemu.org/docs/master/system/arm/stm32.html)):

| Machine | MCU | Core |
|---------|-----|------|
| `stm32vldiscovery` | STM32F100RBT6 | Cortex-M3 |
| `netduino2` | STM32F205RFT6 | Cortex-M3 |
| `netduinoplus2` | STM32F405RGT6 | Cortex-M4F |
| `olimex-stm32-h405` | STM32F405RGT6 | Cortex-M4F |

```bash
# stm32vldiscovery — Cortex-M3 (not F4); match -mcpu to the board
arm-none-eabi-gcc -mcpu=cortex-m3 -T linker.ld -o firmware.elf main.c startup.s
qemu-system-arm \
  -machine stm32vldiscovery \
  -kernel firmware.elf \
  -nographic \
  -serial mon:stdio
```

Boot with `-kernel firmware.bin` or `.elf` per QEMU STM32 boot options.

Machine list: `qemu-system-arm -machine help`. **GPIO, DMA, and I2C are not modeled** on current QEMU STM32 machines — USART/SPI/ADC/timer are partially supported.

### 2. Generic ARM virt (Cortex-A test)

```bash
qemu-system-aarch64 -machine virt -cpu cortex-a53 -m 128M \
  -kernel firmware.elf -nographic
```

### 3. RISC-V bare metal

```bash
qemu-system-riscv32 -machine virt -nographic \
  -bios none \
  -kernel firmware.elf
```

`-bios none` starts at reset vector without OpenSBI.

### 4. GDB stub

```bash
qemu-system-arm -machine stm32vldiscovery -kernel firmware.elf \
  -S -gdb tcp::3333 -nographic

arm-none-eabi-gdb firmware.elf
(gdb) target remote :3333
(gdb) monitor reset halt
(gdb) load
```

Pair with `skills/embedded/openocd-jtag` for on-target workflow.

### 5. Semihosting (if supported)

```bash
qemu-system-arm ... -semihosting-config enable=on,target=native
```

Allows `printf` via semihosting syscall — toolchain must be built with semihosting support.

### 6. Limitations (QEMU STM32 per upstream docs)

| Gotcha | Reality |
|--------|---------|
| No GPIO in QEMU STM32 | GPIO controller not implemented — LED blink tests need hardware or another machine |
| No DMA / I2C | DMA and I2C missing on STM32 QEMU models |
| Partial RCC | RCC reset/enable only on F4; not full clock tree |
| Wrong MCU assumed | `stm32vldiscovery` is F100 M3, not F407 — match CPU flags and linker memory |
| Timing | Not cycle-accurate vs silicon |

Validate on hardware before production sign-off.

### 7. Agent usage

```
/qemu-embedded-simulation Run STM32VL discovery firmware in QEMU with GDB on port 3333
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| QEMU exits immediately | `main` returned | Loop or `WFI` at end |
| Wrong entry address | ELF not linked for model | Check `readelf -h` entry |
| No serial output | Wrong UART model address | Use machine-specific map or semihosting |
| GDB can't connect | Forgot `-S` | Add `-S -gdb tcp::3333` |
| HardFault in QEMU | Stack/vector invalid | Fix startup — see baremetal-startup |

## Related Skills

- `skills/baremetal/baremetal-startup` — vectors and linker script
- `skills/baremetal/stm32-baremetal` — STM32 layout
- `skills/embedded/openocd-jtag` — hardware debug
- `skills/kernel-dev/qemu-for-kernel-development` — Linux kernel in QEMU
- `skills/platform/riscv-privileged` — RISC-V reset and virt