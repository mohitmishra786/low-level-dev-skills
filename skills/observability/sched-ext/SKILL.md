---
name: sched-ext
description: sched_ext skill for Linux CPU schedulers written in BPF. Use when enabling CONFIG_SCHED_CLASS_EXT, running scx schedulers such as scx_lavd or scx_bpfland, writing a custom BPF scheduler with dispatch queues, debugging a scheduler that stalls or gets ejected, or measuring scheduling latency. Activates on queries about sched_ext, SCX, scx_simple, scx_lavd, scx_bpfland, scx_rusty, scxcli, sched_ext_ops, dispatch queues, scx_bpf_dsq_insert, or BPF CPU schedulers.
---

# sched_ext — BPF CPU Schedulers

## Purpose

Guide agents through sched_ext (examples checked on Linux 7.3.5): enabling it, running existing schedulers, writing a minimal BPF scheduler, and debugging or measuring one safely.

## Triggers

- "How do I try a sched_ext scheduler like scx_lavd?"
- "How do I write my own CPU scheduler in BPF?"
- "Why did my BPF scheduler get disabled?"
- "What are dispatch queues (DSQs)?"
- "Is sched_ext safe to run in production?"
- "How do I check which scheduler is active?"

## Workflow

### 1. What sched_ext is

sched_ext (upstream since Linux 6.12) adds a scheduling class whose policy is a BPF
`struct_ops` program loaded from user space. When the program exits, errors or stalls, the
kernel switches all tasks back to the default fair class. Linux 7.1 added per-cgroup
sub-schedulers. Meta and Google run it in production; CachyOS and SteamOS use it on desktops.

```text
Want different scheduling behaviour?
├── Tuning knobs (nice, cgroup cpu.weight, isolcpus) enough? → use them first
├── An existing scx scheduler fits (gaming latency, throughput, NUMA)? → section 3
└── Workload-specific policy needed → write one (sections 4-5), test in a VM first
```

### 2. Kernel configuration

```text
CONFIG_SCHED_CLASS_EXT=y      # depends on the three below
CONFIG_BPF_SYSCALL=y
CONFIG_BPF_JIT=y
CONFIG_DEBUG_INFO_BTF=y       # needs pahole at build time
```

Schedulers built with the in-tree helpers (`tools/sched_ext`) or the scx repository also need:

```text
CONFIG_FUNCTION_TRACER=y      # fentry programs in the scx common headers
CONFIG_DYNAMIC_FTRACE=y
CONFIG_BPF_EVENTS=y
CONFIG_CGROUP_SCHED=y         # struct_ops has cgroup callbacks the loader expects
CONFIG_EXT_GROUP_SCHED=y
```

`tools/sched_ext/Kconfig` in the kernel tree is the full recommended fragment.

```bash
# Is sched_ext available and is a scheduler loaded?
cat /sys/kernel/sched_ext/state          # disabled | enabled
cat /sys/kernel/sched_ext/root/ops       # name of the running scheduler (only when enabled)
```

### 3. Running existing schedulers

The `sched-ext/scx` repository (v1.1.4) ships production schedulers in Rust and C:

| Scheduler | Aimed at |
|-----------|----------|
| `scx_lavd` | Latency-criticality aware virtual deadline; interactive and gaming workloads |
| `scx_bpfland` | EEVDF-like, per-CPU deadline queues; keeps interactive tasks responsive (Linux 6.16+) |
| `scx_rusty` | Multi-domain: BPF round robin per domain, load balancing in user space |
| `scx_p2dq` | Pick-two load balancing with multi-layer queueing, general purpose |
| `scx_cosmos` | Keeps tasks on their previous CPU (locality) when not saturated |
| `scx_flash` | Fairness and predictable performance |

```bash
# Fedora, Arch, CachyOS, openSUSE Tumbleweed package them (scx-scheds)
sudo scx_lavd                 # runs until Ctrl-C, then the kernel falls back to the fair class

# Managed by systemd: v1.1.4 ships services/scx.service, which runs the scheduler named in
# /etc/default/scx (SCX_SCHEDULER=scx_cosmos, optional SCX_FLAGS=...)
sudo systemctl enable --now scx.service
systemctl status scx.service

# scxcli (front end for scx.service) is only on the main branch, not in v1.1.4:
#   cargo build --release -p scxcli
scxcli list                   # recommended schedulers and current state
sudo scxcli start scx_cosmos

# From source
git clone https://github.com/sched-ext/scx && cd scx
cargo build --release -p scx_lavd
```

The BPF interface has no stability guarantee: kfuncs and `sched_ext_ops` fields change between
kernel releases. Run a scheduler version built for your kernel, and test before deploying.

### 4. Writing a minimal scheduler

A scheduler fills in `struct sched_ext_ops`. Tasks flow through dispatch queues (DSQs): each CPU
has a local DSQ it runs from, and the scheduler can create shared DSQs.

