---
name: branch-prediction-and-speculation
description: Branch prediction and speculation skill for CPU security and performance. Use when explaining branch predictors, mispredict penalties, speculative execution, Spectre/Meltdown mitigations, or branchless patterns. Activates on queries about branch prediction, speculative execution, Spectre, Meltdown, mispredict, or branchless code.
---

# Branch Prediction and Speculation

## Purpose

Explain how modern CPUs predict branches, execute speculatively, recover on mispredict, and why speculation created side channels (Spectre/Meltdown) — linking performance tuning with security-aware low-level coding.

## When to Use

- Hot loop branchy code underperforms expectations
- Evaluating `likely`/`unlikely` or branchless refactors
- Understanding kernel `retpoline`, IBRS, and similar mitigations
- Secure coding around secret-dependent branches

## Workflow

### 1. Branch predictor basics

```
Fetch sees conditional branch
├── Predict direction (taken / not-taken)
├── Speculatively execute predicted path
└── On resolve:
    ├── Correct → commit, ~0 penalty (deep pipelines still cost on mispredict)
    └── Wrong → squash, refill from correct PC (10–20+ cycles typical)
```

Patterns: backward branches often predicted taken (loops); forward not-taken.

### 2. Performance patterns

```c
/* Predictable — tight loop backward branch */
for (int i = 0; i < n; i++)
    sum += a[i];

/* Unpredictable — data-dependent */
if (data[i] > threshold)  /* hard to predict */
    rare_path();
```

Techniques: branchless `cmov`/select, lookup tables, sorting data to reduce branches, splitting hot/cold paths.

```c
/* Branchless min (integer) */
int m = a < b ? a : b;  /* compiler may lower to cmov */
```

### 3. Compiler hints (use sparingly)

```c
#define likely(x)   __builtin_expect(!!(x), 1)
#define unlikely(x) __builtin_expect(!!(x), 0)

if (unlikely(ptr == NULL))
    return -EINVAL;
```

Measure with `perf` — hints are not magic on modern predictors.

### 4. Speculative execution and side channels

CPUs may execute instructions before branch outcome is known. If speculated path touches secret-dependent memory, cache state can leak (Spectre variant 1).

**Mitigations (high level):**

- Kernel: retpoline, IBRS/IBPB, STIBP (see kernel `cpu_show_mitigations`)
- Compiler: speculative load hardening (`-mspeculative-load-hardening` on Clang)
- Code: constant-time crypto — no secret-dependent branches or indices

Meltdown (Intel): user load from kernel mapping — fixed by KPTI (separate page tables).

### 5. Measurement

```bash
perf stat -e branches,branch-misses ./app
```

High `branch-misses` ratio → investigate hot branches.

### 6. Agent usage

```
/branch-prediction-and-speculation Make this comparison function constant-time against Spectre-style leakage
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Loop slower than expected | Mispredicted exit | Peel iterations; branchless tail |
| `likely` no help | Predictor already good | Profile first |
| Secret leak in crypto | Branches on secret bytes | Constant-time algorithms |
| Mitigation regression | KPTI/retpoline overhead | Accept or isolate secrets |
| "Branchless" slower | CMOV still executes both | Benchmark on target CPU |

## Related Skills

- `skills/computer-architecture/cpu-pipelines-and-hazards` — control hazards
- `skills/security/kernel-security` — KPTI, CET, speculation mitigations
- `skills/low-level-programming/cpu-cache-opt` — cache timing channels
- `skills/profilers/hardware-counters` — branch-misses event
- `skills/runtimes/binary-hardening` — userspace hardening overlap