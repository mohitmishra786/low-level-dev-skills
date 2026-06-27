---
name: mmio-and-bit-manipulation
description: MMIO and register access skill for bare-metal firmware. Use when accessing memory-mapped peripherals with volatile, bit masks, RMW patterns, or endianness concerns. Activates on queries about MMIO, volatile register, bit manipulation, read-modify-write, or register alignment.
---

# MMIO and Bit Manipulation

## Purpose

Guide agents through safe memory-mapped I/O: `volatile` semantics, read-modify-write patterns, bitfield pitfalls, alignment and endianness, and portable register access macros for bare-metal drivers.

## When to Use

- Writing peripheral register drivers without HAL
- Fixing intermittent register corruption or stale reads
- Replacing C bitfields with explicit masks
- Porting drivers between little-endian MCUs
- Auditing ISR vs main-line register access

## Workflow

### 1. MMIO fundamentals

Peripheral registers live at fixed addresses in the CPU memory map. The compiler must not cache reads/writes.

```c
#include <stdint.h>

#define PERIPH_BASE   0x40000000U
#define GPIOA_MODER   (*(volatile uint32_t *)(PERIPH_BASE + 0x20000U))
```

| Qualifier | Effect |
|-----------|--------|
| `volatile` | Forces load/store each access — required for hardware |
| `const volatile` | Read-only hardware (rare) |
| Plain `uint32_t *` | **Wrong** — compiler may optimize away |

### 2. Read-modify-write macros

```c
#define REG32(addr)        (*(volatile uint32_t *)(addr))
#define REG_SET(addr, mask)   (REG32(addr) |= (mask))
#define REG_CLR(addr, mask)   (REG32(addr) &= ~(mask))
#define REG_TOGGLE(addr, mask) (REG32(addr) ^= (mask))
#define REG_WRITE(addr, val)  (REG32(addr) = (val))
#define REG_READ(addr)        (REG32(addr))
```

**Good** — atomic intent for single-bit updates when register supports it:

```c
#define GPIOA_BSRR  REG32(0x40020018U)
GPIOA_BSRR = (1U << 5);        /* set PA5 */
GPIOA_BSRR = (1U << (5+16));   /* reset PA5 — STM32 BSRR pattern */
```

**Bad** — non-atomic RMW on interrupt-shared registers:

```c
uint32_t v = REG_READ(GPIOA_MODER);
v |= (1U << 10);
REG_WRITE(GPIOA_MODER, v);  /* ISR may interleave — lost update */
```

Fix: disable IRQ briefly, use hardware set/clear registers, or LL atomic bitband if available.

### 3. Bitfield pitfalls

```c
/* Bad — layout is implementation-defined, not portable */
typedef struct {
    uint32_t mode  : 2;
    uint32_t type  : 1;
    uint32_t speed : 2;
} gpio_moder_bits_t;
```

Prefer explicit masks:

```c
#define GPIO_MODER_MODE0_SHIFT   0
#define GPIO_MODER_MODE0_MASK    (3U << GPIO_MODER_MODE0_SHIFT)
#define GPIO_MODER_MODE0_VAL(n)  ((n) << GPIO_MODER_MODE0_SHIFT)

REG32(GPIOA_MODER) = (REG32(GPIOA_MODER) & ~GPIO_MODER_MODE0_MASK)
                   | GPIO_MODER_MODE0_VAL(1);  /* output */
```

### 4. Endianness and alignment

- Cortex-M and most MCUs: **little-endian** — `uint32_t` MMIO at word-aligned addresses
- Unaligned `uint32_t` access may fault on ARMv7-M+
- 8-bit registers: use `volatile uint8_t` with correct byte lane address

```c
#define REG8(addr)  (*(volatile uint8_t *)(addr))
```

### 5. Memory barriers (when needed)

```c
/* After configuring peripheral before first use */
__DSB();
__ISB();

/* After DMA setup, before enabling channel */
__DMB();
```

Use CMSIS barriers (`core_cm4.h`) on Cortex-M.

### 6. Agent usage examples

```
/mmio-and-bit-manipulation Safe pattern to set bit 3 without affecting other bits in ISR context
/mmio-and-bit-manipulation Why must peripheral pointers be volatile?
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Register write ignored | Wrong address/clock gated | Enable peripheral clock first |
| Random bit flips | RMW race with ISR | BSRR-style atomic regs or critical section |
| HardFault on access | Unaligned or protected bus | Match access width to datasheet |
| Optimized-away read | Missing `volatile` | Use `volatile uint32_t` |
| Bitfield wrong value | Compiler packs unexpectedly | Use shift/mask macros |

## Related Skills

- `skills/baremetal/peripherals-from-datasheet` — extracting register maps
- `skills/baremetal/gpio-baremetal` — GPIO register patterns
- `skills/low-level-programming/assembly-arm` — inline asm barriers
- `skills/embedded/linker-scripts` — peripheral memory map regions