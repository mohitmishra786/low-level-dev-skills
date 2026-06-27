---
name: jit-compilation
description: JIT compilation skill for runtime code generation. Use when building LLVM ORC JIT, LLJIT, Cranelift JIT, inline caches, trampolines, or Rust dynasm codegen. Activates on queries about ORC JIT, LLJIT, Cranelift, ExecutionSession, inline cache, W^X, or dynasm.
---

# JIT Compilation

## Purpose

Guide agents through just-in-time compilation: LLVM ORC JIT v2 (`ExecutionSession`, `IRLayer`, `ObjectLayer`), LLJIT for simpler use cases, Cranelift JIT, inline caches for dynamic dispatch, trampolines for lazy compilation, security considerations (W^X, code signing), and Rust `dynasm` for x86 codegen.

## When to Use

- Building an interpreter with a JIT hot-path
- Implementing lazy function compilation on first call
- Embedding dynamic code generation in a REPL or game engine
- Prototyping codegen without writing a full linker
- Creating inline caches for polymorphic call sites
- Generating x86 machine code from Rust with `dynasm`

## Workflow

### 1. JIT architecture overview

```
Source/AST/Bytecode
    → IR (LLVM IR or Cranelift CLIF)
    → Object file (in memory)
    → Runtime linker (RTDyldObjectLinkingLayer)
    → Executable code in R+X memory
    → Function pointer call
```

### 2. LLJIT — simplest LLVM JIT

```cpp
#include "llvm/ExecutionEngine/Orc/LLJIT.h"
#include "llvm/IR/LLVMContext.h"
#include "llvm/IR/Module.h"
#include "llvm/IR/IRBuilder.h"

using namespace llvm;
using namespace llvm::orc;

int main() {
    auto JIT = cantFail(LLJITBuilder().create());

    LLVMContext Context;
    auto M = std::make_unique<Module>("jit", Context);
    IRBuilder<> Builder(Context);

    // int add(int a, int b) { return a + b; }
    Function *AddFn = Function::Create(
        FunctionType::get(Builder.getInt32Ty(),
                          {Builder.getInt32Ty(), Builder.getInt32Ty()}, false),
        Function::ExternalLinkage, "add", M.get());

    BasicBlock *BB = BasicBlock::Create(Context, "entry", AddFn);
    Builder.SetInsertPoint(BB);
    auto Args = AddFn->arg_begin();
    Value *Sum = Builder.CreateAdd(Args, Args + 1);
    Builder.CreateRet(Sum);

    cantFail(JIT->addIRModule(ThreadSafeModule(std::move(M), std::make_unique<LLVMContext>())));

    auto AddSym = JIT->lookup("add");
    auto *AddPtr = (int (*)(int, int))AddSym->getValue();
    int result = AddPtr(3, 4);  // 7
    return 0;
}
```

```bash
clang++ -std=c++17 jit.cpp $(llvm-config --cxxflags --ldflags --libs core orcjit native) -o jit
```

### 3. ORC JIT v2 layers

```cpp
ExecutionSession ES;
auto &MainJD = ES.createBareJITDylib("main");

RTDyldObjectLinkingLayer ObjectLayer(
    ES, []() { return std::make_unique<SectionMemoryManager>(); });

IRCompileLayer CompileLayer(
    ES, ObjectLayer, std::make_unique<TargetMachineBuilder>());

// Add IR module to JITDylib
ThreadSafeModule TSM = ...;
CompileLayer.add(MainJD, std::move(TSM));

// Resolve symbol
auto Sym = ES.lookup({&MainJD}, "my_func");
```

Layers:
- **IRLayer** — compiles LLVM IR to object
- **ObjectLayer** — links relocatable objects
- **ExecutionSession** — symbol lookup and JITDylib management

### 4. Lazy compilation with trampolines

```
First call → trampoline → compile function → patch trampoline → direct call
```

