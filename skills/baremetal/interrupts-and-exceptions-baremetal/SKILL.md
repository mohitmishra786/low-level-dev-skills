---
name: interrupts-and-exceptions-baremetal
description: Bare-metal interrupt and exception skill for Cortex-M NVIC. Use when writing ISRs, configuring priorities, handling HardFault, or measuring interrupt latency. Activates on queries about NVIC, ISR, vector table, HardFault, tail-chaining, or interrupt priority.
---

# Interrupts and Exceptions (Bare-Metal)

## Purpose

Guide agents through bare-metal interrupt handling on ARM Cortex-M: NVIC configuration, ISR writing rules, exception handlers (HardFault, BusFault), priority grouping, nesting, tail-chaining, and latency considerations.

## When to Use

- Configuring peripheral IRQ priorities
- Writing ISRs that must not block
- Debugging HardFault after enabling interrupts
- Sharing data between ISR and main loop
- Optimizing interrupt latency

## Workflow

### 1. NVIC overview (Cortex-M)

```
Exception / IRQ flow
├── NVIC receives IRQ (priority compare with BASEPRI/PRIMask)
├── Stacking: automatic save r0-r3, r12, lr, pc, psr
├── Branch to handler from vector table
├── Handler runs (should be short)
└── Unstack and return — tail-chain if another IRQ pending
```

### 2. Enable and prioritize an IRQ

```c
#include "stm32f4xx.h"  /* CMSIS device header */

void uart_irq_init(void) {
    NVIC_SetPriority(USART2_IRQn, NVIC_EncodePriority(NVIC_GetPriorityGrouping(), 2, 0));
    NVIC_EnableIRQ(USART2_IRQn);
}
```

Priority: lower numeric value = higher urgency (on most Cortex-M implementations). Check vendor docs for grouping bits.

### 3. ISR template

```c
void USART2_IRQHandler(void) {
    if (USART2->SR & USART_SR_RXNE) {
        uint8_t b = (uint8_t)USART2->DR;  /* read clears RXNE */
        ringbuf_push(b);
    }
    if (USART2->SR & USART_SR_ORE) {
        (void)USART2->DR;  /* clear overrun */
    }
}
```

ISR rules:
- No blocking calls (`printf`, `malloc`, long loops)
- Minimize work — defer to main via flag/ring buffer
- Clear interrupt flags per datasheet (read-to-clear vs write-1-clear)

### 4. Critical sections

```c
uint32_t primask = __get_PRIMASK();
__disable_irq();
/* atomic section */
__set_PRIMASK(primask);
```

Or raise `BASEPRI` to mask lower-priority IRQs only.

### 5. HardFault handler

```c
void HardFault_Handler(void) {
    __asm volatile(
        "tst lr, #4\n"
        "ite eq\n"
        "mrseq r0, msp\n"
        "mrsne r0, psp\n"
        "b hard_fault_c\n"
    );
}

void hard_fault_c(uint32_t *stack) {
    uint32_t r0  = stack[0];
    uint32_t pc  = stack[6];
    uint32_t psr = stack[7];
    /* log pc — GDB: info registers, bt */
    while (1);
}
```

Decode CFSR/HFSR registers for fault cause:

```c
volatile uint32_t cfsr = SCB->CFSR;
volatile uint32_t hfsr = SCB->HFSR;
volatile uint32_t bfar = SCB->BFAR;
```

### 6. Latency and tail-chaining

| Factor | Impact |
|--------|--------|
| Higher priority IRQ | Preempts lower |
| Tail-chaining | Back-to-back IRQs skip unstack/restack |
| FPU context | Lazy stacking adds latency on M4F/M7 |
| Long ISRs | Starves other IRQs and main |

Measure with GPIO toggle + scope, or DWT cycle counter (`DWT->CYCCNT`).

### 7. Agent usage examples

```
/interrupts-and-exceptions-baremetal Configure NVIC priority for UART vs SysTick
/interrupts-and-exceptions-baremetal Decode HardFault stacked PC with GDB
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| IRQ never fires | NVIC not enabled or IRQ masked | `NVIC_EnableIRQ`; check `PRIMASK` |
| Spurious re-entry | Flag not cleared | Clear per RM (ORE needs DR read) |
| HardFault in ISR | Stack overflow | Increase `_estack`; check ISR stack |
| Lost bytes | ISR too slow | Ring buffer + higher IRQ priority |
| Priority inversion | Long critical section | Shorten `__disable_irq` window |

## Related Skills

- `skills/baremetal/baremetal-startup` — vector table entries
- `skills/baremetal/uart-serial-baremetal` — UART IRQ handlers
- `skills/embedded/openocd-jtag` — GDB breakpoint in ISR
- `skills/debuggers/gdb` — examine fault stack frame
- `skills/low-level-programming/assembly-arm` — fault handler asm