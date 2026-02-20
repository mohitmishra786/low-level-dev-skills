---
name: heaptrack
description: heaptrack memory profiler skill for Linux. Use when tracking heap allocations, finding memory leaks, measuring peak heap usage, identifying allocation hotspots, or comparing allocation behaviour between runs. Activates on queries about heaptrack, heap profiling, memory allocation analysis, heaptrack_print, allocation hotspots, or memory leak detection with heaptrack.
---

# heaptrack

## Purpose

Guide agents through heaptrack for heap allocation profiling on Linux: recording allocation traces, analysing with heaptrack_print, identifying leaks and hotspots, and comparing runs.

## Triggers

- "How do I find memory allocation hotspots in my C++ program?"
- "My program uses too much memory — how do I find where?"
- "How do I use heaptrack to detect memory leaks?"
- "What is heaptrack and how does it differ from Valgrind massif?"
- "How do I compare memory usage between two program versions?"
- "heaptrack_print output — how do I interpret it?"

## Workflow

### 1. Installation

```bash
# Ubuntu/Debian
sudo apt-get install heaptrack heaptrack-gui

# Fedora
sudo dnf install heaptrack

# Arch
sudo pacman -S heaptrack

# Build from source
git clone https://github.com/KDE/heaptrack.git
cmake -S heaptrack -B heaptrack-build -DCMAKE_BUILD_TYPE=Release
cmake --build heaptrack-build -j$(nproc)
```

### 2. Basic usage

```bash
# Profile a program (generates heaptrack.<prog>.<pid>.zst)
heaptrack ./myapp arg1 arg2

# Attach to running process
heaptrack --pid 12345

# Analyse the trace file
heaptrack_print heaptrack.myapp.12345.zst

# GUI analysis (if heaptrack-gui installed)
heaptrack_gui heaptrack.myapp.12345.zst
```

### 3. Build for better profiling

```bash
# Build with debug symbols (essential for readable backtraces)
cmake -S . -B build -DCMAKE_BUILD_TYPE=RelWithDebInfo
cmake --build build

# Then profile
heaptrack ./build/myapp
```

### 4. Interpreting heaptrack_print output

```bash
heaptrack_print heaptrack.myapp.*.zst 2>/dev/null
```

Key sections:

```text
total runtime: 2.34s
calls to allocation functions: 145,234 (62,064/s)
temporary allocations: 89,123 (38,087/s)
peak heap memory consumption: 45.23MB
peak RSS (including heap): 78.45MB
total memory leaked: 2.34MB

# Top allocation hotspots (by peak memory)
hotspot 1: 12.34MB peak
  myapp::cache::Cache::insert(...)
    at src/cache.cpp:142
  ...

# Top leaked allocations
leak 1: 2.34MB leaked in 1,234 allocations
  myapp::connection::Connection::new(...)
    at src/connection.cpp:67
```

| Metric | Meaning |
|--------|---------|
| `total memory leaked` | Memory allocated but never freed |
| `peak heap consumption` | Maximum live heap at any point |
| `temporary allocations` | Allocated and freed within one call stack |
| `calls to allocation functions` | Total malloc/new/realloc calls |

### 5. Filtering and analysis options

```bash
# Show top N hotspots
heaptrack_print -p 10 heaptrack.myapp.*.zst  # top 10 hotspots

# Show flamegraph data
heaptrack_print -f heaptrack.myapp.*.zst > alloc.folded
flamegraph.pl alloc.folded > alloc.svg

# Show only leaked allocations
heaptrack_print -l heaptrack.myapp.*.zst

# Show allocations above threshold
heaptrack_print --min-cost 1048576 heaptrack.myapp.*.zst  # >1MB only

# Short summary
heaptrack_print -s heaptrack.myapp.*.zst
```

### 6. Comparing two runs

```bash
# Record baseline
heaptrack ./myapp --config baseline.conf
mv heaptrack.myapp.*.zst before.zst

# Make changes, record again
heaptrack ./myapp --config new.conf
mv heaptrack.myapp.*.zst after.zst

# Compare (shows diff of hotspots)
heaptrack_print before.zst | head -20 > before.txt
heaptrack_print after.zst  | head -20 > after.txt
diff before.txt after.txt
```

### 7. heaptrack vs Valgrind massif

| Feature | heaptrack | Valgrind massif |
|---------|-----------|-----------------|
| Overhead | ~2-3x | ~20x |
| Output | Compressed trace + GUI | Text/ms_print |
| Leak detection | Yes | Yes |
| Peak tracking | Yes | Yes |
| Temporal view | Yes (GUI) | Yes (ms_print) |
| Platform | Linux only | Linux, macOS |
| Needs recompile | No | No |
| Call graph | Full stack traces | Full stack traces |

Use heaptrack for most cases; use massif when you need platform portability or detailed snapshot comparison.

### 8. Integration with Rust

heaptrack works with Rust binaries when using the system allocator:

```rust
// Rust: use system allocator so heaptrack can intercept
use std::alloc::System;
#[global_allocator]
static A: System = System;
```

```bash
# Profile Rust binary
cargo build --release
heaptrack ./target/release/myapp

# Note: debug symbols improve backtraces
cargo build --profile release-with-debug
heaptrack ./target/release-with-debug/myapp
```

For heaptrack_print output reference and GUI usage, see [references/heaptrack-analysis.md](references/heaptrack-analysis.md).

## Related skills

- Use `skills/profilers/valgrind` for Memcheck (correctness) and massif (alternative heap profiler)
- Use `skills/profilers/linux-perf` for CPU profiling alongside memory profiling
- Use `skills/rust/rust-profiling` for Rust-specific allocation profiling approaches
- Use `skills/runtimes/sanitizers` — ASan LeakSanitizer for leak detection without profiling overhead
