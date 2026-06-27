---
name: os-dev-scratch
description: OS development from scratch skill for bootloader through context switching. Use when building a minimal x86-64 OS, setting up GDT/IDT/page tables, writing keyboard/serial drivers, or using QEMU for kernel boot. Activates on queries about bootloader, long mode, page tables, IDT, PIC/APIC, xv6, or x86_64-elf-gcc.
---

# OS Development from Scratch

## Purpose

Guide agents through building a minimal operating system from scratch: bootloader stages (BIOS/GRUB vs UEFI/limine), 64-bit long mode setup with GDT and page tables, IDT and interrupt handlers, PIC/APIC configuration, basic keyboard and serial drivers, physical and virtual memory managers, context switching, with xv6-RISC-V as a reference architecture.

## When to Use

- Learning how an OS boots from power-on to `main()`
- Implementing protected/long mode transitions on x86-64
- Writing a physical memory allocator (bitmap) and page table manager
- Handling timer, keyboard, and page fault interrupts
- Testing with QEMU `-kernel` and cross-compiler `x86_64-elf-gcc`
- Porting concepts from xv6 to a custom x86 or RISC-V kernel

## Workflow

### 1. Boot stages overview

```
BIOS path (legacy)
├── BIOS POST
├── MBR (512 bytes) → boot sector loads stage2
├── GRUB/multiboot → loads kernel ELF
└── kernel entry (_start)

UEFI path (modern)
├── UEFI firmware
├── EFI bootloader (limine, systemd-boot)
├── Loads kernel + initrd from ESP
└── kernel entry (handoff with memory map)
```

### 2. Toolchain setup

```bash
# Cross-compiler for bare metal
brew install x86_64-elf-gcc x86_64-elf-binutils   # macOS
# or build from source / apt install gcc-x86-64-elf

x86_64-elf-gcc --version

# QEMU for testing
qemu-system-x86_64 --version
```

Linker script essentials:

```ld
/* linker.ld */
ENTRY(_start)
SECTIONS {
    . = 0x100000;          /* 1MB — typical kernel load address */
    .text : { *(.text .text.*) }
    .rodata : { *(.rodata .rodata.*) }
    .data : { *(.data .data.*) }
    .bss : { *(.bss .bss.*) }
}
```

```bash
x86_64-elf-gcc -ffreestanding -nostdlib -c kernel.c -o kernel.o
x86_64-elf-ld -T linker.ld kernel.o -o kernel.elf
```

### 3. Multiboot/limine boot

```bash
# QEMU direct kernel boot (no disk)
qemu-system-x86_64 \
  -kernel kernel.elf \
  -serial stdio \
  -m 128M \
  -no-reboot -no-shutdown

# With limine (UEFI)
qemu-system-x86_64 \
  -bios /usr/share/ovmf/OVMF.fd \
  -drive file=disk.img,format=raw \
  -serial stdio
```

### 4. Long mode setup

```
Protected mode (32-bit) → enable PAE → setup 4-level page tables → enable long mode
```

```c
// Minimal GDT entry (64-bit flat segments)
struct gdt_entry {
    uint16_t limit_low;
    uint16_t base_low;
    uint8_t  base_mid;
    uint8_t  access;
    uint8_t  granularity;
    uint8_t  base_high;
} __attribute__((packed));

// Page table setup (4KB pages, identity map first 1GB)
uint64_t pml4[512] __attribute__((aligned(4096)));
uint64_t pdpt[512] __attribute__((aligned(4096)));
uint64_t pd[512] __attribute__((aligned(4096)));

void setup_paging(void) {
    for (int i = 0; i < 512; i++)
        pd[i] = (i * 0x200000) | 0x83;  // 2MB huge pages
    pdpt[0] = (uint64_t)pd | 0x03;
    pml4[0] = (uint64_t)pdpt | 0x03;
    __asm__ volatile("mov %0, %%cr3" :: "r"(pml4));
}
```

### 5. IDT and interrupt handlers

