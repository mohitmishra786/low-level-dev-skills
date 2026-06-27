---
name: freertos
description: FreeRTOS skill for embedded RTOS development. Use when creating tasks, managing priorities, using queues and mutexes, detecting stack overflows, configuring FreeRTOS via FreeRTOSConfig.h, or debugging FreeRTOS applications with OpenOCD and GDB. Activates on queries about FreeRTOS tasks, queues, semaphores, mutexes, configASSERT, stack overflow, vTaskDelay, or FreeRTOS-aware debugging.
---

# FreeRTOS

## Purpose

Guide agents through FreeRTOS application development: task creation and priorities, inter-task communication with queues and semaphores, stack overflow detection, configASSERT, and FreeRTOS-aware debugging with GDB and OpenOCD.

## Triggers

- "How do I create a FreeRTOS task?"
- "How do I pass data between FreeRTOS tasks?"
- "My FreeRTOS task is crashing — how do I detect stack overflow?"
- "How do I use FreeRTOS mutexes?"
- "How do I debug FreeRTOS tasks with GDB?"
- "How do I configure FreeRTOSConfig.h?"

## Workflow

### 1. Task creation and priorities

```c
#include "FreeRTOS.h"
#include "task.h"

// Task function signature
void vMyTask(void *pvParameters) {
    const char *name = (const char *)pvParameters;
    for (;;) {
        // Task body — must never return
        printf("Task %s running\n", name);
        vTaskDelay(pdMS_TO_TICKS(500));  // yield for 500ms
    }
}

int main(void) {
    // xTaskCreate(function, name, stack_depth_words, param, priority, handle)
    TaskHandle_t xHandle = NULL;
    xTaskCreate(vMyTask, "MyTask",
                configMINIMAL_STACK_SIZE + 128,  // words, not bytes!
                (void *)"sensor",
                tskIDLE_PRIORITY + 2,            // higher = more urgent
                &xHandle);

    vTaskStartScheduler();  // never returns if heap is sufficient
    for (;;);               // should never reach here
}
```

Priority guidelines:
- `tskIDLE_PRIORITY` (0) — idle task, never block here
- ISR-deferred tasks — highest priority to service interrupts quickly
- Avoid priorities above `configMAX_PRIORITIES - 1`

### 2. Queues — inter-task data passing

```c
#include "queue.h"

typedef struct { uint32_t sensor_id; float value; } SensorReading_t;

QueueHandle_t xSensorQueue;

void vProducerTask(void *pvParam) {
    SensorReading_t reading;
    for (;;) {
        reading.sensor_id = 1;
        reading.value = read_adc();
        // Send; block max 10ms if queue full
        xQueueSend(xSensorQueue, &reading, pdMS_TO_TICKS(10));
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

void vConsumerTask(void *pvParam) {
    SensorReading_t reading;
    for (;;) {
        // Block forever until item available
        if (xQueueReceive(xSensorQueue, &reading, portMAX_DELAY) == pdTRUE) {
            process(reading.value);
        }
    }
}

// Create before starting scheduler
xSensorQueue = xQueueCreate(10, sizeof(SensorReading_t));
```

From ISR: use `xQueueSendFromISR()` and pass `&xHigherPriorityTaskWoken`.

### 3. Semaphores and mutexes

```c
#include "semphr.h"

// Binary semaphore — signaling (ISR→task)
SemaphoreHandle_t xSem = xSemaphoreCreateBinary();

void UART_ISR(void) {
    BaseType_t xWoken = pdFALSE;
    xSemaphoreGiveFromISR(xSem, &xWoken);
    portYIELD_FROM_ISR(xWoken);
}

void vUartTask(void *p) {
    for (;;) {
        xSemaphoreTake(xSem, portMAX_DELAY);
        // process received data
    }
}

// Mutex — mutual exclusion (NOT from ISR)
SemaphoreHandle_t xMutex = xSemaphoreCreateMutex();

void vCriticalSection(void) {
    if (xSemaphoreTake(xMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        // protected access
        shared_resource++;
        xSemaphoreGive(xMutex);
    }
}

// Recursive mutex (same task can take multiple times)
SemaphoreHandle_t xRecursive = xSemaphoreCreateRecursiveMutex();
xSemaphoreTakeRecursive(xRecursive, portMAX_DELAY);
xSemaphoreGiveRecursive(xRecursive);
```

Use mutex (not binary semaphore) for shared resources to get priority inheritance.

### 4. Stack overflow detection

```c
// FreeRTOSConfig.h
#define configCHECK_FOR_STACK_OVERFLOW  2  // Method 2 (pattern + watermark)
#define configUSE_MALLOC_FAILED_HOOK    1

// Implement the hook (called when overflow detected)
void vApplicationStackOverflowHook(TaskHandle_t xTask, char *pcTaskName) {
    // Log the offending task name, then halt
    configASSERT(0);  // triggers assertion failure
}

void vApplicationMallocFailedHook(void) {
    configASSERT(0);
}
```

Check watermarks at runtime:

```c
// Returns minimum ever free stack words
UBaseType_t uxHighWaterMark = uxTaskGetStackHighWaterMark(xHandle);
printf("Stack headroom: %lu words\n", uxHighWaterMark);
// Rule of thumb: keep headroom > 20 words
```

### 5. Essential FreeRTOSConfig.h settings

