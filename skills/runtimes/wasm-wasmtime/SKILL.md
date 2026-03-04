---
name: wasm-wasmtime
description: WebAssembly runtime skill using wasmtime. Use when running WASM modules with wasmtime CLI, working with WASI preview2, using the component model, embedding wasmtime in Rust applications, limiting execution with fuel metering, or debugging WASM with DWARF in wasmtime. Activates on queries about wasmtime, WASI, WASM component model, wasmtime embedding, WIT interfaces, fuel metering, or server-side WebAssembly.
---

# wasmtime — Server-Side WASM Runtime

## Purpose

Guide agents through wasmtime: running WASM modules from the CLI, WASI APIs, the component model with WIT interfaces, embedding wasmtime in Rust applications, fuel metering for sandboxed execution, and debugging WASM with DWARF debug info.

## Triggers

- "How do I run a WASM file with wasmtime?"
- "How does WASI work with wasmtime?"
- "How do I embed wasmtime in my Rust application?"
- "What is the WebAssembly component model?"
- "How do I limit WASM execution with fuel?"
- "How do I debug a WASM module in wasmtime?"

## Workflow

### 1. wasmtime CLI

```bash
# Install
curl https://wasmtime.dev/install.sh -sSf | bash

# Run a WASM module
wasmtime hello.wasm

# Run with WASI arguments
wasmtime prog.wasm -- arg1 arg2

# Pre-open directories (WASI filesystem sandbox)
wasmtime --dir /tmp::/ prog.wasm    # map host /tmp to WASI root

# Pass environment variables
wasmtime --env HOME=/home/user prog.wasm

# Invoke specific exported function
wasmtime run --invoke add math.wasm 3 4

# Inspect exports
wasmtime explore math.wasm    # interactive explorer
wasmtime inspect math.wasm    # show all exports/imports

# Compile to native ahead-of-time
wasmtime compile prog.wasm -o prog.cwasm
wasmtime run prog.cwasm
```

### 2. WASI preview2 APIs

WASI preview2 provides a capability-based POSIX-like API set:

```bash
# wasmtime supports WASI p2 natively
wasmtime --wasi-modules experimental-wasi-http prog.wasm

# Key WASI interfaces (WIT)
# wasi:filesystem — file and directory access
# wasi:sockets — TCP/UDP networking (preview2)
# wasi:http — HTTP client/server (experimental)
# wasi:cli — stdin/stdout/stderr, environment
# wasi:random — secure random numbers
# wasi:clocks — system and monotonic clocks
```

### 3. Embedding wasmtime in Rust

```toml
# Cargo.toml
[dependencies]
wasmtime = "24"
wasmtime-wasi = "24"
anyhow = "1"
```

```rust
use wasmtime::*;
use wasmtime_wasi::WasiCtxBuilder;

fn main() -> anyhow::Result<()> {
    // Create engine with default config
    let engine = Engine::default();

    // Load and compile WASM module
    let module = Module::from_file(&engine, "prog.wasm")?;

    // Set up WASI context
    let wasi = WasiCtxBuilder::new()
        .inherit_stdio()
        .inherit_env()
        .preopened_dir("/tmp", "/")?
        .build();

    // Create a store (holds WASM state)
    let mut store = Store::new(&engine, wasi);

    // Instantiate the module
    let instance = Instance::new(&mut store, &module, &[])?;

    // Call an exported function
    let add = instance.get_typed_func::<(i32, i32), i32>(&mut store, "add")?;
    let result = add.call(&mut store, (3, 4))?;
    println!("Result: {result}");

    Ok(())
}
```

### 4. Fuel metering — CPU limiting

Fuel metering limits the number of WASM instructions executed, preventing runaway or malicious code:

```rust
use wasmtime::*;

let mut config = Config::default();
config.consume_fuel(true);    // enable fuel consumption

let engine = Engine::new(&config)?;
let module = Module::from_file(&engine, "untrusted.wasm")?;

let mut store = Store::new(&engine, ());
store.set_fuel(1_000_000)?;   // allow 1M instructions

let instance = Instance::new(&mut store, &module, &[])?;
let run = instance.get_typed_func::<(), ()>(&mut store, "run")?;

match run.call(&mut store, ()) {
    Ok(_) => println!("Completed, fuel remaining: {}", store.get_fuel()?),
    Err(e) if e.to_string().contains("all fuel consumed") => {
        println!("Timed out (fuel exhausted)");
    }
    Err(e) => eprintln!("Error: {e}"),
}
```

### 5. Component model and WIT

The component model adds typed interface definitions (WIT) on top of core WASM:

```wit
// math.wit — interface definition
package example:math@1.0.0;

interface calculator {
    add: func(a: s32, b: s32) -> s32;
    sqrt: func(x: f64) -> f64;
}

world math-world {
    export calculator;
}
```

```bash
# Install component toolchain
cargo install wasm-tools cargo-component

# Create a Rust component
cargo component new --lib math-component
# Implement the WIT interface in src/lib.rs

# Build component
cargo component build --release

# Run with wasmtime component
wasmtime run math-component.wasm
```

```rust
// Embed a component in Rust
use wasmtime::component::*;

wasmtime::component::bindgen!({
    world: "math-world",
    path: "math.wit",
});

let component = Component::from_file(&engine, "math.wasm")?;
let (calculator, _) = MathWorld::instantiate(&mut store, &component, &linker)?;
let result = calculator.call_add(&mut store, 3, 4)?;
```

### 6. WASM debugging with DWARF

```bash
# Build WASM with debug info (Rust)
cargo build --target wasm32-wasi    # debug profile includes DWARF by default

# Run with source-level debugging
WASMTIME_BACKTRACE_DETAILS=1 wasmtime prog.wasm

# Full DWARF stack traces
wasmtime --debug-info prog.wasm 2>&1

# GDB with WASM (wasmtime dev build)
wasmtime debug prog.wasm   # experimental

# wasm-tools for inspection
wasm-tools print prog.wasm | head -50     # disassemble to WAT
wasm-tools validate prog.wasm             # validate WASM binary
```

### 7. Performance configuration

```rust
// High-performance embedding config
let mut config = Config::default();
config.cranelift_opt_level(OptLevel::SpeedAndSize);
config.parallel_compilation(true);
config.cache_config_load_default()?;    // disk cache for compiled modules

// Ahead-of-time compilation for production
// 1. Pre-compile in build pipeline
let serialized = module.serialize()?;
std::fs::write("prog.cwasm", &serialized)?;

// 2. Load pre-compiled at runtime (zero compilation cost)
let module = unsafe { Module::deserialize_file(&engine, "prog.cwasm")? };
```

## Related skills

- Use `skills/runtimes/wasm-emscripten` for compiling C/C++ to WASM for browser/WASI
- Use `skills/rust/rust-async-internals` for async patterns in wasmtime Rust embedding
- Use `skills/runtimes/binary-hardening` for sandboxing considerations with WASM
