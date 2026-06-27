---
name: baremetal-startup
description: Bare-metal startup skill for reset-to-main bring-up. Use when writing startup code, vector tables, .data/.bss init, stack setup, or crt0 for Cortex-M/RISC-V. Activates on queries about reset vector, VTOR, startup.s, bss init, or bare-metal entry point.
---

# Bare-Metal Startup

## Purpose

Guide agents through bare-metal startup from reset to `main()`: reset and exception vectors, `.data`/`.bss` initialization, stack and heap setup, C runtime integration with linker scripts, and common Cortex-M and RISC-V bring-up bugs.

## When to Use

- Firmware hangs before reaching `main()`
- Porting to a new MCU without vendor HAL
- Writing custom `startup.s` or `Reset_Handler`
- Integrating with `skills/embedded/linker-scripts`
- Debugging uninitialized globals or stack overflows at boot

## Workflow

### 1. Boot sequence mental model

```
Power-on / reset
├── CPU loads SP from vector[0]
├── CPU branches to Reset_Handler from vector[1]
├── Reset_Handler: init clocks (optional), copy .data, zero .bss
├── Configure stack pointer (if not already from vector)
├── Call SystemInit() / platform_init()
└── Call main() — must not return (loop or WFI)
```

### 2. Cortex-M vector table

On Cortex-M, the vector table starts at address 0 or a relocatable base (VTOR):

| Index | Entry |
|-------|-------|
| 0 | Initial stack pointer (`_estack`) |
| 1 | `Reset_Handler` |
| 2 | `NMI_Handler` |
| 3 | `HardFault_Handler` |
| 4+ | IRQ handlers per NVIC |

```asm
/* startup.s — minimal Cortex-M */
.syntax unified
.thumb

.section .isr_vector,"a",%progbits
.global g_pfnVectors
g_pfnVectors:
    .word _estack
    .word Reset_Handler
    .word NMI_Handler
    .word HardFault_Handler
    /* ... device IRQ vectors from vendor CMSIS ... */

.section .text.Reset_Handler
.thumb_func
.global Reset_Handler
Reset_Handler:
    ldr r0, =_sidata    /* .data load address (LMA) */
    ldr r1, =_sdata     /* .data VMA start */
    ldr r2, =_edata
    b LoopCopyDataInit
CopyDataInit:
    ldr r3, [r0], #4
    str r3, [r1], #4
LoopCopyDataInit:
    cmp r1, r2
    blt CopyDataInit
    ldr r2, =_sbss
    ldr r4, =_ebss
    movs r3, #0
    b LoopFillZerobss
FillZerobss:
    str r3, [r2], #4
LoopFillZerobss:
    cmp r2, r4
    blt FillZerobss
    bl SystemInit
    bl main
    b .
```

```c
/* Linker symbols — declared extern in startup */
extern uint32_t _estack, _sidata, _sdata, _edata, _sbss, _ebss;
```

### 3. VTOR relocation (Cortex-M)

```c
#include "core_cm4.h"  /* CMSIS */

void relocate_vector_table(uint32_t base) {
    SCB->VTOR = base & 0xFFFFFF80U;  /* must be aligned per ARM ref manual */
    __DSB();
    __ISB();
}
```

Bootloader jumping to app often requires setting VTOR to the application's vector table address (e.g., `0x08020000` on STM32 flash).

### 4. RISC-V startup (overview)

```asm
/* entry.S — simplified */
.section .text.entry
.global _start
_start:
    la sp, _stack_top
    la t0, _bss_start
    la t1, _bss_end
clear_bss:
    beq t0, t1, bss_done
    sw zero, 0(t0)
    addi t0, t0, 4
    j clear_bss
bss_done:
    call main
    j .
```

Trap vector: `mtvec` for M-mode; see `skills/platform/riscv-privileged`.

### 5. crt0 responsibilities

| Task | Who does it |
|------|-------------|
| Copy `.data` LMA→VMA | `Reset_Handler` / crt0 |
| Zero `.bss` | `Reset_Handler` |
| Init stack | Vector[0] or explicit `sp` |
| Heap (`_sbrk`) | Optional; libc or custom |
| C++ constructors | `__libc_init_array()` if using full libc |
| FPU enable | `SystemInit` on Cortex-M4F/M7 |

### 6. Linker script integration

```ld
_estack = ORIGIN(RAM) + LENGTH(RAM);
_sidata = LOADADDR(.data);
```

Cross-link `skills/embedded/linker-scripts` for MEMORY/SECTIONS layout.

### 7. Agent usage examples

```
/baremetal-startup My STM32 never reaches main — what should Reset_Handler do?
/baremetal-startup How do I relocate the vector table after bootloader jump?
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| HardFault immediately | Stack pointer invalid | Set `_estack` to valid RAM top |
| Globals wrong at boot | `.data` not copied | Copy LMA→VMA in Reset_Handler |
| BSS non-zero | `.bss` not zeroed | Add bss clear loop |
| IRQs don't fire | VTOR points to wrong table | `SCB->VTOR = app_vector_addr` |
| `main` returns into garbage | No loop after main | `while(1)` or `WFI` loop |
| C++ static init crash | Constructors before clocks | Call `SystemInit` first |

## Related Skills

- `skills/embedded/linker-scripts` — `_estack`, LMA/VMA, section placement
- `skills/baremetal/interrupts-and-exceptions-baremetal` — vector table IRQ entries
- `skills/baremetal/bootloaders-embedded` — VTOR relocation on app jump
- `skills/embedded/openocd-jtag` — halt at `Reset_Handler` with GDB
- `skills/low-level-programming/assembly-arm` — Thumb-2 syntax
- `skills/platform/riscv-privileged` — RISC-V trap setup