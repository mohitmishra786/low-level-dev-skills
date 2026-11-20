---
name: wasm-wasmtime
description: WebAssembly runtime skill using wasmtime. Use when running WASM modules or components with the wasmtime CLI, choosing between WASI 0.1/0.2/0.3, using the component model, embedding wasmtime in Rust applications, limiting execution with fuel or timeouts, or debugging WASM with DWARF in wasmtime. Activates on queries about wasmtime, WASI, WASIp2, WASIp3, WASM component model, wasmtime embedding, WIT interfaces, fuel metering, or server-side WebAssembly.
---

# wasmtime — Server-Side WASM Runtime

## Purpose

Guide agents through wasmtime (examples checked against wasmtime 50): running modules and components from the CLI, WASI versions, the component model with WIT interfaces, embedding wasmtime in Rust, fuel and timeout limits, and debugging WASM with DWARF.

## Triggers

- "How do I run a WASM file with wasmtime?"
- "What is the difference between WASI p1, p2 and p3?"
- "How do I embed wasmtime in my Rust application?"
- "What is the WebAssembly component model?"
- "How do I limit WASM execution with fuel?"
- "How do I debug a WASM module in wasmtime?"

## Workflow

### 1. wasmtime CLI

```bash
# Install
curl https://wasmtime.dev/install.sh -sSf | bash

# Run a WASM module or component (run is the default subcommand)
wasmtime hello.wasm

# Arguments after the file go to the guest
wasmtime run prog.wasm arg1 arg2

# Pre-open directories (WASI filesystem sandbox)
wasmtime run --dir /tmp::/ prog.wasm    # map host /tmp to guest /

# Pass environment variables
wasmtime run --env HOME=/home/user prog.wasm

# Invoke an exported function
wasmtime run --invoke add math.wasm 3 4             # core module
wasmtime run --invoke 'add(3, 4)' math-component.wasm  # component: call syntax

# Inspect a binary (wasm-tools, not wasmtime)
wasm-tools print prog.wasm --skeleton    # imports/exports as WAT
wasm-tools component wit component.wasm  # a component's WIT interface
wasmtime explore prog.wasm               # writes prog.explore.html (wasm ↔ machine code)

# Compile ahead of time
wasmtime compile prog.wasm -o prog.cwasm
wasmtime run --allow-precompiled prog.cwasm  # required for .cwasm input
```

Resource limits on the CLI:

```bash
wasmtime run -W fuel=10000000 prog.wasm        # trap after N units of fuel
wasmtime run -W timeout=2s prog.wasm           # trap after wall-clock time
wasmtime run -W max-memory-size=67108864 prog.wasm  # cap linear memory (bytes)
```

`-W` sets wasm features and limits, `-S` WASI options, `-D` debug options, `-O` codegen options.
Run `wasmtime -W help` (or `-S help`, `-D help`, `-O help`) for the full list.

### 2. WASI versions

| Version | Binary kind | Rust target | Notes |
|---------|-------------|-------------|-------|
| 0.1 (preview 1) | core module importing `wasi_snapshot_preview1` | `wasm32-wasip1` | Was `wasm32-wasi`; that target was removed from rustc |
| 0.2 | component, `wasi:*@0.2.x` interfaces | `wasm32-wasip2` | Streams via `wasi:io` |
| 0.3 | component, `wasi:*@0.3.x` interfaces | `wasm32-wasip3` | Native `async`, `stream<T>`, `future<T>`; on by default in wasmtime 46+ |

```bash
# wasmtime detects module vs component and links the matching WASI version
wasmtime run hello-p1.wasm
wasmtime run hello-p3.wasm

# WASI options (components)
wasmtime run -S http component.wasm             # wasi:http outgoing requests
wasmtime run -S inherit-network component.wasm  # full host network for wasi:sockets
wasmtime run -S p3=n component.wasm             # disable WASIp3 interfaces

# Serve a wasi:http proxy component
wasmtime serve proxy.wasm

# Key WASI interfaces (WIT)
# wasi:filesystem, wasi:sockets, wasi:http, wasi:cli, wasi:random, wasi:clocks
```

WASI 0.3 was ratified in June 2026. It removes the `wasi:io` package; streams and futures are
component-model types, and the canonical ABI lifts/lowers `async func` directly. Bindings
generators (`wit-bindgen`, `wasmtime::component::bindgen!`) emit async functions for these.

