---
name: low-power-embedded
description: Low-power embedded skill for sleep modes and energy optimization. Use when configuring MCU sleep/stop/standby, peripheral clock gating, wake-up sources, or measuring firmware current draw. Activates on queries about WFI, STOP mode, STM32 PWR, nRF sleep, wake-up EXTI, or reducing embedded power consumption.
---

# Low-Power Embedded

## Purpose

Guide agents through MCU low-power modes: sleep vs deep sleep (stop/standby), peripheral and bus clock gating, wake-up source configuration, and practical current measurement — with Cortex-M `WFI`/`WFE` and vendor PWR examples (STM32-focused patterns apply broadly).

## When to Use

- Battery-powered firmware missing power budget
- Wake-up latency vs consumption tradeoffs
- Debugging "device won't wake" or "current still mA in sleep"
- Before shipping RTOS idle hook or bare-metal main loop sleep
- Cross-linking with `skills/baremetal/interrupts-and-exceptions-baremetal`

## Workflow

### 1. Power mode hierarchy (STM32-style)

| Mode | CPU | Peripherals | RAM | Wake source | Relative current |
|------|-----|-------------|-----|-------------|------------------|
| Run | on | on | on | — | highest |
| Sleep | off | on | on | any IRQ | medium |
| Stop | off | most off | on | EXTI, RTC, UART | low |
| Standby | off | off | lost* | WKUP pins, RTC | lowest |

\* Standby clears most SRAM; use backup domain or external EEPROM for state.

### 2. Enter Sleep (WFI)

```c
/* Cortex-M — sleep until interrupt */
__disable_irq();
/* configure wake source (e.g. EXTI, RTC alarm) */
__enable_irq();
__WFI(); /* or __WFE() for event-based wake */
```

Ensure pending interrupts are cleared before `WFI` or wake may be immediate.

### 3. STM32 Stop mode pattern

```c
#include "stm32f4xx.h"

void enter_stop_mode(void)
{
    /* Gate clocks you do not need */
    RCC->AHB1ENR &= ~RCC_AHB1ENR_GPIOAEN; /* example — only if safe */

    PWR->CR |= PWR_CR_CWUF;   /* clear wake flags */
    PWR->CR |= PWR_CR_PDDS;   /* deep sleep = Stop */
    SCB->SCR |= SCB_SCR_SLEEPDEEP_Msk;

    __WFI();

    /* After wake: re-enable HSE/PLL — clocks lost in Stop on many parts */
    SystemInit();
}
```

After Stop, re-init clocks and peripherals that lost their registers.

### 4. Clock gating checklist

```
Before sleep
├── Disable unused peripheral clocks (RCC xENR)
├── Disable ADC/DAC continuous modes
├── Stop DMA channels
├── Enter peripheral low-power (UART mute, SPI off)
└── Configure lowest viable regulator scale (Voltage Scale 2/3)
```

### 5. Wake-up sources

| Source | Config |
|--------|--------|
| EXTI GPIO | SYSCFG + EXTI IMR, edge trigger |
| RTC alarm | RTC WUT/WAKEUP |
| UART | Start bit detection (some MCUs) |
| IWDG | Not a wake source — resets device |

### 6. Measurement tips

- Use ammeter in series with VDDA/VDD; short sampling window for uA
- DWT cycle counter for wake latency benchmarking
- Compare run vs sleep current **with same clock tree** documented

### 7. RTOS note

FreeRTOS `configUSE_TICKLESS_IDLE` maps to WFI/Stop — coordinate with `skills/embedded/freertos`.

### 8. Agent usage

```
/low-power-embedded Configure STM32 Stop mode with EXTI0 wake and PLL restore
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Still mA in "sleep" | Debug interface active (SWD) | Disconnect debugger; disable DBGMCU |
| Immediate wake from WFI | Pending NVIC IRQ | Clear flags before WFI |
| Lost state after wake | Entered Standby not Stop | Use Stop if RAM must persist |
| UART dead after wake | Clock tree not restored | Call `SystemInit()` path |
| Higher than datasheet uA | Floating GPIO | Set unused pins analog or pull |

## Related Skills

- `skills/baremetal/interrupts-and-exceptions-baremetal` — EXTI wake IRQs
- `skills/baremetal/gpio-baremetal` — pin mode for leakage control
- `skills/baremetal/stm32-baremetal` — RCC and PWR registers
- `skills/baremetal/timers-pwm-baremetal` — stop timers before sleep
- `skills/embedded/freertos` — tickless idle integration