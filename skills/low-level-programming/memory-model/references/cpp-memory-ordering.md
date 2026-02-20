# C++ Memory Ordering Reference

## Happens-Before Relation

A **happens-before** (HB) relationship between operation A and B means: the effects of A are guaranteed to be visible when B executes.

Establishing HB:

1. **Sequenced-before**: program order within a single thread
2. **Synchronizes-with**: a release operation synchronizes-with an acquire operation that reads its value
3. **Transitivity**: if A HB B and B HB C, then A HB C

```text
Thread 1:                    Thread 2:
x = 42;        ←─────────────────────────────────────
flag.store(true,             while(!flag.load(
  release);     ─ sync-with ─  acquire));
                             assert(x == 42);  // HB guarantees this
```

## Memory Order Rules Table

| Operation type | Valid orderings |
|----------------|----------------|
| Atomic load | Relaxed, Consume, Acquire, SeqCst |
| Atomic store | Relaxed, Release, SeqCst |
| Read-Modify-Write (fetch_add, CAS...) | All orderings |
| Fence | Relaxed, Acquire, Release, AcqRel, SeqCst |

## SeqCst Total Order

`memory_order_seq_cst` establishes a single total order across all `seq_cst` operations in all threads. Every thread observes these operations in the same order.

```cpp
std::atomic<bool> x{false}, y{false};
std::atomic<int> z{0};

void write_x() { x.store(true, std::memory_order_seq_cst); }
void write_y() { y.store(true, std::memory_order_seq_cst); }

void read_x_then_y() {
    while (!x.load(seq_cst));
    if (y.load(seq_cst)) z.fetch_add(1, seq_cst);
}
void read_y_then_x() {
    while (!y.load(seq_cst));
    if (x.load(seq_cst)) z.fetch_add(1, seq_cst);
}

// SeqCst guarantees: z will never be 0 after both readers complete
// With weaker orderings, z could be 0 (both readers miss each other's store)
```

## CAS (Compare-And-Swap) Patterns

```cpp
// Strong CAS (never spuriously fails)
std::atomic<int> val{0};

int expected = 0;
bool success = val.compare_exchange_strong(
    expected,              // Updated to actual val if fail
    42,                    // New value to write
    std::memory_order_acq_rel,   // success ordering
    std::memory_order_relaxed    // failure ordering (load only)
);

// Weak CAS (may spuriously fail, use in retry loops)
int expected = 0;
while (!val.compare_exchange_weak(expected, 42,
    std::memory_order_acq_rel,
    std::memory_order_relaxed)) {
    expected = 0;  // Reset if failed
}
```

CAS ordering rule: failure ordering must not be stronger than success ordering; failure ordering cannot be Release or AcqRel (it's a load).

## Lock-Free Stack

```cpp
template<typename T>
class LockFreeStack {
    struct Node {
        T data;
        Node* next;
    };
    std::atomic<Node*> head{nullptr};

public:
    void push(T val) {
        Node* node = new Node{val, nullptr};
        node->next = head.load(std::memory_order_relaxed);
        while (!head.compare_exchange_weak(
                node->next, node,
                std::memory_order_release,
                std::memory_order_relaxed)) {}
    }

    std::optional<T> pop() {
        Node* node = head.load(std::memory_order_acquire);
        while (node != nullptr &&
               !head.compare_exchange_weak(
                node, node->next,
                std::memory_order_acquire,
                std::memory_order_acquire)) {}
        if (node == nullptr) return std::nullopt;
        T val = std::move(node->data);
        // Note: ABA problem and safe memory reclamation omitted
        delete node;
        return val;
    }
};
```

## Platform Memory Models

| Platform | Default ordering | Notes |
|----------|-----------------|-------|
| x86/x86-64 | TSO (total store order) | Loads not reordered with loads, stores not with stores |
| ARM64 | Weakly ordered | Most relaxed; all barriers needed explicitly |
| POWER | Weakly ordered | Even weaker than ARM in some cases |
| RISC-V | RVWMO | Defined per-instruction |

x86 TSO means: on x86, Acquire/Release operations are essentially "free" (no explicit barrier). SeqCst still requires an `mfence` or locked operation. On ARM, every Acquire needs a `dmb ish` barrier.

## std::atomic_flag (Simplest Atomic)

```cpp
// Only guaranteed lock-free atomic type
std::atomic_flag flag = ATOMIC_FLAG_INIT;  // starts false

// Test-and-set (returns old value, sets to true)
bool was_set = flag.test_and_set(std::memory_order_acquire);

// Clear (set to false)
flag.clear(std::memory_order_release);

// C++20: test without setting
bool val = flag.test(std::memory_order_acquire);
```

## Rust Ordering Equivalents

| C++ | Rust | Notes |
|-----|------|-------|
| `memory_order_relaxed` | `Ordering::Relaxed` | |
| `memory_order_acquire` | `Ordering::Acquire` | |
| `memory_order_release` | `Ordering::Release` | |
| `memory_order_acq_rel` | `Ordering::AcqRel` | Only for RMW |
| `memory_order_seq_cst` | `Ordering::SeqCst` | |
| `atomic_thread_fence(acquire)` | `fence(Ordering::Acquire)` | |
| `atomic_signal_fence` | (no direct equivalent) | |

## Quick Selection Guide

```text
Counter only (e.g., statistics):
    → Relaxed for all operations

Reference count:
    → Relaxed for addref
    → AcqRel for release (detect zero)
    → Acquire for optional final load

One writer, one reader flag:
    → Release on store
    → Acquire on load

Multiple writers, single reader:
    → AcqRel on all modifications
    → Acquire on read

Need global ordering across multiple atomics:
    → SeqCst on everything (but benchmark!)
```
