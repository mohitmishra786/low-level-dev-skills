# Emscripten Linker Flags Reference

Source: https://emscripten.org/docs/tools_reference/settings_reference.html

## Key Settings

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `EXPORTED_FUNCTIONS` | list | `["_main"]` | C functions exported to JS (needs leading `_`) |
| `EXPORTED_RUNTIME_METHODS` | list | `[]` | Runtime helpers: `ccall`, `cwrap`, `allocate`, etc. |
| `MODULARIZE` | bool | `0` | Wrap output in a function returning a Promise |
| `EXPORT_NAME` | string | `"Module"` | Name of the exported JS module |
| `INITIAL_MEMORY` | int | 16MB | Initial WASM heap size |
| `MAXIMUM_MEMORY` | int | 2GB | Max WASM heap with ALLOW_MEMORY_GROWTH |
| `ALLOW_MEMORY_GROWTH` | bool | `0` | Allow heap to grow dynamically |
| `STACK_SIZE` | int | 64KB | C stack size |
| `ASSERTIONS` | 0/1/2 | `1` in debug | Runtime safety assertions |
| `SAFE_HEAP` | bool | `0` | Check all heap accesses for alignment |
| `ASYNCIFY` | bool | `0` | Enable Asyncify for async C |
| `USE_PTHREADS` | bool | `0` | Enable pthreads (needs SharedArrayBuffer) |
| `SHARED_MEMORY` | bool | `0` | Enable shared memory |
| `SINGLE_FILE` | bool | `0` | Embed WASM in JS as base64 |
| `ENVIRONMENT` | string | `"web,webview,worker,node"` | Target environments |
| `FILESYSTEM` | bool | `1` | Include virtual filesystem |
| `EXIT_RUNTIME` | bool | `0` | Call exit() when main() returns |
| `INVOKE_RUN` | bool | `1` | Run main() automatically |
| `NO_EXIT_RUNTIME` | bool | `1` | Don't tear down runtime on exit |

## Common Configurations

### Minimal library (no main, no filesystem)

```bash
emcc lib.c -o lib.js \
  -s EXPORTED_FUNCTIONS='["_my_func"]' \
  -s EXPORTED_RUNTIME_METHODS='["cwrap"]' \
  -s FILESYSTEM=0 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME=MyLib \
  -s ENVIRONMENT=web \
  -Os
```

### Node.js WASM module

```bash
emcc prog.c -o prog.js \
  -s ENVIRONMENT=node \
  -s MODULARIZE=1 \
  -s EXPORT_NAME=MyModule \
  -O2
# Use: const M = await require('./prog.js')()
```

### Threaded application

```bash
emcc prog.c -o prog.js \
  -s USE_PTHREADS=1 \
  -s PTHREAD_POOL_SIZE=4 \
  -s INITIAL_MEMORY=64MB \
  -O2
# Requires: Cross-Origin-Opener-Policy: same-origin
#           Cross-Origin-Embedder-Policy: require-corp
```

### Minimal WASI build

```bash
emcc prog.c -o prog.wasm \
  --target=wasi \
  -s ENVIRONMENT=node \
  -Os
```
