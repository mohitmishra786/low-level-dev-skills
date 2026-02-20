---
name: rust-profiling
description: Rust profiling skill for performance analysis. Use when generating flamegraphs from Rust binaries, measuring monomorphization bloat with cargo-llvm-lines, analysing binary size with cargo-bloat, microbenchmarking with Criterion, or interpreting inlined frames in profiles. Activates on queries about cargo flamegraph, cargo-bloat, cargo-llvm-lines, Criterion benchmarks, Rust performance profiling, or binary size analysis.
---

# Rust Profiling

## Purpose

Guide agents through Rust performance profiling: flamegraphs via cargo-flamegraph, binary size analysis, monomorphization bloat measurement, Criterion microbenchmarks, and interpreting profiling results with inlined Rust frames.

## Triggers

- "How do I generate a flamegraph for a Rust program?"
- "My Rust binary is huge — how do I find what's causing it?"
- "How do I write Criterion benchmarks?"
- "How do I measure monomorphization bloat?"
- "Rust performance is worse than expected — how do I profile it?"
- "How do I use perf with Rust?"

## Workflow

### 1. Build for profiling

```bash
# Release with debug symbols (needed for readable profiles)
# Cargo.toml:
[profile.release-with-debug]
inherits = "release"
debug = true

cargo build --profile release-with-debug

# Or quick: release + debug info inline
CARGO_PROFILE_RELEASE_DEBUG=true cargo build --release
```

### 2. Flamegraphs with cargo-flamegraph

```bash
# Install
cargo install flamegraph

# Linux: uses perf (requires perf_event_paranoid ≤ 1)
sudo sh -c 'echo 1 > /proc/sys/kernel/perf_event_paranoid'
cargo flamegraph --bin myapp -- arg1 arg2

# macOS: uses DTrace (requires sudo)
sudo cargo flamegraph --bin myapp -- arg1 arg2

# Profile tests
cargo flamegraph --test mytest -- test_filter

# Profile benchmarks
cargo flamegraph --bench mybench -- --bench

# Output
# Generates flamegraph.svg in current directory
# Open in browser: firefox flamegraph.svg
```

Custom flamegraph options:
```bash
# More samples
cargo flamegraph --freq 1000 --bin myapp

# Filter to specific threads
cargo flamegraph --bin myapp -- args 2>/dev/null

# Using perf directly for more control
perf record -g -F 999 ./target/release-with-debug/myapp args
perf script | stackcollapse-perf.pl | flamegraph.pl > out.svg
```

### 3. Binary size analysis with cargo-bloat

```bash
# Install
cargo install cargo-bloat

# Show top functions by size
cargo bloat --release -n 20

# Show per-crate size breakdown
cargo bloat --release --crates

# Include only specific crate
cargo bloat --release --filter myapp

# Compare before/after a change
cargo bloat --release --crates > before.txt
# make changes
cargo bloat --release --crates > after.txt
diff before.txt after.txt
```

Typical output:
```
 File  .text    Size    Crate Name
 2.4%   3.0% 47.0KiB      std <std macros>
 1.8%   2.3% 35.5KiB   myapp myapp::heavy_module::process
 1.2%   1.5% 23.1KiB    serde serde::de::...
```

### 4. Monomorphization bloat with cargo-llvm-lines

```bash
# Install
cargo install cargo-llvm-lines

# Show LLVM IR line counts (proxy for monomorphization)
cargo llvm-lines --release | head -40

# Filter to your crate only
cargo llvm-lines --release | grep '^myapp'
```

Typical output:
```
   Lines      Copies  Function name
   85330           1  [LLVM passes]
    7761          92  core::fmt::write
    4672          11  myapp::process::<impl MyTrait for T>
    3201          47  <alloc::vec::Vec<T> as core::ops::Drop>::drop
```

High `Copies` count = monomorphization expansion. Fix:
```rust
// Before: generic, gets monomorphized for every T
fn process<T: AsRef<[u8]>>(data: T) -> usize {
    do_work(data.as_ref())
}

// After: thin generic wrapper + concrete inner
fn process<T: AsRef<[u8]>>(data: T) -> usize {
    fn inner(data: &[u8]) -> usize { do_work(data) }
    inner(data.as_ref())
}
```

### 5. Criterion microbenchmarks

```toml
# Cargo.toml
[dev-dependencies]
criterion = { version = "0.5", features = ["html_reports"] }

[[bench]]
name = "my_bench"
harness = false
```

```rust
// benches/my_bench.rs
use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};

fn bench_process(c: &mut Criterion) {
    // Simple benchmark
    c.bench_function("process 1000 items", |b| {
        let data: Vec<i32> = (0..1000).collect();
        b.iter(|| process(black_box(&data)))  // black_box prevents optimization
    });
}

fn bench_sizes(c: &mut Criterion) {
    let mut group = c.benchmark_group("process_sizes");

    for size in [100, 1000, 10000].iter() {
        let data: Vec<i32> = (0..*size).collect();
        group.bench_with_input(
            BenchmarkId::from_parameter(size),
            &data,
            |b, data| b.iter(|| process(black_box(data))),
        );
    }
    group.finish();
}

criterion_group!(benches, bench_process, bench_sizes);
criterion_main!(benches);
```

```bash
# Run all benchmarks
cargo bench

# Run specific benchmark
cargo bench --bench my_bench

# Run with filter
cargo bench -- process_sizes

# Compare with baseline (save/load)
cargo bench -- --save-baseline before
# make changes
cargo bench -- --baseline before

# View HTML report
open target/criterion/report/index.html
```

### 6. perf with Rust (Linux)

```bash
# Record
perf record -g ./target/release-with-debug/myapp args
perf record -g -F 999 ./target/release-with-debug/myapp args  # higher freq

# Report
perf report                     # interactive TUI
perf report --stdio --no-call-graph | head -40   # text

# Annotate specific function
perf annotate myapp::hot_function

# stat (quick counters)
perf stat ./target/release/myapp args
```

Rust-specific perf tips:
- Build with `debug = 1` (line tables only) for faster builds with line-level attribution
- Use `RUSTFLAGS="-C force-frame-pointers=yes"` for better call graphs without DWARF unwinding
- Disable ASLR for reproducible addresses: `setarch $(uname -m) -R ./myapp`

### 7. heaptrack / DHAT for allocations

```bash
# heaptrack (Linux)
heaptrack ./target/release/myapp args
heaptrack_print heaptrack.myapp.*.zst | head -50

# DHAT via Valgrind
valgrind --tool=dhat ./target/debug/myapp args
# Open dhat-out.* with dh_view.html
```

For flamegraph setup and Criterion configuration, see [references/cargo-flamegraph-setup.md](references/cargo-flamegraph-setup.md).

## Related skills

- Use `skills/rust/rustc-basics` for build configuration (debug symbols, profiles)
- Use `skills/profilers/linux-perf` for perf fundamentals
- Use `skills/profilers/flamegraphs` for reading and interpreting flamegraph SVGs
- Use `skills/profilers/valgrind` for allocation profiling with massif/DHAT
