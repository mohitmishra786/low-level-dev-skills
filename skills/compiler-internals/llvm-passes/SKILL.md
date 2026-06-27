---
name: llvm-passes
description: LLVM passes skill for writing compiler optimizations. Use when writing FunctionPass or ModulePass, registering PassPlugins, running with opt, using analysis utilities, or testing with llvm-lit. Activates on queries about LLVM pass, PassPlugin, opt -passes, DominatorTree, llvm-lit, or New Pass Manager.
---

# LLVM Passes

## Purpose

Guide agents through writing LLVM optimization passes with the New Pass Manager: `FunctionPass` and `ModulePass` structure, `PassPluginLibraryInfo` registration, running via `opt -load-pass-plugin`, common analysis utilities (`DominatorTree`, `LoopInfo`, `AliasAnalysis`), IR modification patterns, `llvm-lit` testing, and debugging with `opt -print-after-all`.

## When to Use

- Adding a custom optimization to an LLVM-based compiler
- Writing an IR transformation pass (inlining, DCE, custom lowering)
- Analyzing control flow with dominator trees or loop info
- Testing passes with FileCheck and llvm-lit
- Debugging pass ordering and IR corruption
- Integrating passes into Clang via plugin

## Workflow

### 1. New Pass Manager architecture

```
opt / clang
├── ModulePassManager
│   └── FunctionPassManager (per function)
│       └── FunctionPass instances
└── AnalysisManager (cached analyses)
```

Passes declare analysis usage; analyses are invalidated on IR mutation.

### 2. Minimal FunctionPass (C++ plugin)

```cpp
// MyPass.cpp
#include "llvm/IR/PassManager.h"
#include "llvm/Passes/PassBuilder.h"
#include "llvm/Passes/PassPlugin.h"
#include "llvm/Support/raw_ostream.h"

using namespace llvm;

namespace {

struct MyPass : PassInfoMixin<MyPass> {
    PreservedAnalyses run(Function &F, FunctionAnalysisManager &AM) {
        bool changed = false;
        for (BasicBlock &BB : F) {
            for (Instruction &I : BB) {
                if (auto *Call = dyn_cast<CallInst>(&I)) {
                    if (Call->getCalledFunction() &&
                        Call->getCalledFunction()->getName() == "dead_func") {
                        Call->eraseFromParent();
                        changed = true;
                    }
                }
            }
        }
        return changed ? PreservedAnalyses::none() : PreservedAnalyses::all();
    }
};

} // namespace

extern "C" LLVM_ATTRIBUTE_WEAK PassPluginLibraryInfo llvmGetPassPluginInfo() {
    return {
        LLVM_PLUGIN_API_VERSION, "MyPass", "v0.1",
        [](PassBuilder &PB) {
            PB.registerPipelineParsingCallback(
                [](StringRef Name, FunctionPassManager &FPM,
                   ArrayRef<PassBuilder::PipelineElement>) {
                    if (Name == "my-pass") {
                        FPM.addPass(MyPass());
                        return true;
                    }
                    return false;
                });
        }
    };
}
```

```cmake
# CMakeLists.txt
find_package(LLVM REQUIRED CONFIG)
add_library(MyPass MODULE MyPass.cpp)
target_include_directories(MyPass SYSTEM PRIVATE ${LLVM_INCLUDE_DIRS})
target_compile_definitions(MyPass PRIVATE ${LLVM_DEFINITIONS})
llvm_map_components_to_libnames(llvm_libs core passes support)
target_link_libraries(MyPass PRIVATE ${llvm_libs})
```

```bash
cmake -B build -DLLVM_DIR=$(llvm-config --cmakedir)
cmake --build build
```

### 3. Running with opt

```bash
# Run pass on IR file
opt -load-pass-plugin ./build/MyPass.so -passes=my-pass -S input.ll -o output.ll

# Print IR after each pass
opt -load-pass-plugin ./build/MyPass.so -passes=my-pass -print-after-all input.ll -o /dev/null

# Pass pipeline string
opt -passes="function(instcombine),my-pass,function(dce)" input.ll -S -o out.ll
```

