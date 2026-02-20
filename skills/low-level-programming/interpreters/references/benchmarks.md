# Interpreter Dispatch Benchmark Notes

## Dispatch strategy relative performance

Results vary by workload and CPU, but the general ordering is consistent:

| Strategy | Relative throughput | Branch predictor behaviour |
|----------|--------------------|-----------------------------|
| `switch` dispatch | 1× (baseline) | One shared indirect branch; hard to predict for complex opcode mix |
| Computed goto | 1.5–3× | One indirect branch per opcode; per-opcode training possible |
| Subroutine threading | ~1.5× | Function call overhead; good on CPUs with BTB per call site |
| Direct threading | 2–4× | Same as computed goto but pointer-sized bytecode |
| Native JIT | 10–100× | No dispatch at all for hot traces |

Source: various academic papers and LuaJIT blog posts by Mike Pall.

## Measuring dispatch overhead

```bash
# Profile the interpreter loop
perf record -g -F 9999 ./my_interpreter benchmark.bc
perf report --no-children   # look at self time

# Expected: high self-time on the dispatch instruction itself
# means CPU is mispredicting the indirect branch
```

Symptom of dispatch overhead: `perf report` shows high time at the `jmp [r14]` (or equivalent indirect jump) instruction, not inside the opcode handlers.

Fix: switch to computed goto or add a tracing JIT.

## JIT threshold heuristics

Most production runtimes use multi-tier JIT:

| Tier | Strategy | Activation |
|------|---------|-----------|
| Interpreter | Switch or computed goto | Always |
| Baseline JIT | Simple code gen, no opt | After N=100–1000 calls |
| Optimising JIT | Full SSA, speculative, IC | After M=10000+ calls with stable types |

LuaJIT uses trace recording: compile a hot loop's trace after 56 iterations.
V8 uses function-level tiering: Ignition (bytecode) → Maglev (mid-tier) → Turbofan (optimising).

## Stack frame layout recommendations

```c
// Keep hot fields first in the VM struct (better cache line usage)
typedef struct VM {
    Value  *sp;        // stack pointer — accessed every instruction
    uint8_t *ip;       // instruction pointer — accessed every instruction
    Value  *stack;     // stack base
    Value  *locals;    // current frame locals
    // ... less-hot fields ...
    int     call_depth;
    GC     *gc;
    Table  *globals;
} VM;
```

Pack hot VM state into 1–2 cache lines (64 bytes each). Accessing `sp` and `ip` should never cause cache misses in a tight loop.
