---
name: cargo-workflows
description: Cargo workflow skill for Rust projects. Use when managing workspaces, feature flags, build scripts, cargo cache, incremental builds, dependency auditing, or CI configuration with Cargo. Activates on queries about cargo workspaces, Cargo.toml features, build.rs, cargo nextest, cargo deny, cargo check vs build, or Cargo.lock management.
user-invocable: true
triggers:
  - cargo workspace setup
  - feature flags in Cargo.toml
  - build.rs script
  - cargo nextest
  - cargo deny audit
  - cargo incremental build
  - manage Cargo.lock
  - CI config for Rust with Cargo
---

# Cargo Workflows

## Purpose

Guide agents through Cargo workspaces, feature management, build scripts (`build.rs`), CI integration, incremental compilation, and the Cargo tool ecosystem.

## Triggers

- "How do I set up a Cargo workspace with multiple crates?"
- "How do features work in Cargo?"
- "How do I write a build.rs script?"
- "How do I speed up Cargo builds in CI?"
- "How do I audit my Rust dependencies?"
- "What is cargo nextest and should I use it?"

## Workflow

### 1. Workspace setup

```text
my-project/
├── Cargo.toml           # Workspace root
├── Cargo.lock           # Single lock file for all members
├── crates/
│   ├── core/
│   │   └── Cargo.toml
│   ├── cli/
│   │   └── Cargo.toml
│   └── server/
│       └── Cargo.toml
└── tools/
    └── codegen/
        └── Cargo.toml
```

```toml
# Workspace root Cargo.toml
[workspace]
members = [
    "crates/core",
    "crates/cli",
    "crates/server",
    "tools/codegen",
]
resolver = "3"   # MSRV-aware resolver; edition 2024 default, but virtual workspaces must set it

# Shared dependency versions (workspace.dependencies)
[workspace.dependencies]
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
anyhow = "1"

# Shared profile settings
[profile.release]
lto = "thin"
codegen-units = 1
```

```toml
# Member Cargo.toml
[package]
name = "myapp-core"
version.workspace = true
edition.workspace = true

[dependencies]
serde.workspace = true    # Inherit from workspace
anyhow.workspace = true
```

### 2. Feature flags

```toml
[features]
default = ["std"]

# Simple flag
std = []

# Feature that enables another feature
full = ["std", "async", "serde-support"]

# Feature with optional dependency
async = ["dep:tokio"]
serde-support = ["dep:serde", "serde/derive"]

[dependencies]
tokio = { version = "1", optional = true }
serde = { version = "1", optional = true }
```

```bash
# Build with specific features
cargo build --features "async,serde-support"

# Build with no default features
cargo build --no-default-features

# Build with all features
cargo build --all-features

# Check feature combinations
cargo check --no-default-features
cargo check --all-features
```

Feature gotchas:

- Features are additive: once enabled anywhere in the dependency graph, they stay enabled
- `resolver = "2"` prevents feature leakage between dev-dependencies and regular deps
- Use `dep:optional_dep` syntax (edition 2021) to avoid implicit feature creation

### 3. Build scripts (build.rs)

```rust
// build.rs (at crate root, runs before compilation)
use std::env;
use std::path::PathBuf;

fn main() {
    // Re-run if these files change
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=wrapper.h");
    println!("cargo:rerun-if-env-changed=MY_LIB_PATH");

    // Link a system library
    println!("cargo:rustc-link-lib=mylib");
    println!("cargo:rustc-link-search=/usr/local/lib");

    // Pass a cfg flag to Rust code
    let target = env::var("TARGET").unwrap();
    if target.contains("linux") {
        println!("cargo:rustc-cfg=target_os_linux");
    }

    // Set environment variable for downstream crates
    println!("cargo:rustc-env=MY_GENERATED_VAR=value");

    // Generate bindings with bindgen
    let bindings = bindgen::Builder::default()
        .header("wrapper.h")
        .generate()
        .expect("Unable to generate bindings");

    let out_path = PathBuf::from(env::var("OUT_DIR").unwrap());
    bindings.write_to_file(out_path.join("bindings.rs")).unwrap();
}
```

| `println!` directive | Effect |
|---------------------|--------|
| `cargo:rerun-if-changed=FILE` | Re-run build script if file changes |
| `cargo:rerun-if-env-changed=VAR` | Re-run if env var changes |
| `cargo:rustc-link-lib=NAME` | Link library |
| `cargo:rustc-link-search=PATH` | Add library search path |
| `cargo:rustc-cfg=FLAG` | Enable `#[cfg(FLAG)]` in code |
| `cargo:rustc-env=KEY=VAL` | Set `env!("KEY")` at compile time |
| `cargo:warning=MSG` | Emit build warning |

### 4. Incremental builds and CI caching

```yaml
# GitHub Actions with sccache
- uses: Swatinem/rust-cache@v2
  with:
    cache-on-failure: true
    shared-key: "release-build"

# Or manual cache
- uses: actions/cache@v3
  with:
    path: |
      ~/.cargo/registry/index/
      ~/.cargo/registry/cache/
      ~/.cargo/git/db/
      target/
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
```

