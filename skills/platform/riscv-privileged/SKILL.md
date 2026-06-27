---
name: riscv-privileged
description: RISC-V privileged architecture skill for M/S/U modes and traps. Use when handling CSRs, trap handlers, PLIC/CLINT interrupts, OpenSBI integration, page tables Sv39/Sv48, or QEMU virt testing. Activates on queries about RISC-V privileged, mstatus, mtvec, satp, OpenSBI, PLIC, or Sv39.
---

# RISC-V Privileged Architecture

## Purpose

Guide agents through the RISC-V privileged specification: M/S/U privilege modes, CSR registers, trap handling, PLIC and CLINT interrupt controllers, OpenSBI firmware integration, Sv39/Sv48 page tables, and QEMU `virt` machine testing.

## When to Use

- Writing an OS kernel or hypervisor for RISC-V
- Implementing trap handlers and context switch
- Integrating OpenSBI for S-mode firmware services
- Configuring interrupt controllers on QEMU virt or hardware
- Setting up virtual memory with Sv39 or Sv48
- Porting xv6-RISC-V or bare-metal firmware

## Workflow

### 1. Privilege levels

```
RISC-V privilege stack
├── M-mode (Machine) — firmware, OpenSBI, most privileged
├── S-mode (Supervisor) — OS kernel
└── U-mode (User) — applications

Embedded (no S-mode): M + U only
```

### 2. Key CSRs

| CSR | Mode | Purpose |
|-----|------|---------|
| `mstatus` / `sstatus` | M/S | Interrupt enable, privilege state |
| `mtvec` / `stvec` | M/S | Trap vector base address |
| `mepc` / `sepc` | M/S | Exception PC |
| `mcause` / `scause` | M/S | Trap cause code |
| `mtval` / `stval` | M/S | Faulting address/instruction |
| `satp` | S | Page table root (mode + PPN) |
| ` mie` / `sie` | M/S | Interrupt enable bits |
| `mip` / `sip` | M/S | Interrupt pending bits |

```c
// Read CSR (GCC extended asm)
static inline uint64_t read_csr_satp(void) {
    uint64_t val;
    asm volatile("csrr %0, satp" : "=r"(val));
    return val;
}

// Write CSR
static inline void write_csr_stvec(void *handler) {
    asm volatile("csrw stvec, %0" :: "r"(handler));
}
```

### 3. Trap handling

```
Trap types
├── Synchronous exceptions — ecall, page fault, illegal insn
└── Asynchronous interrupts — timer, external, software
```

```c
// scause encoding (top bit: 1=interrupt, 0=exception)
void handle_trap(uint64_t scause, uint64_t sepc, uint64_t stval) {
    if (scause & (1UL << 63)) {
        // Interrupt
        switch (scause & 0xff) {
        case 5:  // Supervisor timer interrupt
            timer_interrupt();
            break;
        case 9:  // Supervisor external interrupt
            external_interrupt();
            break;
        }
    } else {
        // Exception
        switch (scause) {
        case 8:   // ecall from U-mode
            handle_syscall();
            break;
        case 12:  // Instruction page fault
        case 13:  // Load page fault
        case 15:  // Store page fault
            handle_page_fault(stval, scause);
            break;
        }
    }
}
```

### 4. Trap vector setup

```assembly
# trapvec.S — direct mode (all traps to one handler)
.section .text.trap
.globl trap_entry
.align 4
trap_entry:
    # Save registers to trap frame
    csrrw sp, sscratch, sp   # switch to kernel stack
    # ... save caller-saved ...
    csrr a0, scause
    csrr a1, sepc
    csrr a2, stval
    call handle_trap
    # ... restore ...
    sret
```

```c
write_csr_stvec(trap_entry);
// vectored mode: mtvec[1:0] = 01, base aligned to 4×entries
```

### 5. CLINT and PLIC

