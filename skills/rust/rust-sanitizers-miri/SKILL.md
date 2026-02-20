---
name: rust-sanitizers-miri
description: Rust sanitizers and Miri skill for memory safety validation. Use when running AddressSanitizer or ThreadSanitizer on Rust code, interpreting sanitizer reports, using Miri to detect undefined behaviour in unsafe Rust, or validating unsafe code correctness. Activates on queries about Rust ASan, Rust TSan, Miri, RUSTFLAGS sanitize, cargo miri, unsafe Rust UB, or interpreting Rust sanitizer output.
---

# Rust Sanitizers and Miri

## Purpose

Guide agents through runtime safety validation for Rust: ASan/TSan/MSan/UBSan via RUSTFLAGS, Miri for compile-time UB detection in unsafe code, and interpreting sanitizer reports.

## Triggers

- "How do I run AddressSanitizer on Rust code?"
- "How do I use Miri to check my unsafe Rust?"
- "How do I run ThreadSanitizer on a Rust program?"
- "My unsafe Rust might have UB — how do I detect it?"
- "How do I interpret a Rust ASan report?"
- "Can I run Rust sanitizers on stable?"

## Workflow

### 1. Sanitizers in Rust (nightly required)

Rust sanitizers require nightly and a compatible platform:

```bash
# Install nightly
rustup toolchain install nightly
rustup component add rust-src --toolchain nightly

# AddressSanitizer (Linux, macOS)
RUSTFLAGS="-Z sanitizer=address" \
    cargo +nightly test -Zbuild-std \
    --target x86_64-unknown-linux-gnu

# ThreadSanitizer (Linux)
RUSTFLAGS="-Z sanitizer=thread" \
    cargo +nightly test -Zbuild-std \
    --target x86_64-unknown-linux-gnu

# MemorySanitizer (Linux, requires all-instrumented build)
RUSTFLAGS="-Z sanitizer=memory -Zsanitizer-memory-track-origins" \
    cargo +nightly test -Zbuild-std \
    --target x86_64-unknown-linux-gnu

# UndefinedBehaviorSanitizer
RUSTFLAGS="-Z sanitizer=undefined" \
    cargo +nightly test -Zbuild-std \
    --target x86_64-unknown-linux-gnu
```

`-Zbuild-std` rebuilds the standard library with the sanitizer, which is necessary for accurate results.

### 2. Stable sanitizer workaround

For stable Rust, use the `cross` tool with a Docker image that has sanitizers pre-configured, or run `cargo test` inside a Docker container with a nightly image.

Alternatively, for simpler UB checking without nightly:
```bash
# cargo-sanitize (wrapper)
cargo install cargo-sanitize
cargo sanitize address
```

### 3. Interpreting ASan output in Rust

```
==12345==ERROR: AddressSanitizer: heap-buffer-overflow on address 0x602000000050
READ of size 4 at 0x602000000050 thread T0
    #0 0x401234 in myapp::module::function /src/main.rs:15
    #1 0x401567 in myapp::main /src/main.rs:42

0x602000000050 is located 0 bytes after a 40-byte region allocated at:
    #0 0x... in alloc::alloc::alloc ...
    #1 0x... in myapp::create_buffer /src/main.rs:10
```

Rust-specific patterns:
| ASan error | Likely Rust cause |
|------------|------------------|
| `heap-buffer-overflow` | `unsafe` slice access past bounds |
| `use-after-free` | `unsafe` pointer use after Vec realloc |
| `stack-use-after-return` | Returning reference to local |
| `heap-use-after-free` | Use after `drop()` or `Box::from_raw` |

### 4. Miri — interpreter for undefined behaviour

Miri interprets Rust MIR and detects UB that sanitizers might miss:

```bash
# Install Miri (requires nightly)
rustup +nightly component add miri

# Run tests under Miri
cargo +nightly miri test

# Run specific test
cargo +nightly miri test test_name

# Run a binary under Miri
cargo +nightly miri run

# Run with Stacked Borrows model (strict aliasing)
MIRIFLAGS="-Zmiri-strict-provenance" cargo +nightly miri test

# Disable isolation (allow file I/O, randomness)
MIRIFLAGS="-Zmiri-disable-isolation" cargo +nightly miri test
```

### 5. What Miri detects

```rust
// 1. Dangling pointer use
unsafe {
    let x = Box::new(42);
    let ptr = Box::into_raw(x);
    let _ = Box::from_raw(ptr);  // drop
    let _val = *ptr;  // Miri: use of dangling pointer
}

// 2. Invalid enum discriminant
let x: u8 = 3;
let e = unsafe { std::mem::transmute::<u8, MyEnum>(x) };
// Miri: enum value has invalid tag

// 3. Uninitialized memory read
let uninit: MaybeUninit<u32> = MaybeUninit::uninit();
let val = unsafe { uninit.assume_init() };  // Miri: reading uninitialized bytes

// 4. Stacked borrows violation
let mut x = 5u32;
let ptr = &mut x as *mut u32;
let _ref = &x;  // shared reference
unsafe { *ptr = 10; }  // Miri: mutable access while shared borrow exists

// 5. Data races (with threads)
// Miri simulates sequential execution and detects races via Stacked Borrows
```

### 6. ThreadSanitizer for Rust

```bash
RUSTFLAGS="-Z sanitizer=thread" \
    RUST_TEST_THREADS=8 \
    cargo +nightly test -Zbuild-std \
    --target x86_64-unknown-linux-gnu 2>&1 | head -50
```

TSan output:
```
WARNING: ThreadSanitizer: data race (pid=12345)
  Write of size 4 at 0x7f... by thread T2 (mutexes: write M1):
    #0 myapp::counter::increment src/counter.rs:10
  Previous read of size 4 at 0x7f... by thread T1:
    #0 myapp::counter::get src/counter.rs:5
```

### 7. Miri configuration via MIRIFLAGS

| Flag | Effect |
|------|--------|
| `-Zmiri-disable-isolation` | Allow I/O, clock, randomness |
| `-Zmiri-strict-provenance` | Strict pointer provenance (stricter than LLVM) |
| `-Zmiri-symbolic-alignment-check` | Stricter alignment checking |
| `-Zmiri-check-number-validity` | Check float/int validity |
| `-Zmiri-num-cpus=N` | Simulate N CPUs (for concurrency) |
| `-Zmiri-seed=N` | Seed for random scheduling |
| `-Zmiri-ignore-leaks` | Suppress memory leak errors |
| `-Zmiri-tag-raw-pointers` | Track raw pointer provenance |

### 8. CI integration

```yaml
# GitHub Actions
- name: Miri
  run: |
    rustup toolchain install nightly
    rustup +nightly component add miri
    cargo +nightly miri test
  env:
    MIRIFLAGS: "-Zmiri-disable-isolation"

- name: ASan (nightly)
  run: |
    rustup component add rust-src --toolchain nightly
    RUSTFLAGS="-Z sanitizer=address" \
    cargo +nightly test -Zbuild-std \
    --target x86_64-unknown-linux-gnu
```

## Related skills

- Use `skills/rust/rust-debugging` for GDB/LLDB debugging of Rust panics
- Use `skills/runtimes/sanitizers` for C/C++ sanitizer usage and comparison
- Use `skills/rust/rust-unsafe` for unsafe Rust patterns and review checklist
- Use `skills/runtimes/fuzzing` to generate inputs that trigger sanitizer errors
