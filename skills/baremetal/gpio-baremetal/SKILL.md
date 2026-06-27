---
name: gpio-baremetal
description: Bare-metal GPIO skill for pin configuration and interrupts. Use when configuring GPIO modes, alternate functions, pull resistors, or EXTI interrupts on STM32/nRF/ESP32-class MCUs. Activates on queries about GPIO MODER, alternate function, pin interrupt, or LED/button bare-metal setup.
---

# GPIO (Bare-Metal)

## Purpose

Configure and use GPIO without HAL: input/output modes, alternate function mapping, pull-up/down, speed/slew, and pin-change interrupts for LEDs, buttons, and peripheral pin mux.

## When to Use

- Blink LED or read button before bringing up UART/SPI
- Mux pins to USART/SPI alternate functions
- EXTI line interrupts on pin edges
- Porting GPIO code between vendors

## Workflow

### 1. STM32 GPIO pattern

```c
/* Enable GPIOA clock */
RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;

/* PA5 output — MODER[11:10] = 01 */
GPIOA->MODER &= ~(3U << (5 * 2));
GPIOA->MODER |=  (1U << (5 * 2));

/* Toggle via BSRR — atomic set/reset */
GPIOA->BSRR = (1U << 5);       /* set */
GPIOA->BSRR = (1U << (5+16));  /* reset */
```

Alternate function (e.g., USART2 TX on PA2):

```c
GPIOA->MODER &= ~(3U << (2*2));
GPIOA->MODER |=  (2U << (2*2));           /* AF mode */
GPIOA->AFR[0] &= ~(0xFU << (2*4));
GPIOA->AFR[0] |=  (7U << (2*4));          /* AF7 = USART2 */
```

### 2. Input with pull-up

```c
/* PC13 input, pull-up */
GPIOC->MODER &= ~(3U << (13*2));          /* input mode 00 */
GPIOC->PUPDR &= ~(3U << (13*2));
GPIOC->PUPDR |=  (1U << (13*2));          /* pull-up */

int pressed = !(GPIOC->IDR & (1U << 13)); /* active low */
```

### 3. EXTI interrupt (STM32)

```c
/* SYSCFG: map EXTI13 to PC13 */
SYSCFG->EXTICR[3] = (SYSCFG->EXTICR[3] & ~0xFU) | 0x2;  /* port C */
EXTI->IMR  |= (1U << 13);
EXTI->FTSR |= (1U << 13);  /* falling edge */
NVIC_EnableIRQ(EXTI15_10_IRQn);
```

ISR: check `EXTI->PR`, clear with write-1.

### 4. nRF52 / ESP32 notes

| Platform | Pattern |
|----------|---------|
| nRF52 | `NRF_P0->PIN_CNF[n]` — direction, pull, drive |
| ESP32 | `GPIO.out_w1ts`, `GPIO.enable`; IO_MUX for function |

Always enable peripheral clock / power domain before pin config.

### 5. Agent usage

```
/gpio-baremetal Configure PA2 as USART2 TX alternate function on STM32F4
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Pin stuck | Wrong MODER / not AF | Re-read RM pin table |
| EXTI storm | No debounce / floating input | Enable pull; debounce in software |
| AF mismatch | Wrong AFR nibble | Pin-specific AF table in RM |
| No toggle visible | Wrong port bit / LED active low | Check schematic |

## Related Skills

- `skills/baremetal/mmio-and-bit-manipulation` — BSRR/MODER masks
- `skills/baremetal/peripherals-from-datasheet` — RM pinout tables
- `skills/baremetal/uart-serial-baremetal` — AF mux for serial