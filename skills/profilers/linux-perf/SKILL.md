---
name: linux-perf
description: Linux perf profiler skill for CPU performance analysis. Use when collecting sampling profiles with perf record, generating perf report, measuring hardware counters (cache misses, branch mispredicts, IPC), identifying hot functions, or feeding perf data into flamegraph tools. Activates on queries about perf, Linux performance counters, PMU events, off-CPU profiling, perf stat, perf annotate, or sampling-based profiling on Linux.
---

# Linux perf

## Purpose

Guide agents through `perf` for CPU profiling: sampling, hardware counter measurement, hotspot identification, and integration with flamegraph generation.

## Triggers

- "Which function is consuming the most CPU?"
- "How do I measure cache misses / IPC?"
- "How do I use `perf` to find hotspots?"
- "How do I generate a flamegraph from perf data?"
- "perf shows `[unknown]` or `[kernel]` frames"

## Workflow

### 1. Prerequisites

```bash
# Install
sudo apt install linux-perf    # Debian/Ubuntu (version-matched)
sudo dnf install perf          # Fedora/RHEL

# Check permissions
# By default perf requires root or paranoid level ≤ 1
cat /proc/sys/kernel/perf_event_paranoid
# 2 = only CPU stats (not kernel), 1 = user+kernel, 0 = all, -1 = no restrictions

# Temporarily lower (session only)
sudo sysctl -w kernel.perf_event_paranoid=1

# Persistent
echo 'kernel.perf_event_paranoid=1' | sudo tee /etc/sysctl.d/99-perf.conf
sudo sysctl -p /etc/sysctl.d/99-perf.conf
```

Compile the target with debug symbols for useful frame data:
```bash
gcc -g -O2 -fno-omit-frame-pointer -o prog main.c
# -fno-omit-frame-pointer: essential for frame-pointer-based unwinding
# Alternative: compile with DWARF CFI and use --call-graph=dwarf
```

### 2. perf stat — quick counters

```bash
# Basic hardware counters
perf stat ./prog

# With specific events
perf stat -e cache-misses,cache-references,instructions,cycles,branch-misses ./prog

# Wall-clock comparison: N runs
perf stat -r 5 ./prog

# Attach to existing process
perf stat -p 12345 sleep 10
```

Interpret `perf stat` output:
- **IPC** (instructions per cycle) < 1.0: memory-bound or stalled pipeline
- **cache-miss rate** > 5%: significant cache pressure
- **branch-miss rate** > 5%: branch predictor struggling

### 3. perf record — sampling

```bash
# Default: sample at 1000 Hz (cycles event)
perf record -g ./prog

# Specify frequency
perf record -F 999 -g ./prog

# Specific event
perf record -e cache-misses -g ./prog

# Attach to running process
perf record -F 999 -g -p 12345 sleep 30

# Off-CPU profiling (time spent waiting)
perf record -e sched:sched_switch -ag sleep 10

# DWARF call graphs (better for binaries without frame pointers)
perf record -F 999 --call-graph=dwarf ./prog

# Save to named file
perf record -o myapp.perf.data -g ./prog
```

### 4. perf report — interactive analysis

```bash
perf report                          # reads perf.data
perf report -i myapp.perf.data
perf report --no-children            # self time only (not cumulative)
perf report --sort comm,dso,sym      # sort by fields
perf report --stdio                  # non-interactive text output
```

Navigation in TUI:
- `Enter` — expand a symbol
- `a` — annotate (show assembly with hit counts)
- `s` — show source (needs debug info)
- `d` — filter by DSO (library)
- `t` — filter by thread
- `?` — help

### 5. perf annotate — hot instructions

```bash
# Show assembly with hit percentages
perf annotate sym_name

# From report: press 'a' on a symbol
# Or directly:
perf annotate -i perf.data --symbol=hot_function --stdio
```

High hit count on a `mov` or `vmovdqa` suggests a cache miss at that load.

### 6. perf top — live profiling

```bash
# Live top, like 'top' but for functions
sudo perf top -g

# Filter by process
sudo perf top -p 12345
```

### 7. Feed into flamegraphs

```bash
# Generate perf script output
perf script > out.perf

# Use Brendan Gregg's FlameGraph tools
git clone https://github.com/brendangregg/FlameGraph
./FlameGraph/stackcollapse-perf.pl out.perf > out.folded
./FlameGraph/flamegraph.pl out.folded > flamegraph.svg

# Open flamegraph.svg in browser
```

See `skills/profilers/flamegraphs` for reading flamegraphs and interpreting results.

### 8. Common issues

| Problem | Cause | Fix |
|---------|-------|-----|
| `Permission denied` | `perf_event_paranoid` too high | Lower paranoid level or run with `sudo` |
| `[unknown]` frames | Missing frame pointers or debug info | Recompile with `-fno-omit-frame-pointer` or use `--call-graph=dwarf` |
| `[kernel]` everywhere | Kernel symbols not visible | Use `sudo perf record`; install `linux-image-$(uname -r)-dbgsym` |
| `No kallsyms` | Kernel symbols unavailable | `echo 0 | sudo tee /proc/sys/kernel/kptr_restrict` |
| Empty report for short program | Program exits too fast | Use `-F 9999` or instrument longer workload |
| DWARF unwinding slow | Large DWARF stack | Limit with `--call-graph dwarf,512` |

### 9. Useful events

```bash
# List all available events
perf list

# Common hardware events
cycles
instructions
cache-references
cache-misses
branch-instructions
branch-misses
stalled-cycles-frontend
stalled-cycles-backend

# Software events
context-switches
cpu-migrations
page-faults

# Tracepoints (requires root)
sched:sched_switch
syscalls:sys_enter_read
```

For a counter reference and interpretation guide, see [references/events.md](references/events.md).

## Related skills

- Use `skills/profilers/flamegraphs` for SVG flamegraph generation and reading
- Use `skills/profilers/valgrind` for cache simulation and memory profiling
- Use `skills/compilers/gcc` or `skills/compilers/clang` for PGO from perf data (AutoFDO)
