# Flamegraph Tools Reference

Source: <https://github.com/brendangregg/FlameGraph>
Source: <https://www.brendangregg.com/flamegraphs.html>

## Table of Contents

1. [FlameGraph scripts](#flamegraph-scripts)
2. [stackcollapse scripts by profiler](#stackcollapse-scripts-by-profiler)
3. [flamegraph.pl options](#flamegraphpl-options)
4. [Differential flamegraphs](#differential-flamegraphs)
5. [Alternative flamegraph tools](#alternative-flamegraph-tools)
6. [Reading patterns quick reference](#reading-patterns-quick-reference)

---

## FlameGraph scripts

All from: `git clone https://github.com/brendangregg/FlameGraph`

| Script | Purpose |
|--------|---------|
| `stackcollapse-perf.pl` | Collapse `perf script` output |
| `stackcollapse-callgrind.pl` | Collapse Valgrind Callgrind output |
| `stackcollapse-gprof.pl` | Collapse `gprof` output |
| `stackcollapse-go.pl` | Collapse Go pprof raw output |
| `stackcollapse-stap.pl` | Collapse SystemTap output |
| `stackcollapse-dtrace.pl` | Collapse DTrace stacks |
| `stackcollapse-jstack.pl` | Collapse Java jstack output |
| `stackcollapse-ljp.pl` | Collapse Lightweight Java Profiler |
| `stackcollapse.pl` | Generic collapse (DTrace format) |
| `flamegraph.pl` | Generate SVG flamegraph |
| `difffolded.pl` | Diff two folded stack files |
| `record-test.sh` | Example perf recording script |

---

## stackcollapse scripts by profiler

### Linux perf

```bash
perf record -F 999 -g -o perf.data ./prog
perf script -i perf.data > out.perf
stackcollapse-perf.pl out.perf > out.folded
flamegraph.pl out.folded > fg.svg
```

### Valgrind Callgrind

```bash
valgrind --tool=callgrind --callgrind-out-file=cg.out ./prog
stackcollapse-callgrind.pl cg.out > out.folded
flamegraph.pl out.folded > fg.svg
```

### DTrace (macOS / FreeBSD / Solaris)

```bash
# CPU sampling
sudo dtrace -x ustackframes=100 \
  -n 'profile-997 /execname=="prog"/ { @[ustack()] = count(); }' \
  -o out.stacks \
  sleep 30

stackcollapse.pl out.stacks > out.folded
flamegraph.pl out.folded > fg.svg

# Kernel + user combined
sudo dtrace -x stackframes=100 \
  -n 'profile-997 { @[stack(),ustack()] = count(); }' \
  -o out.stacks sleep 30
```

### Go pprof

```bash
go tool pprof -raw -output=cpu.pprof ./prog
stackcollapse-go.pl cpu.pprof > out.folded
flamegraph.pl out.folded > fg.svg
```

### Java (async-profiler)

```bash
# async-profiler: https://github.com/async-profiler/async-profiler
asprof -d 30 -f out.collapsed -t <PID>
# -f out.collapsed writes pre-collapsed format
flamegraph.pl out.collapsed > fg.svg

# Or use jstack periodically
for i in $(seq 1 100); do jstack <PID> >> jstacks.txt; sleep 0.1; done
stackcollapse-jstack.pl jstacks.txt > out.folded
flamegraph.pl out.folded > fg.svg
```

### Rust (cargo-flamegraph)

```bash
cargo install flamegraph
# Runs perf internally and generates flamegraph.svg
cargo flamegraph --bin mybin
```

---

## flamegraph.pl options

```bash
flamegraph.pl [options] folded_input > output.svg
```

| Option | Default | Effect |
|--------|---------|--------|
| `--title "text"` | "Flame Graph" | SVG title |
| `--subtitle "text"` | none | Subtitle below title |
| `--width N` | 1200 | Width in pixels |
| `--height N` | 16 | Frame height in pixels |
| `--minwidth N` | 0.1 | Min frame width % (hide smaller) |
| `--fonttype font` | Verdana | Font family |
| `--fontsize N` | 12 | Font size |
| `--countname name` | "samples" | Label for count in tooltip |
| `--nametype "Name:"` | "Function:" | Label for function name |
| `--colors palette` | hot | Color palette (see below) |
| `--bgcolors color` | — | Background color |
| `--cp` | off | Consistent palette across SVGs |
| `--reverse` | off | Reverse the stacks (icicle-like) |
| `--inverted` | off | Icicle chart (root at top) |
| `--negate` | off | Negate diff values (for difffolded) |
| `--factor N` | 1 | Multiply all sample counts by N |
| `--hash` | off | Deterministic color by function name |
| `--palette file` | — | Save/load color palette file |

### Color palettes

| Palette | Best for |
|---------|---------|
| `hot` | Default; red/yellow for hotness |
| `cold` | Blue tones |
| `mem` | Memory profiling |
| `io` | I/O profiling |
| `java` | Java (color-codes JIT vs interpreted) |
| `js` | JavaScript |
| `perl` | Perl |
| `python` | Python |
| `red` / `green` / `blue` | Monochrome variants |
| `aqua` | Aqua tones |
| `orange` | Orange tones |
| `yellow` | Yellow tones |
| `purple` | Purple tones |

---

## Differential flamegraphs

Compare two profiles: red = more time (regression), blue = less time (improvement).

```bash
# Collect two profiles
perf record -g -o before.data ./prog_old
perf script -i before.data | stackcollapse-perf.pl > before.folded

perf record -g -o after.data ./prog_new
perf script -i after.data  | stackcollapse-perf.pl > after.folded

# Generate diff (positive = regression in 'after')
difffolded.pl before.folded after.folded | flamegraph.pl > diff.svg

# Invert: positive = improvement in 'after'
difffolded.pl -n after.folded before.folded | flamegraph.pl --negate > diff_inv.svg
```

Reading the diff:
- **Saturated red**: function took significantly more time in the new profile
- **Saturated blue**: function took significantly less time
- **Pale colors**: small change
- **Gray/white**: no change
- **Frame only in one profile**: appears fully colored (red or blue)

---

## Alternative flamegraph tools

### Speedscope (browser-based, interactive)

```bash
# Install
npm install -g speedscope

# Use
perf script | speedscope -
# Opens in browser with left-heavy / right-heavy / sandwich views
```

### Firefox Profiler

```bash
# Supports perf data via import at profiler.firefox.com
perf script -F +pid > profile.perf
# Upload to https://profiler.firefox.com
```

### inferno (Rust implementation, fast)

```bash
cargo install inferno
perf script | inferno-collapse-perf | inferno-flamegraph > fg.svg
```

### pprof (Go, supports flamegraphs)

```bash
go tool pprof -http=:8080 profile.pb.gz
# Flamegraph view available in the web UI
```

---

## Reading patterns quick reference

| Visual pattern | Interpretation | Action |
|----------------|----------------|--------|
| Wide frame at top (leaf) | This function is where time is spent | Optimise the function body |
| Wide base, narrow towers | Lots of different callees | Reduce call overhead; cache; batch |
| Very tall stack | Deep recursion or call chain | Check for unnecessary depth; iterative rewrite |
| Plateau of tiny slivers | Many small functions all sharing time | Inlining might help; or algorithmic change |
| One wide frame dominating everything | Single bottleneck | Focus optimisation here first |
| Flat top with many small frames | Vectorisation / unrolled loop | Usually good; check if SIMD expected |
| Diff: red at base, blue at top | Bottleneck moved deeper | New hotspot introduced lower in call chain |

**The actionable hotspot** is always the widest frame that has no (or very narrow) children above it. That is where CPU time is actually consumed.
