---
name: cpu-pipelines-and-hazards
description: CPU pipeline skill for hazards, forwarding, and stalls. Use when explaining pipeline stages, data/control hazards, forwarding paths, or branch stalls in performance analysis. Activates on queries about pipeline hazard, data hazard, control hazard, forwarding, pipeline stall, or superscalar basics.
---

# CPU Pipelines and Hazards

## Purpose

Explain classic and modern CPU pipeline concepts: stages, data and control hazards, forwarding/bypassing, stalls, and branch handling — foundational for optimization and understanding microarchitecture counters.

## When to Use

- Interpreting pipeline stall metrics from `skills/profilers/intel-vtune-amd-uprof`
- Teaching why instruction order affects throughput
- Relating assembly scheduling to hardware behavior
- Debugging unexpected performance cliffs in hot loops

## Workflow

### 1. Five-stage classic pipeline (MIPS-style mental model)

```
IF → ID → EX → MEM → WB
```

Overlapped execution: instruction N in EX while N+1 in ID.

### 2. Data hazards

| Type | Example | Mitigation |
|------|---------|------------|
| RAW (true) | `add r1,r2,r3` then `sub r4,r1,r5` | Forwarding from EX/MEM/WB |
| WAR / WAW | Rare in in-order; relevant in OoO rename | Register renaming |

Without forwarding:

```
stall until writeback completes
```

### 3. Control hazards (branches)

```
Branch in ID → target unknown until EX
├── Predict taken/not-taken (static or dynamic)
├── Flush wrong-path instructions on mispredict
└── Penalty = pipeline depth (varies by CPU)
```

See `skills/computer-architecture/branch-prediction-and-speculation`.

### 4. Structural hazards

Limited functional units (single memory port) cause stalls even without dependencies.

### 5. Practical optimization hints

```c
/* Bad — tight dependency chain */
for (int i = 0; i < n; i++)
    acc = acc + data[i];   /* each iter waits on acc */

/* Better — multiple accumulators (ILP) */
acc0 = acc1 = 0;
for (int i = 0; i < n; i += 2) {
    acc0 += data[i];
    acc1 += data[i+1];
}
acc = acc0 + acc1;
```

Pair with `skills/low-level-programming/cpu-cache-opt` — memory often dominates.

### 6. Reading uops / ports (x86)

```bash
perf stat -e instructions,cycles,stalls-frontend,stalls-backend ./app
```

VTune "Microarchitecture Exploration" maps to pipeline slots.

### 7. Agent usage

```
/cpu-pipelines-and-hazards Explain RAW hazard in this ARM assembly loop and how to break it
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| High `stalls-frontend` | I-cache misses / branch mispredict | Align hot loop; see branch skill |
| No speedup from unroll | Memory bound | Profile loads; prefetch |
| Wrong cycle model | Ignored OoO execution | Use perf hardware counters |
| "NOP fixes it" | Timing-sensitive MMIO | Never tune device delays by NOP |

## Related Skills

- `skills/computer-architecture/branch-prediction-and-speculation` — mispredict cost
- `skills/computer-architecture/memory-hierarchy-and-caches` — load latency
- `skills/low-level-programming/cpu-cache-opt` — cache-line effects
- `skills/profilers/intel-vtune-amd-uprof` — pipeline analysis
- `skills/low-level-programming/assembly-arm` — instruction scheduling