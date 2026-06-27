---
name: dma-baremetal
description: Bare-metal DMA skill for memory-peripheral transfers. Use when configuring DMA channels, circular mode, double buffering, or DMA IRQ completion. Activates on queries about DMA bare-metal, circular buffer, memory-to-peripheral, or DMA stream configuration.
---

# DMA (Bare-Metal)

## Purpose

Configure DMA controllers for memory-to-peripheral and peripheral-to-memory transfers: channel/stream setup, burst sizes, circular mode, half-transfer interrupts, and cache coherency on Cortex-M7.

## When to Use

- Offloading UART/SPI/ADC bulk transfers from CPU
- Audio/streaming double buffers
- Debugging DMA not triggering or corrupt data

## Workflow

### 1. STM32 DMA2 stream (periph→mem)

```c
/* UART2 RX DMA — Stream5, Channel 4 (verify RM matrix) */
RCC->AHB1ENR |= RCC_AHB1ENR_DMA1EN;

DMA1_Stream5->PAR  = (uint32_t)&USART2->DR;
DMA1_Stream5->M0AR = (uint32_t)rx_buf;
DMA1_Stream5->NDTR = sizeof(rx_buf);
DMA1_Stream5->CR   = DMA_SxCR_MINC     /* mem increment */
                   | DMA_SxCR_TCIE    /* transfer complete IRQ */
                   | DMA_SxCR_CHSEL_2 /* channel 4 */
                   | DMA_SxCR_EN;

USART2->CR3 |= USART_CR3_DMAR;
```

### 2. Circular / double buffer

```c
DMA1_Stream5->CR |= DMA_SxCR_CIRC;  /* auto-reload NDTR */
/* HTIF = first half, TCIF = second half — process in IRQ */
```

### 3. Cortex-M7 cache (H7)

DMA buffer in non-cacheable region or clean/invalidate D-Cache:

```c
SCB_CleanDCache_by_Addr((void*)tx_buf, len);
/* after DMA TX */
SCB_InvalidateDCache_by_Addr((void*)rx_buf, len);
```

### 4. Agent usage

```
/dma-baremetal Configure UART RX DMA circular buffer on STM32F4
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| DMA no start | Stream/channel mismatch | RM DMA request mapping table |
| Corrupt RX | Cache coherency (M7) | Invalidate after RX complete |
| NDTR stuck | Peripheral DMA enable missing | USART_CR3 DMAR/DMAT |
| IRQ flood | Clear flags in ISR | `DMA_LISR`/`HIFCR` |

## Related Skills

- `skills/baremetal/uart-serial-baremetal` — USART DMA enable
- `skills/baremetal/adc-dac-baremetal` — ADC DMA mode
- `skills/low-level-programming/cpu-cache-opt` — cache line concepts