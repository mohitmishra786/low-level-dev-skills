---
name: kernel-concurrency
description: Kernel concurrency skill for Linux locking and synchronization. Use when choosing spinlocks vs mutexes, using RCU, seqlocks, completions, or applying memory barriers in kernel code. Activates on queries about kernel spinlock, mutex, RCU, seqlock, memory barrier, or PREEMPT_RT locking.
---

# Kernel Concurrency

## Purpose

Guide agents through synchronization in the Linux kernel: spinlocks, mutexes, semaphores, RCU, seqlocks, completions, and memory ordering rules — critical for correct drivers and subsystem patches.

## When to Use

- IRQ handler shares data with process context
- Read-mostly data structures needing RCU
- Choosing lock type for `probe` vs `ioctl` paths
- Debugging deadlocks or `scheduling while atomic`

## Workflow

### 1. Lock selection tree

```
Context can sleep?
├── No (IRQ, spinlock held, preempt disabled)
│   └── spin_lock_irqsave() / atomic_t
└── Yes
    ├── Exclusive long-held → mutex
    ├── Reader/writer → rw_semaphore or RCU (read-mostly)
    └── One-shot signal → completion
```

**Never sleep while holding a spinlock** (`kmalloc(GFP_KERNEL)`, `mutex_lock`).

### 2. Spinlock + IRQ

```c
spinlock_t lock;
unsigned long flags;

spin_lock_irqsave(&lock, flags);
/* critical section — no blocking */
spin_unlock_irqrestore(&lock, flags);
```

Use `spin_lock_bh` when softirq/tasklet sharing is the concern.

### 3. Mutex in process context

```c
struct mutex m;
mutex_lock(&m);
/* may allocate, may sleep */
mutex_unlock(&m);
```

### 4. RCU (read-copy update)

```c
/* Readers — no lock */
rcu_read_lock();
p = rcu_dereference(ptr);
/* use p */
rcu_read_unlock();

/* Writer */
new = kmalloc(...);
rcu_assign_pointer(ptr, new);
synchronize_rcu();
kfree(old);
```

RCU readers must not block indefinitely. Grace period completes after all CPUs quiescent.

### 5. Seqlock (jiffies, timestamps)

```c
unsigned seq;
do {
    seq = read_seqbegin(&seqlock);
    /* read shared data */
} while (read_seqretry(&seqlock, seq));
```

Writer uses `write_seqlock` / `write_sequnlock`.

### 6. Completions

```c
DECLARE_COMPLETION(done);
/* waiter */
wait_for_completion(&done);
/* signaller */
complete(&done);
```

### 7. Memory barriers

Kernel provides `smp_mb()`, `smp_wmb()`, `smp_rmb()`. Device MMIO uses `readl`/`writel` (ordered on most arches). See `skills/low-level-programming/memory-model` for userspace analogies.

### 8. Agent usage

```
/kernel-concurrency Protect shared ring buffer between IRQ and read() syscall
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `scheduling while atomic` | Sleep under spinlock | Use `GFP_ATOMIC` or defer work |
| Deadlock | AB-BA mutex order | Global lock ordering |
| RCU stall | Reader blocked too long | `rcu_read_lock` section minimal |
| Lost wake | `complete` before `wait` | Use `INIT_COMPLETION` each cycle |
| Corrupt counter | Non-atomic RMW in IRQ | `atomic_t` or lock |

## Related Skills

- `skills/kernel/device-drivers` — threaded IRQ pattern
- `skills/low-level-programming/memory-model` — C11 atomics vs kernel
- `skills/debuggers/concurrency-debugging` — userspace TSan
- `skills/kernel/kernel-internals` — scheduler preemption
- `skills/profilers/linux-perf` — lock contention profiling