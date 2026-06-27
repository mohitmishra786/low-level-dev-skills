---
name: hypervisor-internals
description: Hardware virtualization internals skill for Intel VT-x and AMD-V. Use when studying VMCS/VMCB, EPT/NPT page tables, VMEXIT handling, APIC virtualization, or building minimal hypervisors. Activates on queries about VMX, SVM, VMCS, EPT, NPT, VMEXIT, or type-1 hypervisor.
---

# Hypervisor Internals

## Purpose

Explain hardware virtualization internals for agents: Intel VT-x (VMXON, VMCS, VMLAUNCH/VMRESUME, VMEXIT reasons), AMD SVM (VMCB, #VMEXIT), Extended/Nested Page Tables (EPT/NPT), APIC virtualization, MSR bitmaps, virtual interrupt injection, and references for building minimal type-1 hypervisors.

## When to Use

- Understanding how KVM, Hyper-V, or VMware map to hardware features
- Debugging VMEXIT storms or EPT violations
- Studying hypervisor security research (CVE triage)
- Building educational hypervisors (SimpleVisor, hvpp)
- Tuning nested virtualization performance
- Analyzing VM escape or side-channel mitigations

## Workflow

### 1. Virtualization types

```
Type 1 (bare metal)     Type 2 (hosted)
├── Hyper-V             ├── KVM + QEMU
├── Xen                 ├── VirtualBox
├── VMware ESXi         └── Parallels
└── Runs directly on HW     Runs on host OS
```

### 2. Intel VT-x overview

```
VMX operation
├── VMXON — enter VMX root mode
├── VMCS setup — guest/host state fields
├── VMLAUNCH / VMRESUME — enter guest
├── Guest runs until VMEXIT
└── VMXOFF — exit VMX operation
```

Key structures:
- **VMCS** (Virtual Machine Control Structure) — guest/host state, control fields
- **VMEXIT** — forced exit to hypervisor (I/O, MSR, EPT fault, interrupt)

```c
// Simplified VMX enable check (kernel/driver context)
#include <linux/cpufeature.h>
if (boot_cpu_has(X86_FEATURE_VMX))
    // VT-x supported
```

### 3. VMCS fields (conceptual)

| Category | Examples |
|----------|----------|
| Guest state | GPRs, CR0/3/4, segment selectors, RIP, RSP |
| Host state | Host RIP (VMEXIT handler), host CR3 |
| Control | Pin-based, proc-based, VMEXIT/entry controls |
| Exit info | Exit reason, qualification, guest-linear-address |

VMEXIT reasons (common):

```
Exit reason codes (Intel)
├── 10 — CPUID
├── 28 — CR access
├── 30 — I/O instruction
├── 48 — EPT violation
├── 0  — External interrupt
└── 1  — Triple fault
```

### 4. AMD SVM (AMD-V)

```
SVM operation
├── EFER.SVME = 1
├── VMCB setup — guest save area + control area
├── VMRUN — enter guest
├── #VMEXIT — exit to host handler
└── Guest state in VMCB
```

VMCB control area: intercept vectors (CPUID, MSR, IO), nested paging enable, ASID.

| Intel | AMD |
|-------|-----|
| VMCS | VMCB |
| VMXON/VMXOFF | EFER.SVME |
| VMLAUNCH/VMRESUME | VMRUN |
| EPT | NPT (Nested Page Tables) |

### 5. EPT / NPT — second-level paging

```
Guest virtual (GVA) → Guest physical (GPA) [guest page tables]
GPA → Host physical (HPA) [EPT/NPT, managed by hypervisor]
```

EPT violation VMEXIT: guest accessed unmapped GPA or violated permissions.

```bash
# KVM EPT stats (if available)
# Nested virtualization adds second EPT walk — perf cost
```

Mitigations for side channels: flush L1D on VMEXIT (MDS), cache partitioning.

### 6. MSR and I/O bitmaps

```
MSR bitmap (4KB)
├── Per-MSR read/write intercept control
└── Avoid VMEXIT on common MSRs for performance

I/O bitmap
├── Intercept specific port I/O
└── Pass-through unlisted ports
```

Hypervisors intercept `MSR_IA32_FEATURE_CONTROL`, `MSR_IA32_EFER`, etc.

### 7. APIC virtualization

```
APIC virtualization
├── Virtual interrupt delivery — reduce VMEXIT on EOI
├── Posted interrupts — hardware-assisted injection
└── TPR shadowing — avoid exit on priority changes
```

Reduces overhead for interrupt-heavy guests (network I/O).

### 8. Virtual interrupt injection

Intel: inject via VM-entry interruption-information field.
AMD: V_IRQ, V_INTR_PRIO in VMCB.

```
Device interrupt → host IRQ handler → hypervisor
    → inject virtual IRQ to guest IDT
    → guest ISR runs
```

### 9. Minimal hypervisor references

| Project | Platform | Notes |
|---------|----------|-------|
| SimpleVisor | Windows | Educational, few thousand lines |
| hvpp | Windows | C++ hypervisor library |
| kvmm | Linux | Minimal KVM study |
| barevisor | x86_64 | Rust/ASM educational |

Study path:
1. CPUID detection and VMX enable
2. Allocate VMCS, set host/guest state
3. Handle VMEXIT for CPUID and HLT
4. Add EPT with identity map
5. Inject interrupts

### 10. KVM ioctl interface (practical)

```c
// Userspace KVM (how QEMU talks to KVM)
int kvm = open("/dev/kvm", O_RDWR);
int vm = ioctl(kvm, KVM_CREATE_VM, 0);
int vcpu = ioctl(vm, KVM_CREATE_VCPU, 0);
ioctl(vcpu, KVM_RUN, 0);  // runs until VMEXIT
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| VMEXIT storm on MSR | MSR bitmap intercepts all | Fine-tune bitmap; pass-through safe MSRs |
| EPT misconfiguration | Mismatched GPA→HPA | Verify EPT PTE permissions |
| Nested virt slow | Double page walk | Hardware assist; limit nesting depth |
| VMXON fails | CR0/CR4 fixed bits | Set required CR bits per Intel SDM |
| Guest triple fault | Bad IDT or unhandled exception | Check guest interrupt setup |
| I/O intercept overhead | All ports trapped | Shrink I/O bitmap |

## Related Skills

- `skills/virtualization/qemu-kvm` — practical KVM/QEMU usage
- `skills/virtualization/containers-internals` — lighter isolation without full VM
- `skills/kernel/kernel-internals` — host kernel scheduler/memory
- `skills/kernel/os-dev-scratch` — guest OS development context
- `skills/security/kernel-security` — hypervisor CVE mitigations
- `skills/platform/riscv-privileged` — RISC-V H-extension virtualization