---
name: rust-unsafe
description: Rust unsafe code skill for systems programming. Use when writing or reviewing unsafe Rust, understanding what operations require unsafe, implementing safe abstractions over unsafe code, auditing unsafe blocks, or understanding raw pointers, transmute, and extern. Activates on queries about unsafe Rust, raw pointers, transmute, unsafe blocks, writing safe wrappers, UnsafeCell, unsafe trait impl, or auditing unsafe code.
---

# Rust unsafe

## Purpose

Guide agents through writing, reviewing, and reasoning about unsafe Rust: what operations require `unsafe`, how to write safe abstractions, audit patterns, common pitfalls, and when to reach for `unsafe`.

## Triggers

- "When do I need to use unsafe in Rust?"
- "How do I write a safe abstraction over unsafe code?"
- "How do I audit an unsafe block?"
- "What are the rules for raw pointers in Rust?"
- "What does transmute do and when is it safe?"
- "How do I implement UnsafeCell correctly?"

## Workflow

### 1. The five unsafe superpowers

`unsafe` grants exactly five capabilities not available in safe Rust:

1. **Dereference raw pointers** (`*const T`, `*mut T`)
2. **Call unsafe functions** (including `extern "C"` functions)
3. **Access or modify mutable static variables**
4. **Implement unsafe traits** (`Send`, `Sync`)
5. **Access fields of unions**

Everything else in Rust — including memory allocation, borrowing, closures — follows safe rules even inside `unsafe` blocks.

### 2. Raw pointers

```rust
// Creating raw pointers (safe — no dereference yet)
let x = 42u32;
let ptr: *const u32 = &x;
let mut_ptr: *mut u32 = &mut some_val as *mut u32;

// Null pointer
let null: *const u32 = std::ptr::null();
let null_mut: *mut u32 = std::ptr::null_mut();

// Dereference (unsafe)
let val = unsafe { *ptr };

// Null check
if !ptr.is_null() {
    let val = unsafe { *ptr };
}

// Offset (safe to compute, unsafe to dereference)
let arr = [1u32, 2, 3, 4, 5];
let p = arr.as_ptr();
let third = unsafe { *p.add(2) };   // arr[2]
let also_third = unsafe { *p.offset(2) };

// Slice from raw parts
let slice: &[u32] = unsafe {
    std::slice::from_raw_parts(p, arr.len())
};
```

Rules for sound raw pointer dereference:
- Pointer must be non-null
- Pointer must be aligned for `T`
- Memory must be initialized for `T`
- Must not violate aliasing rules (only one `&mut` to a location)
- Memory must be valid for the lifetime of the reference

### 3. unsafe functions and traits

```rust
// Declare unsafe function (callers must uphold invariants)
/// # Safety
/// `ptr` must be non-null and aligned to `T`, and point to initialized data.
/// The caller must ensure no other mutable reference to the same location exists.
unsafe fn read_ptr<T>(ptr: *const T) -> T {
    ptr.read()  // ptr::read is unsafe
}

// Call unsafe function
let val = unsafe { read_ptr(some_ptr) };

// Unsafe trait — implementor must uphold safety invariants
unsafe trait MyUnsafeTrait {
    fn operation(&self);
}

// Implementing an unsafe trait is unsafe
unsafe impl MyUnsafeTrait for MyType {
    fn operation(&self) { /* must uphold the trait's invariants */ }
}

// Send and Sync
// Send: type can be moved to another thread
// Sync: type can be shared between threads (&T is Send)
unsafe impl Send for MyType {}
unsafe impl Sync for MyType {}
```

### 4. Safe abstractions over unsafe