```cpp
// Simplified lazy compile on first invocation
void *LazyCompile(const std::string &Name) {
    if (!Compiled.count(Name)) {
        auto Fn = CompileFromAST(Name);
        Compiled[Name] = Fn;
        // Patch call site or update function pointer table
    }
    return Compiled[Name];
}
```

ORC supports lazy reexports and lazy compilation via `LazyCallThroughManager`.

### 5. Inline caches

```javascript
// Concept: monomorphic call site caches resolved target
// Pseudocode for dynamic language
function call_site(obj, method, args) {
    if (obj.class_id === cache.class_id) {
        return cache.fn_ptr(args);  // fast path
    }
    cache.class_id = obj.class_id;
    cache.fn_ptr = resolve_method(obj, method);
    return cache.fn_ptr(args);
}
```

JIT generates specialized code per cached type; deoptimize on cache miss.

### 6. Cranelift JIT

```rust
use cranelift::prelude::*;
use cranelift_jit::{JITBuilder, JITModule};
use cranelift_module::{Linkage, Module};

let isa = cranelift_native::builder().finish(settings::Flags::new(settings::builder()))?;
let jit_builder = JITBuilder::with_isa(isa, cranelift_module::default_libcall_names());
let mut module = JITModule::new(jit_builder);

let mut ctx = module.make_context();
ctx.func = Function::with_name_signature(
    module.declare_function("add", Linkage::Export, &sig)?,
    sig,
);
// ... build IR in ctx.func ...
module.define_function(func_id, &mut ctx)?;
module.finalize_definitions()?;
let code = module.get_finalized_function(func_id);
let add_fn: fn(i32, i32) -> i32 = unsafe { std::mem::transmute(code) };
```

Cranelift: faster compile times than LLVM, good for embeddable JITs.

### 7. Security — W^X policy

```
W^X (Write XOR Execute)
├── Memory page is writable OR executable, never both
├── JIT: allocate RW → write code → mprotect(RX)
└── macOS hardened runtime requires signed JIT pages
```

```c
#include <sys/mman.h>

void *mem = mmap(NULL, size, PROT_READ | PROT_WRITE,
                 MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
// write machine code to mem
mprotect(mem, size, PROT_READ | PROT_EXEC);
```

Linux: `MAP_JIT` on Apple platforms; `sealed` memfd on hardened systems.

### 8. Rust dynasm (x86)

```rust
use dynasm::dynasm;
use dynasmrt::{Assembler, ExecutableBuffer};

let mut asm = Assembler::new().unwrap();
dynasm!(asm
    ; .arch x86_64
    ; add:
    ; add eax, ecx
    ; ret
);
let buf = asm.finalize().unwrap();
let add_fn: fn(i32, i32) -> i32 = unsafe { std::mem::transmute(buf.ptr(0)) };
```

Use for lightweight asm snippets without LLVM dependency.

### 9. Decision tree

```
JIT backend choice?
├── Need LLVM optimizations → ORC JIT / LLJIT
├── Fast compile, embeddable → Cranelift
├── Tiny asm snippets → dynasm
└── ML workloads → MLIR → ORC pipeline
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Symbol not found on lookup | Name mangling or not exported | Use C linkage; `LLVMExternalLinkage` |
| Segfault calling JIT code | ABI mismatch | Match calling convention and types |
| W^X mmap failed | SELinux/grsecurity | Use `MAP_JIT`; check `dmesg` |
| Stale code after recompile | Old function pointer | Invalidate caches; use trampolines |
| LLVM JIT slow compile | `-O2` in JIT | Use `-O0` for JIT; optimize hot paths only |
| Cranelift verify error | Invalid CLIF | Enable `cranelift_codegen::verify_function` |

## Related Skills

- `skills/compiler-internals/llvm-passes` — optimize before JIT
- `skills/compiler-internals/compiler-frontend` — AST to IR for JIT input
- `skills/compiler-internals/mlir` — MLIR lowering to LLVM for JIT
- `skills/compilers/llvm` — LLVM IR fundamentals
- `skills/low-level-programming/interpreters` — bytecode interpreters using JIT
- `skills/low-level-programming/assembly-x86` — hand-written asm context