### 3. Embedding wasmtime in Rust

```toml
# Cargo.toml — wasmtime and wasmtime-wasi versions must match
[dependencies]
wasmtime = "50"
wasmtime-wasi = "50"
anyhow = "1"
```

```rust
use wasmtime::*;
use wasmtime_wasi::p1::{self, WasiP1Ctx};
use wasmtime_wasi::{FsPerms, WasiCtxBuilder};

fn main() -> Result<()> {
    let engine = Engine::default();

    // Load and compile a module built for wasm32-wasip1
    let module = Module::from_file(&engine, "prog.wasm")?;

    // WASI imports are supplied through a Linker
    let mut linker: Linker<WasiP1Ctx> = Linker::new(&engine);
    p1::add_to_linker_sync(&mut linker, |ctx| ctx)?;

    // WASI context: stdio, env, args, preopened directory
    let wasi = WasiCtxBuilder::new()
        .inherit_stdio()
        .inherit_env()
        .args(&["prog.wasm", "arg1"])
        .preopened_dir("/tmp", "/", FsPerms::ReadWrite)?
        .build_p1();

    // The store holds all instance state
    let mut store = Store::new(&engine, wasi);
    let instance = linker.instantiate(&mut store, &module)?;

    // Run the WASI command entry point
    let start = instance.get_typed_func::<(), ()>(&mut store, "_start")?;
    start.call(&mut store, ())?;
    Ok(())
}
```

A module without imports can use `Instance::new(&mut store, &module, &[])` directly. A module
that imports WASI fails to instantiate that way.

### 4. Fuel metering — CPU limiting

Fuel metering limits the work a guest can do, stopping runaway or malicious code:

```rust
use wasmtime::*;

let mut config = Config::new();
config.consume_fuel(true);    // enable fuel consumption

let engine = Engine::new(&config)?;
let module = Module::from_file(&engine, "untrusted.wasm")?;

let mut store = Store::new(&engine, ());
store.set_fuel(1_000_000)?;

let instance = Instance::new(&mut store, &module, &[])?;
let run = instance.get_typed_func::<(), ()>(&mut store, "run")?;

match run.call(&mut store, ()) {
    Ok(()) => println!("Completed, fuel remaining: {}", store.get_fuel()?),
    Err(e) if e.downcast_ref::<Trap>() == Some(&Trap::OutOfFuel) => {
        println!("Timed out (fuel exhausted)");
    }
    Err(e) => eprintln!("Error: {e}"),
}
```

For wall-clock limits, use epoch interruption (`Config::epoch_interruption`, `Engine::increment_epoch`
from a timer thread), which costs less than fuel.

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

Guest (Rust; `wasm32-wasip2` produces a component directly, no `cargo component` needed):

```rust
// Cargo.toml: [lib] crate-type = ["cdylib"], [dependencies] wit-bindgen = "0.63"
wit_bindgen::generate!({ world: "math-world", path: "math.wit" });

struct Component;

impl exports::example::math::calculator::Guest for Component {
    fn add(a: i32, b: i32) -> i32 { a + b }
    fn sqrt(x: f64) -> f64 { x.sqrt() }
}

export!(Component);
```

```bash
cargo build --release --target wasm32-wasip2
wasmtime run --invoke 'add(3, 4)' target/wasm32-wasip2/release/math_component.wasm
```

Host:

```rust
use wasmtime::component::{Component, Linker, ResourceTable};
use wasmtime::{Engine, Store};
use wasmtime_wasi::{WasiCtx, WasiCtxBuilder, WasiCtxView, WasiView};

wasmtime::component::bindgen!({
    world: "math-world",
    path: "math.wit",
});

struct State {
    ctx: WasiCtx,
    table: ResourceTable,
}

impl WasiView for State {
    fn ctx(&mut self) -> WasiCtxView<'_> {
        WasiCtxView { ctx: &mut self.ctx, table: &mut self.table }
    }
}

let component = Component::from_file(&engine, "math_component.wasm")?;
let mut linker: Linker<State> = Linker::new(&engine);
wasmtime_wasi::p2::add_to_linker_sync(&mut linker)?;  // wasip2 guests import WASI

let state = State { ctx: WasiCtxBuilder::new().inherit_stdio().build(), table: ResourceTable::new() };
let mut store = Store::new(&engine, state);

let math = MathWorld::instantiate(&mut store, &component, &linker)?;
let result = math.example_math_calculator().call_add(&mut store, 3, 4)?;
```

