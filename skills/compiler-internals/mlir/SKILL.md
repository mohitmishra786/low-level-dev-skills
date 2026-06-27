---
name: mlir
description: MLIR skill for multi-level intermediate representation. Use when writing custom dialects, defining ops with ODS, writing lowering passes, running mlir-opt, or building ML compilers with Torch-MLIR/IREE. Activates on queries about MLIR, dialect, ODS, mlir-opt, linalg, lowering pass, or Torch-MLIR.
---

# MLIR

## Purpose

Guide agents through MLIR (Multi-Level IR): ops, regions, blocks, and values; built-in dialects (arith, func, memref, affine, linalg); writing custom dialects with ODS; lowering passes with `ConversionPattern`; `mlir-opt` CLI; and ML compiler use cases (Torch-MLIR, IREE).

## When to Use

- Building a domain-specific compiler IR (graphics, ML, hardware DSL)
- Lowering high-level ops to LLVM or GPU dialects
- Writing progressive lowering pipelines (linalg → loops → LLVM)
- Integrating with IREE or Torch-MLIR for ML deployment
- Creating reusable transformation passes across dialects
- Prototyping compiler optimizations at the right abstraction level

## Workflow

### 1. MLIR structure

```
Module
└── func.func @main()
    └── region
        └── block ^bb0:
            └── operations (ops) producing SSA values
```

Key concepts:
- **Operation** — instruction-like node (`arith.addi`, `memref.load`)
- **Region** — container of blocks (functions, control flow)
- **Block** — CFG node with ordered ops
- **Value** — SSA result of an op or block argument

### 2. Built-in dialects

| Dialect | Purpose |
|---------|---------|
| `arith` | Integer/float arithmetic |
| `func` | Function definitions and calls |
| `memref` | Buffer abstraction with shapes/strides |
| `affine` | Affine loop nests, map/set constraints |
| `linalg` | Structured linear algebra ops |
| `scf` | Structured control flow (for, if) |
| `llvm` | LLVM IR dialect for final lowering |
| `gpu` | GPU kernel launches |

```mlir
// example.mlir
func.func @add(%a: memref<4xf32>, %b: memref<4xf32>, %c: memref<4xf32>) {
  %c0 = arith.constant 0 : index
  %c4 = arith.constant 4 : index
  scf.for %i = %c0 to %c4 step %c1 {
    %av = memref.load %a[%i] : memref<4xf32>
    %bv = memref.load %b[%i] : memref<4xf32>
    %sum = arith.addf %av, %bv : f32
    memref.store %sum, %c[%i] : memref<4xf32>
  }
  return
}
```

### 3. mlir-opt CLI

```bash
# Parse and print
mlir-opt example.mlir

# Run canonicalization
mlir-opt example.mlir -canonicalize

# Lower affine to scf
mlir-opt affine.mlir -lower-affine

# Full pipeline toward LLVM
mlir-opt input.mlir \
  --linalg-bufferize \
  --convert-linalg-to-loops \
  --convert-scf-to-cf \
  --convert-arith-to-llvm \
  --convert-memref-to-llvm \
  --convert-func-to-llvm \
  -o llvm.mlir
```

### 4. ODS — Operation Definition Specification

```tablegen
// MyOps.td
include "mlir/IR/OpBase.td"

def My_Dialect : Dialect {
    let name = "my";
    let summary = "My custom dialect";
}

class My_Op<string mnemonic, list<Trait> traits = []> :
    Op<My_Dialect, mnemonic, traits>;

def AddOp : My_Op<"add", [Pure]> {
    let summary = "Add two values";
    let arguments = (ins AnyType:$lhs, AnyType:$rhs);
    let results = (outs AnyType:$result);
    let assemblyFormat = "$lhs `,` $rhs attr-dict `:` type($result)";
}
```

```bash
# Generate C++ from TableGen
mlir-tblgen -gen-op-defs MyOps.td -I include/ -o MyOps.cpp.inc
```

### 5. Custom dialect C++ implementation

```cpp
#include "mlir/IR/DialectImplementation.h"
#include "MyDialect.h"

#include "MyOps.cpp.inc"

void MyDialect::initialize() {
    addOperations<
#define GET_OP_LIST
#include "MyOps.cpp.inc"
    >();
}

#define GET_OP_CLASSES
#include "MyOps.cpp.inc"
```

### 6. Lowering passes

```cpp
#include "mlir/Conversion/LLVMCommon/ConversionTarget.h"
#include "mlir/Transforms/DialectConversion.h"

struct AddOpLowering : OpConversionPattern<my::AddOp> {
    using OpConversionPattern::OpConversionPattern;

    LogicalResult matchAndRewrite(my::AddOp op, OpAdaptor adaptor,
                                  ConversionPatternRewriter &rewriter) const override {
        rewriter.replaceOpWithNewOp<arith::AddIOp>(op, adaptor.getLhs(), adaptor.getRhs());
        return success();
    }
};

void populateLoweringPatterns(RewritePatternSet &patterns) {
    patterns.add<AddOpLowering>(patterns.getContext());
}

// In pass:
mlir::ConversionTarget target(*context);
target.addIllegalDialect<my::MyDialect>();
target.addLegalDialect<arith::ArithDialect>();

if (failed(applyPartialConversion(module, target, std::move(patterns))))
    signalPassFailure();
```

### 7. linalg for ML compilers

```mlir
%0 = linalg.matmul ins(%A, %B : tensor<128x256xf32>, tensor<256x64xf32>)
                   outs(%C : tensor<128x64xf32>) -> tensor<128x64xf32>
```

Lowering path: `linalg` → `scf` loops → `affine` → `llvm`

### 8. Torch-MLIR and IREE

```bash
# Torch-MLIR: PyTorch → MLIR
python -m torch_mlir.tools.import-onnx --onnx-model model.onnx -o model.mlir

# IREE: MLIR → GPU/CPU executable
iree-compile --iree-hal-target-backends=llvm-cpu model.mlir -o model.vmfb
iree-run-module --module=model.vmfb --function=main
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Dialect not registered | Missing `registerDialect` | Register in tool/pass init |
| ODS build failure | TableGen include path | Check `-I` for mlir/IR/OpBase.td |
| Lowering incomplete | Illegal ops remain | Debug with `--mlir-print-ir-after-failure` |
| Type mismatch in pattern | Wrong adaptor types | Use `OpAdaptor` typed accessors |
| mlir-opt crash | Invalid IR | Run `-verify-each` |
| Empty function after lowering | All ops illegal, none converted | Add missing patterns |

## Related Skills

- `skills/compiler-internals/llvm-passes` — LLVM pass equivalents
- `skills/compiler-internals/compiler-frontend` — AST to MLIR import
- `skills/compiler-internals/jit-compilation` — JIT compiled MLIR→LLVM
- `skills/compilers/llvm` — LLVM IR output target
- `skills/gpu/cuda` — GPU dialect lowering targets
- `skills/gpu/triton-lang` — alternative GPU kernel IR