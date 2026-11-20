---
name: linker-scripts
description: Linker script skill for embedded bare-metal targets. Use when writing or modifying GNU ld linker scripts, placing code and data in specific flash or RAM regions, understanding VMA vs LMA, configuring startup .bss/.data initialization, using MEMORY and SECTIONS commands, or debugging linker errors about regions. Activates on queries about linker scripts, MEMORY command, SECTIONS command, .bss init, VMA vs LMA, weak symbols, or placing functions in specific memory regions.
---

# Linker Scripts

## Purpose

Guide agents through writing and modifying GNU ld linker scripts for embedded targets: MEMORY and SECTIONS commands, VMA vs LMA for code relocation, startup `.bss`/`.data` initialization, placing sections in specific regions, and using PROVIDE/KEEP/ALIGN directives.

## Triggers

- "How do I write a linker script for my MCU?"
- "How do I place a function in a specific flash/RAM region?"
- "What's the difference between VMA and LMA in a linker script?"
- "How does .bss and .data initialization work at startup?"
- "Linker error: region 'FLASH' overflowed"
- "How do I use weak symbols in a linker script?"

## Workflow

### 1. Linker script anatomy

```ld
/* Minimal Cortex-M linker script (works with newlib and C++) */

ENTRY(Reset_Handler)            /* entry point symbol */

MEMORY
{
    FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 512K
    RAM   (rwx) : ORIGIN = 0x20000000, LENGTH = 128K
}

SECTIONS
{
    .text :                     /* code section */
    {
        KEEP(*(.isr_vector))    /* interrupt vector must be first */
        *(.text)
        *(.text.*)
        *(.rodata)
        *(.rodata.*)
        KEEP(*(.init))          /* newlib/crt0 prologue/epilogue */
        KEEP(*(.fini))
        *(.ARM.extab* .gnu.linkonce.armextab.*)  /* unwind data */
        . = ALIGN(4);
    } > FLASH

    .ARM.exidx :                /* unwind tables (C++ exceptions, backtraces) */
    {
        __exidx_start = .;
        *(.ARM.exidx* .gnu.linkonce.armexidx.*)
        __exidx_end = .;
    } > FLASH

    .init_array :               /* static constructors, run by __libc_init_array() */
    {
        PROVIDE_HIDDEN(__preinit_array_start = .);
        KEEP(*(.preinit_array*))
        PROVIDE_HIDDEN(__preinit_array_end = .);
        PROVIDE_HIDDEN(__init_array_start = .);
        KEEP(*(SORT(.init_array.*)))
        KEEP(*(.init_array*))
        PROVIDE_HIDDEN(__init_array_end = .);
        PROVIDE_HIDDEN(__fini_array_start = .);
        KEEP(*(SORT(.fini_array.*)))
        KEEP(*(.fini_array*))
        PROVIDE_HIDDEN(__fini_array_end = .);
        . = ALIGN(4);
        _etext = .;             /* end of flash code/constants */
    } > FLASH

    .data :                     /* VMA = RAM, LMA = FLASH */
    {
        _sdata = .;
        *(.data)
        *(.data.*)
        . = ALIGN(4);
        _edata = .;
    } > RAM AT > FLASH
    _sidata = LOADADDR(.data);  /* LMA of .data, used by startup copy loop */

    .bss (NOLOAD) :
    {
        _sbss = .;
        __bss_start__ = _sbss;  /* name newlib crt0 expects */
        *(.bss)
        *(.bss.*)
        *(COMMON)
        . = ALIGN(4);
        _ebss = .;
        __bss_end__ = _ebss;
    } > RAM

    PROVIDE(end = _ebss);       /* heap start for newlib _sbrk */

    /* Stack at top of RAM */
    _estack = ORIGIN(RAM) + LENGTH(RAM);
}
```

The `.init`/`.fini`, `.ARM.exidx`/`.ARM.extab` and `.init_array` rules are needed as soon as newlib,
libstdc++ or C++ exceptions are linked in. Without them those sections become orphans after `.text`
and overlap the load address of `.data`. `__bss_start__`, `__bss_end__` and `end` are the names newlib's
`crt0` and `_sbrk` expect.

### 2. VMA vs LMA

- **VMA** (Virtual Memory Address): where the section runs at runtime
- **LMA** (Load Memory Address): where the section is stored in the image (flash)

For `.data`: stored in flash (LMA), copied to RAM at startup (VMA).

```ld
/* VMA in RAM, LMA in the next free spot of FLASH */
.data :
{
    _sdata = .;
    *(.data)
    _edata = .;
} > RAM AT > FLASH
_sidata = LOADADDR(.data);       /* where startup code copies from */
```

Prefer `> RAM AT > FLASH` over `AT(_etext)` or `AT(ADDR(.text) + SIZEOF(.text))`. The region form puts the
LMA after every section already placed in FLASH (`.ARM.exidx`, `.init_array`, ...). A fixed address
ignores them, and they end up overlapping `.data`.

### 3. Startup .bss / .data initialization

The C runtime must copy `.data` from flash to RAM and zero `.bss` before `main()`:

