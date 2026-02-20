---
name: flamegraphs
description: Flamegraph generation and interpretation skill. Use when converting perf, Valgrind Callgrind, or other profiler output into SVG flamegraphs using Brendan Gregg's FlameGraph tools, or when reading flamegraphs to identify performance bottlenecks. Activates on queries about flamegraphs, stackcollapse, flamegraph.svg, identifying hot frames, wide vs tall frames, or performance visualisation.
---

# Flamegraphs

## Purpose

Guide agents through the pipeline from profiler data to SVG flamegraph, and teach interpretation of flamegraphs to drive concrete optimisation decisions.

## Triggers

- "How do I generate a flamegraph from perf data?"
- "How do I read a flamegraph?"
- "The flamegraph shows a wide frame — what does that mean?"
- "How do I generate a flamegraph from Callgrind?"
- "I want to compare two flamegraphs (before/after)"

## Workflow

### 1. Install FlameGraph tools

```bash
git clone https://github.com/brendangregg/FlameGraph
# No install needed; scripts are in the repo
export PATH=$PATH:/path/to/FlameGraph
```

### 2. perf → flamegraph (most common path)

```bash
# Step 1: record
perf record -F 999 -g -o perf.data ./prog

# Step 2: generate script output
perf script -i perf.data > out.perf

# Step 3: collapse stacks
stackcollapse-perf.pl out.perf > out.folded

# Step 4: generate SVG
flamegraph.pl out.folded > flamegraph.svg

# Step 5: view
xdg-open flamegraph.svg     # Linux
open flamegraph.svg          # macOS
```

One-liner:

```bash
perf record -F 999 -g ./prog && perf script | stackcollapse-perf.pl | flamegraph.pl > fg.svg
```

### 3. Differential flamegraph (before/after)

```bash
# Collect two profiles
perf record -g -o before.data ./prog_old
perf record -g -o after.data ./prog_new

# Collapse
perf script -i before.data | stackcollapse-perf.pl > before.folded
perf script -i after.data  | stackcollapse-perf.pl > after.folded

# Diff (red = regressed, blue = improved)
difffolded.pl before.folded after.folded | flamegraph.pl > diff.svg
```

### 4. Callgrind → flamegraph

```bash
valgrind --tool=callgrind --callgrind-out-file=cg.out ./prog
stackcollapse-callgrind.pl cg.out | flamegraph.pl > fg.svg
```

### 5. Other profiler inputs

```bash
# Go pprof
go tool pprof -raw -output=prof.txt prog
stackcollapse-go.pl prof.txt | flamegraph.pl > fg.svg

# DTrace
dtrace -x ustackframes=100 -n 'profile-99 /execname=="prog"/ { @[ustack()] = count(); }' \
  -o out.stacks sleep 10
stackcollapse.pl out.stacks | flamegraph.pl > fg.svg

# Java (async-profiler)
async-profiler -d 30 -f out.collapsed PID
flamegraph.pl out.collapsed > fg.svg
```

### 6. Reading flamegraphs

A flamegraph is a call-stack visualisation:

- **X axis**: time on CPU (not time sequence) — wider = more time
- **Y axis**: call stack depth — taller = deeper call chain
- **Color**: random (no significance) — unless using differential mode

**What to look for:**

| Pattern | Meaning | Action |
|---------|---------|--------|
| Wide frame near bottom | Function itself is hot | Optimise that function |
| Wide frame with tall narrow towers | Calling many different callees | Hot dispatch; reduce call overhead |
| Very tall stack with wide base | Deep recursion | Check recursion depth; consider iterative approach |
| Plateau at the top | Leaf function with no callees | This leaf is the actual hotspot |
| Many narrow identical stacks | Many threads doing the same work | Consider parallelism or batching |

**Identifying the actionable hotspot:**

1. Find the widest top frame (a frame with no or narrow children above it)
2. That is where CPU time is actually spent
3. Trace down to understand what called it and why

**Differential flamegraph:**

- Red frames: more time in new profile (regression)
- Blue frames: less time in new profile (improvement)
- Frames only in one profile appear solid colored

### 7. flamegraph.pl options

```bash
flamegraph.pl --title "My App" \
              --subtitle "Release build, workload X" \
              --width 1600 \
              --height 16 \
              --minwidth 0.5 \
              --colors java \
              out.folded > fg.svg
```

| Option | Effect |
|--------|--------|
| `--title` | SVG title |
| `--width` | Width in pixels |
| `--height` | Frame height in pixels |
| `--minwidth` | Omit frames < N% (reduces clutter) |
| `--colors` | Palette: `hot` (default), `mem`, `io`, `java`, `js`, `perl`, `red`, `green`, `blue` |
| `--inverted` | Icicle chart (roots at top) |
| `--reverse` | Reverse stacks |
| `--cp` | Consistent palette (same frame = same color across SVGs) |

## References

For tool installation, stackcollapse scripts, and palette options, see [references/tools.md](references/tools.md).

## Related skills

- Use `skills/profilers/linux-perf` to collect perf data
- Use `skills/profilers/valgrind` to collect Callgrind data
- Use `skills/compilers/clang` for LLVM PGO from sampling profiles
