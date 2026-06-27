---
name: kernel-internals
description: Linux kernel internals skill for scheduler, memory, and VFS subsystems. Use when analyzing CFS/EEVDF scheduling, buddy/SLUB allocators, page cache, memory zones, OOM killer, or interpreting /proc/meminfo. Activates on queries about kernel scheduler, vruntime, SLUB, vmalloc, page cache, or OOM killer.
---

# Kernel Internals

## Purpose

Guide agents through Linux kernel internals: the CFS and EEVDF schedulers, runqueues and vruntime, the buddy allocator and SLUB, vmalloc vs kmalloc, VFS dentry/inode/file objects, page cache and readahead, memory zones, OOM killer heuristics, and `/proc/meminfo` interpretation.

## When to Use

- Diagnosing scheduling latency or unfair CPU distribution
- Understanding kmalloc failures vs vmalloc for large kernel allocations
- Analyzing page cache behavior and readahead effectiveness
- Interpreting `/proc/meminfo` during memory pressure
- Debugging OOM killer victim selection
- Reading kernel source in `kernel/sched/`, `mm/`, or `fs/`

## Workflow

### 1. Scheduler — CFS and EEVDF

Linux uses **EEVDF** (Earliest Eligible Virtual Deadline First) for CFS-class scheduling. EEVDF was merged as an option in **6.6** (2023); the gradual CFS→EEVDF transition **completed in 6.12** (Nov 2024). On older 6.6–6.11 kernels, verify which scheduler is active. Core concepts (runqueues, vruntime/lag) carry over:

```
Per-CPU runqueue (struct rq)
├── cfs_rq — fair-class tasks sorted by vruntime/deadline
├── rt_rq  — real-time tasks (FIFO/RR)
└── dl_rq  — SCHED_DEADLINE tasks
```

Key metrics:

```bash
# Task scheduling info
chrt -p <pid>
cat /proc/<pid>/sched

# Runqueue latency (scheduler debugging)
cat /sys/kernel/debug/sched/debug  # requires debugfs

# Trace scheduler events
perf sched record -a -- sleep 5
perf sched latency
```

`vruntime` — virtual runtime tracking CPU time consumed; lower vruntime = more eligible for CPU.

```bash
# CFS tunables
sysctl kernel.sched_latency_ns
sysctl kernel.sched_min_granularity_ns
sysctl kernel.sched_wakeup_granularity_ns
```

### 2. EEVDF specifics

EEVDF picks the task with the earliest eligible virtual deadline, improving latency fairness for short time-slice tasks. Tasks with positive lag are eligible; the scheduler selects the earliest virtual deadline among eligible tasks.

```bash
# Check kernel version (EEVDF transition complete in 6.12+)
uname -r

# Scheduler documentation
# docs.kernel.org/scheduler/sched-eevdf.html
```

### 3. Memory subsystem — buddy allocator

Physical pages allocated in power-of-two order (order 0 = 4KB, order 1 = 8KB, ...).

```
ZONE_DMA / ZONE_DMA32 / ZONE_NORMAL / ZONE_MOVABLE
└── free_area[MAX_ORDER] — buddy lists per order
```

```bash
# Buddy allocator stats
cat /proc/buddyinfo

# Per-zone page counts
cat /proc/zoneinfo | head -80
```

### 4. SLUB allocator

Default kmalloc backend — per-CPU caches (slabs) for common sizes.

```bash
# SLUB debug (requires CONFIG_SLUB_DEBUG)
cat /sys/kernel/slab/*/objects 2>/dev/null | head

# kmalloc size classes visible in /proc/slabinfo
cat /proc/slabinfo | head -20
```

| API | Use when |
|-----|----------|
| `kmalloc(size, GFP_KERNEL)` | ≤ ~128KB (arch-dependent), physically contiguous |
| `kzalloc(size, flags)` | Zeroed kmalloc |
| `vmalloc(size)` | Large, virtually contiguous (may be physically fragmented) |
| `get_free_pages()` | Direct page allocation |