```bash
# Warm cache locally
cargo fetch                    # Download all deps without building
cargo build --tests            # Build everything including test bins

# Check if incremental hurts release builds (it often does)
[profile.release]
incremental = false            # Default; leave false for release
```

### 5. cargo nextest (faster test runner)

```bash
# Install
cargo install cargo-nextest

# Run tests (parallel by default, better output)
cargo nextest run

# Run with specific filter
cargo nextest run test_name_pattern

# List tests without running
cargo nextest list

# Use in CI (JUnit output)
cargo nextest run --profile ci
```

`nextest.toml`:

```toml
[profile.ci]
fail-fast = false
test-threads = "num-cpus"
retries = { backoff = "exponential", count = 2, delay = "1s" }

[profile.default]
test-threads = "num-cpus"
```

### 6. Dependency management and auditing

```bash
# Check for security advisories
cargo install cargo-audit
cargo audit

# Deny specific licenses, duplicates, advisories
cargo install cargo-deny
cargo deny check

# Check for unused dependencies
cargo install cargo-machete
cargo machete

# Update dependencies
cargo update                    # Update to compatible versions
cargo update -p serde           # Update single package
cargo upgrade                   # Update to latest (cargo-edit)
```

`deny.toml`:

```toml
[licenses]
allow = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause"]
deny = ["GPL-2.0", "AGPL-3.0"]

[bans]
multiple-versions = "warn"
deny = [{ name = "openssl", reason = "Use rustls instead" }]

[advisories]
ignore = []  # List advisory IDs to ignore
```

### 7. Useful cargo commands

```bash
# Build only specific binary
cargo build --bin myapp

# Build only specific example
cargo build --example myexample

# Run with arguments
cargo run -- --flag arg1 arg2

# Expand macros (for debugging proc macros)
cargo install cargo-expand
cargo expand module::path

# Tree of dependencies
cargo tree
cargo tree --duplicates      # Show crates with multiple versions
cargo tree -i serde          # Who depends on serde?

# Cargo.toml metadata
cargo metadata --format-version 1 | jq '.packages[].name'
```

For workspace patterns and dependency resolution details, see [references/workspace-patterns.md](references/workspace-patterns.md).

### 8. Edition 2024 migration

Edition 2024 (Rust 1.85+) is the default for `cargo new`. Migrate one crate at a time, and one
edition at a time: `cargo fix --edition` only prepares for the *next* edition, so a 2018 crate goes
2018 → 2021 → 2024, repeating the steps below for each hop.

```bash
# 1. Apply automatic fixes while still on the old edition.
#    Cover every feature and platform you support: code behind a disabled
#    feature or another target's cfg is not seen.
cargo fix --edition --all-targets --all-features
cargo fix --edition --all-targets --all-features --target aarch64-unknown-linux-gnu  # per extra target

# 2. Bump the edition in that crate's Cargo.toml (resolver = "3" in a virtual workspace)

# 3. Build and fix what cargo fix could not, for the same feature/target matrix
cargo check --all-targets --all-features
cargo check --all-targets --all-features --target aarch64-unknown-linux-gnu
```

If some features are mutually exclusive, replace `--all-features` with each supported
`--features` combination.

If members inherit `edition.workspace = true`, changing `[workspace.package] edition` moves all of
them at once. During the migration set `edition = "2024"` per member as each is fixed, then switch
the shared value once every inheriting member builds.

Review what `cargo fix` generated: it wraps `std::env::set_var`/`remove_var` calls in `unsafe { }`
without proving they are sound. These are only safe while no other thread reads or writes the
environment; if you cannot guarantee that, restructure (set variables before spawning threads, or
pass configuration explicitly) instead of keeping the block.

| Change in 2024 | Old code | Fix |
|----------------|----------|-----|
| `extern` blocks must be unsafe | `extern "C" { fn f(); }` | `unsafe extern "C" { fn f(); }`; mark safe items `safe fn` |
| Unsafe attributes | `#[no_mangle]`, `#[export_name]`, `#[link_section]` | `#[unsafe(no_mangle)]` etc. |
| `unsafe fn` body is not an unsafe context | `unsafe fn f(p: *const u8) -> u8 { *p }` | Wrap operations in `unsafe { }` (lint warns) |
| References to `static mut` | `let r = &COUNTER;` | Error; use `&raw const COUNTER`, atomics, or `UnsafeCell` |
| `std::env::set_var` / `remove_var` | Safe call | Now `unsafe`; only sound with no concurrent env access (audit `cargo fix` output) |
| `gen` is reserved | `let gen = 1;` | Rename or use `r#gen` |
| RPIT captures all in-scope lifetimes | `-> impl Iterator` borrowing an argument | Usually just works; restrict with `+ use<>` |
| Default resolver `"3"` | `resolver = "2"` | MSRV-aware: needs `rust-version` to pick compatible deps |

The `unsafe extern` and `#[unsafe(...)]` spellings are accepted from Rust 1.82 on every edition. Use them
unconditionally in crates that must build on both.

## Related skills

- Use `skills/rust/rustc-basics` for compiler flags and profile configuration
- Use `skills/rust/rust-debugging` for debugging Cargo-built binaries
- Use `skills/rust/rust-ffi` for `build.rs` with C library bindings
- Use `skills/build-systems/cmake` when integrating Rust into a CMake build