```c
/* scx_mini.bpf.c — global FIFO scheduler with an idle-CPU fast path */
#include <scx/common.bpf.h>

char _license[] SEC("license") = "GPL";

UEI_DEFINE(uei);                 /* exit info shared with userspace */

#define SHARED_DSQ 0             /* our own dispatch queue id */

/* Pick a CPU on wakeup; if it is idle, queue straight to its local DSQ */
s32 BPF_STRUCT_OPS(mini_select_cpu, struct task_struct *p, s32 prev_cpu, u64 wake_flags)
{
        bool is_idle = false;
        s32 cpu = scx_bpf_select_cpu_dfl(p, prev_cpu, wake_flags, &is_idle);

        if (is_idle)
                scx_bpf_dsq_insert(p, SCX_DSQ_LOCAL, SCX_SLICE_DFL, 0);
        return cpu;
}

/* Everything else goes to one shared FIFO */
void BPF_STRUCT_OPS(mini_enqueue, struct task_struct *p, u64 enq_flags)
{
        scx_bpf_dsq_insert(p, SHARED_DSQ, SCX_SLICE_DFL, enq_flags);
}

/* A CPU ran out of work: pull the next task from the shared FIFO */
void BPF_STRUCT_OPS(mini_dispatch, s32 cpu, struct task_struct *prev)
{
        scx_bpf_dsq_move_to_local(SHARED_DSQ, 0);
}

s32 BPF_STRUCT_OPS_SLEEPABLE(mini_init)
{
        return scx_bpf_create_dsq(SHARED_DSQ, -1);   /* -1: any NUMA node */
}

void BPF_STRUCT_OPS(mini_exit, struct scx_exit_info *ei)
{
        UEI_RECORD(uei, ei);
}

SCX_OPS_DEFINE(mini_ops,
               .select_cpu = (void *)mini_select_cpu,
               .enqueue    = (void *)mini_enqueue,
               .dispatch   = (void *)mini_dispatch,
               .init       = (void *)mini_init,
               .exit       = (void *)mini_exit,
               .name       = "mini");
```

```c
/* scx_mini.c — load, attach, wait for Ctrl-C, report why the scheduler exited */
#include <signal.h>
#include <stdio.h>
#include <unistd.h>
#include <bpf/bpf.h>
#include <scx/common.h>
#include "scx_mini.bpf.skel.h"

static volatile int exit_req;

static void on_signal(int sig) { exit_req = 1; }

int main(int argc, char **argv)
{
        struct scx_mini *skel;
        struct bpf_link *link;
        __u64 ecode;

        signal(SIGINT, on_signal);
        signal(SIGTERM, on_signal);
restart:
        skel = SCX_OPS_OPEN(mini_ops, scx_mini);        /* open the BPF object */
        SCX_OPS_LOAD(skel, mini_ops, scx_mini, uei);    /* verify + load */
        link = SCX_OPS_ATTACH(skel, mini_ops, scx_mini); /* switch tasks to sched_ext */

        while (!exit_req && !UEI_EXITED(skel, uei))
                sleep(1);

        bpf_link__destroy(link);                          /* back to the fair class */
        ecode = UEI_REPORT(skel, uei);
        scx_mini__destroy(skel);

        if (!exit_req && UEI_ECODE_RESTART(ecode))
                goto restart;
        return 0;
}
```

```bash
# Build next to the in-tree examples (they provide libbpf, bpftool and the scx headers)
cp scx_mini.bpf.c scx_mini.c linux/tools/sched_ext/
sed -i 's/^c-sched-targets = /c-sched-targets = scx_mini /' linux/tools/sched_ext/Makefile

# KOUT: the kernel's O= build directory (the BTF in $KOUT/vmlinux is used for vmlinux.h)
KOUT="$HOME/src/build-scx"
make -C linux/tools/sched_ext O="$KOUT" LLVM=1 scx_mini   # needs clang >= 16
sudo "$KOUT/build/bin/scx_mini"
# Without O=, the binary is linux/tools/sched_ext/build/bin/scx_mini

# dmesg: sched_ext: BPF scheduler "mini" enabled
```

Rust user space: the scx repository's schedulers generate the libbpf-rs skeleton in `build.rs`
(`scx_cargo::BpfBuilder`) and drive it with `scx_utils` macros. The calls in
`scheds/rust/scx_cosmos/src/main.rs` at v1.1.4, in order:

```rust
let mut skel = scx_ops_open!(skel_builder, open_object, cosmos_ops, open_opts)?; // open
let mut skel = scx_ops_load!(skel, cosmos_ops, uei)?;                            // verify + load
let link = scx_ops_attach!(skel, cosmos_ops)?;                                   // start scheduling
while !shutdown.load(Ordering::Relaxed) && !uei_exited!(&skel, uei) { /* stats */ }
drop(link);                                                                      // detach
let exit = uei_report!(&skel, uei)?;   // why it exited; exit.should_restart() → reopen
```

