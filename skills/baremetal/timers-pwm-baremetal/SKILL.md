---
name: timers-pwm-baremetal
description: Bare-metal timer and PWM skill. Use when configuring general-purpose timers for PWM, input capture, or periodic ticks without RTOS. Activates on queries about timer prescaler, PWM duty cycle, input capture, or SysTick bare-metal.
---

# Timers and PWM (Bare-Metal)

## Purpose

Configure MCU timers for PWM output, input capture, and periodic scheduling: prescaler/ARR setup, compare channels, and SysTick as a simple tick source.

## When to Use

- Motor/LED dimming via PWM
- Measuring pulse width (input capture)
- Bare-metal `millis()` without FreeRTOS
- Hardware periodic sampling trigger

## Workflow

### 1. PWM on TIM2 CH1 (STM32)

```
f_pwm = f_timer_clk / ((PSC+1) * (ARR+1))
duty = (CCR / (ARR+1)) * 100%
```

```c
RCC->APB1ENR |= RCC_APB1ENR_TIM2EN;

TIM2->PSC  = 83;      /* 84MHz / 84 = 1 MHz tick */
TIM2->ARR  = 999;     /* 1 kHz PWM */
TIM2->CCR1 = 500;     /* 50% duty */
TIM2->CCMR1 |= (6U << TIM_CCMR1_OC1M_Pos);  /* PWM mode 1 */
TIM2->CCER  |= TIM_CCER_CC1E;
TIM2->CR1   |= TIM_CR1_CEN;
```

GPIO: PA0 AF1 TIM2_CH1.

### 2. SysTick tick

```c
volatile uint32_t tick_ms;

void SysTick_Handler(void) {
    tick_ms++;
}

void systick_init(uint32_t hz) {
    SysTick_Config(SystemCoreClock / hz);
}
```

### 3. Input capture

Configure channel in `CCMR` as input, set `CCER` polarity, read `CCR` on interrupt when edge captured.

### 4. Agent usage

```
/timers-pwm-baremetal 1 kHz 25% duty PWM on TIM2 channel 1
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Wrong frequency | APB timer clock doubling | Check RM timer clock x2 rule |
| No PWM output | CCER/CCMR not enabled | Enable channel output |
| Jittery tick | SysTick overridden | One owner for SysTick |

## Related Skills

- `skills/baremetal/gpio-baremetal` — timer pin AF
- `skills/embedded/freertos` — replace SysTick with RTOS tick
- `skills/baremetal/adc-dac-baremetal` — timer TRGO for ADC trigger