```
QEMU virt interrupt map
├── CLINT — timer and software interrupts (per-hart)
│   ├── mtime / mtimecmp — machine timer
│   └── msip — machine software interrupt
└── PLIC — external device interrupts (UART, virtio, etc.)
    ├── priority, pending, enable per source
    └── claim/complete per hart context
```

```c
// Timer via SBI (preferred in S-mode) or direct CLINT in M-mode
// PLIC claim
uint32_t irq = plic_claim(hart_id);
handle_device_irq(irq);
plic_complete(hart_id, irq);
```

### 6. OpenSBI

```bash
# Build OpenSBI with payload (your kernel)
git clone https://github.com/riscv-software-src/opensbi
cd opensbi
make PLATFORM=generic FW_PAYLOAD_PATH=../kernel.elf FW_PAYLOAD_OFFSET=0x80200000
# Output: build/platform/generic/firmware/fw_payload.elf
```

SBI calls from S-mode via `ecall`:

```c
struct sbiret sbi_set_timer(uint64_t stime) {
    return sbi_ecall(0x54494D45, 0, stime, 0, 0, 0, 0, 0);
    // Extension ID 0x54494D45 = TIME
}
```

Common SBI extensions: Base, Timer, IPI, RFENCE, HSM.

### 7. Page tables — Sv39

```
Sv39: 39-bit virtual addresses, 3 levels
VPN[2] → L2 PTE → L1 PTE → L0 PTE → physical page

satp: MODE(4) | ASID(9) | PPN(44)
MODE = 8 for Sv39, 9 for Sv48
```

```c
// PTE flags
#define PTE_V  (1L << 0)  // Valid
#define PTE_R  (1L << 1)  // Read
#define PTE_W  (1L << 2)  // Write
#define PTE_X  (1L << 3)  // Execute
#define PTE_U  (1L << 4)  // User accessible

uint64_t *walk_create(uint64_t *root, uint64_t va, int alloc);
void map_page(uint64_t *root, uint64_t va, uint64_t pa, int perm);
```

Sv48: 4 levels, 48-bit virtual addresses (QEMU virt default on RV64).

### 8. QEMU virt testing

```bash
qemu-system-riscv64 \
  -machine virt \
  -cpu rv64 \
  -m 128M \
  -kernel kernel.elf \
  -bios default \
  -serial mon:stdio \
  -display none \
  -no-reboot

# With OpenSBI payload
qemu-system-riscv64 \
  -machine virt -m 128M \
  -kernel opensbi/build/.../fw_payload.elf \
  -serial stdio -nographic
```

```bash
# GDB debug
qemu-system-riscv64 -s -S ...  # port 1234, wait
riscv64-unknown-elf-gdb kernel.elf
(gdb) target remote :1234
```

### 9. Reference: xv6-RISC-V

```bash
git clone https://github.com/mit-pdos/xv6-riscv
make qemu
# Study: kernel/trap.c, kernel/vm.c, kernel/start.c, kernel/plic.c
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Trap loop on boot | `stvec` misaligned | Align to 4 bytes; check handler |
| Page fault on entry | satp enabled before mapping | Identity-map kernel first |
| Timer not firing | SBI vs CLINT mismatch | Use `sbi_set_timer` in S-mode |
| PLIC no interrupts | Enable bit not set | Set priority, enable, threshold |
| OpenSBI hang | Wrong payload offset | Match `FW_PAYLOAD_OFFSET` to link addr |
| Illegal instruction | Compressed insn not supported | Enable C extension in CPU config |

## Related Skills

- `skills/low-level-programming/assembly-riscv` — RV32/RV64 ISA and psABI
- `skills/kernel/os-dev-scratch` — OS dev concepts (x86 parallel)
- `skills/virtualization/qemu-kvm` — QEMU usage patterns
- `skills/embedded/zephyr` — Zephyr on RISC-V
- `skills/kernel/kernel-internals` — Linux VM and scheduler analogies
- `skills/platform/arm-sve` — other architecture platform skills