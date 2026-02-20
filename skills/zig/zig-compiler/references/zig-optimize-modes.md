# Zig Optimization Modes Reference

## Mode Comparison Table

| Feature | Debug | ReleaseSafe | ReleaseFast | ReleaseSmall |
|---------|-------|-------------|-------------|--------------|
| LLVM opt level | 0 | 2 | 3 | s |
| Integer overflow | panic | panic | undefined | undefined |
| Array bounds | panic | panic | undefined | undefined |
| Null dereference | panic | panic | undefined | undefined |
| `unreachable` | panic | panic | undefined | undefined |
| Debug info | yes | no | no | no |
| Frame pointer | yes | no | no | no |
| Compile speed | fast | medium | slow | medium |
| Binary size | large | medium | medium | small |

## Safety Checks Detail

### Runtime detectable safety checks (Debug/ReleaseSafe)

```zig
// 1. Integer overflow
const x: u8 = 200;
const y: u8 = x + 100;  // panic: integer overflow

// Safe alternatives:
const y = x +% 100;           // wrapping add
const y = @addWithOverflow(x, 100);  // returns {result, overflowed}
const y = std.math.add(u8, x, 100) catch handle_overflow();

// 2. Array bounds
var arr = [3]u32{ 1, 2, 3 };
const x = arr[5];  // panic: index out of bounds

// 3. Null pointer optional
var opt: ?*u32 = null;
const x = opt.?;  // panic: null value

// 4. Enum tag
const val: u8 = 99;
const e = @as(MyEnum, @enumFromInt(val));  // panic if 99 is not a valid tag

// 5. Unreachable
fn get(x: u8) u8 {
    return switch (x) {
        0 => 10,
        1 => 20,
        else => unreachable,  // panic if reached in Debug/ReleaseSafe
    };
}
```

### When to use each mode

```
Debug:       Development, always. Fast compile + all checks.
ReleaseSafe: Staging/production where safety matters (servers, critical code).
             Same behavior as Debug on errors — panics instead of UB.
ReleaseFast: Production after thorough testing with ReleaseSafe.
             Maximum throughput. Errors become undefined behaviour.
ReleaseSmall: WASM, embedded, CLI tools where size matters.
```

## Panic Handling

```zig
// Default panic: prints to stderr and exits
// Custom panic handler in root file:
pub fn panic(msg: []const u8, error_return_trace: ?*std.builtin.StackTrace, ret_addr: ?usize) noreturn {
    std.log.err("PANIC: {s}", .{msg});
    // log to file, notify monitoring, etc.
    std.process.exit(1);
}
```

## Comptime Integer Overflow

Comptime overflow is always an error, regardless of mode:

```zig
comptime {
    const x: u8 = 300;  // error: integer value 300 cannot be coerced to type 'u8'
}
```

## Target CPU Features

```bash
# List CPU features for a target
zig targets | python3 -c "import sys,json; data=json.load(sys.stdin); [print(c['name']) for c in data['cpus'] if 'x86_64' in c.get('name','')]"

# Enable specific CPU features
zig build-exe -target x86_64-linux-gnu \
    -mcpu baseline+avx2+bmi2 \
    src/main.zig

# Native CPU (all available features)
zig build-exe -mcpu native src/main.zig

# Common CPU presets
# baseline      — minimum for the architecture
# native        — detect current machine
# x86_64-v2     — SSE4.2 (most VMs)
# x86_64-v3     — AVX2 (Haswell+)
# cortex_a72    — Raspberry Pi 4
```

## Single-File Compilation Flags

```bash
zig build-exe [flags] src/main.zig

-O <mode>                    # Debug|ReleaseSafe|ReleaseFast|ReleaseSmall
-target <triple>             # cpu-os-abi
-mcpu <cpu[+feat...]>        # CPU/feature selection
-femit-bin=<path>            # Output binary path
-femit-asm=<path>            # Emit assembly
-femit-llvm-ir=<path>        # Emit LLVM IR
-fno-emit-bin                # Skip binary, emit other artifacts only
-I <dir>                     # Add include directory
-L <dir>                     # Add library directory
-l <name>                    # Link library
--strip                      # Strip debug info
-fstack-check                # Extra stack overflow protection
-fsingle-threaded            # Disable thread-local storage
--name <name>                # Output file name (without extension)
```

## WASM-Specific

```bash
# WASI (WebAssembly System Interface)
zig build-exe -target wasm32-wasi -O ReleaseSmall src/main.zig
wasmtime myapp.wasm

# Freestanding WASM (browser)
zig build-exe \
    -target wasm32-freestanding \
    -O ReleaseSmall \
    --export=init \
    --export=update \
    -fno-entry \
    src/main.zig

# Check WASM binary size
wasm-opt -Oz myapp.wasm -o myapp.opt.wasm
ls -lh myapp.opt.wasm
```
