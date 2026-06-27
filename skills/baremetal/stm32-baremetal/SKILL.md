---
name: stm32-baremetal
description: STM32 bare-metal skill for CMSIS-only MCU projects. Use when scaffolding STM32 firmware without HAL, configuring clocks/RCC, using CMSIS headers, or building with arm-none-eabi-gcc. Activates on queries about STM32 bare metal, CMSIS without HAL, STM32F4/H7 bring-up, or minimal Makefile CMake for Cortex-M.
---

# STM32 Bare-Metal (CMSIS, No HAL)

## Purpose

Guide agents through a minimal STM32 bare-metal project using CMSIS device headers and startup code only — no STM32 HAL — covering clock setup, linker script integration, peripheral register access, and a reproducible build layout for STM32F/G/H/L families.

## When to Use

- Starting STM32 firmware without Cube HAL dependency
- Porting vendor examples to register-level drivers
- Integrating with `skills/baremetal/baremetal-startup` and `skills/embedded/linker-scripts`
- Debugging clock or flash placement issues on STM32
- Teaching register-level STM32 before RTOS or Zephyr

## Workflow

### 1. Minimal project layout

```
stm32-bare/
├── startup_stm32f407xx.s   # vector table + Reset_Handler
├── system_stm32f4xx.c      # SystemInit(), SystemCoreClockUpdate()
├── stm32f407xx.h           # CMSIS (from ST pack or copy)
├── linker.ld               # FLASH/RAM regions
├── main.c
└── Makefile
```

Use CMSIS-Core (`core_cm4.h`) and device header from ST CMSIS pack or open-source packs (e.g. `stm32-cmsis-device-f4`).

### 2. Clock configuration (RCC)

STM32 requires explicit HSE/HSI and PLL setup before high-speed peripherals:

```c
/* system_stm32f4xx.c — simplified PLL from 8 MHz HSE */
void SystemInit(void)
{
    RCC->CR |= RCC_CR_HSEON;
    while (!(RCC->CR & RCC_CR_HSERDY)) {}

    RCC->PLLCFGR = RCC_PLLCFGR_PLLSRC_HSE | (8 << 0) | (336 << 6) | (0 << 16) | (7 << 24);
    RCC->CFGR   |= RCC_CFGR_PPRE1_DIV2 | RCC_CFGR_PPRE2_DIV1 | RCC_CFGR_HPRE_DIV1;
    RCC->CR     |= RCC_CR_PLLON;
    while (!(RCC->CR & RCC_CR_PLLRDY)) {}

    FLASH->ACR = FLASH_ACR_LATENCY_5WS;
    RCC->CFGR  |= RCC_CFGR_SW_PLL;
    while ((RCC->CFGR & RCC_CFGR_SWS) != RCC_CFGR_SWS_PLL) {}

    SystemCoreClockUpdate();
}
```

Always match `FLASH_ACR` wait states to voltage scale and SYSCLK per reference manual table.

### 3. Enable peripheral clock before MMIO

```c
#define RCC_AHB1ENR_GPIOAEN (1U << 0)

static inline void gpioa_clock_enable(void)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;
    (void)RCC->AHB1ENR; /* AHB read-after-write — required on STM32 */
}
```

### 4. Build flags (arm-none-eabi-gcc)

```makefile
MCU      = -mcpu=cortex-m4 -mthumb -mfpu=fpv4-sp-d16 -mfloat-abi=hard
CFLAGS   = $(MCU) -Wall -Wextra -ffunction-sections -fdata-sections -g3
LDFLAGS  = $(MCU) -T linker.ld -Wl,--gc-sections -specs=nano.specs -lc -lm -lnosys
```

### 5. Flash map (typical F4)

| Region | Address | Notes |
|--------|---------|-------|
| Flash | `0x08000000` | Vector table at boot |
| SRAM1 | `0x20000000` | Stack, heap, .data/.bss |
| CCM   | `0x10000000` | F4 only — not DMA-accessible from all masters |

Bootloader apps often link at `0x08010000` and set `SCB->VTOR = 0x08010000` on entry.

### 6. QEMU note

QEMU STM32 machines (`stm32vldiscovery`, `netduinoplus2`, etc.) use **different** MCUs than F407 and omit GPIO/DMA/I2C per [QEMU STM32 docs](https://www.qemu.org/docs/master/system/arm/stm32.html). Use `skills/qemu/qemu-embedded-simulation` for simulation; validate F4 firmware on hardware.

### 7. Agent usage

```
/stm32-baremetal Scaffold CMSIS-only STM32F407 project with USART2 printf
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Hang in `SystemInit` | HSE not populated / wrong PLL | Use HSI for bring-up; verify crystal |
| Peripheral dead | RCC clock gate off | Enable AHB/APB bit; read-back RCC |
| HardFault on boot | Stack in wrong region / VTOR | Check `_estack` in linker.ld |
| Wrong baud rate | `SystemCoreClock` stale | Call `SystemCoreClockUpdate()` after PLL |
| DMA fails from CCM | CCM not on AHB matrix path | Place DMA buffers in SRAM1 |

## Related Skills

- `skills/baremetal/baremetal-startup` — vector table and `.data`/`.bss`
- `skills/baremetal/mmio-and-bit-manipulation` — register access patterns
- `skills/baremetal/bootloaders-embedded` — app offset and VTOR relocation
- `skills/embedded/linker-scripts` — FLASH/RAM MEMORY blocks
- `skills/embedded/openocd-jtag` — flash and GDB via ST-Link