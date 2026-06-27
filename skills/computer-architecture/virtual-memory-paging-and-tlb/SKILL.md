---
name: virtual-memory-paging-and-tlb
description: Virtual memory skill for paging, page tables, and TLB. Use when explaining page faults, multi-level page tables, TLB behavior, or virtual vs physical addressing. Activates on queries about virtual memory, page table, TLB, page fault, mmap paging, or x86-64 paging.
---

# Virtual Memory, Paging, and TLB

## Purpose

Explain virtual memory: paging, multi-level page tables, TLB role, page faults, and address translation — bridging OS kernels, embedded MPU, and performance analysis.

## When to Use

- Understanding `mmap`, `brk`, and demand paging
- Debugging segfaults and guard pages
- Huge pages / TLB pressure tuning
- Contrasting Cortex-M MPU with full MMU systems

## Workflow

### 1. Translation overview

```
Virtual address (VA)
├── TLB lookup → physical on hit
└── TLB miss → page table walk → fill TLB
        ├── valid PTE → physical address
        └── invalid → page fault (OS handles)
```

### 2. Page table (x86-64 4-level example)

```
CR3 → PML4 → PDPT → PD → PT → physical frame
```

Linux on x86_64 uses 4 KiB pages (default) and optional 2 MiB / 1 GiB huge pages.

### 3. Page fault types (simplified)

| Fault | Typical cause |
|-------|----------------|
| Major | Disk read — file-backed page not in RAM |
| Minor | Zero-fill or COW break |
| Protection | User access to kernel page, W^X violation |

```bash
# Linux page fault stats
grep pgfault /proc/vmstat
```

### 4. TLB pressure

Large sparse address spaces + random pointer chasing → TLB misses dominate.

Mitigations:

- `mmap` huge pages (`MAP_HUGETLB`, `madvise(MADV_HUGEPAGE)`)
- Smaller working set / better locality
- `numactl --membind` for NUMA

### 5. Embedded contrast (Cortex-M)

Many MCUs use **MPU** (region-based) not full paging — no TLB, fixed region count. Application processors use MMU + OS.

See `skills/platform/riscv-privileged` for Sv39/Sv48.

### 6. Userspace inspection (Linux)

```bash
cat /proc/self/maps
pmap -x $$
```

### 7. Agent usage

```
/virtual-memory-paging-and-tlb Explain why 4 KiB random access hurts TLB and hugepage helps
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Segfault | Unmapped VA | Fix pointer; check `maps` |
| Slow mmap workload | TLB thrashing | Huge pages; reduce regions |
| COW spike after fork | Shared pages split on write | Expected; consider `MAP_POPULATE` |
| W^X fault | JIT without mprotect dance | Separate RW and RX mappings |
| Wrong phys on MCU | No MMU — linear map | Use linker script addresses |

## Related Skills

- `skills/computer-architecture/memory-hierarchy-and-caches` — cache after translation
- `skills/kernel-dev/kernel-memory-management` — kernel page allocator
- `skills/kernel/os-dev-scratch` — build paging from scratch
- `skills/platform/riscv-privileged` — Sv39 page tables
- `skills/allocators/numa-programming` — NUMA and migration