---
name: wasm-emscripten
description: WebAssembly with Emscripten skill for C/C++ to WASM compilation. Use when compiling C/C++ to WebAssembly with emcc, configuring EXPORTED_FUNCTIONS, understanding the WASM memory model, using Asyncify for async C code, debugging .wasm with browser devtools or wasm-opt, or targeting WASI vs browser environments. Activates on queries about Emscripten, emcc, WebAssembly from C/C++, WASM memory model, Asyncify, EXPORTED_FUNCTIONS, WASI, or wasm-opt.
---

# WebAssembly with Emscripten

## Purpose

Guide agents through compiling C/C++ to WebAssembly using Emscripten: emcc flag selection, function exports, memory model configuration, Asyncify for asynchronous C code, debugging WASM binaries, and targeting WASI vs browser.

## Triggers

- "How do I compile C to WebAssembly with Emscripten?"
- "How do I export a C function to JavaScript?"
- "How does WebAssembly memory work with Emscripten?"
- "How do I debug a .wasm file?"
- "How do I use Asyncify to make synchronous C code async?"
- "What's the difference between WASI and Emscripten browser target?"

## Workflow

### 1. Setup and first build

```bash
# Install Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh    # add emcc to PATH

# Verify
emcc --version

# Compile C to WASM (browser target)
emcc hello.c -o hello.html          # generates hello.html + hello.js + hello.wasm
emcc hello.c -o hello.js            # just JS + WASM (no HTML shell)

# Serve locally (WASM requires HTTP, not file://)
python3 -m http.server 8080
# Open: http://localhost:8080/hello.html
```

### 2. Exporting functions to JavaScript

```c
// math.c
#include <emscripten.h>

// EMSCRIPTEN_KEEPALIVE prevents dead-code elimination
EMSCRIPTEN_KEEPALIVE
int add(int a, int b) {
    return a + b;
}

EMSCRIPTEN_KEEPALIVE
double sqrt_approx(double x) {
    return x * 0.5 + 1.0;
}
```

```bash
# Export specific functions
emcc math.c -o math.js \
  -s EXPORTED_FUNCTIONS='["_add","_sqrt_approx"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  -s MODULARIZE=1 \
  -s EXPORT_NAME=MathModule

# The leading underscore is required for C functions
```

```javascript
// Using exported functions in JS
const Module = await MathModule();

// Direct call
const result = Module._add(3, 4);

// Via ccall (type-safe)
const result2 = Module.ccall('add', 'number', ['number', 'number'], [3, 4]);

// Via cwrap (creates a callable JS function)
const add = Module.cwrap('add', 'number', ['number', 'number']);
console.log(add(3, 4));  // 7
```

### 3. Memory model

Emscripten provides a linear memory heap accessible from both C and JS:

```bash
# Configure initial and maximum heap
emcc prog.c -o prog.js \
  -s INITIAL_MEMORY=16MB \
  -s MAXIMUM_MEMORY=256MB \
  -s ALLOW_MEMORY_GROWTH=1    # allow dynamic growth

# Stack size (default 64KB)
emcc prog.c -o prog.js -s STACK_SIZE=1MB

# Shared memory (for SharedArrayBuffer / threads)
emcc prog.c -o prog.js -s SHARED_MEMORY=1 -s USE_PTHREADS=1
```

```javascript
// Accessing C memory from JS
const ptr = Module._malloc(1024);     // allocate
Module.HEAPU8.set([1, 2, 3], ptr);   // write bytes
Module._free(ptr);                     // free

// Read a C string
const strPtr = Module.ccall('get_message', 'number', [], []);
const str = Module.UTF8ToString(strPtr);

// Write a string to C
const jsStr = "hello";
const cStr = Module.stringToNewUTF8(jsStr);  // malloc + copy
Module._process_string(cStr);
Module._free(cStr);
```

### 4. Asyncify — synchronous C in async environments

Asyncify lets synchronous C code suspend and resume for async operations (like `fetch()`, sleep, etc.):

```c
// async.c
#include <emscripten.h>

// Synchronous sleep in C (blocks C, but yields to JS event loop)
EM_JS(void, do_fetch, (const char *url), {
    // Emscripten generates wrappers to suspend C while JS runs
    Asyncify.handleAsync(async () => {
        const resp = await fetch(UTF8ToString(url));
        const text = await resp.text();
        console.log(text);
    });
});

void process_url(const char *url) {
    do_fetch(url);     // looks synchronous in C
    printf("fetch complete\n");
}
```

```bash
# Enable Asyncify
emcc async.c -o async.js \
  -s ASYNCIFY \
  -s ASYNCIFY_STACK_SIZE=16384 \
  -O2   # Asyncify works better with optimization
```

### 5. Optimization and wasm-opt

```bash
# Optimization levels
emcc prog.c -O0 -o prog.js    # no optimization (fastest build)
emcc prog.c -O2 -o prog.js    # balanced
emcc prog.c -O3 -o prog.js    # aggressive
emcc prog.c -Os -o prog.js    # optimize for size
emcc prog.c -Oz -o prog.js    # aggressive size (Emscripten's smallest)

# Post-process with wasm-opt (Binaryen)
wasm-opt -Oz -o prog.opt.wasm prog.wasm    # optimize for size
wasm-opt -O4 -o prog.opt.wasm prog.wasm    # optimize for speed

# Compare sizes
ls -lh prog.wasm prog.opt.wasm
```

### 6. Debugging WASM

```bash
# Build with debug info
emcc prog.c -g -O0 -o prog.html \
  -s ASSERTIONS=1 \
  -s SAFE_HEAP=1      # catch misaligned accesses

# In Chrome DevTools:
# Sources → prog.wasm → line-by-line C source debugging
# (requires -g and browser with WASM debugging support)

# LLDB with WASM (wasmtime)
# See skills/runtimes/wasm-wasmtime for CLI WASM debugging
```

```bash
# Emscripten debug helpers
emcc prog.c -o prog.js \
  -s ASSERTIONS=2       # extensive runtime checks
  -s SAFE_HEAP=1        # sanitize heap accesses
  -s STACK_OVERFLOW_CHECK=1

# Print generated JS
emcc prog.c -o prog.js && cat prog.js | head -100
```

### 7. WASI vs browser target

| Feature | Browser (Emscripten) | WASI |
|---------|---------------------|------|
| Host APIs | Web APIs (fetch, WebGL, etc.) | POSIX subset (files, stdin/stdout) |
| Runtime | Browser JS engine | wasmtime, wasmer, WAMR, Node.js |
| Threads | SharedArrayBuffer + pthreads | wasi-threads (limited) |
| Networking | fetch(), WebSocket | wasi-http (preview2) |
| Use case | Web applications | Server-side, CLI tools, edge |

```bash
# Build for WASI (no browser JS, pure WASM)
emcc prog.c -o prog.wasm --target=wasi

# Or use wasi-sdk (better WASI support than Emscripten)
/opt/wasi-sdk/bin/clang --sysroot=/opt/wasi-sdk/share/wasi-sysroot \
  prog.c -o prog.wasm
wasmtime prog.wasm
```

For Emscripten linker flags reference, see [references/emscripten-linker-flags.md](references/emscripten-linker-flags.md).

## Related skills

- Use `skills/runtimes/wasm-wasmtime` for server-side WASM with wasmtime CLI and Rust embedding
- Use `skills/compilers/clang` for Clang-based WASM compilation with WASI SDK
- Use `skills/binaries/elf-inspection` for inspecting WASM binary structure
