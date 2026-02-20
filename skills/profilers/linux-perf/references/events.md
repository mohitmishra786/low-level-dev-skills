# Linux perf Events Reference

Source: https://perf.wiki.kernel.org/index.php/Main_Page
Source: https://man7.org/linux/man-pages/man1/perf-stat.1.html

## Table of Contents
1. [Hardware events](#hardware-events)
2. [Software events](#software-events)
3. [Tracepoints](#tracepoints)
4. [Interpreting metrics](#interpreting-metrics)

---

## Hardware events

These map to hardware PMU counters. Availability depends on CPU.

| Event | Meaning |
|-------|---------|
| `cycles` | CPU clock cycles |
| `instructions` | Instructions retired |
| `cache-references` | L1D cache accesses |
| `cache-misses` | L1D cache misses |
| `branch-instructions` | Branches executed |
| `branch-misses` | Branch mispredictions |
| `bus-cycles` | Bus cycles |
| `stalled-cycles-frontend` | Cycles stalled fetching instructions |
| `stalled-cycles-backend` | Cycles stalled waiting for execution units |
| `ref-cycles` | Reference (unscaled) cycles |

### Raw PMU events (Intel Skylake example)

```bash
# L2 misses
perf stat -e r412e ./prog

# LLC (L3) misses
perf stat -e r2b4 ./prog

# DTLB misses
perf stat -e r08085 ./prog

# Memory bandwidth (approximate)
perf stat -e 'cpu/event=0xd1,umask=0x20/u' ./prog
```

Use `ocperf.py` or Intel's PMU tools for named aliases.

---

## Software events

These are tracked by the kernel in software, not hardware PMU.

| Event | Meaning |
|-------|---------|
| `cpu-clock` | CPU clock (software timer) |
| `task-clock` | Time on-CPU for the task |
| `page-faults` | Total page faults (minor + major) |
| `minor-faults` | Minor faults (page in memory, just not mapped) |
| `major-faults` | Major faults (page must be fetched from disk) |
| `context-switches` | Voluntary + involuntary switches |
| `cpu-migrations` | Process moved to different CPU |
| `alignment-faults` | Misaligned memory accesses |
| `emulation-faults` | Emulated instructions |

---

## Tracepoints

Requires root (`perf_event_paranoid` ≤ 0 or `sudo`).

```bash
# List all
perf list tracepoint

# Scheduler
sched:sched_switch
sched:sched_wakeup
sched:sched_process_fork

# Syscalls
syscalls:sys_enter_read
syscalls:sys_exit_read
syscalls:sys_enter_write

# Block I/O
block:block_rq_issue
block:block_rq_complete

# Network
net:netif_receive_skb
net:net_dev_xmit
```

---

## Interpreting metrics

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| IPC | `instructions / cycles` | < 1.0: stalled; > 2.0: well-optimised |
| CPI | `cycles / instructions` | Inverse of IPC |
| Cache miss rate | `cache-misses / cache-references` | > 10%: significant |
| Branch miss rate | `branch-misses / branch-instructions` | > 5%: worth examining |
| Frontend stall % | `stalled-cycles-frontend / cycles` | > 20%: instruction fetch bottleneck |
| Backend stall % | `stalled-cycles-backend / cycles` | > 20%: execution bottleneck |

### Diagnosing bottlenecks

- **Low IPC + high backend stalls + high cache misses** → memory bandwidth bound; improve data locality
- **Low IPC + high frontend stalls** → i-cache pressure; split hot/cold code, enable PGO
- **High branch-miss rate** → unpredictable branches; sort data, profile-guided branch hints
- **High page-faults major** → thrashing; reduce working set or increase physical memory
