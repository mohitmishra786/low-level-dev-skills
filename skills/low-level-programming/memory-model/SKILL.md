---
name: memory-model
description: C++ and Rust memory model skill for concurrent programming. Use when understanding memory ordering, writing lock-free data structures, using std::atomic or Rust atomics, diagnosing data races, or selecting the correct memory order for atomic operations. Also covers futexes (futex_waitv, futex2) and rseq. Activates on queries about memory ordering, acquire-release, seq_cst, relaxed atomics, happens-before, memory barriers, std::atomic, Rust atomic ordering, futex, futex_waitv, or rseq.
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

### 9. Futexes and rseq

Futexes are the kernel half of every mutex and condition variable: user space spins or uses
atomics, and calls into the kernel only to sleep or wake. Two newer interfaces matter for
custom synchronization:

```c
/* waitv.c — futex_waitv (Linux 5.16+): sleep on two futexes, wake on either */
#define _GNU_SOURCE
#include <linux/futex.h>
#include <pthread.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdio.h>
#include <sys/syscall.h>
#include <time.h>
#include <unistd.h>

static _Atomic uint32_t f1, f2;

static long futex_waitv(struct futex_waitv *w, unsigned n, unsigned flags,
                        struct timespec *timeout, clockid_t clock)
{
    return syscall(SYS_futex_waitv, w, n, flags, timeout, clock);
}

static void *waker(void *arg)
{
    (void)arg;
    usleep(100 * 1000);
    atomic_store(&f2, 1);                                   /* change the value first */
    syscall(SYS_futex, &f2, FUTEX_WAKE_PRIVATE, 1, NULL, NULL, 0);
    return NULL;
}

int main(void)
{
    struct futex_waitv w[2] = {
        { .uaddr = (uintptr_t)&f1, .val = 0, .flags = FUTEX2_SIZE_U32 | FUTEX2_PRIVATE },
        { .uaddr = (uintptr_t)&f2, .val = 0, .flags = FUTEX2_SIZE_U32 | FUTEX2_PRIVATE },
    };
    pthread_t t;
    pthread_create(&t, NULL, waker, NULL);
    long idx = futex_waitv(w, 2, 0, NULL, CLOCK_MONOTONIC); /* returns index of the woken futex */
    printf("woken by futex %ld (f2=%u)\n", idx, atomic_load(&f2));   /* woken by futex 1 */
    pthread_join(t, NULL);
    return 0;
}
```

```c
/* futex2 single-futex calls (Linux 6.7+): explicit size flags and a bitset mask */
syscall(SYS_futex_wait, &word, 0UL /* expected */, 0xffffffffUL /* mask */,
        FUTEX2_SIZE_U32 | FUTEX2_PRIVATE, NULL, CLOCK_MONOTONIC);
syscall(SYS_futex_wake, &word, 0xffffffffUL, 1 /* waiters */, FUTEX2_SIZE_U32 | FUTEX2_PRIVATE);
```

The mask must fit the futex size: `~0UL` with `FUTEX2_SIZE_U32` fails with `EINVAL`. Always
re-check the value after waking; the kernel only promises the value was different or a wake happened.

Restartable sequences (rseq) give each thread a kernel-updated area with its current CPU. glibc
2.35+ registers it for every thread, which enables per-CPU data structures without atomics on
the fast path (tcmalloc uses this):

```c
/* rseq.c — read the current CPU from the rseq area glibc registers (glibc 2.35+) */
#define _GNU_SOURCE
#include <sched.h>
#include <stdio.h>
#include <sys/rseq.h>

int main(void)
{
    if (__rseq_size == 0) {                       /* registration disabled or unsupported */
        puts("rseq not registered");
        return 1;
    }
    struct rseq *rs = (struct rseq *)((char *)__builtin_thread_pointer() + __rseq_offset);
    printf("rseq cpu_id=%u sched_getcpu=%d size=%u\n", rs->cpu_id, sched_getcpu(), __rseq_size);
    return 0;
}
```

`GLIBC_TUNABLES=glibc.pthread.rseq=0` disables glibc's registration (the program above then
prints `rseq not registered`), which is needed when a library registers its own rseq area.

## Related skills

- Use `skills/runtimes/sanitizers` — TSan detects data races involving non-atomic accesses
- Use `skills/rust/rust-sanitizers-miri` for detecting Rust memory ordering violations with Miri
- Use `skills/low-level-programming/assembly-x86` to understand generated fence instructions
- Use `skills/debuggers/gdb` for debugging concurrent programs with thread inspection
