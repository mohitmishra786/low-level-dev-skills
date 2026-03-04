---
name: concurrency-debugging
description: Concurrency debugging skill for diagnosing data races and deadlocks. Use when reading TSan race reports, debugging deadlocks with GDB thread inspection, analyzing lock-order graphs with Helgrind, identifying std::atomic misuse patterns, or reasoning about happens-before in C++ and Rust. Activates on queries about data races, TSan reports, deadlocks, Helgrind, lock ordering, thread sanitizer output, or atomic ordering issues.
---

# Concurrency Debugging

## Purpose

Guide agents through diagnosing and fixing concurrency bugs: reading ThreadSanitizer race reports, using Helgrind for lock-order analysis, detecting deadlocks with GDB thread inspection, identifying common `std::atomic` misuse patterns, and applying happens-before reasoning in C++ and Rust.

## Triggers

- "ThreadSanitizer reported a data race — how do I read the report?"
- "My program deadlocks — how do I debug it?"
- "How do I use Helgrind to find threading bugs?"
- "Am I using std::atomic correctly?"
- "How does happens-before work in C++ memory ordering?"
- "How do I find which threads are deadlocked in GDB?"

## Workflow

### 1. ThreadSanitizer (TSan) — race detection

```bash
# Build with TSan
clang -fsanitize=thread -g -O1 -o prog main.c
# or GCC
gcc -fsanitize=thread -g -O1 -o prog main.c

# Run (TSan intercepts memory accesses at runtime)
./prog

# TSan-specific options
TSAN_OPTIONS="halt_on_error=1:second_deadlock_stack=1" ./prog
```

Reading a TSan report:

```text
WARNING: ThreadSanitizer: data race (pid=12345)
  Write of size 4 at 0x7f1234 by thread T2:
    #0 increment /src/counter.c:8:5              ← access site in T2
    #1 worker_thread /src/counter.c:22:3

  Previous read of size 4 at 0x7f1234 by thread T1:
    #0 read_counter /src/counter.c:3:14          ← conflicting access in T1
    #1 main /src/counter.c:30:5

  Thread T2 created at:
    #0 pthread_create .../tsan_interceptors.cpp
    #1 main /src/counter.c:28:3

SUMMARY: ThreadSanitizer: data race /src/counter.c:8:5 in increment
```

How to read:
1. Line 1: type of access (write/read) and address
2. Stack under "Write of size": the thread that performed the write
3. Stack under "Previous read/write": the conflicting thread
4. "Thread T2 created at": where the thread was spawned
5. Fix: the `increment` and `read_counter` functions access the same address without synchronization

Common races and fixes:

| Race pattern | Fix |
|-------------|-----|
| Read/write on global without lock | Add mutex or use `std::atomic` |
| Double-checked locking without `atomic` | Use `std::once_flag` + `std::call_once` |
| `+=` on shared integer | Use `std::atomic<int>::fetch_add()` |
| Container modified while iterated | Lock entire critical section |
| `shared_ptr` ref count race | Already safe (ref count is atomic); but pointed-to object may not be |

### 2. Helgrind — lock-order and race detection

Helgrind uses Valgrind infrastructure to detect lock ordering violations (potential deadlocks) and data races:

```bash
# Run with Helgrind
valgrind --tool=helgrind --log-file=helgrind.log ./prog

# Lock order violation report
==1234== Thread #3: lock order "0x... M2" after "0x... M1"
==1234== observed (incorrect) order
==1234==    at pthread_mutex_lock (helgrind/...)
==1234==    by worker2 /src/worker.c:45           ← T3 takes M2 then M1
==1234==
==1234== required order established by acquisition of lock at address 0x... M1
==1234==    at pthread_mutex_lock
==1234==    by worker1 /src/worker.c:31            ← T1 takes M1 then M2
```

Lock-order violation = potential deadlock:
- Thread T1 acquires M1, then tries M2
- Thread T2 acquires M2, then tries M1
- Both can deadlock if they race

Fix: enforce a consistent global lock ordering. Always take M1 before M2 everywhere.

### 3. Deadlock detection with GDB

