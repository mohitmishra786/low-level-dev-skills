---
name: resource-optimization-lowend
description: Resource optimization skill for constrained embedded targets. Use when reducing flash/RAM usage, analyzing stack depth, reading linker map files, or tuning size vs speed on MCUs. Activates on queries about firmware size optimization, linker map, stack usage, -Os, flash RAM budget, or bloat analysis.
---

# Resource Optimization (Low-End Systems)

## Purpose

Guide agents through flash and RAM optimization on constrained devices: compiler size flags, linker map analysis, stack usage measurement, dead code elimination, and size-vs-speed tradeoffs — for bare-metal and small RTOS images.

## When to Use

- Firmware exceeds flash budget
- Stack overflow in production only
- Choosing `-Os` vs `-O2` on MCU
- Finding unexpected `.rodata` or `.bss` growth

## Workflow

### 1. Size measurement toolchain

```bash
arm-none-eabi-size -A firmware.elf
arm-none-eabi-objdump -h firmware.elf
nm --size-sort -S firmware.elf | tail -20
```

### 2. Linker map file

```ld
/* linker.ld */
OUTPUT_FORMAT("elf32-littlearm")
ENTRY(Reset_Handler)

SECTIONS
{
  /* ... */
}

/* Generate map */
/* gcc ... -Wl,-Map=firmware.map */
```

```bash
grep -E '\.text|\.rodata|\.data|\.bss' firmware.map | head
```

Identify largest symbols and unexpected library pull-in.

### 3. Compiler flags

| Flag | Effect |
|------|--------|
| `-Os` | Size-first optimization |
| `-ffunction-sections -fdata-sections` | Per-symbol sections |
| `-Wl,--gc-sections` | Drop unused sections |
| `-flto` | Cross-TU dead code elimination |
| `-specs=nano.specs` | Smaller newlib (GCC ARM) |

```makefile
CFLAGS += -Os -ffunction-sections -fdata-sections
LDFLAGS += -Wl,--gc-sections -Wl,--print-memory-usage
```

### 4. Stack analysis

```bash
# Static (if built with -fstack-usage)
find . -name '*.su' -exec cat {} \;

# Linker stack symbol
grep _estack firmware.map
```

Runtime: fill stack with pattern (`0xDEADBEEF`), run tests, scan high-water mark. FreeRTOS: `uxTaskGetStackHighWaterMark`.

### 5. RAM categories

| Section | Tactic |
|---------|--------|
| `.bss` | Shrink buffers; pool allocators |
| `.data` | Move const to flash (`const` → `.rodata`) |
| Heap | Avoid malloc; fixed pools |
| Stack | Reduce nesting; smaller ISR stacks |

### 6. Size vs speed decision

```
Hot path in ISR or 1 kHz loop?
├── Yes → -O2 for that file (#pragma GCC optimize)
└── No  → -Os globally
```

### 7. Agent usage

```
/resource-optimization-lowend Find top 10 flash consumers in firmware.map and suggest -gc-sections fixes
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| printf pulls 20+ KB | Full newlib printf | `_write` retarget; tiny printf |
| `--gc-sections` broke IRQ | Section collected | `KEEP()` in linker script |
| Stack overflow late | Deep call + IRQ nest | Measure HW stack; increase `_estack` |
| RAM zero but big ELF | `.data` not loaded | Check VMA/LMA |
| LTO link fail | Mixed compiler versions | Same GCC for all objects |

## Related Skills

- `skills/embedded/linker-scripts` — MEMORY/Sections layout
- `skills/baremetal/baremetal-startup` — stack symbol
- `skills/baremetal/low-power-embedded` — RAM retention
- `skills/compilers/gcc` — optimization flags
- `skills/rust/rust-no-std` — embedded Rust size patterns