```rust
// The golden rule: unsafe blocks should be small, isolated, and
// wrapped in a safe API that maintains the invariant

pub struct MyVec<T> {
    ptr: *mut T,
    len: usize,
    cap: usize,
}

impl<T> MyVec<T> {
    pub fn new() -> Self {
        MyVec { ptr: std::ptr::NonNull::dangling().as_ptr(), len: 0, cap: 0 }
    }

    // Safe public API
    pub fn get(&self, index: usize) -> Option<&T> {
        if index < self.len {
            // Safety: index < len guarantees ptr+index is in bounds and initialized
            Some(unsafe { &*self.ptr.add(index) })
        } else {
            None
        }
    }

    // # Safety comment documents the invariant
    pub fn push(&mut self, val: T) {
        if self.len == self.cap {
            self.grow();
        }
        // Safety: len < cap after grow(), so ptr+len is in bounds
        unsafe { self.ptr.add(self.len).write(val) };
        self.len += 1;
    }
}

// Implement Drop to clean up
impl<T> Drop for MyVec<T> {
    fn drop(&mut self) {
        // Safety: ptr was allocated with this layout, and all elements are initialized
        unsafe {
            std::ptr::drop_in_place(std::slice::from_raw_parts_mut(self.ptr, self.len));
            std::alloc::dealloc(self.ptr as *mut u8,
                std::alloc::Layout::array::<T>(self.cap).unwrap());
        }
    }
}
```

### 5. transmute

```rust
// transmute: reinterpret bits of one type as another
// Both types must have the same size

// Safe uses:
let x: u32 = 0x3f800000;
let f: f32 = unsafe { std::mem::transmute(x) };  // bits → float

// Transmute slice pointer (sound if types have same size/align)
let bytes: &[u8] = &[0x00, 0x00, 0x80, 0x3f];
let floats: &[f32] = unsafe {
    std::slice::from_raw_parts(bytes.as_ptr() as *const f32, 1)
};

// Prefer safe alternatives when available:
let f = f32::from_bits(x);         // instead of transmute for float bits
let n = u32::from_ne_bytes(bytes); // instead of transmute for byte arrays
```

Common transmute pitfalls:
- Wrong sizes (compile error, but check for generic types)
- Creating invalid enum values
- Creating references with wrong lifetimes

### 6. UnsafeCell — interior mutability

```rust
use std::cell::UnsafeCell;

// UnsafeCell is the only way to mutate through a shared reference
struct MyCell<T> {
    value: UnsafeCell<T>,
}

impl<T: Copy> MyCell<T> {
    fn new(val: T) -> Self {
        MyCell { value: UnsafeCell::new(val) }
    }

    fn get(&self) -> T {
        // Safety: single-threaded, no concurrent mutation
        unsafe { *self.value.get() }
    }

    fn set(&self, val: T) {
        // Safety: single-threaded, no outstanding references
        unsafe { *self.value.get() = val }
    }
}
```

### 7. Unsafe audit checklist

When reviewing an `unsafe` block:

- [ ] Is there a `// Safety:` comment explaining the invariant?
- [ ] Is the raw pointer non-null?
- [ ] Is the raw pointer correctly aligned for the target type?
- [ ] Is the memory initialized?
- [ ] Is the lifetime of the reference valid?
- [ ] Are aliasing rules respected (no simultaneous `&` and `&mut`)?
- [ ] For `extern "C"`: are C invariants documented and verified?
- [ ] For `Send`/`Sync` impl: is thread safety actually guaranteed?
- [ ] Is the unsafe block as small as possible?
- [ ] Is there a test under Miri for the unsafe code?

### 8. When to use unsafe

```
Before reaching for unsafe, check:
├── Does std have a safe API? (Vec, Box, Arc — usually yes)
├── Does a crate handle it? (memmap2, nix, windows-sys)
├── Can you restructure to avoid it?
└── Is the performance gain measured and significant?

Legitimate uses:
├── FFI to C libraries (extern "C")
├── OS-level APIs (syscalls, mmap, ioctl)
├── Performance-critical data structures (custom allocators, SoA)
├── Hardware access (embedded, drivers)
└── Implementing safe abstractions (the standard library itself)
```

For unsafe patterns and audit examples, see [references/unsafe-patterns.md](references/unsafe-patterns.md).

## Related skills

- Use `skills/rust/rust-sanitizers-miri` — Miri is the essential tool for testing unsafe code
- Use `skills/rust/rust-ffi` for unsafe patterns in FFI contexts
- Use `skills/rust/rust-debugging` for debugging panics in unsafe code
- Use `skills/low-level-programming/memory-model` for aliasing and memory ordering in unsafe