```bash
# Attach GDB to a deadlocked process
gdb -p $(pgrep prog)

# Or run under GDB then trigger deadlock

(gdb) info threads          # list all threads and current state
# * 1  Thread 0x... (LWP 1234) "prog" ... in __lll_lock_wait ()
#   2  Thread 0x... (LWP 1235) "prog" ... in __lll_lock_wait ()
# Threads blocked in __lll_lock_wait = waiting for mutex

(gdb) thread 1
(gdb) bt                    # show which mutex thread 1 is waiting for

(gdb) thread 2
(gdb) bt                    # show which mutex thread 2 holds/waits

# Find the mutex owner
(gdb) p ((pthread_mutex_t*)0x601090)->__data.__owner   # Linux glibc mutex
# prints TID of owning thread

# Python script to dump all mutex owners (GDB 7+)
python
import gdb
for t in gdb.selected_inferior().threads():
    t.switch()
    print(f"Thread {t.num}: {gdb.execute('bt 3', to_string=True)}")
end
```

### 4. std::atomic misuse patterns

```cpp
// WRONG: atomic variable, but non-atomic compound operation
std::atomic<int> counter{0};
if (counter == 0) counter = 1;   // not atomic together! TOCTOU race

// CORRECT: use compare_exchange
int expected = 0;
counter.compare_exchange_strong(expected, 1);

// WRONG: relaxed ordering for sync flag
std::atomic<bool> ready{false};
// Producer:
data = 42;
ready.store(true, std::memory_order_relaxed);  // WRONG: no happens-before

// CORRECT: release-acquire for publishing data
// Producer:
data = 42;
ready.store(true, std::memory_order_release);   // syncs with acquire

// Consumer:
if (ready.load(std::memory_order_acquire)) {    // syncs with release
    use(data);  // safe to read data here
}

// WRONG: using data across threads without atomic/mutex
// int shared_data;  // non-atomic — UB on concurrent access

// CORRECT: protect with mutex or make atomic
std::mutex mtx;
std::unique_lock lock(mtx);
shared_data = 42;
```

### 5. Happens-before reasoning

In C++, happens-before is established by:

```
Sequenced-before (within a thread):
  Statement A comes before B in code → A happens-before B

Synchronizes-with (across threads):
  store(release) → load(acquire) on SAME atomic variable
    → store happens-before load
    → everything before store happens-before everything after load

Thread creation/join:
  spawn(T) → any action in T         (create synchronizes-with)
  any action in T → join(T)          (join synchronizes-before)

Mutex:
  unlock(M) → lock(M) (next acquirer)
```

```cpp
// Establishing happens-before across threads
std::atomic<int> flag{0};
int data = 0;

// Thread 1:
data = 42;                        // A
flag.store(1, memory_order_release); // B: A sequenced-before B

// Thread 2:
while (flag.load(memory_order_acquire) != 1) {}  // C: synchronizes-with B
int x = data;                     // D: C sequenced-before D
// D reads 42: A happens-before B synchronizes-with C sequenced-before D
//             → A happens-before D
```

### 6. Rust concurrency — compile-time guarantees

Rust prevents data races at compile time via ownership:

```rust
use std::sync::{Arc, Mutex};
use std::thread;

// Shared mutable state: Arc<Mutex<T>>
let counter = Arc::new(Mutex::new(0u32));

let c = Arc::clone(&counter);
let t = thread::spawn(move || {
    let mut val = c.lock().unwrap();
    *val += 1;
});

t.join().unwrap();
println!("{}", *counter.lock().unwrap());

// Rust prevents:
// - Sharing &mut T across threads (Sync not impl for &mut T)
// - Moving non-Send types to threads (compiler error)
// Use TSAN_OPTIONS with cargo test if TSan checks are needed:
// RUSTFLAGS="-Z sanitizer=thread" cargo +nightly test
```

## Related skills

- Use `skills/runtimes/sanitizers` for TSan build flags and other sanitizers
- Use `skills/profilers/valgrind` for Helgrind and Memcheck integration
- Use `skills/debuggers/gdb` for advanced GDB thread inspection
- Use `skills/low-level-programming/memory-model` for C++/Rust memory ordering theory
