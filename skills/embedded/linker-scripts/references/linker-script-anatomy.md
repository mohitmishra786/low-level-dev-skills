# Linker Script Anatomy Reference

Source: https://sourceware.org/binutils/docs/ld/Scripts.html

## Table of Contents

1. [Complete STM32 Example](#complete-stm32-example)
2. [Location Counter Operations](#location-counter-operations)
3. [Output Section Attributes](#output-section-attributes)
4. [Built-in Functions](#built-in-functions)

## Complete STM32 Example

```ld
/* STM32F407 — 1MB Flash, 192KB RAM (128KB + 64KB CCM) */

ENTRY(Reset_Handler)

_Min_Heap_Size  = 0x800;    /* 2KB heap minimum */
_Min_Stack_Size = 0x400;    /* 1KB stack minimum */

MEMORY
{
    FLASH   (rx)  : ORIGIN = 0x08000000, LENGTH = 1024K
    RAM     (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
    CCMRAM  (xrw) : ORIGIN = 0x10000000, LENGTH = 64K
}

SECTIONS
{
    /* Vector table first in flash */
    .isr_vector :
    {
        . = ALIGN(4);
        KEEP(*(.isr_vector))
        . = ALIGN(4);
    } > FLASH

    /* Code and read-only data */
    .text :
    {
        . = ALIGN(4);
        *(.text)
        *(.text*)
        *(.glue_7)
        *(.glue_7t)
        *(.eh_frame)
        KEEP(*(.init))
        KEEP(*(.fini))
        . = ALIGN(4);
        _etext = .;
    } > FLASH

    /* ARM exception unwinding tables */
    .ARM.extab : { *(.ARM.extab* .gnu.linkonce.armextab.*) } > FLASH
    .ARM : {
        __exidx_start = .;
        *(.ARM.exidx*)
        __exidx_end = .;
    } > FLASH

    /* C++ constructors/destructors */
    .preinit_array :
    {
        PROVIDE_HIDDEN(__preinit_array_start = .);
        KEEP(*(.preinit_array*))
        PROVIDE_HIDDEN(__preinit_array_end = .);
    } > FLASH

    .init_array :
    {
        PROVIDE_HIDDEN(__init_array_start = .);
        KEEP(*(SORT(.init_array.*)))
        KEEP(*(.init_array*))
        PROVIDE_HIDDEN(__init_array_end = .);
    } > FLASH

    .fini_array :
    {
        PROVIDE_HIDDEN(__fini_array_start = .);
        KEEP(*(SORT(.fini_array.*)))
        KEEP(*(.fini_array*))
        PROVIDE_HIDDEN(__fini_array_end = .);
    } > FLASH

    _sidata = LOADADDR(.data);  /* LMA of .data */

    .data :
    {
        . = ALIGN(4);
        _sdata = .;
        *(.data)
        *(.data*)
        *(.RamFunc)             /* Functions to run from RAM */
        *(.RamFunc*)
        . = ALIGN(4);
        _edata = .;
    } > RAM AT > FLASH          /* Alternative syntax for AT() */

    /* CCM section (no init required — must be initialized manually) */
    .ccmram :
    {
        . = ALIGN(4);
        _sccmram = .;
        *(.ccmram)
        *(.ccmram*)
        . = ALIGN(4);
        _eccmram = .;
    } > CCMRAM AT > FLASH

    .bss :
    {
        _sbss = .;
        __bss_start__ = _sbss;
        *(.bss)
        *(.bss*)
        *(COMMON)
        . = ALIGN(4);
        _ebss = .;
        __bss_end__ = _ebss;
    } > RAM

    /* User heap */
    ._user_heap_stack :
    {
        . = ALIGN(8);
        PROVIDE(end = .);
        PROVIDE(_end = .);
        . = . + _Min_Heap_Size;
        . = . + _Min_Stack_Size;
        . = ALIGN(8);
    } > RAM

    /* Top of stack = top of RAM */
    _estack = ORIGIN(RAM) + LENGTH(RAM);

    /* Discard unwanted sections */
    /DISCARD/ :
    {
        libc.a ( * )
        libm.a ( * )
        libgcc.a ( * )
    }
}
```

## Location Counter Operations

```ld
/* . = current location counter (VMA) */
. = 0x08000000;             /* set absolute address */
. = ALIGN(4);               /* round up to 4-byte boundary */
. += 256;                   /* reserve 256 bytes */

/* Useful in MEMORY-relative expressions */
_stack_top = ORIGIN(RAM) + LENGTH(RAM);
_flash_end  = ORIGIN(FLASH) + LENGTH(FLASH);
```

## Output Section Attributes

```ld
.section_name [address] [(type)] :
    [AT(lma)]
    [ALIGN(align) | ALIGN_WITH_INPUT]
    [SUBALIGN(subsection_align)]
    [constraint]
{
    output-section-command
} [> region] [AT > lma_region] [:phdr :phdr ...] [= fillexp]
```

Type modifiers:

| Type | Meaning |
|------|---------|
| `NOLOAD` | Section not loaded (e.g., `.noinit` BSS variant) |
| `DSECT` | Dummy section (no output) |
| `INFO` | Section contains link information |
| `OVERLAY` | Overlay section |

```ld
/* NOLOAD — section exists at runtime address but not in image */
.noinit (NOLOAD) :
{
    *(.noinit)
} > RAM
```

## Built-in Functions

| Function | Description |
|----------|-------------|
| `ADDR(section)` | Returns VMA of named section |
| `LOADADDR(section)` | Returns LMA of named section |
| `SIZEOF(section)` | Size in bytes of named section |
| `ALIGNOF(section)` | Alignment of named section |
| `DEFINED(symbol)` | 1 if symbol defined, 0 otherwise |
| `MAX(a,b)` / `MIN(a,b)` | Arithmetic max/min |
| `ALIGN(exp, align)` | Round exp up to align boundary |
| `ABSOLUTE(expr)` | Force absolute (non-relative) value |
| `BLOCK(expr)` | Synonym for ALIGN (legacy) |
| `DATA_SEGMENT_ALIGN(max,page)` | For executable data segments |
| `PROVIDE(sym = expr)` | Define sym only if not already defined |
| `PROVIDE_HIDDEN(sym = expr)` | Same but hidden visibility |
| `KEEP(pattern)` | Don't remove with `--gc-sections` |
| `SORT(pattern)` | Sort matching sections by name |
| `SORT_BY_ALIGNMENT(pattern)` | Sort by alignment (largest first) |
