---
name: bootloaders-embedded
description: Embedded bootloader skill for firmware update and app handoff. Use when writing a custom bootloader, jumping to application code, relocating VTOR, or implementing DFU/USB firmware update on Cortex-M. Activates on queries about bootloader jump, vector table relocation, application entry point, STM32 DFU, or dual-bank flash.
---

# Embedded Bootloaders

## Purpose

Guide agents through embedded bootloader fundamentals: vector table relocation, safe handoff from bootloader to application, flash partitioning, and basic firmware-update patterns (UART, USB DFU, or custom protocol) on Cortex-M and similar MCUs.

## When to Use

- Application must run at non-zero flash offset (e.g. `0x08010000`)
- Implementing OTA or USB DFU without vendor HAL
- Debugging "app works when flashed alone but not via bootloader"
- Integrating with `skills/baremetal/baremetal-startup` and `skills/baremetal/stm32-baremetal`

## Workflow

### 1. Memory layout (typical STM32)

| Region | Address | Size | Content |
|--------|---------|------|---------|
| Bootloader | `0x08000000` | 16–64 KB | BL code, update logic |
| Application | `0x08010000` | remainder | App vector + code |

Linker script for app must set `FLASH ORIGIN` to app base; vector table must live at app base.

### 2. Valid application image check

Before jump, verify:

```
App vector[0] (initial SP) points into RAM region
App vector[1] (Reset) points into flash region and has Thumb bit set (LSB=1)
Optional: CRC or magic word in app metadata section
```

```c
#define APP_BASE  0x08010000U

static int app_valid(uint32_t base)
{
    uint32_t sp = *(uint32_t *)base;
    uint32_t reset = *(uint32_t *)(base + 4);
    if (sp < SRAM_BASE || sp > SRAM_END)
        return 0;
    if ((reset & 1U) == 0U)
        return 0;
    if (reset < base || reset > FLASH_END)
        return 0;
    return 1;
}
```

### 3. Cortex-M handoff sequence

```c
typedef void (*app_entry_t)(void);

void jump_to_app(uint32_t app_base)
{
    uint32_t sp    = *(uint32_t *)app_base;
    uint32_t reset = *(uint32_t *)(app_base + 4);

    /* Disable interrupts and de-init peripherals/boot-owned hardware */
    __disable_irq();
    SysTick->CTRL = 0;
    for (int i = 0; i < 8; i++) {
        NVIC->ICER[i] = 0xFFFFFFFFU;
        NVIC->ICPR[i] = 0xFFFFFFFFU;
    }

    SCB->VTOR = app_base;
    __set_MSP(sp);
    __DSB();
    __ISB();

    app_entry_t entry = (app_entry_t)reset;
    entry(); /* does not return */
}
```

Application must set `SCB->VTOR = APP_BASE` early in `Reset_Handler` if startup assumes relocatable vector table.

### 4. Bootloader responsibilities

```
Power-on
├── Init minimal clock + UART/USB for update
├── Check update flag in RTC backup / GPIO strap
├── If update requested → receive image, verify, program flash
└── Else if valid app → jump_to_app()
    └── Else stay in bootloader shell
```

### 5. STM32 system memory DFU (factory ROM)

STM32 chips expose USB DFU in system memory when BOOT0=1. Custom bootloaders are separate — do not confuse ROM DFU with user flash BL.

### 6. Update safety

- Write to scratch sector, verify CRC, then swap metadata pointer (A/B)
- Never erase the only valid image without recovery path
- Reset watchdog only after verified commit

### 7. Agent usage

```
/bootloaders-embedded Write STM32F4 jump-to-app at 0x08010000 with VTOR setup
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| HardFault after jump | SP invalid or Thumb bit missing | Validate vectors; ensure `reset \| 1` |
| IRQs hit bootloader handlers | VTOR not relocated | Set `SCB->VTOR` before enabling IRQs |
| App OK standalone, fails via BL | Linker still at `0x08000000` | Relink app with correct ORIGIN |
| UART garbage after jump | BL left UART running | De-init or reset peripherals |
| Brick after OTA | Power loss mid-erase | Dual-bank or metadata rollback |

## Related Skills

- `skills/baremetal/baremetal-startup` — vector table and Reset_Handler
- `skills/baremetal/stm32-baremetal` — flash map and CMSIS
- `skills/baremetal/interrupts-and-exceptions-baremetal` — NVIC disable pattern
- `skills/embedded/linker-scripts` — VMA/LMA for split images
- `skills/embedded/openocd-jtag` — recover bricked flash