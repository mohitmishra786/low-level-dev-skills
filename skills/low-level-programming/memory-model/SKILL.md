---
name: memory-model
description: C++ and Rust memory model skill for concurrent programming. Use when understanding memory ordering, writing lock-free data structures, using std::atomic or Rust atomics, diagnosing data races, or selecting the correct memory order for atomic operations. Activates on queries about memory ordering, acquire-release, seq_cst, relaxed atomics, happens-before, memory barriers, std::atomic, or Rust atomic ordering.
---

# Memory Model

## Purpose

Guide agents through C++ and Rust memory models: memory orderings, the happens-before relation, atomic operations, fences, and practical patterns for lock-free data structures.

## Triggers

- "What is the C++ memory model?"
- "What memory order should I use for my atomic operation?"
- "What is the difference between acquire-release and seq_cst?"
- "How do I use std::atomic in C++?"
- "What is acquire/release in Rust atomics?"
- "How do I implement a lock-free queue?"

## Workflow

### 1. Memory ordering overview

Modern CPUs and compilers reorder operations for performance. The memory model specifies what reorderings are allowed and how synchronisation is achieved.

```text
Ordering strength (weakest to strongest):
Relaxed < Release/Acquire < AcqRel < SeqCst

Stronger ordering = more synchronization = more correct, but slower
Weaker ordering  = fewer barriers = faster, but needs careful analysis
```

### 2. Memory orderings

| Order | C++ | Rust | What it means |
|-------|-----|------|--------------|
| Relaxed | `memory_order_relaxed` | `Ordering::Relaxed` | No ordering guarantee; just atomicity |
| Consume | `memory_order_consume` | (use Acquire) | Data dependency ordering |
| Acquire | `memory_order_acquire` | `Ordering::Acquire` | This load sees all writes before the matching release |
| Release | `memory_order_release` | `Ordering::Release` | All writes before this store are visible to acquire |
| AcqRel | `memory_order_acq_rel` | `Ordering::AcqRel` | Both acquire and release on RMW ops |
| SeqCst | `memory_order_seq_cst` | `Ordering::SeqCst` | Total order across all seq_cst operations |

### 3. C++ std::atomic

```cpp
#include <atomic>
#include <thread>

std::atomic<int> counter{0};
std::atomic<bool> ready{false};

// Producer thread
void producer() {
    data = 42;                              // (1) write data
    ready.store(true, std::memory_order_release);  // (2) signal
}

// Consumer thread
void consumer() {
    while (!ready.load(std::memory_order_acquire));  // (3) wait
    assert(data == 42);                              // (4) guaranteed to see (1)
}
```

Acquire-release guarantees: if thread A does a **release store** to X, and thread B does an **acquire load** that sees A's value, then all writes by A before the release are visible to B after the acquire.

### 4. Choosing the right ordering

```text
Use case?
├── Counter (just needs atomicity, order irrelevant)    → Relaxed
├── Reference counting (decrement + final check)        → AcqRel (dec), Acquire (load 0 check)
├── Publish data from one thread to another             → Release (store), Acquire (load)
├── Mutual exclusion / mutex implementation             → AcqRel / SeqCst
├── Lock-free queue multiple producers/consumers        → SeqCst (safest to start)
└── Sequence number check (simple flag)                 → Release + Acquire
```

### 5. Common patterns

```cpp
// Pattern 1: Spinlock
class Spinlock {
    std::atomic_flag flag = ATOMIC_FLAG_INIT;
public:
    void lock() {
        while (flag.test_and_set(std::memory_order_acquire))
            ; // spin
    }
    void unlock() {
        flag.clear(std::memory_order_release);
    }
};

// Pattern 2: Reference counting
class RefCounted {
    std::atomic<int> refcount{1};
public:
    void addref() {
        refcount.fetch_add(1, std::memory_order_relaxed);  // only need atomicity
    }
    void release() {
        if (refcount.fetch_sub(1, std::memory_order_acq_rel) == 1) {
            // AcqRel ensures we see all writes from other releasers
            delete this;
        }
    }
};

// Pattern 3: One-time initialisation
class LazyInit {
    std::atomic<void*> ptr{nullptr};
    std::mutex mtx;
public:
    void* get() {
        void* p = ptr.load(std::memory_order_acquire);
        if (p == nullptr) {
            std::lock_guard lock(mtx);
            p = ptr.load(std::memory_order_relaxed);
            if (p == nullptr) {
                p = create();
                ptr.store(p, std::memory_order_release);
            }
        }
        return p;
    }
};
```

### 6. Rust atomics

```rust
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;

// Simple counter
let counter = Arc::new(AtomicUsize::new(0));

// Increment
counter.fetch_add(1, Ordering::Relaxed);

// Read
let val = counter.load(Ordering::Relaxed);

// Publish/subscribe pattern
static READY: AtomicBool = AtomicBool::new(false);

// Publisher thread
unsafe { DATA = 42; }  // Write data
READY.store(true, Ordering::Release);  // Signal

// Subscriber thread
while !READY.load(Ordering::Acquire) {}
let d = unsafe { DATA };  // Safe: guaranteed to see publisher's write
```

### 7. Fences

Fences provide ordering without an atomic operation on a specific variable:

```cpp
// C++ fence — equivalent to a global memory barrier
std::atomic_thread_fence(std::memory_order_acquire);  // Acquire fence
std::atomic_thread_fence(std::memory_order_release);  // Release fence

// Typical use: multiple atomic writes then one fence
relaxed_atomic_a.store(1, std::memory_order_relaxed);
relaxed_atomic_b.store(2, std::memory_order_relaxed);
std::atomic_thread_fence(std::memory_order_release);  // barrier for all above
sentinel.store(true, std::memory_order_relaxed);
```

### 8. Common mistakes

| Mistake | Fix |
|---------|-----|
| Using Relaxed for publish/subscribe | Use Release on store, Acquire on load |
| Using SeqCst everywhere | Profile first; use weakest correct ordering |
| Forgetting that non-atomic loads are not atomic | All shared mutable data needs atomic or mutex |
| Using `volatile` for thread safety in C++ | `volatile` is not a memory ordering tool; use `atomic` |
| Assuming sequential consistency without SeqCst | Each platform has different default consistency |

For memory ordering rules and happens-before reference, see [references/cpp-memory-ordering.md](references/cpp-memory-ordering.md).

## Related skills

- Use `skills/runtimes/sanitizers` — TSan detects data races involving non-atomic accesses
- Use `skills/rust/rust-sanitizers-miri` for detecting Rust memory ordering violations with Miri
- Use `skills/low-level-programming/assembly-x86` to understand generated fence instructions
- Use `skills/debuggers/gdb` for debugging concurrent programs with thread inspection
