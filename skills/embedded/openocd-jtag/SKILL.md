---
name: openocd-jtag
description: OpenOCD skill for embedded hardware debugging. Use when configuring OpenOCD for JTAG or SWD targets, flashing firmware, connecting GDB to bare-metal targets, setting hardware watchpoints, or using J-Link with OpenOCD. Activates on queries about OpenOCD, JTAG, SWD, GDB remote target, flash programming, hardware breakpoints, J-Link, or connecting GDB to an MCU.
---

# OpenOCD / JTAG Debugging

## Purpose

Guide agents through configuring OpenOCD for JTAG and SWD targets, flashing firmware to microcontrollers, attaching GDB for bare-metal debugging, setting hardware watchpoints, and configuring J-Link and CMSIS-DAP adapters.

## Triggers

- "How do I connect GDB to my MCU with OpenOCD?"
- "How do I flash firmware using OpenOCD?"
- "How do I set up J-Link with OpenOCD?"
- "What's the difference between JTAG and SWD?"
- "How do I set a hardware watchpoint in GDB?"
- "OpenOCD says 'Error: unable to find JTAG device' — how do I fix it?"

## Workflow

### 1. JTAG vs SWD

| Feature | JTAG | SWD (Serial Wire Debug) |
|---------|------|------------------------|
| Pins | 4+ (TCK, TMS, TDI, TDO, TRST) | 2 (SWCLK, SWDIO) |
| Multi-target | Yes (daisy chain) | No (one target) |
| Speed | Up to 30 MHz | Up to 10 MHz |
| Availability | Full JTAG: Cortex-A/R, RISC-V | SWD: Cortex-M only |
| Cable cost | More complex | Simpler 2-wire |

Most Cortex-M microcontrollers support both. Use SWD when pin count is limited.

### 2. OpenOCD configuration

```tcl
# openocd.cfg — CMSIS-DAP (ST-Link v2, DAPLink)
source [find interface/cmsis-dap.cfg]
source [find target/stm32f4x.cfg]
adapter speed 4000              # kHz

# For SWD explicitly
transport select swd

# J-Link adapter
source [find interface/jlink.cfg]
jlink serial 123456789          # optional: select by serial
source [find target/nrf52.cfg]
adapter speed 8000
```

```bash
# Run OpenOCD (keeps running, serves GDB on port 3333)
openocd -f openocd.cfg

# Common interface config files
ls $(openocd --help 2>&1 | grep "scripts" | head -1)/interface/
# cmsis-dap.cfg, jlink.cfg, ftdi/olimex-arm-usb-ocd.cfg, stlink.cfg ...

# Common target config files
ls $(openocd --help 2>&1 | grep "scripts" | head -1)/target/
# stm32f4x.cfg, nrf52.cfg, esp32.cfg, rp2040.cfg, at91sam4s.cfg ...
```

### 3. Connecting GDB

```bash
# In terminal 1: start OpenOCD
openocd -f openocd.cfg

# In terminal 2: start GDB
arm-none-eabi-gdb firmware.elf

# GDB commands
(gdb) target extended-remote :3333   # connect to OpenOCD
(gdb) monitor reset halt              # reset and halt target
(gdb) load                            # flash ELF to target
(gdb) monitor reset init             # re-initialize after flash
(gdb) break main                      # set software breakpoint
(gdb) continue

# One-liner for quick debugging
arm-none-eabi-gdb -ex "target extended-remote :3333" \
                  -ex "monitor reset halt" \
                  -ex "load" \
                  -ex "break main" \
                  -ex "continue" \
                  firmware.elf
```

### 4. Flashing firmware

```bash
# Flash via OpenOCD telnet interface
telnet localhost 4444

# OpenOCD telnet commands
> reset halt
> program firmware.elf verify reset
> exit

# Or via GDB
(gdb) monitor flash write_image erase firmware.bin 0x08000000
(gdb) monitor reset run

# Flash only (no debug) — script mode
openocd -f openocd.cfg \
        -c "program firmware.elf verify reset exit"

# For raw binary
openocd -f openocd.cfg \
        -c "program firmware.bin 0x08000000 verify reset exit"
```

### 5. Hardware breakpoints and watchpoints

Software breakpoints (`break`) patch instruction memory with trap instructions — they don't work in flash-execute-in-place without debug registers. Use hardware breakpoints instead:

```bash
# Hardware breakpoint (uses debug register, limited count: 4-8 on Cortex-M)
(gdb) hbreak function_name
(gdb) hbreak *0x08001234

# Hardware watchpoint — triggers on memory read/write
(gdb) watch global_variable         # write watchpoint
(gdb) rwatch some_buffer            # read watchpoint
(gdb) awatch sensor_value           # read OR write watchpoint

# List breakpoints/watchpoints
(gdb) info breakpoints

# Cortex-M typically has: 4–8 hardware breakpoints, 2–4 watchpoints
```

### 6. OpenOCD commands reference

```bash
# Via telnet (port 4444) or GDB monitor
monitor reset halt          # reset and hold at reset vector
monitor reset init          # reset and run init scripts
monitor reset run           # reset and run freely
monitor halt                # halt running target
monitor resume              # resume execution
monitor mdw 0x20000000      # memory display word at address
monitor mww 0x40021000 0x1  # memory write word
monitor reg r0              # read register
monitor arm disassemble 0x08000000 16  # disassemble 16 instructions

# Flash operations
monitor flash list
monitor flash erase_sector 0 0 0   # erase sector 0
monitor flash write_bank 0 firmware.bin 0
```

### 7. Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `unable to find JTAG device` | Wrong interface, cable, or power | Check USB connection; power target; verify interface config |
| `JTAG scan chain interrogation failed` | Wrong target config or bad SWD mode | Match config to exact MCU; try `transport select swd` |
| `flash 'stm32f4x' is not supported` | Wrong target | Check MCU part number; use correct `.cfg` |
| `Error: timed out while waiting for target halted` | Target running, not halted | `monitor halt`; check BOOT pins |
| `Cannot access memory at address` | MMU, memory protection, or wrong address | Check MPU config; use correct flash/RAM address |
| `Warn: target not examined yet` | OpenOCD not connected to target | Check power and connections |

### 8. J-Link configuration

```tcl
# openocd.cfg for J-Link
source [find interface/jlink.cfg]
jlink usb 0          # use first J-Link found
transport select swd  # or jtag
adapter speed 4000

source [find target/stm32l4x.cfg]
```

J-Link GDB Server (alternative to OpenOCD):

```bash
# Segger's own GDB server
JLinkGDBServer -if SWD -device STM32L476RG -port 3333 &
arm-none-eabi-gdb -ex "target remote :3333" firmware.elf
```

## Related skills

- Use `skills/embedded/freertos` for FreeRTOS-aware debugging with OpenOCD
- Use `skills/embedded/zephyr` for Zephyr's `west debug` integration
- Use `skills/debuggers/gdb` for GDB session management
- Use `skills/embedded/linker-scripts` for understanding memory map for flash addresses
