---
name: rustc-basics
description: Rust compiler skill for systems programming. Use when selecting RUSTFLAGS, configuring Cargo profiles, tuning release builds, reading assembly or MIR output, understanding monomorphization, or diagnosing compilation errors. Activates on queries about rustc flags, Cargo.toml profiles, opt-level, LTO, codegen-units, target-cpu, emit asm, MIR, or Rust build performance.
---

# rustc Basics

## Purpose

Guide agents through Rust compiler invocation: RUSTFLAGS, Cargo profile configuration, build modes, MIR and assembly inspection, monomorphization, and common compilation error patterns.

## Triggers

- "How do I configure a release build in Rust for maximum performance?"
- "How do I see the assembly output for a Rust function?"
- "What is monomorphization and why is it making my compile slow?"
- "How do I enable LTO in Rust?"
- "My Rust binary is too large — how do I shrink it?"
- "How do I read Rust MIR output?"

## Workflow

### 1. Choose a build mode

```bash
# Debug (default) — fast compile, no optimization, debug info
cargo build

# Release — optimized, no debug info by default
cargo build --release

# Check only (fastest, no codegen)
cargo check

# Build for specific target
cargo build --release --target aarch64-unknown-linux-gnu
```

### 2. Cargo.toml profile configuration

```toml
[profile.release]
opt-level = 3          # 0-3, "s" (size), "z" (aggressive size)
debug = false          # true = full, 1 = line tables only, 0 = none
lto = "thin"           # false | "thin" | true (fat LTO)
codegen-units = 1      # 1 = max optimization, higher = faster compile
panic = "abort"        # "unwind" (default) | "abort" (smaller binary)
strip = "symbols"      # "none" | "debuginfo" | "symbols"
overflow-checks = false # default true in debug, false in release

[profile.release-with-debug]
inherits = "release"
debug = true           # release build with debug symbols
strip = "none"

[profile.dev]
opt-level = 1          # Speed up debug builds slightly
```

| Setting | Impact |
|---------|--------|
| `lto = true` (fat) | Best optimization, slowest link |
| `lto = "thin"` | Good optimization, parallel link |
| `codegen-units = 1` | Best inlining, slower compile |
| `panic = "abort"` | Removes unwind tables, smaller binary |
| `opt-level = "z"` | Aggressive size reduction |

### 3. RUSTFLAGS

```bash
# Set for a single build
RUSTFLAGS="-C target-cpu=native" cargo build --release

# Enable all target CPU features
RUSTFLAGS="-C target-cpu=native -C target-feature=+avx2,+bmi2" cargo build --release

# Control codegen at invocation level
RUSTFLAGS="-C opt-level=3 -C codegen-units=1 -C lto=on" cargo build --release
```

Persistent in `.cargo/config.toml`:
```toml
[build]
rustflags = ["-C", "target-cpu=native"]

[target.x86_64-unknown-linux-gnu]
rustflags = ["-C", "target-cpu=native", "-C", "link-arg=-fuse-ld=lld"]
```

### 4. Inspect assembly output

```bash
# Using cargo-show-asm (recommended)
cargo install cargo-show-asm
cargo asm --release 'myapp::module::function_name'

# Using rustc directly
rustc --emit=asm -C opt-level=3 -C target-cpu=native src/lib.rs
cat lib.s

# View MIR (mid-level IR, before codegen)
rustc --emit=mir -C opt-level=3 src/lib.rs
cat lib.mir

# View LLVM IR
rustc --emit=llvm-ir -C opt-level=3 src/lib.rs
cat lib.ll

# Use Compiler Explorer (Godbolt) patterns locally
RUSTFLAGS="--emit=asm" cargo build --release
find target/ -name "*.s"
```

### 5. Understand monomorphization

Rust generics are monomorphized — each concrete type instantiation produces separate code. This causes:
- Binary size bloat
- Longer compile times
- Potential i-cache pressure

```bash
# Measure monomorphization bloat
cargo install cargo-llvm-lines
cargo llvm-lines --release | head -30

# Shows: lines of LLVM IR per function (monomorphized copies visible)
```

Mitigation strategies:
```rust
// 1. Type erasure with dyn Trait (trades monomorphization for dispatch)
fn process(iter: &mut dyn Iterator<Item = i32>) { ... }

// 2. Non-generic inner function pattern
fn my_generic<T: AsRef<str>>(s: T) {
    fn inner(s: &str) { /* actual work */ }
    inner(s.as_ref())  // monomorphization only in thin wrapper
}
```

### 6. Binary size reduction

```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
panic = "abort"
strip = "symbols"
```

```bash
# Check binary size breakdown
cargo install cargo-bloat
cargo bloat --release --crates      # per-crate size
cargo bloat --release -n 20         # top 20 largest functions

# Compress executable (at cost of startup time)
upx --best --lzma target/release/myapp
```

### 7. Common error triage

| Error | Cause | Fix |
|-------|-------|-----|
| `cannot find function in this scope` | Missing `use` or wrong module path | Add `use crate::module::fn_name` |
| `the trait X is not implemented for Y` | Missing impl or wrong generic bound | Implement trait or adjust bounds |
| `lifetime may not live long enough` | Borrow checker lifetime issue | Add explicit lifetime annotations |
| `cannot borrow as mutable because also borrowed as immutable` | Aliasing violation | Restructure borrows to not overlap |
| `use of moved value` | Value used after `move` into closure or function | Use `.clone()` or borrow instead |
| `mismatched types: expected &str found String` | String vs &str confusion | Use `.as_str()` or `&my_string` |

### 8. Useful rustc flags

```bash
# Show all enabled features at a given opt level
rustc -C opt-level=3 --print cfg

# List available targets
rustc --print target-list

# Show target-specific features
rustc --print target-features --target x86_64-unknown-linux-gnu

# Explain an error code
rustc --explain E0382
```

For RUSTFLAGS reference and Cargo profile patterns, see [references/rustflags-profiles.md](references/rustflags-profiles.md).

## Related skills

- Use `skills/rust/cargo-workflows` for workspace management and Cargo tooling
- Use `skills/rust/rust-debugging` for debugging Rust binaries with GDB/LLDB
- Use `skills/rust/rust-profiling` for profiling and flamegraphs
- Use `skills/rust/rust-sanitizers-miri` for memory safety validation
