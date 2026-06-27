---
name: linux-kernel-architecture
description: Linux kernel architecture skill for subsystem overview. Use when navigating kernel source, understanding boot flow, initcalls, or major subsystems (VFS, scheduler, MM). Activates on queries about kernel architecture, boot process, initcall levels, subsystem layout, or where code lives in linux.git.
---

# Linux Kernel Architecture

## Purpose

Provide a mental map of the Linux kernel: boot sequence, major subsystems, key data structures, and where to look in source — complementing `skills/kernel/kernel-internals` with architecture-level navigation for driver and subsystem work.

## When to Use

- First time exploring `linux.git` for a feature or bug
- Understanding how boot reaches `init` and driver `probe`
- Tracing a syscall or interrupt through subsystems
- Onboarding before `skills/kernel-dev/platform-device-model` or driver skills

## Workflow

### 1. Boot flow (x86/ARM64 simplified)

```
firmware/UEFI
├── arch/*/boot — decompress kernel, early setup
├── start_kernel() — mm, scheduler, timers, IRQ subsys
├── rest_init() → kernel_init → run_init_process
└── userspace init (systemd)
```

Driver `module_init` / `device_initcall` run during `start_kernel` before init.

### 2. Major subsystems

| Subsystem | Path (typical) | Key structs |
|-----------|----------------|-------------|
| Scheduler | `kernel/sched/` | `task_struct`, `sched_entity` |
| Memory | `mm/` | `struct page`, `mm_struct`, `vm_area_struct` |
| VFS | `fs/` | `inode`, `dentry`, `file`, `super_block` |
| Block | `block/` | `request_queue`, `gendisk` |
| Net | `net/` | `sk_buff`, `net_device` |
| Drivers | `drivers/` | `device`, `device_driver` |
| Syscalls | `kernel/`, `fs/`, `mm/` | `SYSCALL_DEFINE*` |

### 3. Initcall levels

```c
/* include/linux/init.h — order matters */
early_initcall → core_initcall → postcore_initcall
→ arch_initcall → subsys_initcall → fs_initcall
→ device_initcall → late_initcall
```

Platform drivers usually register at `subsys_initcall` or via `module_init`.

### 4. Finding code

```bash
# Locate symbol
grep -rn "platform_driver_register" drivers/

# Trace config
./scripts/config --state CONFIG_FOO

# File hierarchy docs
ls Documentation/admin-guide/
```

### 5. Agent usage

```
/linux-kernel-architecture Where does page fault handling live and what calls it?
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Driver probes too early | Initcall vs DT ordering | Defer with `deferred_probe` |
| Symbol missing | Built as module | `modprobe` or built-in `CONFIG_*` |
| Wrong subsystem | Similar names in `drivers/` | Follow `struct bus_type` |
| Boot hang | Early printk disabled | `earlyprintk`, `initcall_debug` |

## Related Skills

- `skills/kernel/kernel-internals` — scheduler, SLUB, VFS depth
- `skills/kernel-dev/kernel-memory-management` — mm/ details
- `skills/kernel-dev/platform-device-model` — driver model
- `skills/kernel-dev/device-tree` — hardware description
- `skills/low-level-programming/linux-kernel-modules` — LKM basics