### 4. ModulePass example

```cpp
struct MyModulePass : PassInfoMixin<MyModulePass> {
    PreservedAnalyses run(Module &M, ModuleAnalysisManager &AM) {
        for (Function &F : M) {
            if (F.isDeclaration()) continue;
            // module-level transformation
        }
        return PreservedAnalyses::none();
    }
};
```

Register on `ModulePassManager` in plugin callback.

### 5. Analysis utilities

```cpp
#include "llvm/Analysis/DominatorTree.h"
#include "llvm/Analysis/LoopInfo.h"
#include "llvm/Analysis/AliasAnalysis.h"

PreservedAnalyses run(Function &F, FunctionAnalysisManager &AM) {
    auto &DT = AM.getResult<DominatorTreeAnalysis>(F);
    auto &LI = AM.getResult<LoopAnalysis>(F);
    auto &AA = AM.getResult<AAManager>(F);

    for (Loop *L : LI) {
        BasicBlock *Header = L->getHeader();
        // Loop invariant code motion, etc.
    }

    DominatorTreeNode *IDom = DT.getNode(&F.getEntryBlock());
    (void)IDom;
    return PreservedAnalyses::all();
}
```

Declare analyses used:

```cpp
AnalysisUsage MyLegacyPass::getAnalysisUsage(AnalysisUsage &AU) const {
    AU.addRequired<DominatorTreeWrapperPass>();
    AU.addRequired<LoopInfoWrapperPass>();
    return AU;
}
```

(New PM: analyses requested via `AM.getResult<>` — dependency auto-tracked.)

### 6. IR modification patterns

```cpp
// Insert instruction before iterator
IRBuilder<> Builder(&*I.getIterator());
Value *NewVal = Builder.CreateAdd(I.getOperand(0), ConstantInt::get(I.getType(), 1));
I.replaceAllUsesWith(NewVal);
I.eraseFromParent();

// Clone basic block
BasicBlock *Clone = CloneBasicBlock(OrigBB, VMap, ".clone", &F);

// Create function
FunctionCallee Fn = M.getOrInsertFunction("my_fn",
    FunctionType::get(Builder.getVoidTy(), false));
```

Always update SSA and invalidate analyses after structural changes.

### 7. llvm-lit testing

```
test/
├── lit.cfg.py
└── my-pass.test
```

```
# my-pass.test
# RUN: opt -load-pass-plugin %shlibdir/MyPass.so -passes=my-pass -S %s | FileCheck %s

define void @test() {
  call void @dead_func()
  ret void
}

; CHECK-NOT: dead_func
```

```bash
llvm-lit test/my-pass.test -v
```

### 8. Debugging passes

```bash
# Verify IR after pass
opt -load-pass-plugin ./MyPass.so -passes=my-pass input.ll -o out.ll
opt -verify-each out.ll

# Time passes
opt -passes=my-pass -time-passes input.ll -o /dev/null

# Debug pass manager
OPT_DEBUG=1 opt -passes=my-pass input.ll -o /dev/null
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Pass not found: my-pass` | Plugin not loaded or name mismatch | Check `registerPipelineParsingCallback` name |
| Verify module failed | Broken SSA after transform | Run `-verify-each`; check use-def chains |
| Analysis stale | Modified IR without invalidation | Return `PreservedAnalyses::none()` |
| Plugin load error | LLVM version mismatch | Build against same LLVM as opt |
| Empty opt output | Forgot `-S` | Add `-S` for textual IR |
| lit test FAIL | CHECK line mismatch | `opt -S` and compare manually |

## Related Skills

- `skills/compilers/llvm` — LLVM IR inspection and opt pipeline as user
- `skills/compiler-internals/compiler-frontend` — IR generation feeding passes
- `skills/compiler-internals/jit-compilation` — ORC JIT running optimized IR
- `skills/compiler-internals/mlir` — MLIR passes (similar concepts)
- `skills/compilers/clang` — Clang optimization flags
- `skills/build-systems/cmake` — building pass plugins