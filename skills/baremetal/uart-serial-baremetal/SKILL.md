---
name: uart-serial-baremetal
description: Bare-metal UART skill for serial console and debug. Use when configuring baud rate, polling or IRQ-driven TX/RX, or integrating DMA with UART. Activates on queries about UART bare-metal, baud BRR, serial printf, or USART interrupt.
---

# UART Serial (Bare-Metal)

## Purpose

Implement UART/USART for debug console and device communication: baud rate calculation, 8N1 framing, polling and interrupt-driven I/O, overrun handling, and optional DMA basics.

## When to Use

- First `printf`/log output on new hardware
- Serial protocol to sensor/module
- Replacing blocking HAL_UART with minimal driver
- Fixing garbled or missing characters

## Workflow

### 1. Baud rate (STM32)

```
BRR = pclk / (16 * baud)   /* oversampling by 16 — check RM for USART */
```

```c
void usart2_init(uint32_t pclk, uint32_t baud) {
    RCC->APB1ENR |= RCC_APB1ENR_USART2EN;
    /* GPIO PA2/PA3 AF — see gpio-baremetal */

    USART2->BRR = pclk / baud;  /* simplified — RM has fractional formula */
    USART2->CR1 = USART_CR1_TE | USART_CR1_RE | USART_CR1_UE;
}
```

Verify `pclk` from actual clock tree (`SystemCoreClock`, APB prescaler).

### 2. Polling TX/RX

```c
void uart_putc(USART_TypeDef *u, char c) {
    while (!(u->SR & USART_SR_TXE))
        ;
    u->DR = (uint8_t)c;
}

char uart_getc(USART_TypeDef *u) {
    while (!(u->SR & USART_SR_RXNE))
        ;
    return (uint8_t)u->DR;
}
```

### 3. Interrupt-driven RX ring buffer

```c
void USART2_IRQHandler(void) {
    if (USART2->SR & USART_SR_RXNE) {
        uint8_t b = USART2->DR;
        rb_push(&rx_rb, b);
    }
    if (USART2->SR & USART_SR_ORE) {
        (void)USART2->DR;  /* clear overrun — required on STM32 */
    }
}
```

### 4. retarget `printf` (newlib)

```c
int _write(int fd, char *ptr, int len) {
    (void)fd;
    for (int i = 0; i < len; i++)
        uart_putc(USART2, ptr[i]);
    return len;
}
```

Link with `--specs=nosys.specs` or provide full syscalls.

### 5. Agent usage

```
/uart-serial-baremetal Calculate USART BRR for 115200 at 84 MHz PCLK
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Garbage chars | Wrong baud/PCLK | Recompute BRR; check APB divider |
| Lost bytes | ORE not cleared | Read DR on ORE; use IRQ + ringbuf |
| No output | TX pin not AF | GPIO alternate function |
| `printf` hangs | `_write` missing | Implement retarget |

## Related Skills

- `skills/baremetal/gpio-baremetal` — TX/RX pin mux
- `skills/baremetal/interrupts-and-exceptions-baremetal` — USART IRQ
- `skills/baremetal/dma-baremetal` — UART RX DMA
- `skills/embedded/openocd-jtag` — semihosting alternative