---
name: interpreters
description: Bytecode interpreter and JIT compiler skill for implementing language runtimes in C/C++. Use when designing bytecode dispatch loops (switch, computed goto, threaded code), implementing stack-based or register-based VMs, adding a simple JIT using mmap/mprotect, or understanding performance trade-offs in interpreter design. Activates on queries about bytecode VMs, dispatch loops, computed goto, JIT compilation basics, tracing JITs, or implementing a scripting language runtime.
---

# Interpreters and Bytecode VMs

## Purpose

Guide agents through implementing efficient bytecode interpreters and simple JITs in C/C++: dispatch strategies, VM architecture choices, and performance patterns.

## Triggers

- "How do I implement a fast bytecode dispatch loop?"
- "What is the difference between switch dispatch and computed goto?"
- "How do I implement a register-based vs stack-based VM?"
- "How do I add basic JIT compilation to my interpreter?"
- "Why is my interpreter slow?"

## Workflow

### 1. VM architecture choice

| Style | Description | Examples |
|-------|-------------|---------|
| Stack-based | Operands on a value stack; compact bytecode | JVM, CPython, WebAssembly |
| Register-based | Operands in virtual registers; fewer instructions | Lua 5+, Dalvik |
| Direct threading | Each "instruction" is a function call | Some Forth implementations |
| Continuation-passing | Interpreter functions return continuations | Academic |

**Stack-based:** easier to implement, compile to; code generation is simpler. More instructions per expression.
**Register-based:** fewer dispatch iterations; needs register allocation in the compiler; better cache behaviour for complex expressions.

### 2. Dispatch loop strategies

#### Switch dispatch (simplest, baseline)

```c
while (1) {
    uint8_t op = *ip++;
    switch (op) {
        case OP_LOAD:  push(constants[*ip++]); break;
        case OP_ADD:   { Value b = pop(); Value a = pop(); push(a + b); } break;
        case OP_HALT:  return;
        // ...
    }
}
```

Problem: `switch` compiles to a single indirect branch from a jump table. Modern CPUs can mispredict it heavily because the same indirect branch is used for all opcodes.

#### Computed goto (GCC/Clang extension — fastest portable approach)

```c
// Table of label addresses
static const void *dispatch_table[] = {
    [OP_LOAD]  = &&op_load,
    [OP_ADD]   = &&op_add,
    [OP_HALT]  = &&op_halt,
    // ...
};

#define DISPATCH() goto *dispatch_table[*ip++]

DISPATCH();  // start

op_load:
    push(constants[*ip++]);
    DISPATCH();

op_add: {
    Value b = pop(); Value a = pop(); push(a + b);
    DISPATCH();
}

op_halt:
    return;
```

Each opcode ends with its own indirect branch. The CPU can train the branch predictor per-opcode, dramatically improving prediction rates.

**Note:** `&&label` is a GCC/Clang extension, not standard C. Use `#ifdef __GNUC__` to guard and fall back to switch for other compilers.

#### Direct threaded code (most aggressive)

Each bytecode word is a function pointer or label address; the VM is the fetch-decode-execute loop itself.

```c
typedef void (*Handler)(VM *vm);

// Bytecode is an array of handlers
Handler bytecode[] = { op_load, op_push_1, op_add, op_halt };

for (int i = 0; ; i++) {
    bytecode[i](vm);
}
```

### 3. Value representation

**Tagged pointer:** Store type tag in low bits of pointer (pointer alignment guarantees ≥ 2 bits free):

```c
typedef uintptr_t Value;
#define TAG_INT    0x0
#define TAG_FLOAT  0x1
#define TAG_PTR    0x2
#define TAG_MASK   0x3

#define INT_VAL(v)   ((int64_t)(v) >> 2)
#define FLOAT_VAL(v) (*(float*)((v) & ~TAG_MASK))
#define IS_INT(v)    (((v) & TAG_MASK) == TAG_INT)
```