```c
struct idt_entry {
    uint16_t offset_low;
    uint16_t selector;
    uint8_t  ist;
    uint8_t  type_attr;
    uint16_t offset_mid;
    uint32_t offset_high;
    uint32_t zero;
} __attribute__((packed));

// ISR stub (assembly) → common handler → dispatch by vector
void interrupt_handler(struct trap_frame *frame) {
    if (frame->vector == 14)  // page fault
        handle_page_fault(frame->cr2, frame->error_code);
    else if (frame->vector == 33)  // keyboard IRQ remapped
        keyboard_handler();
}
```

```bash
# Test page fault
# QEMU monitor: info registers
```

### 6. PIC and APIC

```c
// Legacy PIC remapping (8259)
// Remap IRQ 0-15 to vectors 32-47
outb(0x20, 0x11); outb(0xA0, 0x11);
outb(0x21, 0x20); outb(0xA1, 0x28);  // vector offsets
// ...

// Modern: use APIC/IOAPIC (ACPI MADT parsing)
// LAPIC timer for preemption
```

### 7. Serial and keyboard drivers

```c
// COM1 serial (0x3F8)
void serial_putc(char c) {
    while ((inb(0x3F8 + 5) & 0x20) == 0);
    outb(0x3F8, c);
}

// PS/2 keyboard scancode → ASCII lookup table
void keyboard_handler(void) {
    uint8_t scancode = inb(0x60);
    char c = scancode_to_ascii[scancode];
    if (c) serial_putc(c);
    outb(0x20, 0x20);  // EOI to PIC
}
```

```bash
qemu-system-x86_64 -kernel kernel.elf -serial stdio
# printk output appears in terminal
```

### 8. Physical memory manager

```c
// Bitmap allocator over usable RAM regions
// From multiboot memory map or UEFI memory map
#define PAGE_SIZE 4096
uint8_t *frame_bitmap;
uint64_t total_frames;

uint64_t alloc_frame(void) {
    for (uint64_t i = 0; i < total_frames; i++) {
        if (!test_bit(frame_bitmap, i)) {
            set_bit(frame_bitmap, i);
            return i * PAGE_SIZE;
        }
    }
    return 0;  // OOM
}
```

### 9. Context switching

```c
struct context {
    uint64_t rax, rbx, rcx, rdx, rsi, rdi, rbp, rsp;
    uint64_t r8, r9, r10, r11, r12, r13, r14, r15;
    uint64_t rip;
};

void switch_context(struct context *old, struct context *new);
// Assembly: save callee-saved regs to old, restore from new, ret to new->rip
```

Cooperative scheduling first; add timer IRQ preemption later.

### 10. xv6-RISC-V reference

```bash
git clone https://github.com/mit-pdos/xv6-riscv
cd xv6-riscv && make qemu
```

| xv6 component | x86 equivalent |
|---------------|----------------|
| `kernel/vm.c` | Page table management |
| `kernel/trap.c` | IDT/interrupt dispatch |
| `kernel/proc.c` | Context switch, scheduler |
| `kernel/plic.c` | PIC/APIC interrupt controller |
| `user/usys.pl` | System call stubs |

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Triple fault on boot | Invalid GDT/IDT or stack | Set up stack before enabling interrupts |
| QEMU black screen | No serial output configured | `-serial stdio`; early `serial_init` |
| Page fault in kernel | Unmapped address | Identity-map kernel; check CR3 |
| IRQ never fires | PIC mask or IDT not loaded | `lidt`; unmask IRQ in PIC |
| Timer doesn't tick | LAPIC not initialized | Parse ACPI; calibrate LAPIC timer |
| Linker relocation error | Wrong load address | Match `linker.ld` with bootloader expectation |

## Related Skills

- `skills/low-level-programming/assembly-x86` — x86-64 assembly for ISR stubs
- `skills/low-level-programming/assembly-riscv` — xv6-RISC-V reference ISA
- `skills/platform/riscv-privileged` — RISC-V trap handling and page tables
- `skills/virtualization/qemu-kvm` — QEMU flags for kernel development
- `skills/kernel/kernel-internals` — Linux implementation of these concepts
- `skills/low-level-programming/linux-kernel-modules` — graduate to Linux once basics work