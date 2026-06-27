---
name: kernel-memory-management
description: Kernel memory management skill for Linux mm subsystem. Use when using kmalloc, vmalloc, page allocator, SLUB, or debugging OOM and memory zones. Activates on queries about buddy allocator, kmalloc sizes, vmalloc vs kmalloc, SLUB, memory zones, or kernel OOM.
---

# Kernel Memory Management

## Purpose

Guide agents through Linux kernel memory allocation: physical page allocator (buddy), SLUB kmalloc caches, vmalloc virtual mappings, zones (DMA/Normal), and safe allocation patterns in drivers — extending `skills/kernel/kernel-internals`.

## When to Use

- Choosing `kmalloc` vs `vmalloc` vs `get_free_pages`
- Debugging kernel OOM or slab corruption
- DMA buffer allocation requirements
- Understanding `/proc/meminfo` and slab stats

## Workflow

### 1. Allocator decision tree

```
Need physically contiguous memory for DMA?
├── Yes → dma_alloc_coherent() or CMA pool
└── No
    ├── Size ≤ ~128K (arch-dependent) → kmalloc / kzalloc
    ├── Large or non-contiguous OK → vmalloc / vzalloc
    └── Whole pages → alloc_pages() / __get_free_pages()
```

### 2. kmalloc and SLUB

SLUB is the default general-purpose kmalloc backend (per [kernel memory allocation guide](https://docs.kernel.org/core-api/memory-allocation.html)); the legacy SLAB allocator was removed in Linux 6.12.

```c
void *buf = kmalloc(size, GFP_KERNEL);
if (!buf)
    return -ENOMEM;
/* ... */
kfree(buf);
```

| GFP flag | Context |
|----------|---------|
| `GFP_KERNEL` | Process context, may sleep |
| `GFP_ATOMIC` | IRQ / holding spinlock — smaller pools |
| `GFP_DMA` | DMA zone (legacy 32-bit devices) |

Check `/proc/slabinfo` and `cat /sys/kernel/slab/*/object_size`.

### 3. vmalloc

```c
void *v = vmalloc(size);  /* virtually contiguous, physically scattered */
vfree(v);
```

Use for large buffers where contiguous physical pages are unnecessary. Do not use for DMA without `dma_map_*`.

### 4. Buddy page allocator

```c
struct page *page = alloc_pages(GFP_KERNEL, order);
void *addr = page_address(page);
__free_pages(page, order);
```

`order` n allocates `2^n` pages. Zone selection: `ZONE_DMA`, `ZONE_NORMAL`, `ZONE_MOVABLE` (see `include/linux/mmzone.h`).

### 5. NUMA basics

On NUMA systems, `kmalloc` prefers local node; use `alloc_pages_node()` or `mbind` policies for HPC paths — see `skills/allocators/numa-programming`.

### 6. Debugging

```bash
cat /proc/meminfo
cat /proc/slabinfo
dmesg | grep -i oom
```

Kernel config: `CONFIG_SLUB_DEBUG`, `CONFIG_KASAN` for use-after-free.

### 7. Agent usage

```
/kernel-memory-management Choose allocator for 2 MiB driver ring buffer in process context
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `kmalloc` fails large | Exceeds kmalloc limit | Use `vmalloc` or pages |
| DMA buffer wrong | Used `vmalloc` for HW DMA | `dma_alloc_coherent` |
| OOM killer | Unbounded cache growth | Limit pools; use shrinker |
| Slab corruption | Use-after-free | KASAN; audit `kfree` pairing |
| `GFP_KERNEL` in IRQ | Sleeping allocator in atomic | `GFP_ATOMIC` |

## Related Skills

- `skills/kernel/kernel-internals` — page cache, OOM killer
- `skills/kernel/device-drivers` — `dma_alloc_coherent`
- `skills/allocators/custom-allocators` — userspace allocator design
- `skills/allocators/numa-programming` — NUMA-aware allocation
- `skills/runtimes/sanitizers` — KASAN overlap