```c
// FreeRTOSConfig.h — adapt to your MCU
#define configCPU_CLOCK_HZ              (SystemCoreClock)
#define configTICK_RATE_HZ              1000          // 1ms tick
#define configMAX_PRIORITIES            8
#define configMINIMAL_STACK_SIZE        128           // words
#define configTOTAL_HEAP_SIZE           (16 * 1024)  // bytes
#define configMAX_TASK_NAME_LEN         16

// Debug / safety
#define configUSE_TRACE_FACILITY        1
#define configUSE_STATS_FORMATTING_FUNCTIONS  1
#define configCHECK_FOR_STACK_OVERFLOW  2
#define configUSE_MALLOC_FAILED_HOOK    1
#define configASSERT(x) if((x)==0) { taskDISABLE_INTERRUPTS(); for(;;); }

// Features
#define configUSE_MUTEXES               1
#define configUSE_RECURSIVE_MUTEXES     1
#define configUSE_COUNTING_SEMAPHORES   1
#define configUSE_TIMERS                1
#define configTIMER_TASK_STACK_DEPTH    (configMINIMAL_STACK_SIZE * 2)
```

### 6. GDB debugging with OpenOCD

```bash
# Connect GDB with FreeRTOS thread awareness
# OpenOCD provides FreeRTOS-aware RTOS plugin

# openocd.cfg addition
# source [find rtos/FreeRTOS.cfg]  # auto-loads with most targets

# GDB session
(gdb) info threads          # lists all FreeRTOS tasks
(gdb) thread 3              # switch to task 3
(gdb) bt                    # backtrace of that task's stack
(gdb) frame 2               # inspect specific frame

# Print task list from GDB (if trace facility enabled)
(gdb) call vTaskList(buf)
(gdb) printf "%s\n", buf
```

### 7. FreeRTOS v11 API updates

FreeRTOS v11 (2024+) extends task notifications and stream buffers:

```c
// Task notifications v2 — 32-bit values with action semantics
xTaskNotifyIndexed(xHandle, 0, ulValue, eSetValueWithOverwrite);
xTaskNotifyWaitIndexed(0, 0, ULONG_MAX, &ulNotified, portMAX_DELAY);

// Stream buffers — ISR-safe send with trigger level
xStreamBufferSend(xStream, data, len, 0);
xStreamBufferSetTriggerLevel(xStream, 1);  // wake receiver on 1 byte
```

Check `FreeRTOS.h` `tskKERNEL_VERSION_NUMBER` at compile time for API availability.

### 8. ARM TrustZone integration

Secure/non-secure world split on Cortex-M33/M55:

```c
#include "secure_context.h"

// Initialize secure context management (secure side or NSC veneer)
SecureContext_Init();

// Allocate secure context for task calling secure functions
xTaskCreateSecure(vSecureTask, "SecTask", STACK, NULL, priority, &xHandle);

// MPU defines NSC (Non-Secure Callable) regions for SG veneers
```

Requires TrustZone-enabled MCU, secure firmware partition, and NSC linker section placement.

### 9. FreeRTOS+TCP basics

```c
#include "FreeRTOS_IP.h"
#include "FreeRTOS_Sockets.h"

// After network stack init (FreeRTOS_IPInit)
Socket_t xSocket = FreeRTOS_socket(FREERTOS_AF_INET, FREERTOS_SOCK_STREAM,
                                   FREERTOS_IPPROTO_TCP);
FreeRTOS_connect(xSocket, &xAddress, sizeof(xAddress));
FreeRTOS_send(xSocket, buffer, len, 0);
```

Configure buffer counts and TCP/IP options in `FreeRTOSIPConfig.h` (e.g., `ipconfigUSE_TCP`, `ipconfigNUM_NETWORK_BUFFER_DESCRIPTORS`). Pairs with an Ethernet MAC driver and FreeRTOS+TCP buffer management.

### 10. MPU region configuration

```c
// Restricted task with MPU regions (Cortex-M with MPU)
static const TaskParameters_t xRestrictedTaskParams = {
    .pvTaskCode = vRestrictedTask,
    .pcName = "Restricted",
    .usStackDepth = configMINIMAL_STACK_SIZE,
    .pvParameters = NULL,
    .uxPriority = tskIDLE_PRIORITY + 1,
    .puxStackBuffer = stackBuffer,
    .xRegions = {
        { .pvBaseAddress = 0x20000000, .ulLength = 0x10000,
          .ulParameters = tskMPU_REGION_READ_ONLY | tskMPU_REGION_EXECUTE_NEVER },
        { .pvBaseAddress = 0x00000000, .ulLength = 0, .ulParameters = 0 }  // terminator
    }
};
xTaskCreateRestricted(&xRestrictedTaskParams, &xHandle);
```

Define separate RAM regions for read-only code/data, privileged peripherals, and task-private stacks.

For OpenOCD setup details, see `skills/embedded/openocd-jtag`.
For FreeRTOSConfig.h reference, see [references/freertos-config.md](references/freertos-config.md).

## Related skills

- Use `skills/embedded/openocd-jtag` for GDB/OpenOCD remote debugging setup
- Use `skills/embedded/linker-scripts` for placing FreeRTOS heap in specific RAM regions
- Use `skills/debuggers/gdb` for general GDB session management
- Use `skills/embedded/zephyr` for an alternative RTOS with built-in device management
