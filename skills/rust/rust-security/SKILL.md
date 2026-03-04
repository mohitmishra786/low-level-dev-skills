---
name: rust-security
description: Rust security skill for supply chain safety and memory-safe development. Use when auditing dependencies with cargo-audit, enforcing policies with cargo-deny, reviewing RUSTSEC advisories, writing memory-safe FFI patterns, or integrating fuzzing and Miri into a security review pipeline. Activates on queries about cargo-audit, cargo-deny, RUSTSEC advisories, supply chain security, Rust CVEs, safe FFI, or fuzzing for security.
---

# Rust Security

## Purpose

Guide agents through Rust security practices: dependency auditing with cargo-audit, policy enforcement with cargo-deny, RUSTSEC advisory database, memory-safe patterns for FFI, and combining fuzzing with Miri for security review.

## Triggers

- "How do I check my Rust dependencies for CVEs?"
- "How do I use cargo-audit?"
- "How do I enforce dependency policies in CI?"
- "What's the RUSTSEC advisory database?"
- "How do I write memory-safe FFI in Rust?"
- "How do I fuzz-test my Rust library for security bugs?"

## Workflow

### 1. cargo-audit — vulnerability scanning

```bash
# Install
cargo install cargo-audit --locked

# Scan current project
cargo audit

# Full output including ignored
cargo audit --deny warnings

# Audit the lockfile (CI-friendly)
cargo audit --file Cargo.lock

# JSON output for CI integration
cargo audit --json | jq '.vulnerabilities.list[].advisory.id'
```

Output format:

```
error[RUSTSEC-2023-0052]: Vulnerability in `vm-superio`
    Severity: low
       Title: MMIO Register Misuse
    Solution: upgrade to `>= 0.7.0`
```

### 2. cargo-deny — policy enforcement

cargo-deny goes beyond audit: it enforces license policies, bans specific crates, checks source origins, and validates duplicate dependency versions.

```bash
cargo install cargo-deny --locked

# Initialize deny.toml
cargo deny init

# Run all checks
cargo deny check

# Run specific check
cargo deny check advisories
cargo deny check licenses
cargo deny check bans
cargo deny check sources
```

`deny.toml` configuration:

```toml
[advisories]
vulnerability = "deny"      # Deny known vulnerabilities
unmaintained = "warn"       # Warn on unmaintained crates
yanked = "deny"             # Deny yanked versions

# Ignore specific advisories
ignore = [
    "RUSTSEC-2021-0145",    # known false positive for our usage
]

[licenses]
unlicensed = "deny"
allow = [
    "MIT", "Apache-2.0", "Apache-2.0 WITH LLVM-exception",
    "BSD-2-Clause", "BSD-3-Clause", "ISC", "Unicode-DFS-2016",
]
# Deny GPL for proprietary projects
deny = ["GPL-2.0", "GPL-3.0"]

[bans]
multiple-versions = "warn"  # Warn if same crate appears twice
wildcards = "deny"          # Deny wildcard dependencies

[[bans.deny]]
name = "openssl"            # Force rustls instead
wrappers = ["reqwest"]      # Allow if only required by these

[sources]
unknown-registry = "deny"
unknown-git = "deny"
allow-git = [
    "https://github.com/my-org/private-crate",
]
```

GitHub Actions CI integration:

```yaml
- name: Security audit
  run: |
    cargo install cargo-deny --locked
    cargo deny check
```

### 3. RUSTSEC advisory database

The RUSTSEC database at https://rustsec.org/ tracks vulnerabilities, unmaintained crates, and unsound code.

```bash
# Browse advisories from CLI
cargo audit --db ~/.cargo/advisory-db fetch
ls ~/.cargo/advisory-db/crates/

# Check a specific advisory
curl https://rustsec.org/advisories/RUSTSEC-2023-0001.json | jq .

# Common categories
# type: vulnerability — exploitable security bug
# type: unmaintained — no longer maintained (supply chain risk)
# type: unsound — documented unsoundness in safe API
# type: yanked — crate version yanked from crates.io
```

### 4. Memory-safe FFI patterns

Common sources of unsafety at the Rust/C boundary:

```rust
// UNSAFE pattern — raw pointer from C, no lifetime
extern "C" fn process_data(data: *const u8, len: usize) {
    // Don't do this — no bounds check, no lifetime guarantee
    let slice = unsafe { std::slice::from_raw_parts(data, len) };
}

// SAFE pattern — validate before using
extern "C" fn process_data(data: *const u8, len: usize) -> i32 {
    // Validate pointer and length
    if data.is_null() || len == 0 || len > 1024 * 1024 {
        return -1;
    }
    // Safety: non-null, len validated, called from C with valid buffer
    let slice = unsafe { std::slice::from_raw_parts(data, len) };
    do_work(slice);
    0
}

// Use safe wrapper crates for common patterns
use nix::unistd::read;   // safe POSIX wrappers
use windows::Win32::System::Memory::VirtualAlloc;  // safe Windows bindings
```

### 5. Fuzzing for security bugs

```bash
# cargo-fuzz — libFuzzer-based
cargo install cargo-fuzz

# Initialize
cargo fuzz init
cargo fuzz add my_target

# fuzz/fuzz_targets/my_target.rs
# #![no_main]
# use libfuzzer_sys::fuzz_target;
# fuzz_target!(|data: &[u8]| {
#     if let Ok(s) = std::str::from_utf8(data) {
#         let _ = my_lib::parse(s);
#     }
# });

# Run fuzzing (long-running)
cargo fuzz run my_target

# With sanitizers for security coverage
cargo fuzz run my_target -- -sanitizer=address

# Reproduce a crash
cargo fuzz run my_target artifacts/my_target/crash-xxxx
```

```bash
# Honggfuzz — good for security targets
cargo install honggfuzz
cargo hfuzz run my_target
```

### 6. Miri for soundness

```bash
# Install Miri
rustup +nightly component add miri

# Run tests under Miri
cargo +nightly miri test

# Check for UB in unsafe code
MIRIFLAGS="-Zmiri-disable-isolation -Zmiri-backtrace=full" \
  cargo +nightly miri test

# Miri detects:
# - Use-after-free
# - Dangling references
# - Invalid pointer arithmetic
# - Data races (with -Zmiri-tree-borrows)
# - Uninitialized memory reads
```

### 7. Supply chain hardening

```bash
# Pin Cargo.lock in applications (not libraries)
# Always commit Cargo.lock for binaries

# Verify checksums (cargo already does this)
cargo fetch --locked    # fails if Cargo.lock doesn't match

# Audit all dependencies including transitive
cargo tree              # view full dependency tree
cargo tree -d           # show duplicate versions

# Use cargo-vet for peer review of new deps
cargo install cargo-vet
cargo vet              # check all deps have been vetted

# Minimal dependency principle
cargo machete          # finds unused dependencies
```

## Related skills

- Use `skills/rust/rust-sanitizers-miri` for Miri and sanitizer details
- Use `skills/runtimes/fuzzing` for fuzzing strategy and corpus management
- Use `skills/rust/rust-unsafe` for unsafe code audit patterns
- Use `skills/rust/cargo-workflows` for Cargo.lock and workspace management