Copy one of those schedulers as a template rather than starting from scratch.

### 5. Core callbacks and kfuncs

| `sched_ext_ops` callback | Called when | Typical action |
|--------------------------|-------------|----------------|
| `select_cpu` | Task wakes up | Choose a CPU; may insert directly into `SCX_DSQ_LOCAL` |
| `enqueue` | Task becomes runnable | Insert into a DSQ (FIFO or vtime-ordered) |
| `dispatch` | A CPU's local DSQ is empty | Move tasks from shared DSQs to the local one |
| `running` / `stopping` | Task starts / stops on a CPU | Track vtime or usage |
| `enable` / `init_task` | Task joins sched_ext | Initialize per-task state |
| `init` / `exit` | Scheduler load / unload | Create DSQs / record exit info |

| kfunc | Purpose |
|-------|---------|
| `scx_bpf_dsq_insert(p, dsq, slice, flags)` | Queue a task FIFO into a DSQ |
| `scx_bpf_dsq_insert_vtime(p, dsq, slice, vtime, flags)` | Queue ordered by virtual time |
| `scx_bpf_dsq_move_to_local(dsq, flags)` | Pull the first task of a DSQ to this CPU |
| `scx_bpf_create_dsq(id, node)` | Create a shared DSQ |
| `scx_bpf_select_cpu_dfl(...)` | Default idle-CPU selection |
| `scx_bpf_kick_cpu(cpu, flags)` | Wake or preempt another CPU |
| `scx_bpf_error(fmt, ...)` | Abort the scheduler with a message |

Built-in DSQs: `SCX_DSQ_LOCAL` (current CPU), `SCX_DSQ_LOCAL_ON | cpu` (a given CPU),
`SCX_DSQ_GLOBAL` (shared fallback). `SCX_SLICE_DFL` is the default time slice.

### 6. Safety nets and debugging

The kernel protects itself from a broken scheduler:

- **Watchdog**: a runnable task that is not scheduled within `timeout_ms` (default 30 s, set in
  `SCX_OPS_DEFINE`) ejects the scheduler: `BPF scheduler "x" disabled (runnable task stall)`.
- **SysRq-S**: `echo S > /proc/sysrq-trigger` (or Alt-SysRq-S) disables sched_ext:
  `disabled by sysrq-S`.
- **Errors**: `scx_bpf_error()` or a verifier-unsafe operation disables it with the message.
- Unloading (Ctrl-C) prints `disabled (unregistered from user space)`.

```bash
# Why did it exit? The loader prints the reason (UEI_REPORT); the kernel logs it too
dmesg | grep sched_ext

# bpf_printk() output from the scheduler
cat /sys/kernel/debug/tracing/trace_pipe

# Inspect the loaded struct_ops programs and their maps
bpftool prog show | grep -A2 struct_ops
bpftool map show

# Kernel-side state (needs drgn)
tools/sched_ext/scx_show_state.py
```

Develop in a VM: `qemu-system-* -smp 4` with the config from section 2 boots in seconds, and a
broken scheduler costs at most one `timeout_ms`.

### 7. Measuring the effect

```bash
# Run-queue latency histogram (bcc tools; Debian/Ubuntu name shown)
runqlat-bpfcc 10 1

# Per-task scheduling delays
perf sched record -- sleep 10 && perf sched latency --sort max
```

Compare with the default scheduler on the same workload and hardware; a scheduler that wins on
one benchmark can lose badly on another.

### 8. Common problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `/sys/kernel/sched_ext` missing | Kernel without `CONFIG_SCHED_CLASS_EXT` | Rebuild with section 2 options (6.12+) |
| `Couldn't load trivial BPF program` | No program type libbpf can probe (e.g. no `CONFIG_NET`/perf events) | Enable `CONFIG_NET` or `CONFIG_PERF_EVENTS` |
| `prog 'scx_lib_init_probe': failed to load: -EINVAL` | fentry needs the function tracer | `CONFIG_FUNCTION_TRACER`, `CONFIG_DYNAMIC_FTRACE` |
| Loader build fails: `no member named 'cgroup_set_bandwidth'` | Kernel BTF lacks cgroup scheduling fields | `CONFIG_CGROUP_SCHED`, `CONFIG_EXT_GROUP_SCHED` |
| `disabled (runnable task stall)` | Tasks queued but never dispatched | Make `dispatch` drain every DSQ you insert into |
| Verifier rejects a kfunc | Scheduler built for another kernel version | Rebuild against the running kernel's BTF |

## Related skills

- Use `skills/observability/ebpf` for libbpf, BTF, CO-RE and verifier errors
- Use `skills/observability/ebpf-rust` for the Rust/Aya side of BPF tooling
- Use `skills/kernel/kernel-internals` for the default scheduler and run queues
- Use `skills/profilers/linux-perf` for `perf sched` and latency analysis
- Use `skills/kernel-dev/qemu-for-kernel-development` for a VM to test schedulers in
