---
name: rust-debugging
description: Rust debugging skill for systems programming. Use when debugging Rust binaries with GDB or LLDB, enabling Rust pretty-printers, interpreting panics and backtraces, debugging async/await with tokio-console, stepping through no_std code, or using dbg! and tracing macros effectively. Activates on queries about rust-gdb, rust-lldb, RUST_BACKTRACE, Rust panics, debugging async Rust, tokio-console, or pretty-printers.
---

# Rust Debugging

## Purpose

Guide agents through debugging Rust programs: GDB/LLDB with Rust pretty-printers, backtrace configuration, panic triage, async debugging with tokio-console, and `#[no_std]` debugging strategies.

## Triggers

- "How do I use GDB/LLDB to debug a Rust binary?"
- "How do I get a full backtrace from a Rust panic?"
- "How do I debug async Rust / Tokio?"
- "Rust pretty-printers aren't working in GDB"
- "How do I debug a Rust panic in production?"
- "How do I use dbg! and tracing in Rust?"

## Workflow

### 1. Build for debugging

```bash
# Debug build (default) — full debug info, no optimization
cargo build

# Release with debug info (for profiling real workloads)
cargo build --release --profile release-with-debug
# Or configure in Cargo.toml:
# [profile.release-with-debug]
# inherits = "release"
# debug = true

# Run directly
cargo run
cargo run -- arg1 arg2
```

### 2. GDB with Rust pretty-printers

```bash
# Use rust-gdb wrapper (sets up pretty-printers automatically)
rust-gdb target/debug/myapp

# Or set up manually in ~/.gdbinit:
# python
# import subprocess, sys
# ...
```

Common GDB session for Rust:
```gdb
# Basic
(gdb) break main
(gdb) run arg1 arg2
(gdb) next           # step over
(gdb) step           # step into
(gdb) continue

# Rust-aware inspection
(gdb) print my_string     # Shows String content via pretty-printer
(gdb) print my_vec        # Shows Vec elements
(gdb) print my_option     # Shows Some(value) or None
(gdb) info locals

# Break on panic
(gdb) break rust_panic
(gdb) break core::panicking::panic

# Backtrace
(gdb) bt              # Short backtrace
(gdb) bt full         # Full with locals
```

### 3. LLDB with Rust pretty-printers

```bash
# Use rust-lldb wrapper
rust-lldb target/debug/myapp

# Manual setup
lldb target/debug/myapp
(lldb) command script import /path/to/rust/lib/rustlib/etc/lldb_lookup.py
(lldb) command source /path/to/rust/lib/rustlib/etc/lldb_commands
```

Common LLDB session:
```lldb
(lldb) b main::main
(lldb) r arg1 arg2
(lldb) n              # next (step over)
(lldb) s              # step into
(lldb) c              # continue
(lldb) frame variable # show locals
(lldb) p my_string    # print variable with pretty-printer
(lldb) bt             # backtrace
(lldb) bt all         # all threads
```

### 4. Backtrace configuration

```bash
# Short backtrace (default on panic)
RUST_BACKTRACE=1 ./myapp

# Full backtrace with all frames
RUST_BACKTRACE=full ./myapp

# With symbols (requires debug build or separate debug info)
RUST_BACKTRACE=full ./target/debug/myapp

# Capture backtrace programmatically
use std::backtrace::Backtrace;
let bt = Backtrace::capture();
eprintln!("{bt}");
```

For release binaries, keep debug symbols in a separate file:
```bash
# Build release with debug info
cargo build --release
objcopy --only-keep-debug target/release/myapp target/release/myapp.debug
strip --strip-debug target/release/myapp
objcopy --add-gnu-debuglink=target/release/myapp.debug target/release/myapp
```

### 5. Panic triage

```rust
// Set a custom panic hook for structured logging
use std::panic;

panic::set_hook(Box::new(|info| {
    let backtrace = std::backtrace::Backtrace::force_capture();
    eprintln!("PANIC: {info}");
    eprintln!("{backtrace}");
    // Log to file, send to Sentry, etc.
}));
```

Common panic patterns:
| Panic message | Likely cause |
|---------------|-------------|
| `index out of bounds: the len is N but the index is M` | Array/vec OOB access |
| `called Option::unwrap() on a None value` | Unwrap on None |
| `called Result::unwrap() on an Err value` | Unwrap on error |
| `attempt to subtract with overflow` | Integer underflow (debug build) |
| `assertion failed` | Failed `assert!` or `assert_eq!` |
| `stack overflow` | Infinite recursion |

Use `panic = "abort"` in release to get a crash dump instead of unwind.

### 6. The dbg! macro

```rust
// dbg! prints file, line, value and returns the value
let result = dbg!(some_computation(x));
// prints: [src/main.rs:15] some_computation(x) = 42

// Chain multiple values
let (a, b) = dbg!((compute_a(), compute_b()));

// Inspect inside iterator chains
let sum: i32 = (0..10)
    .filter(|x| dbg!(x % 2 == 0))
    .map(|x| dbg!(x * x))
    .sum();
```

### 7. Structured logging with tracing

```toml
[dependencies]
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
```

```rust
use tracing::{debug, error, info, instrument, warn};

#[instrument]  // Auto-traces function entry/exit with arguments
fn process(id: u64, data: &str) -> Result<(), Error> {
    debug!("Processing item");
    info!(item_id = id, "Started processing");

    if data.is_empty() {
        warn!(item_id = id, "Empty data");
        return Err(Error::EmptyData);
    }

    error!(item_id = id, err = ?some_result, "Failed");
    Ok(())
}

// Initialize in main
tracing_subscriber::fmt()
    .with_env_filter("myapp=debug,warn")
    .init();
```

```bash
# Control log levels at runtime
RUST_LOG=debug ./myapp
RUST_LOG=myapp::module=trace,warn ./myapp
```

### 8. Async debugging with tokio-console

```toml
[dependencies]
console-subscriber = "0.3"
tokio = { version = "1", features = ["full", "tracing"] }
```

```rust
// In main
console_subscriber::init();
```

```bash
# Install and run tokio-console
cargo install tokio-console
tokio-console  # Connects to running Rust process at port 6669
```

tokio-console shows: task states, waker activity, blocked tasks, poll durations.

For GDB/LLDB command reference and pretty-printer setup, see [references/rust-gdb-pretty-printers.md](references/rust-gdb-pretty-printers.md).

## Related skills

- Use `skills/rust/rustc-basics` for debug info flags and build configuration
- Use `skills/debuggers/gdb` for GDB fundamentals
- Use `skills/debuggers/lldb` for LLDB fundamentals
- Use `skills/rust/rust-sanitizers-miri` for memory safety and undefined behaviour
