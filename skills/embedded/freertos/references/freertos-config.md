# FreeRTOS Configuration Reference

Source: https://www.freertos.org/a00110.html

## Table of Contents

1. [Core Configuration](#core-configuration)
2. [Memory Management](#memory-management)
3. [Hook Functions](#hook-functions)
4. [Timer Configuration](#timer-configuration)
5. [Interrupt Configuration (ARM Cortex-M)](#interrupt-configuration-arm-cortex-m)

## Core Configuration

```c
/* Scheduler behavior */
#define configUSE_PREEMPTION                    1  // preemptive (0=cooperative)
#define configUSE_TIME_SLICING                  1  // round-robin at same priority
#define configUSE_PORT_OPTIMISED_TASK_SELECTION 0  // 1=CLZ instruction on Cortex-M
#define configUSE_TICKLESS_IDLE                 0  // 1=low-power tickless mode

/* Tick and clock */
#define configCPU_CLOCK_HZ                      (SystemCoreClock)  // Hz
#define configTICK_RATE_HZ                      1000               // ticks/second
#define configSYSTICK_CLOCK_HZ                  (configCPU_CLOCK_HZ / 8)  // if different

/* Task limits */
#define configMAX_PRIORITIES                    8
#define configMINIMAL_STACK_SIZE                128   // words (NOT bytes)
#define configMAX_TASK_NAME_LEN                 16
#define configIDLE_SHOULD_YIELD                 1     // idle yields to equal-priority tasks

/* Heap */
#define configTOTAL_HEAP_SIZE                   ((size_t)(32 * 1024))  // bytes
```

## Memory Management

FreeRTOS has five heap implementations (`heap_1.c` through `heap_5.c`):

| Heap | Allocation | Free | Notes |
|------|-----------|------|-------|
| heap_1 | Yes | No | Simplest; no free; deterministic |
| heap_2 | Yes | Yes | Best-fit; no coalescence; fragmentation |
| heap_3 | malloc/free | malloc/free | Thread-safe wrapper around stdlib |
| heap_4 | Yes | Yes | First-fit with coalescence; recommended |
| heap_5 | Yes | Yes | heap_4 across multiple non-contiguous regions |

For heap_5 (multiple memory regions):

```c
#include "heap_5.h"

// Define memory regions
const HeapRegion_t xHeapRegions[] = {
    { (uint8_t *)0x20000000, 0x8000 },  // SRAM1: 32KB
    { (uint8_t *)0x10000000, 0x4000 },  // CCM: 16KB
    { NULL, 0 }                          // terminator
};

// Call before vTaskStartScheduler()
vPortDefineHeapRegions(xHeapRegions);
```

## Hook Functions

```c
// Must define if configUSE_MALLOC_FAILED_HOOK=1
void vApplicationMallocFailedHook(void) {
    __disable_irq();
    for (;;);
}

// Must define if configCHECK_FOR_STACK_OVERFLOW > 0
void vApplicationStackOverflowHook(TaskHandle_t xTask, char *pcTaskName) {
    (void)xTask;
    // Log pcTaskName, halt
    __disable_irq();
    for (;;);
}

// Called by idle task (configUSE_IDLE_HOOK=1)
void vApplicationIdleHook(void) {
    // Can enter low-power mode here
    __WFI();  // ARM: wait for interrupt
}

// Called every tick (configUSE_TICK_HOOK=1)
void vApplicationTickHook(void) {
    // Keep SHORT — runs at tick rate inside ISR
}
```

## Timer Configuration

```c
#define configUSE_TIMERS                        1
#define configTIMER_TASK_PRIORITY               (configMAX_PRIORITIES - 1)
#define configTIMER_QUEUE_LENGTH                10
#define configTIMER_TASK_STACK_DEPTH            (configMINIMAL_STACK_SIZE * 2)
```

```c
// One-shot timer example
TimerHandle_t xTimer = xTimerCreate(
    "WdogTimer",           // name (debug only)
    pdMS_TO_TICKS(5000),   // period
    pdFALSE,               // pdTRUE=auto-reload, pdFALSE=one-shot
    (void *)0,             // timer ID
    vTimerCallback         // callback
);
xTimerStart(xTimer, 0);

void vTimerCallback(TimerHandle_t xTimer) {
    // Runs in timer task context — no direct ISR interaction
}
```

## Interrupt Configuration (ARM Cortex-M)

```c
// These must match your MCU's NVIC priority grouping
#define configPRIO_BITS                         4   // Cortex-M4/M7: 4 bits
#define configLIBRARY_LOWEST_INTERRUPT_PRIORITY 15
#define configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY 5

// Derived (do not change)
#define configKERNEL_INTERRUPT_PRIORITY \
    (configLIBRARY_LOWEST_INTERRUPT_PRIORITY << (8 - configPRIO_BITS))
#define configMAX_SYSCALL_INTERRUPT_PRIORITY \
    (configLIBRARY_MAX_SYSCALL_INTERRUPT_PRIORITY << (8 - configPRIO_BITS))
```

**Rule**: ISRs that call FreeRTOS API (`FromISR` variants) must have numeric priority ≥ `configMAX_SYSCALL_INTERRUPT_PRIORITY`. ISRs with LOWER numeric priority (higher urgency) must NOT call FreeRTOS APIs.

```c
// In NVIC setup
NVIC_SetPriority(USART1_IRQn, 6);  // OK: 6 >= 5 (MAX_SYSCALL)
NVIC_SetPriority(DMA1_IRQn, 2);    // NOT OK for FromISR: 2 < 5
```