```c
// Kernel module allocation example
void *buf = kmalloc(4096, GFP_KERNEL);
if (!buf)
    return -ENOMEM;
kfree(buf);
```

### 5. Highmem

On 32-bit or specific configs, `ZONE_HIGHMEM` holds pages not permanently mapped in kernel virtual address space. On 64-bit x86/arm64, essentially all RAM is in `ZONE_NORMAL`.

```bash
grep -i highmem /proc/zoneinfo
```

### 6. VFS layer

```
Path lookup: /home/user/file.txt
├── dentry cache (dcache) — directory entry tree
├── inode — metadata (permissions, size, ops)
└── file — per-open-file state (offset, flags)
```

```bash
# Mounted filesystems
cat /proc/mounts

# Inode/dentry cache pressure
sysctl vm.vfs_cache_pressure   # higher = reclaim caches sooner

# File descriptor usage
ls /proc/<pid>/fd | wc -l
```

### 7. Page cache and readahead

```bash
# Drop caches (testing only — destructive to perf)
sync && echo 3 | sudo tee /proc/sys/vm/drop_caches

# Readahead tuning
blockdev --getra /dev/sda
blockdev --setra 4096 /dev/sda

# Per-file cache status
cat /proc/<pid>/smaps_rollup
```

Page cache pages appear as `Cached` in meminfo. Dirty pages await writeback.

### 8. /proc/meminfo interpretation

```bash
cat /proc/meminfo
```

| Field | Meaning |
|-------|---------|
| `MemTotal` | Total usable RAM |
| `MemFree` | Completely unused pages |
| `MemAvailable` | Estimate of allocatable memory (includes reclaimable cache) |
| `Cached` | Page cache + tmpfs |
| `Buffers` | Block device metadata cache |
| `SwapTotal` / `SwapFree` | Swap space |
| `Dirty` | Pages pending writeback |
| `AnonPages` | Anonymous (heap/stack) pages |
| `Slab` | Kernel object cache |
| `SReclaimable` | Reclaimable slab |
| `SUnreclaim` | Kernel structures (not easily reclaimed) |

```
Memory pressure diagnosis
├── MemAvailable low + Cached high → page cache reclaim candidate
├── AnonPages high + SwapFree low → OOM risk
├── Slab huge → kernel object leak; check /proc/slabinfo
└── Dirty high → slow writeback; check I/O scheduler
```

### 9. OOM killer

```bash
# OOM score per process (higher = more likely victim)
cat /proc/<pid>/oom_score
cat /proc/<pid>/oom_score_adj   # -1000 to 1000, admin adjustment

# OOM events in kernel log
dmesg | grep -i "out of memory"
journalctl -k | grep -i oom
```

OOM killer selects based on `oom_score` considering memory usage, child processes, and `oom_score_adj`. Protect critical daemons:

```bash
# Protect process from OOM (requires root)
echo -1000 | sudo tee /proc/<pid>/oom_score_adj
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `kmalloc: allocation failed` | Fragmentation or size too large | Use `vmalloc`; reduce pressure; `GFP_ATOMIC` only when needed |
| High iowait, low MemAvailable | Page cache thrashing | Increase RAM; tune `vfs_cache_pressure` |
| OOM kills wrong process | High memory user with low adj | Set `oom_score_adj`; use cgroups `memory.max` |
| Scheduling unfairness | RT tasks starving CFS | Check `chrt`; isolate CPUs with `isolcpus` |
| SLUB corruption | Use-after-free in module | Enable KASAN; audit with `slub_debug` |
| Slow file reads | Readahead too small | Increase readahead; check backing device |

## Related Skills

- `skills/kernel/device-drivers` — char/platform drivers using these subsystems
- `skills/kernel/kernel-debugging` — ftrace, kgdb for internals investigation
- `skills/low-level-programming/linux-kernel-modules` — LKM development basics
- `skills/kernel/kernel-testing` — KUnit for subsystem unit tests
- `skills/profilers/linux-perf` — perf sched and memory profiling
- `skills/observability/ebpf` — trace scheduler and memory events from userspace