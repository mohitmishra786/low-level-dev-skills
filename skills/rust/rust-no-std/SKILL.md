---
name: rust-no-std
description: Rust no_std skill for embedded and bare-metal development. Use when writing #![no_std] crates, understanding what core vs std provides, using the alloc crate with custom allocators, implementing panic handlers for embedded, or testing no_std crates on the host. Activates on queries about no_std Rust, #![no_std], core crate, alloc crate, custom allocators in Rust, embedded panic handler, or testing no_std on host.
---

# Rust no_std

## Purpose

Guide agents through `#![no_std]` Rust development: what `core` and `alloc` provide vs `std`, implementing custom global allocators, panic handler selection for embedded targets, and strategies for testing `no_std` crates on the host machine.

## Triggers

- "How do I write a #![no_std] Rust crate?"
- "What's the difference between core, alloc, and std in Rust?"
- "How do I use Vec and String in a no_std environment?"
- "How do I implement a global allocator in Rust?"
- "How do I handle panics in no_std Rust?"
- "How do I test a no_std crate without hardware?"

## Workflow

### 1. no_std crate structure

```rust
// src/lib.rs
#![no_std]

// core is always available (no OS needed)
use core::fmt;
use core::mem;
use core::slice;

// alloc: heap collections — requires a global allocator
#[cfg(feature = "alloc")]
extern crate alloc;
#[cfg(feature = "alloc")]
use alloc::{vec::Vec, string::String, boxed::Box, format};

pub fn add(a: u32, b: u32) -> u32 {
    a + b
}
```

```toml
# Cargo.toml
[features]
default = []
alloc = []       # opt-in to heap allocation

[dependencies]
# no_std-compatible dependencies only
```

### 2. core vs alloc vs std

| Crate | Requires OS | Requires heap | Provides |
|-------|------------|--------------|---------|
| `core` | No | No | Primitives, traits, iter, fmt, mem, ptr, slice, option, result |
| `alloc` | No | Yes (allocator) | Vec, String, Box, Arc, Rc, HashMap (requires global allocator) |
| `std` | Yes | Yes | All of core + alloc + OS APIs (threads, files, sockets, env) |

`std` re-exports everything in `core` and `alloc`, so `use std::fmt` and `use core::fmt` are equivalent when `std` is available.

What's available in `core` only (no heap, no OS):
```rust
// These work in no_std:
core::fmt::Write           // trait for write! macro
core::iter                 // iterators
core::ops                  // operators (+, -, *, Deref, etc.)
core::option::Option
core::result::Result
core::mem::{size_of, align_of, swap, replace}
core::ptr::{read, write, null, NonNull}
core::slice, core::str
core::sync::atomic         // atomic types
core::cell::{Cell, UnsafeCell, RefCell}
core::cmp, core::convert, core::clone, core::default
core::num                  // numeric conversions
core::panic::PanicInfo     // for panic handler
```

### 3. Custom global allocator

To use `alloc` crate in `no_std`, provide a global allocator:

```rust
// src/allocator.rs — embedded allocator using linked_list_allocator
use linked_list_allocator::LockedHeap;

#[global_allocator]
static ALLOCATOR: LockedHeap = LockedHeap::empty();

pub fn init_heap(heap_start: usize, heap_size: usize) {
    unsafe {
        ALLOCATOR.lock().init(heap_start as *mut u8, heap_size);
    }
}
```

```toml
[dependencies]
linked-list-allocator = { version = "0.10", default-features = false }
```

```rust
// src/main.rs (bare-metal)
#![no_std]
#![no_main]

extern crate alloc;
use alloc::vec::Vec;

mod allocator;

// In init code (after BSS/data init):
allocator::init_heap(0x20010000, 0x10000);  // 64KB heap at RAM+64KB

// Now alloc types work:
let mut v: Vec<u32> = Vec::new();
v.push(42);
```

Common embedded allocator crates:
- `linked-list-allocator`: general purpose, `no_std`
- `buddy-alloc`: power-of-two buddy system
- `dlmalloc`: port of Doug Lea's malloc
- `talc`: fast, suited for embedded

### 4. Panic handler

In `no_std`, you must provide a panic handler — Rust requires one:

```rust
// Option 1: halt on panic (simplest, production)
use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}  // spin forever
}

// Option 2: print panic info via defmt (embedded with debug probe)
#[panic_handler]
fn panic(info: &PanicInfo) -> ! {
    defmt::error!("{}", defmt::Display2Format(info));
    cortex_m::asm::udf();  // undefined instruction → hard fault
}

// Option 3: use a panic crate (in Cargo.toml)
// panic-halt = "0.2"   — spin loop
// panic-reset = "0.1.1" — reset MCU
// panic-probe = "0.3"   — defmt + probe-rs
```

### 5. Writing portable no_std libraries

Design your library to work with and without `alloc`:

```rust
#![no_std]
#[cfg(feature = "alloc")]
extern crate alloc;

pub struct Parser<'a> {
    data: &'a [u8],         // borrowed slice: no allocation needed
    pos: usize,
}

impl<'a> Parser<'a> {
    pub fn new(data: &'a [u8]) -> Self {
        Parser { data, pos: 0 }
    }

    // Core API: return borrowed data, no allocation
    pub fn next_token(&mut self) -> Option<&'a [u8]> { /* ... */ None }

    // Alloc API: only when alloc feature is enabled
    #[cfg(feature = "alloc")]
    pub fn collect_all(&mut self) -> alloc::vec::Vec<&'a [u8]> {
        let mut tokens = alloc::vec::Vec::new();
        while let Some(tok) = self.next_token() {
            tokens.push(tok);
        }
        tokens
    }
}
```

### 6. Testing no_std on host

```toml
# Cargo.toml
[dev-dependencies]
std = []   # allow std in tests only (via cfg)

[features]
std = []
```

```rust
// lib.rs
#![cfg_attr(not(test), no_std)]  // no_std except during tests
// Tests compile normally with std — only library code is no_std
```

Or use a separate test harness:

```bash
# Run tests targeting the host (std available for test framework)
cargo test --target x86_64-unknown-linux-gnu

# Test with the actual embedded target using QEMU
cargo test --target thumbv7em-none-eabihf  # fails: no test runner on bare metal

# Solution: use defmt-test or probe-run for on-target testing
# Or: architecture-neutral pure logic tests on host
```

```bash
# Check no_std compliance without hardware
cargo check --target thumbv7em-none-eabihf
cargo build --target thumbv7em-none-eabihf
```

## Related skills

- Use `skills/embedded/embedded-rust` for probe-rs, defmt, and RTIC with no_std
- Use `skills/rust/rust-cross` for cross-compilation target setup
- Use `skills/rust/rust-unsafe` for unsafe patterns needed in allocator implementations
- Use `skills/embedded/linker-scripts` for heap region placement in bare-metal targets
