# cargo-flamegraph Setup and Criterion Reference

## cargo-flamegraph Setup

### Linux Prerequisites

```bash
# Install perf
sudo apt-get install linux-tools-common linux-tools-$(uname -r)  # Debian/Ubuntu
sudo dnf install perf                                              # Fedora
sudo pacman -S perf                                                # Arch

# Allow perf for current user (choose one)
sudo sh -c 'echo 1 > /proc/sys/kernel/perf_event_paranoid'   # Temp
echo 'kernel.perf_event_paranoid = 1' | sudo tee -a /etc/sysctl.d/perf.conf  # Permanent
sudo sysctl -p /etc/sysctl.d/perf.conf

# Allow kernel symbols
sudo sh -c 'echo 0 > /proc/sys/kernel/kptr_restrict'
```

### macOS Prerequisites

DTrace is used on macOS. Requires full disk access and SIP considerations:

```bash
# Check DTrace works
sudo dtrace -n 'BEGIN { exit(0); }'

# If SIP-restricted, boot into recovery and:
# csrutil enable --without dtrace
```

### Installation

```bash
cargo install flamegraph

# Dependencies for flamegraph script
# Linux: inferno (default, pure Rust)
# Or install Brendan Gregg's scripts:
git clone https://github.com/brendangregg/FlameGraph
export PATH="$PATH:/path/to/FlameGraph"
```

### Usage Patterns

```bash
# Profile binary with args
cargo flamegraph --bin myapp -- --workers 4 --input data.bin

# Profile specific test
cargo flamegraph --test integration_tests -- test_name

# Profile benchmark (compare with criterion)
cargo flamegraph --bench my_bench -- --bench benchmark_name

# Profile example
cargo flamegraph --example my_example

# Custom frequency (samples/sec, higher = more accurate, more overhead)
cargo flamegraph --freq 997 --bin myapp   # 997 Hz avoids aliasing

# Output to specific file
cargo flamegraph -o profile.svg --bin myapp

# Open in browser automatically
cargo flamegraph -o /tmp/fg.svg --bin myapp && xdg-open /tmp/fg.svg
```

### Reading Flamegraphs

```
Wide frames  = more CPU time
Tall stacks  = deep call chains
Plateau tops = actual CPU time spent there

x-axis: NOT time, it's alphabetical within each stack level
y-axis: call stack depth (bottom = first called)
```

Look for:
- Wide frames near the top (hot leaves — where CPU actually spends time)
- Unexpected std/alloc frames (excessive allocation)
- Many thin `<closure>` frames (closure overhead in tight loops)

## Criterion Reference

### Benchmark Structure

```rust
use criterion::{
    black_box, criterion_group, criterion_main,
    Criterion, BenchmarkId, Throughput,
};
use std::time::Duration;

fn bench_throughput(c: &mut Criterion) {
    let mut group = c.benchmark_group("throughput");

    // Set measurement time and sample count
    group.measurement_time(Duration::from_secs(10));
    group.sample_size(100);

    for size in [1024usize, 4096, 65536] {
        let data = vec![0u8; size];

        // Report throughput in bytes/sec
        group.throughput(Throughput::Bytes(size as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(size),
            &data,
            |b, data| b.iter(|| process(black_box(data))),
        );
    }
    group.finish();
}
```

### Statistical Configuration

```rust
fn configure(c: &mut Criterion) -> &mut Criterion {
    c.measurement_time(Duration::from_secs(10))  // How long to measure
     .sample_size(200)                            // Number of iterations to sample
     .warm_up_time(Duration::from_secs(3))        // Warm-up before measurement
     .noise_threshold(0.05)                       // 5% noise threshold
     .significance_level(0.05)                    // p-value threshold
     .confidence_level(0.95)                      // Confidence interval width
}
```

### Custom Measurement (wall vs CPU time)

```rust
use criterion::measurement::WallTime;

// Default is WallTime. For CPU-intensive without I/O, it's usually fine.
// For async benchmarks, use tokio's runtime:

fn bench_async(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    c.bench_function("async_op", |b| {
        b.to_async(&rt).iter(|| async_operation())
    });
}
```

### Comparing Results

```bash
# Save baseline
cargo bench -- --save-baseline main-branch

# Switch branch and compare
git checkout my-feature
cargo bench -- --baseline main-branch
```

Output shows:
```
process/1024            time:   [12.345 µs 12.456 µs 12.567 µs]
                        change: [-5.2312% -4.8956% -4.5600%] (p = 0.00 < 0.05)
                        Performance has improved.
```

### Criterion with Async (Tokio)

```toml
[dev-dependencies]
criterion = { version = "0.5", features = ["async_tokio"] }
tokio = { version = "1", features = ["full"] }
```

```rust
use criterion::async_executor::TokioExecutor;

fn bench_async(c: &mut Criterion) {
    c.bench_function("async_fn", |b| {
        b.to_async(TokioExecutor).iter(|| async {
            async_fn(black_box(42)).await
        })
    });
}
```