**NaN boxing (64-bit):** Store non-double values in NaN bit patterns:

```c
// IEEE 754 quiet NaN: exponent all 1s, mantissa != 0
// Use high mantissa bits as type tag, low 48 bits as payload
// Allows pointer/int/bool/nil to fit in a double-sized slot
```

Used by V8 (formerly), LuaJIT, JavaScriptCore.

### 4. Stack management

```c
#define STACK_SIZE 4096
Value stack[STACK_SIZE];
Value *sp = stack;  // stack pointer

#define PUSH(v) (*sp++ = (v))
#define POP()   (*--sp)
#define TOP()   (sp[-1])
#define PEEK(n) (sp[-(n)-1])

// Check for overflow
#define PUSH_SAFE(v) do { \
    if (sp >= stack + STACK_SIZE) { vm_error("stack overflow"); } \
    PUSH(v); \
} while(0)
```

### 5. Inline caching (IC)

Inline caching speeds up property lookups and method dispatch by caching the last observed type at each call site.

```c
struct CallSite {
    Type   cached_type;      // Last observed receiver type
    void  *cached_method;    // Cached function pointer
    int    miss_count;       // Number of misses
};

void invoke_method(VM *vm, CallSite *cs, Value receiver, ...) {
    Type t = GET_TYPE(receiver);
    if (t == cs->cached_type) {
        // Cache hit: direct call, no lookup
        cs->cached_method(vm, receiver, ...);
    } else {
        // Cache miss: look up, update cache
        void *method = lookup_method(t, name);
        cs->cached_type = t;
        cs->cached_method = method;
        cs->miss_count++;
        method(vm, receiver, ...);
    }
}
```

Polymorphic IC (PIC): cache up to N (typ. 4) type-method pairs.

### 6. Simple JIT (mmap + machine code)

For x86-64: allocate executable memory, write machine code bytes, call it.

```c
#include <sys/mman.h>
#include <string.h>

typedef int (*JitFn)(int a, int b);

JitFn jit_compile_add(void) {
    // x86-64: add rdi, rsi; mov rax, rdi; ret
    static const uint8_t code[] = {
        0x48, 0x01, 0xF7,   // add rdi, rsi
        0x48, 0x89, 0xF8,   // mov rax, rdi
        0xC3                 // ret
    };

    void *mem = mmap(NULL, sizeof(code),
                     PROT_READ | PROT_WRITE | PROT_EXEC,
                     MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    if (mem == MAP_FAILED) return NULL;

    memcpy(mem, code, sizeof(code));

    // On some systems (macOS Apple Silicon): must use mprotect
    // mprotect(mem, sizeof(code), PROT_READ | PROT_EXEC);

    return (JitFn)mem;
}
```

On macOS Apple Silicon (M-series): use `pthread_jit_write_protect_np()` or `MAP_JIT` flag.

### 7. Performance tips

1. **Dispatch:** Use computed goto over switch on GCC/Clang
2. **Values:** Use NaN boxing or tagged pointers; avoid boxing/unboxing in hot paths
3. **Stack:** Keep stack pointer in a callee-saved register (`register Value *sp asm("r15")` — GCC global register variable)
4. **Locals access:** Keep frequently accessed locals in VM registers (struct fields), not stack
5. **Profiling:** Use `perf` or sampling to find dispatch overhead vs actual work
6. **Specialisation:** Generate specialised handler variants for common type combinations (int+int add vs generic add)
7. **Trace recording:** Trace JITs (LuaJIT approach) compile hot traces instead of full functions

For a benchmark of dispatch strategies, see [references/benchmarks.md](references/benchmarks.md).

## Related skills

- Use `skills/profilers/linux-perf` to profile the interpreter dispatch loop
- Use `skills/low-level-programming/assembly-x86` to understand JIT output
- Use `skills/runtimes/fuzzing` to fuzz the bytecode parser/loader
- Use `skills/compilers/llvm` for LLVM IR-based JIT (MCJIT / ORC JIT)
