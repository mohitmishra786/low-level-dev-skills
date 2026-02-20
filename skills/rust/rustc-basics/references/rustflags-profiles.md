# RUSTFLAGS and Cargo Profiles Reference

## RUSTFLAGS Complete Reference

### Codegen flags (-C)

| Flag | Values | Effect |
|------|--------|--------|
| `-C opt-level=N` | `0`-`3`, `s`, `z` | Optimization level |
| `-C target-cpu=X` | `native`, `x86-64`, `x86-64-v3`... | Target CPU |
| `-C target-feature=+X` | `+avx2`, `+bmi2`, `+aes`... | Enable CPU features |
| `-C lto=X` | `off`, `thin`, `fat` | LTO mode |
| `-C codegen-units=N` | `1`-`N` | Parallel codegen units |
| `-C panic=X` | `unwind`, `abort` | Panic strategy |
| `-C debuginfo=N` | `0`, `1`, `2` | Debug info level |
| `-C strip=X` | `none`, `debuginfo`, `symbols` | Strip output |
| `-C link-arg=X` | any linker flag | Pass flag to linker |
| `-C linker=X` | `lld`, `gold`, `mold` | Linker to use |
| `-C overflow-checks=X` | `yes`, `no` | Integer overflow checks |
| `-C force-frame-pointers=X` | `yes`, `no` | Frame pointer emission |
| `-C embed-bitcode=X` | `yes`, `no` | Embed LLVM bitcode (for LTO) |
| `-C relocation-model=X` | `static`, `pic`, `pie` | Relocation model |
| `-C code-model=X` | `tiny`, `small`, `large` | Code model |

### Emit flags (--emit)

```bash
# Multiple outputs
rustc --emit=asm,llvm-ir,mir src/lib.rs

# In cargo:
RUSTFLAGS="--emit=asm" cargo build --release
```

| `--emit` value | Output |
|----------------|--------|
| `asm` | Native assembly `.s` |
| `llvm-ir` | LLVM IR `.ll` |
| `llvm-bc` | LLVM bitcode `.bc` |
| `mir` | MIR text `.mir` |
| `metadata` | `.rmeta` crate metadata |
| `link` | Final linked artifact (default) |
| `dep-info` | `.d` Makefile dependency |

## Cargo Profile Options (Complete)

```toml
[profile.release]
# Optimization
opt-level = 3                    # 0|1|2|3|"s"|"z"
lto = "thin"                     # false|"thin"|true
codegen-units = 1                # integer

# Debug information
debug = 0                        # false|0|"line-directives-only"|"line-tables-only"|1|true|2|"full"
debug-assertions = false         # bool
split-debuginfo = "off"          # "off"|"packed"|"unpacked"

# Runtime behavior
panic = "abort"                  # "unwind"|"abort"
overflow-checks = false          # bool
rpath = false                    # bool

# Output
strip = "none"                   # "none"|"debuginfo"|"symbols"
incremental = false              # bool

# Build performance
build-override = {}              # Override for build scripts
```

## Profile Inheritance

```toml
# Custom profiles must inherit from dev or release
[profile.production]
inherits = "release"
lto = true
codegen-units = 1
panic = "abort"
strip = "symbols"

[profile.staging]
inherits = "release"
debug = 1
strip = "none"
```

## Per-Package Profile Overrides

```toml
# Override profile for specific dependencies
[profile.release.package.serde]
opt-level = 3

[profile.dev.package."*"]
opt-level = 1    # Optimize all deps even in dev mode
```

## Common Configurations

### Maximum performance

```toml
[profile.release]
opt-level = 3
lto = true
codegen-units = 1
panic = "abort"
```

```toml
# .cargo/config.toml
[build]
rustflags = ["-C", "target-cpu=native"]
```

### Minimum binary size

```toml
[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
panic = "abort"
strip = "symbols"
```

### Fast CI builds

```toml
[profile.dev]
opt-level = 0
incremental = true

[profile.dev.package."*"]
opt-level = 1    # Compiled deps faster than test code
```

## Linker Configuration

```toml
# .cargo/config.toml

# Use mold (fastest linker)
[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=mold"]

# Use lld
[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=lld"]

# macOS with lld
[target.x86_64-apple-darwin]
rustflags = ["-C", "link-arg=-fuse-ld=/usr/local/bin/lld"]
```

## x86-64 Microarchitecture Levels

```bash
# Broadwell and newer (most cloud VMs)
RUSTFLAGS="-C target-cpu=x86-64-v3" cargo build --release

# Cascade Lake and newer (AVX-512)
RUSTFLAGS="-C target-cpu=x86-64-v4" cargo build --release

# Specific CPUs
RUSTFLAGS="-C target-cpu=skylake" cargo build --release
RUSTFLAGS="-C target-cpu=znver3" cargo build --release  # AMD Zen3
```
