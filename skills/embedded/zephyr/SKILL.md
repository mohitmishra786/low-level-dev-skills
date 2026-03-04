---
name: zephyr
description: Zephyr RTOS skill for embedded development. Use when building Zephyr applications with west, configuring boards and targets, working with Kconfig and devicetree, using the Zephyr shell and logging subsystem, or running on the native_sim target. Activates on queries about Zephyr, west build, Kconfig, devicetree, Zephyr logging, west flash, board targets, or native POSIX simulation.
---

# Zephyr RTOS

## Purpose

Guide agents through Zephyr application development: west build workflow, board configuration, Kconfig and devicetree, Zephyr shell and logging, native_sim target for host testing, and debugging with GDB.

## Triggers

- "How do I build a Zephyr application with west?"
- "How do I configure Zephyr with Kconfig?"
- "How do I use devicetree overlays in Zephyr?"
- "How do I add logging to my Zephyr application?"
- "How do I run Zephyr on my host machine for testing?"
- "How do I debug a Zephyr application?"

## Workflow

### 1. Workspace setup and first build

```bash
# Install west
pip install west

# Initialize workspace from Zephyr manifest
west init ~/zephyrproject
cd ~/zephyrproject
west update                          # fetches Zephyr + all modules

# Install Python dependencies
pip install -r ~/zephyrproject/zephyr/scripts/requirements.txt

# Install Zephyr SDK (toolchains for all targets)
# Download from: https://github.com/zephyrproject-rtos/sdk-ng/releases
export ZEPHYR_SDK_INSTALL_DIR=~/zephyr-sdk-0.17.0
export ZEPHYR_BASE=~/zephyrproject/zephyr

# Build hello_world for a target board
west build -b nrf52840dk/nrf52840 samples/hello_world

# Flash to hardware
west flash

# Open serial monitor
west espressif monitor  # or: screen /dev/ttyACM0 115200
```

Common board targets:

| Board | Target name |
|-------|------------|
| nRF52840 DK | `nrf52840dk/nrf52840` |
| STM32 Nucleo-F446RE | `nucleo_f446re` |
| Raspberry Pi Pico | `rpi_pico/rp2040` |
| ESP32 | `esp32_devkitc_wroom/esp32/procpu` |
| QEMU Cortex-M3 | `qemu_cortex_m3` |
| Native POSIX | `native_sim` |

### 2. Application structure

```
my_app/
├── CMakeLists.txt
├── prj.conf              # Kconfig fragment
├── app.overlay           # devicetree overlay (optional)
└── src/
    └── main.c
```

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.20.0)
find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(my_app)
target_sources(app PRIVATE src/main.c)
```

### 3. Kconfig — feature configuration

```
# prj.conf — Kconfig fragment (key=value)
CONFIG_GPIO=y
CONFIG_UART_CONSOLE=y
CONFIG_LOG=y
CONFIG_LOG_DEFAULT_LEVEL=3     # 0=off 1=err 2=warn 3=info 4=debug
CONFIG_PRINTK=y
CONFIG_HEAP_MEM_POOL_SIZE=4096
CONFIG_MAIN_STACK_SIZE=2048
```

```bash
# Interactive Kconfig menu
west build -t menuconfig

# Search for a config option
west build -t guiconfig

# Show all enabled options
west build -t config -- -n | grep "^CONFIG_"
```

### 4. Devicetree overlays

```dts
/* app.overlay — board-specific hardware additions */
/ {
    leds {
        compatible = "gpio-leds";
        my_led: led_0 {
            gpios = <&gpio0 13 GPIO_ACTIVE_LOW>;
            label = "My LED";
        };
    };
};

/* Override a node property */
&uart0 {
    current-speed = <115200>;
};

/* Disable an existing node */
&spi1 {
    status = "disabled";
};
```

```c
// Access devicetree nodes in C
#include <zephyr/devicetree.h>
#include <zephyr/drivers/gpio.h>

#define LED_NODE DT_ALIAS(led0)
static const struct gpio_dt_spec led = GPIO_DT_SPEC_GET(LED_NODE, gpios);

// Initialize and toggle
gpio_pin_configure_dt(&led, GPIO_OUTPUT_ACTIVE);
gpio_pin_toggle_dt(&led);
```

### 5. Logging subsystem

```c
#include <zephyr/logging/log.h>

LOG_MODULE_REGISTER(my_module, LOG_LEVEL_DBG);

void my_function(void) {
    LOG_INF("Sensor value: %d", 42);
    LOG_WRN("Low battery: %d%%", battery_pct);
    LOG_ERR("SPI transfer failed: %d", ret);
    LOG_DBG("Debug detail: ptr=%p", ptr);
    LOG_HEXDUMP_DBG(buf, len, "raw buffer");
}
```

Backend configuration in `prj.conf`:

```
CONFIG_LOG=y
CONFIG_LOG_BACKEND_UART=y        # UART output
CONFIG_LOG_BACKEND_RTT=y         # Segger RTT output
CONFIG_LOG_TIMESTAMP_DEFAULT=y   # add timestamps
CONFIG_LOG_PROCESS_THREAD_STACK_SIZE=512
```

### 6. native_sim — host testing

```bash
# Build for host (no hardware needed)
west build -b native_sim samples/hello_world

# Run directly on host
./build/zephyr/zephyr.exe

# Run with GDB
gdb ./build/zephyr/zephyr.exe
(gdb) run

# Simulated UART appears on a PTY
./build/zephyr/zephyr.exe &
screen $(ls /tmp/zephyr-uart-*)

# native_sim extras
./build/zephyr/zephyr.exe --help
./build/zephyr/zephyr.exe --stop-at=5  # stop after 5 simulated seconds
```

`native_sim` runs Zephyr as a Linux process. Supports most Zephyr APIs, ideal for unit testing and CI.

### 7. Debugging on hardware

```bash
# West debug (launches OpenOCD + GDB automatically)
west debug

# Or manually with OpenOCD
west build -t run &
arm-zephyr-eabi-gdb build/zephyr/zephyr.elf
(gdb) target remote :3333
(gdb) monitor reset halt
(gdb) load
(gdb) continue

# Zephyr's thread-aware GDB (via OpenOCD RTOS plugin)
(gdb) info threads     # lists Zephyr threads
(gdb) thread 2         # switch to thread
```

For west manifest details, see [references/west-manifest.md](references/west-manifest.md).

## Related skills

- Use `skills/embedded/openocd-jtag` for hardware debugging details
- Use `skills/embedded/freertos` for FreeRTOS as an alternative RTOS
- Use `skills/embedded/linker-scripts` for memory region configuration
- Use `skills/debuggers/gdb` for GDB session management
