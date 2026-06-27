---
name: peripherals-from-datasheet
description: Peripheral driver methodology skill from MCU reference manuals. Use when reading register maps, timing diagrams, and writing drivers from vendor documentation. Activates on queries about reference manual, register map, peripheral init sequence, or datasheet-driven driver design.
---

# Peripherals from Datasheet

## Purpose

Guide agents through a repeatable methodology for writing peripheral drivers from MCU reference manuals: locating register maps, interpreting bit definitions, following init sequences, respecting timing constraints, and producing maintainable register-level code. Pair with `skills/baremetal/datasheet-and-refmanual-reading` for doc-navigation methodology (kept as separate skills).

## When to Use

- Starting a driver without vendor HAL
- Porting a peripheral between MCU families
- Verifying HAL behavior against the reference manual
- Debugging a peripheral that "should work" per examples

## Workflow

### 1. Reference manual navigation

```
Typical RM structure
├── Memory map (peripheral base addresses)
├── Peripheral chapter (UART, SPI, GPIO, ...)
│   ├── Functional description
│   ├── Register map (table of offsets)
│   ├── Register bit definitions
│   └── Timing / electrical notes
└── Electrical characteristics (clock limits, setup/hold)
```

Start with the **programming model** section before copying register writes.

### 2. Extract register map

```c
/* From RM — USART base 0x40004400 */
typedef struct {
    volatile uint32_t SR;   /* 0x00 status */
    volatile uint32_t DR;   /* 0x04 data */
    volatile uint32_t BRR;  /* 0x08 baud */
    volatile uint32_t CR1;  /* 0x0C control */
    /* ... */
} USART_TypeDef;

#define USART2 ((USART_TypeDef *)0x40004400UL)
```

Verify offset column matches struct layout (padding for reserved words).

### 3. Init sequence checklist

```
Peripheral bring-up order
├── 1. Enable bus clock (RCC/APB/AHB register)
├── 2. Reset peripheral (if RM requires)
├── 3. Configure pins (GPIO alternate function)
├── 4. Configure peripheral registers (mode, baud, etc.)
├── 5. Enable peripheral (UE, TE, RE bits)
├── 6. Enable NVIC IRQ (if interrupt-driven)
└── 7. Verify status flags before first transaction
```

**Bad** — enable UART before clock:

```c
USART2->CR1 |= USART_CR1_UE;  /* USART clock still off — no effect */
```

### 4. Bit definition discipline

```c
/* From RM: CR1 M[1:0], PCE, PS, TE, RE, UE */
#define USART_CR1_UE   (1U << 13)
#define USART_CR1_TE   (1U << 3)
#define USART_CR1_RE   (1U << 2)
```

Document RM section number in comment for audit trail.

### 5. Timing and busy-wait

```c
/* RM: poll BUSY flag until reset complete */
while (RCC->CR & RCC_CR_PLLRDY == 0)
    ;
```

Respect startup times (oscillator settle, PLL lock) from electrical characteristics chapter.

### 6. Good vs bad driver structure

**Good** — layered, RM-referenced:

```c
void usart2_init(uint32_t baud) {
    rcc_enable_usart2();
    gpio_config_usart2_pins();
    usart2_set_baud(baud);
    USART2->CR1 = USART_CR1_TE | USART_CR1_RE | USART_CR1_UE;
}
```

**Bad** — magic numbers, no clock enable:

```c
*(uint32_t*)0x4000440C = 0x2000;  /* what peripheral? which bit? */
```

### 7. Agent usage examples

```
/peripherals-from-datasheet Walk me through USART init from STM32 RM
/peripherals-from-datasheet What sections of the ref manual matter for SPI timing?
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Peripheral dead | Clock not enabled | RCC/APB enable bit first |
| Wrong baud rate | PCLK assumption wrong | Recompute using actual clock tree |
| GPIO AF wrong | MUX value from wrong table | Cross-check pinout + AF table |
| IRQ stuck | Status flag clear sequence wrong | RM "clearing flags" subsection |
| Silent data corruption | Endian or width mismatch | Match register access size |

## Related Skills

- `skills/baremetal/datasheet-and-refmanual-reading` — fast RM navigation
- `skills/baremetal/mmio-and-bit-manipulation` — register access patterns
- `skills/baremetal/gpio-baremetal` — pin mux before peripheral enable
- `skills/embedded/linker-scripts` — memory map alignment