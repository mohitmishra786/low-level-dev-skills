---
name: kernel-debugging-advanced
description: Advanced kernel debugging skill for ftrace, trace-cmd, perf, kprobes, kgdb, and crash analysis. Use when tracing kernel functions, profiling syscalls in kernel, dynamic instrumentation, or analyzing vmcore. Activates on queries about ftrace, trace-cmd, kprobe, kgdb, kernel crash dump, or dyndbg.
---

# Advanced Kernel Debugging

## Purpose

Extend `skills/kernel/kernel-debugging` with production-grade tracing: `ftrace`, `trace-cmd`, kernel `perf`, `kprobes`/`kretprobes`, `kgdb`, crash dump analysis, and `printk` discipline. **Not merged** with `kernel-debugging` — that skill covers baseline kgdb/dyndbg; this one focuses on trace-cmd, function_graph, and live/post-mortem production workflows.

## When to Use

- Latency spikes in kernel driver without obvious bug
- Tracing function call graph in kernel
- Live inspection without recompiling (kprobes, bpf)
- Post-mortem `vmcore` after panic

## Workflow

### 1. ftrace function graph

```bash
# Enable function graph tracer
echo function_graph > /sys/kernel/debug/tracing/current_tracer
echo my_driver_probe > /sys/kernel/debug/tracing/set_graph_function
echo 1 > /sys/kernel/debug/tracing/tracing_on
# reproduce issue
cat /sys/kernel/debug/tracing/trace
echo 0 > /sys/kernel/debug/tracing/tracing_on
```

Requires `CONFIG_FUNCTION_GRAPH_TRACER` and debugfs mounted.

### 2. trace-cmd record

```bash
trace-cmd record -p function_graph -F my_probe
trace-cmd report
trace-cmd stat
```

Portable capture for sharing with others.

### 3. perf in kernel context

```bash
perf record -a -g -- sleep 10
perf report --stdio
perf probe --add my_driver:probe
```

See `skills/profilers/linux-perf` for userspace overlap.

### 4. kprobes (dynamic)

```c
#include <linux/kprobes.h>

static struct kprobe kp = {
    .symbol_name = "do_sys_open",
    .pre_handler = handler,
};
register_kprobe(&kp);
```

Use sparingly in production; prefer static tracepoints when available.

### 5. dyndbg and printk discipline

```bash
echo 'module mydriver +p' > /sys/kernel/debug/dynamic_debug/control
echo 'file drivers/foo/*.c +p' > /sys/kernel/debug/dynamic_debug/control
```

```c
pr_debug("state=%d\n", s);           /* compile-time optional */
printk_ratelimited(KERN_WARNING "hw fault\n");
```

### 6. kgdb / kdb

```bash
# kernel cmdline: kgdboc=ttyS0,115200 kgdbwait
echo g > /proc/sysrq-trigger   # break into debugger (when configured)
```

### 7. Crash dump (vmcore)

```bash
# after kdump capture
crash /usr/lib/debug/vmlinux vmcore
crash> bt
crash> dev -s
```

### 8. Agent usage

```
/kernel-debugging-advanced Trace my_driver_ioctl latency with ftrace function_graph
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Empty trace | Tracer not enabled | `tracing_on`; check `current_tracer` |
| ftrace overhead | Graph all functions | Filter with `set_graph_function` |
| kprobe fail | Inlined symbol | Try nearby symbol or static key |
| kgdb no connect | Wrong `kgdboc` tty | Match serial/USB gadget |
| crash no symbols | Missing debuginfo | Install `linux-image-dbg` / vmlinux |

## Related Skills

- `skills/kernel/kernel-debugging` — baseline kgdb, dyndbg
- `skills/profilers/linux-perf` — perf record/report
- `skills/observability/ebpf` — BPF kprobe alternative
- `skills/kernel-dev/writing-char-drivers` — ioctl trace targets
- `skills/debuggers/core-dumps` — userspace core parallels