Exported interfaces are reached through an accessor named after the interface path
(`example:math/calculator` → `example_math_calculator()`).

### 6. WASM debugging with DWARF

```bash
# Build with debug info (Rust debug profile includes DWARF)
cargo build --target wasm32-wasip1

# Backtraces with source locations on traps
WASMTIME_BACKTRACE_DETAILS=1 wasmtime run -D debug-info prog.wasm

# Source-level debugging of JIT code: gdb or lldb on the wasmtime process
gdb --args wasmtime run -D debug-info -O opt-level=0 prog.wasm
(gdb) set breakpoint pending on
(gdb) break hello::main
(gdb) run

lldb -- wasmtime run -D debug-info -O opt-level=0 prog.wasm
(lldb) settings set plugin.jit-loader.gdb.enable on
(lldb) b hello::main
(lldb) run

# Write a wasm core dump (guest memory and stack) on trap
wasmtime run -D coredump=/tmp/core.wasm prog.wasm

# wasm-tools for inspection
wasm-tools print prog.wasm | head -50     # disassemble to WAT
wasm-tools validate prog.wasm             # validate WASM binary
```

### 7. WASM GC (garbage-collected objects)

WASM GC adds struct and array types with managed allocation. It is enabled by default:

```wat
(module
  (type $point (struct (field $x (mut f32)) (field $y (mut f32))))
  (func (export "mk") (result (ref $point))
    (struct.new $point (f32.const 1) (f32.const 2))))
```

```bash
wasm-tools validate --features gc module.wasm
wasmtime run --invoke mk module.wasm     # -W gc=n to disable
```

Use `struct.new`, `array.new`, `struct.get`, `array.get` in WAT or compiler output. Embedders: `Config::wasm_gc`.

### 8. WASM threads and shared memory

```bash
# The threads proposal validates by default, but creating a shared memory is opt-in
wasmtime run -W shared-memory prog.wasm

# Rust target for wasi-threads guests: wasm32-wasip1-threads
# wasmtime 50 rejects -S threads ("the -Sthreads flag is no longer supported"),
# so wasi-threads (thread-spawn) guests need an older wasmtime or another runtime
```

Atomics (`i32.atomic.*`) and `memory.atomic.wait/notify` work on shared memories once
`-W shared-memory` (embedding: `Config::shared_memory(true)`) is set.

### 9. WASM exception handling

Wasmtime implements the standardized proposal (`try_table`, `throw`, `throw_ref`, `exnref`), on by default:

```wat
(module
  (tag $exn (param i32))
  (func (export "run") (result i32)
    (block $h (result i32)
      (try_table (catch $exn $h)
        (throw $exn (i32.const 7)))
      (i32.const 0))))
```

```bash
wasmtime run --invoke run module.wasm    # prints 7
```

The legacy `try`/`catch`/`delegate` encoding is not accepted by current wasm-tools or wasmtime;
binaries that use it must be rebuilt. Embedders: `config.wasm_exceptions(true)`.

### 10. Performance configuration

```rust
// High-performance embedding config
let mut config = Config::new();
config.cranelift_opt_level(OptLevel::SpeedAndSize);
config.parallel_compilation(true);
config.cache(Some(Cache::from_file(None)?));   // disk cache for compiled modules
let engine = Engine::new(&config)?;

// Ahead-of-time compilation for production
// 1. Pre-compile in build pipeline
let serialized = module.serialize()?;
std::fs::write("prog.cwasm", &serialized)?;

// 2. Load pre-compiled at runtime (no compilation; same wasmtime version and config required)
let module = unsafe { Module::deserialize_file(&engine, "prog.cwasm")? };
```

## Related skills

- Use `skills/runtimes/wasm-emscripten` for compiling C/C++ to WASM for browser/WASI
- Use `skills/rust/rust-cross` for the `wasm32-wasip1`/`wasip2` Rust targets
- Use `skills/rust/rust-async-internals` for async patterns in wasmtime Rust embedding
- Use `skills/runtimes/binary-hardening` for sandboxing considerations with WASM
