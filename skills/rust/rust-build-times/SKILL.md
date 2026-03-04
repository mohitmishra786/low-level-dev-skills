---
name: rust-build-times
description: Rust build time optimization skill for reducing slow compilation. Use when using cargo-timings to profile builds, configuring sccache for Rust, using the Cranelift backend, splitting workspaces for parallelism, choosing between thin LTO and fat LTO, or using the mold linker with Rust. Activates on queries about slow Rust compilation, cargo-timings, sccache Rust, cranelift backend, Rust workspace splitting, LTO tradeoffs, or mold linker with Rust.
---

# Rust Build Times

## Purpose

Guide agents through diagnosing and improving Rust compilation speed: `cargo-timings` for build profiling, `sccache` for caching, the Cranelift codegen backend for faster dev builds, workspace crate splitting, LTO configuration trade-offs, and fast linkers (mold/lld).

## Triggers

- "My Rust project takes too long to compile"
- "How do I profile which crates are slow to build?"
- "How do I set up sccache for Rust?"
- "What is the Cranelift backend and how does it help?"
- "Should I use thin LTO or fat LTO?"
- "How do I use the mold linker with Rust?"

## Workflow

### 1. Diagnose with cargo-timings

```bash
# Build with timing report
cargo build --timings

# Opens build/cargo-timings/cargo-timing.html
# Shows: crate compilation timeline, parallelism, bottlenecks

# For release builds
cargo build --release --timings

# Key things to look for in the timing report:
# - Long sequential chains (no parallelism)
# - Individual crates taking > 10s (candidates for optimization)
# - Proc-macro crates blocking everything downstream
```

```bash
# cargo-llvm-lines — count LLVM IR lines per function (monomorphization)
cargo install cargo-llvm-lines
cargo llvm-lines --release | head -20
# Shows functions generating the most LLVM IR (template explosion)
```

### 2. sccache — compilation caching for Rust

```bash
# Install
cargo install sccache
# or: brew install sccache

# Configure for Rust builds
export RUSTC_WRAPPER=sccache

# Add to .cargo/config.toml (project or global)
# ~/.cargo/config.toml
[build]
rustc-wrapper = "sccache"

# Check cache stats
sccache --show-stats

# S3 backend for CI teams
export SCCACHE_BUCKET=my-rust-cache
export SCCACHE_REGION=us-east-1
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=yyy
sccache --start-server

# GitHub Actions with sccache
# - uses: mozilla-actions/sccache-action@v0.0.4
```

### 3. Cranelift codegen backend

Cranelift is a fast codegen backend (vs LLVM) — produces slower code but compiles much faster. Ideal for development builds:

```bash
# Install nightly (Cranelift requires nightly for now)
rustup toolchain install nightly
rustup component add rustc-codegen-cranelift-preview --toolchain nightly

# Use Cranelift for dev builds only
# .cargo/config.toml
[unstable]
codegen-backend = true

[profile.dev]
codegen-backend = "cranelift"
```

```bash
# Use per-build
CARGO_PROFILE_DEV_CODEGEN_BACKEND=cranelift \
RUSTFLAGS="-Zunstable-options" \
cargo +nightly build
```

Cranelift vs LLVM trade-off:
- Dev builds: 20–40% faster compilation with Cranelift
- Runtime performance: LLVM-compiled code is faster (Cranelift skips many optimizations)
- Release builds: always use LLVM

### 4. Workspace splitting for parallelism

A single large crate compiles sequentially. Split into smaller crates to enable Cargo parallelism:

```toml
# Before: one giant crate
[package]
name = "monolith"    # everything in one crate = sequential compile

# After: workspace with parallel crates
[workspace]
members = [
    "core",          # compiled in parallel
    "networking",    # no deps on ui → parallel with ui
    "ui",            # no deps on networking → parallel
    "server",        # depends on core + networking
    "cli",           # depends on core + ui
]
```

```bash
# Visualize dependency graph
cargo tree | head -30
cargo tree --graph | dot -Tsvg > deps.svg   # visual graph

# Check how many crates compile in parallel
cargo build -j$(nproc) --timings    # maximize parallelism
```

Rules for effective workspace splitting:
- Break circular dependencies first
- Separate proc-macros into their own crate (they block everything)
- Keep frequently-changed code isolated (less invalidation)

### 5. LTO configuration

LTO improves runtime performance but increases link time:

```toml
# Cargo.toml profile configuration
[profile.release]
lto = "thin"         # thin LTO: good performance, much faster than "fat"
codegen-units = 1    # needed for best optimization (but disables parallelism)

[profile.release-fast]
inherits = "release"
lto = "fat"          # full LTO: maximum performance, very slow link

[profile.dev]
lto = "off"          # never use LTO in dev (compilation speed)
codegen-units = 16   # maximize parallel codegen in dev
```

LTO comparison:

| Setting | Link time | Runtime perf | Use when |
|---------|-----------|-------------|---------|
| `lto = false` | Fast | Baseline | Dev builds |
| `lto = "thin"` | Moderate | +5–15% | Most release builds |
| `lto = "fat"` | Slow | +15–30% | Maximum performance |
| `codegen-units = 1` | Slowest | Best | With LTO for release |

### 6. Fast linkers

The linker is often the bottleneck for large Rust projects:

```bash
# mold — fastest general-purpose linker (Linux)
sudo apt-get install mold

# .cargo/config.toml
[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=mold"]

# Or use cargo-zigbuild (uses zig cc as linker)
cargo install cargo-zigbuild
cargo zigbuild --release

# lld — LLVM's linker (faster than GNU ld, available everywhere)
# .cargo/config.toml
[target.x86_64-unknown-linux-gnu]
rustflags = ["-C", "link-arg=-fuse-ld=lld"]

# On macOS: zld or the default lld
[target.x86_64-apple-darwin]
rustflags = ["-C", "link-arg=-fuse-ld=/usr/local/bin/zld"]
```

Linker speed comparison (large project, typical):
- GNU ld: baseline
- lld: ~2× faster
- mold: ~5–10× faster
- gold: ~1.5× faster

### 7. Other quick wins

```bash
# Reduce debug info level (faster but less debuggable)
# Cargo.toml
[profile.dev]
debug = 1           # 0=off, 1=line tables, 2=full (default)
# debug=1 saves 20-40% on debug build time

# Split debug info (reduces linker input)
[profile.dev]
split-debuginfo = "unpacked"   # macOS: equivalent of gsplit-dwarf

# Disable incremental compilation (sometimes faster for full rebuilds)
CARGO_INCREMENTAL=0 cargo build

# Reduce proc-macro compile time (pin heavy proc-macro deps)
# Heavy proc-macros: serde, tokio, axum — keep versions stable
```

## Related skills

- Use `skills/rust/cargo-workflows` for Cargo workspace and profile configuration
- Use `skills/build-systems/build-acceleration` for C/C++ equivalent build acceleration
- Use `skills/debuggers/dwarf-debug-format` for debug info size/split-dwarf tradeoffs
- Use `skills/binaries/linkers-lto` for LTO internals
