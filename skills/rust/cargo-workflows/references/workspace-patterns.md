# Cargo Workspace Patterns Reference

## Workspace Dependency Management

### Centralizing versions

```toml
# Root Cargo.toml
[workspace.dependencies]
# Pin all workspace members to same versions
tokio = { version = "1.35", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
tracing = "0.1"
anyhow = "1.0"
thiserror = "1.0"

[workspace.package]
version = "0.1.0"
edition = "2021"
authors = ["team@example.com"]
license = "MIT OR Apache-2.0"
repository = "https://github.com/org/repo"
```

```toml
# Member Cargo.toml
[package]
name = "myapp-core"
version.workspace = true
edition.workspace = true
authors.workspace = true
license.workspace = true

[dependencies]
tokio.workspace = true         # Inherit, including features
serde = { workspace = true, features = ["derive"] }  # Can add features
```

## Feature Resolution (resolver = "2")

With `resolver = "2"` (required in edition 2021 workspaces):

```toml
[workspace]
resolver = "2"
```

- Build deps, dev-deps, and regular deps get independent feature resolution
- Prevents a dev-only dependency from enabling features in prod builds
- `target.cfg()` conditional features respected independently

## Virtual Manifest Pattern

A workspace without its own `[package]` — just orchestrates members:

```toml
# Root Cargo.toml (virtual manifest)
[workspace]
members = ["crates/*", "tools/*"]
resolver = "2"

[workspace.package]
version = "0.1.0"
edition = "2021"

[profile.release]
lto = "thin"
```

Useful for monorepos where the root is not a published crate.

## Path vs Registry Dependencies

```toml
[dependencies]
# Path (local development)
mylib = { path = "../mylib" }

# Registry (published)
mylib = { version = "1.0" }

# Git (unpublished / fork)
mylib = { git = "https://github.com/user/mylib", branch = "main" }
mylib = { git = "https://github.com/user/mylib", rev = "abc1234" }

# Override registry dep with local path (for development)
# In root Cargo.toml:
[patch.crates-io]
serde = { path = "../my-serde-fork" }
```

## Selective Build Commands

```bash
# Build only specific workspace member
cargo build -p myapp-core
cargo build -p myapp-cli --release

# Test specific member
cargo test -p myapp-core

# Test all members
cargo test --workspace

# Build all members
cargo build --workspace

# Exclude member
cargo build --workspace --exclude myapp-codegen
```

## Cargo.lock Management

```bash
# Libraries: Cargo.lock in .gitignore (let users choose versions)
# Applications: Cargo.lock in version control (reproducible builds)

# Generate deterministic lock file
cargo generate-lockfile

# Update single dep
cargo update -p tokio --precise 1.35.1

# Show what would change
cargo update --dry-run
```

## CI Configuration Patterns

### GitHub Actions matrix

```yaml
strategy:
  matrix:
    rust: [stable, beta, nightly]
    os: [ubuntu-latest, macos-latest, windows-latest]

steps:
  - uses: dtolnay/rust-toolchain@master
    with:
      toolchain: ${{ matrix.rust }}
      components: rustfmt, clippy

  - uses: Swatinem/rust-cache@v2

  - run: cargo check --workspace --all-features
  - run: cargo test --workspace
  - run: cargo clippy --workspace -- -D warnings
  - run: cargo fmt --check
```

### MSRV (minimum supported Rust version)

```toml
[package]
rust-version = "1.70"   # MSRV declaration

[workspace.package]
rust-version = "1.70"
```

```bash
# Test against MSRV
rustup install 1.70
cargo +1.70 check --workspace
```

## Published Crate Checklist

```toml
[package]
name = "mycrate"
version = "1.0.0"
edition = "2021"
description = "Short description"
license = "MIT OR Apache-2.0"
repository = "https://github.com/..."
documentation = "https://docs.rs/mycrate"
readme = "README.md"
keywords = ["systems", "async"]
categories = ["network-programming"]
exclude = ["tests/fixtures/**", ".github/**"]
```

```bash
# Verify what will be published
cargo package --list

# Dry run publish
cargo publish --dry-run

# Publish to crates.io
cargo publish
```
