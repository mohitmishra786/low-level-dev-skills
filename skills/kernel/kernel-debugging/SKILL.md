---
name: kernel-debugging
description: Linux kernel debugging skill for kgdb, kdb, ftrace, kprobes, and crash analysis. Use when setting up kgdb over serial, using ftrace and trace-cmd, inserting kprobes, enabling dynamic debug, or analyzing kdump with crash. Activates on queries about kgdb, kdb, ftrace, kprobes, dyndbg, kdump, or kernel dmesg levels.
---

# Kernel Debugging

## Purpose

Guide agents through debugging the Linux kernel: kgdb over serial or USB, kdb built-in debugger commands, ftrace and `trace-cmd`, kprobes and kretprobes, dynamic debug (`dyndbg`), crash dump analysis with crash and makedumpfile, dmesg log levels, and `/proc/sys` runtime tuning for debugging.

## When to Use

- Kernel panic or oops with unclear stack trace
- Live debugging a kernel module or driver with kgdb
- Tracing function calls without recompiling (ftrace, kprobes)
- Enabling verbose driver logging with dyndbg
- Analyzing production crash dumps from kdump
- Tuning kernel runtime parameters for debug sessions

## Workflow

### 1. dmesg and log levels

```bash
# Kernel ring buffer
dmesg -T -l err,warn
dmesg -w   # follow live

# Log level (0=emerg .. 7=debug)
cat /proc/sys/kernel/printk
# current  default  minimum  boot-default
# 4        4        1        7

# Temporarily increase verbosity
echo 8 > /proc/sys/kernel/printk
```

Kernel `printk` levels: `KERN_EMERG` through `KERN_DEBUG`. Driver `dev_dbg()` requires `dyndbg` or `DEBUG` define.

### 2. kgdb over serial

Kernel config: `CONFIG_KGDB`, `CONFIG_KGDB_SERIAL_CONSOLE`.

```bash
# Boot parameter (ttyS0, 115200)
kgdboc=ttyS0,115200 kgdbwait

# Or at runtime
echo ttyS0,115200 > /sys/module/kgdboc/parameters/kgdboc
echo g > /proc/sysrq-trigger   # break into kgdb
```

GDB host side:

```bash
# Connect to remote serial
gdb vmlinux
(gdb) set serial baud 115200
(gdb) target remote /dev/ttyUSB0
(gdb) bt
(gdb) list *panic+0x20
```

USB variant: `CONFIG_KGDB_KDB` with `kgdboc=usb` on supported hardware.

### 3. kdb commands

When `CONFIG_KGDB_KDB` enabled, kdb provides in-kernel shell:

```
kdb commands (at SysRq break)
├── bt          — stack backtrace
├── lsmod       — loaded modules
├── md <addr>   — memory display
├── ps          — process list
├── id <cpu>    — CPU registers
├── go          — continue execution
└── cpu <n>     — switch CPU context
```

```bash
# Enter kdb
echo k > /proc/sysrq-trigger
```

### 4. ftrace

```bash
# Enable function tracer
echo function > /sys/kernel/debug/tracing/current_tracer
echo 1 > /sys/kernel/debug/tracing/tracing_on

# Filter to specific function
echo schedule > /sys/kernel/debug/tracing/set_ftrace_filter
echo ':*probe_*' >> /sys/kernel/debug/tracing/set_ftrace_notrace

# Capture and read
cat /sys/kernel/debug/tracing/trace_pipe

# Disable
echo 0 > /sys/kernel/debug/tracing/tracing_on
echo nop > /sys/kernel/debug/tracing/current_tracer
```

```bash
# trace-cmd (userspace recorder)
trace-cmd record -p function -l schedule,do_page_fault
trace-cmd report
trace-cmd.dat  # kernelshark GUI
```

### 5. kprobes and kretprobes

```bash
# Dynamic kprobe via debugfs
echo 'p:myprobe do_sys_open %ax %si' > /sys/kernel/debug/tracing/kprobe_events
echo 1 > /sys/kernel/debug/tracing/events/kprobes/myprobe/enable
cat /sys/kernel/debug/tracing/trace

# kretprobe
echo 'r:myretprobe do_sys_open $retval' >> /sys/kernel/debug/tracing/kprobe_events

# Cleanup
echo 0 > /sys/kernel/debug/tracing/events/kprobes/myprobe/enable
echo '-:myprobe' > /sys/kernel/debug/tracing/kprobe_events
```

In-kernel kprobe (module):

```c
#include <linux/kprobes.h>

static struct kprobe kp = {
    .symbol_name = "do_sys_open",
    .pre_handler = my_pre_handler,
};

static int __init mod_init(void)
{
    return register_kprobe(&kp);
}
```

### 6. Dynamic debug (dyndbg)

```bash
# Enable all debug messages for a module
echo 'module mydriver +p' > /sys/kernel/debug/dynamic_debug/control

# Enable specific file:line
echo 'file drivers/i2c/i2c-core.c +p' > /sys/kernel/debug/dynamic_debug/control

# Query current settings
grep mydriver /sys/kernel/debug/dynamic_debug/control
```

Boot-time: `dyndbg="module mydriver +p"` on kernel command line.

### 7. kdump and crash analysis

```bash
# Setup kdump (crash kernel reserved memory)
# /etc/default/grub: crashkernel=256M
sudo kdump-config show

# After crash, vmcore in /var/crash/
ls /var/crash/*/vmcore

# Analyze with crash utility
crash /usr/lib/debug/boot/vmlinux-$(uname -r) /var/crash/*/vmcore

crash> bt
crash> log
crash> ps
crash> kmem -i
crash> mod
```

```bash
# Compress vmcore
makedumpfile -c -d /proc/vmcore /tmp/vmcore.lzo
```

### 8. /proc/sys runtime tuning for debugging

```bash
# Panic on oops (reproduce in VM)
sysctl kernel.panic_on_oops=1

# Soft lockup detection
sysctl kernel.softlockup_panic=1

# Watchdog
sysctl kernel.nmi_watchdog=1

# Slab debugging
# Boot: slub_debug=P,pagealloc
```

### 9. Debugging decision tree

```
Kernel issue type?
├── Panic/oops → dmesg; crash vmcore; CONFIG_DEBUG_INFO_BTF
├── Logic bug in driver → dyndbg; ftrace function_graph
├── Performance regression → perf record -g -a; trace-cmd
├── Intermittent → kprobes on suspect path
└── Module crash → kgdb; try_module_get audit
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| kgdb won't connect | Wrong tty/baud | Match `kgdboc` to serial adapter |
| ftrace empty trace | tracing_off or nop tracer | `echo function > current_tracer`; enable tracing_on |
| kprobe registration fails | Missing CONFIG_KPROBES or inlined function | Use tracepoint or static_key |
| dyndbg has no effect | CONFIG_DYNAMIC_DEBUG disabled | Rebuild kernel with option |
| crash can't read vmcore | Wrong vmlinux debug symbols | Install `linux-image-$(uname -r)-dbg` |
| SysRq doesn't work | `kernel.sysrq` disabled | `echo 1 > /proc/sys/kernel/sysrq` |

## Related Skills

- `skills/low-level-programming/linux-kernel-modules` — module development being debugged
- `skills/kernel/device-drivers` — driver-specific probe/IRQ issues
- `skills/kernel/kernel-internals` — subsystem knowledge for interpreting traces
- `skills/debuggers/gdb` — GDB commands shared with kgdb
- `skills/profilers/linux-perf` — perf for kernel hotspots
- `skills/observability/ebpf` — non-invasive kernel tracing alternative