```c
// startup.c or startup.s equivalent in C
extern uint32_t _sdata, _edata, _sidata; // _sidata = LMA of .data
extern uint32_t _sbss, _ebss;

void Reset_Handler(void) {
    // Copy .data from flash to RAM
    uint32_t *src = &_sidata;
    uint32_t *dst = &_sdata;
    while (dst < &_edata) *dst++ = *src++;

    // Zero-initialize .bss
    dst = &_sbss;
    while (dst < &_ebss) *dst++ = 0;

    // Call C++ constructors
    // (call __libc_init_array() if using newlib)

    main();
    for (;;);  // should never return
}
```

The linker script provides `_sidata` with `_sidata = LOADADDR(.data);`, as in section 1.

### 4. Placing code in specific regions

```ld
/* Place time-critical code in RAM for faster execution */
MEMORY
{
    FLASH (rx) : ORIGIN = 0x08000000, LENGTH = 512K
    RAM   (rwx): ORIGIN = 0x20000000, LENGTH = 128K
    CCM   (rw) : ORIGIN = 0x10000000, LENGTH = 64K   /* STM32F4 CCM: data only */
}

.fast_code :
{
    . = ALIGN(4);
    _sfast = .;
    *(.fast_code)   /* sections marked __attribute__((section(".fast_code"))) */
    . = ALIGN(4);
    _efast = .;
} > RAM AT > FLASH   /* runs from SRAM, stored in flash */
_sifast = LOADADDR(.fast_code);
```

```c
// Mark a function to go in fast_code section
__attribute__((section(".fast_code"), noinline))  /* noinline: keep it out of flash callers */
void critical_isr_handler(void) {
    // runs from SRAM; startup must copy _sifast -> [_sfast, _efast) like .data
}
```

On STM32F4 the CCM RAM is connected to the D-bus only and cannot execute code. Use it for stacks and
data. Some parts (STM32F3, G4) have executable CCM SRAM; check the bus matrix in the reference manual.
Flash and SRAM are further apart than the Thumb-2 `BL` range; GNU ld inserts a long-branch veneer
(`__<name>_veneer`) automatically.

### 5. KEEP, ALIGN, PROVIDE

```ld
/* KEEP — prevent garbage collection of section */
KEEP(*(.isr_vector))        /* linker gc won't remove interrupt table */
KEEP(*(.init))
KEEP(*(.fini))

/* ALIGN — advance location counter to alignment boundary */
. = ALIGN(8);               /* align to 8 bytes */

/* PROVIDE — define symbol only if not already defined (weak default) */
PROVIDE(_stack_size = 0x400);  /* default 1KB stack; override in code */

/* Symbols for stack */
.stack :
{
    . = ALIGN(8);
    . += _stack_size;
    _stack_top = .;
} > RAM

/* FILL — fill unused bytes */
.text :
{
    *(.text)
    . = ALIGN(4);
    FILL(0xFF)             /* fill flash gaps with 0xFF (erased state) */
} > FLASH
```

### 6. Weak symbols

```ld
/* In linker script — provide weak default ISR */
PROVIDE(NMI_Handler        = Default_Handler);
PROVIDE(HardFault_Handler  = Default_Handler);
PROVIDE(SysTick_Handler    = Default_Handler);
```

```c
// In C — weak default handler
__attribute__((weak)) void Default_Handler(void) {
    for (;;);  // spin — override this in application
}

// Override by defining a non-weak symbol with the same name
void SysTick_Handler(void) {
    tick_count++;
}
```

### 7. Common linker errors

| Error | Cause | Fix |
|-------|-------|-----|
| `region 'FLASH' overflowed` | Binary too large for flash | Enable LTO, `-Os`, remove unused code; `--gc-sections` |
| `region 'RAM' overflowed` | Too much RAM used | Reduce stack size, use static buffers, check `.bss` size |
| `undefined reference to '_estack'` | Missing linker script symbol | Define `_estack` in linker script |
| `no rule to process file` | `.ld` extension not recognized | Pass with `-T script.ld` |
| `cannot find linker script` | Wrong path | Use `-L dir -T name.ld` |
| Data section `.data` at wrong address | LMA not set | Use `} > RAM AT > FLASH` and `_sidata = LOADADDR(.data)` |
| `section .init LMA [...] overlaps section .data LMA` | Orphan newlib/C++ sections after `.text` | Add `.init`/`.fini`, `.ARM.exidx`, `.init_array` rules (section 1) |
| `undefined reference to '__bss_start__'` / `'end'` | newlib `crt0` / `_sbrk` symbol names | Define `__bss_start__`, `__bss_end__`, `PROVIDE(end = ...)` |
| `undefined reference to '__exidx_start'` | C++ unwinder needs exidx bounds | Define `__exidx_start`/`__exidx_end` around `.ARM.exidx` |

```bash
# Analyze section sizes
arm-none-eabi-size firmware.elf
arm-none-eabi-size -A firmware.elf    # verbose per-section

# Show all sections and their addresses
arm-none-eabi-objdump -h firmware.elf

# Check if .data LMA is in flash range
arm-none-eabi-readelf -S firmware.elf | grep -A2 "\.data"
```

For linker script anatomy details, see [references/linker-script-anatomy.md](references/linker-script-anatomy.md).

## Related skills

- Use `skills/embedded/openocd-jtag` for flashing to addresses defined in linker script
- Use `skills/embedded/freertos` for FreeRTOS heap placement in specific RAM regions
- Use `skills/binaries/linkers-lto` for linker LTO and symbol flags
- Use `skills/binaries/elf-inspection` to inspect section sizes and addresses
