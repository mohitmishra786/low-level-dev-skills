# Zig Debugging Patterns Reference

## Panic Handler Customization

```zig
// Custom panic handler in root file (src/main.zig).
// `panic` is a namespace; std.debug.FullPanic builds one from a single function.
// (The old `pub fn panic(msg, ?*StackTrace, ?usize)` form still compiles but is deprecated.)
pub const panic = std.debug.FullPanic(myPanic);

fn myPanic(msg: []const u8, first_trace_addr: ?usize) noreturn {
    std.debug.print("\n=== PANIC ===\n{s}\n", .{msg});
    std.debug.dumpCurrentStackTrace(.{ .first_address = first_trace_addr orelse @returnAddress() });
    std.process.exit(1);
}
```

## Stack Trace Utilities

```zig
// Print current stack trace
std.debug.dumpCurrentStackTrace(.{});

// Capture a stack trace now, print it later
var addr_buf: [32]usize = undefined;
const trace = std.debug.captureCurrentStackTrace(.{}, &addr_buf);
// Later:
std.debug.dumpStackTrace(&trace);

// Print source location at comptime
const location = @src();
std.debug.print("{s}:{d}\n", .{ location.file, location.line });
```

## Format Specifiers for std.debug.print

```zig
// {}: default format
// {d}: decimal integer or float (fixed notation; {d:.3} for precision)
// {x}: hex (lowercase)
// {X}: hex (uppercase)
// {o}: octal
// {b}: binary
// {e}: float scientific
// {s}: string/slice
// {c}: character (u8 as char)
// {u}: unicode codepoint
// {t}: enum tag or error name
// {f}: call the value's format(self, *std.Io.Writer) method (not "float fixed")
// {any}: any type, debug representation
// {*}: pointer address

const val: u32 = 255;
std.debug.print("{d} {x} {b} {o}\n", .{val, val, val, val});
// → 255 ff 11111111 377

// Struct formatting
const Point = struct { x: f32, y: f32 };
const p = Point{ .x = 1.5, .y = 2.7 };
std.debug.print("{any}\n", .{p});
// → .{ .x = 1.5, .y = 2.7 }

// Pointer
const ptr: *const u32 = &val;
std.debug.print("{*}\n", .{ptr});
// → u32@7ffc...
```

## Compile-Time Debugging

```zig
// Print at compile time with @compileLog
fn fibonacci(comptime n: u32) u32 {
    @compileLog("computing fibonacci for n =", n);
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

// Inspect type at compile time
const T = u32;
@compileLog(@typeName(T));           // → "u32"
@compileLog(@typeInfo(T));           // → TypeInfo union
@compileLog(@sizeOf(T));             // → 4
@compileLog(@alignOf(T));            // → 4
@compileLog(@bitSizeOf(T));          // → 32
```

## GDB Commands for Zig Types

```gdb
# Print Zig slice
(gdb) p my_slice
# Shows: {ptr = 0x..., len = 5}

# Inspect slice elements
(gdb) p *my_slice.ptr@my_slice.len

# Print Zig optional
(gdb) p my_optional

# Print error union
(gdb) p my_error_union

# Zig stack frames show Zig-mangled names
# Demangle with:
(gdb) set print demangle on
(gdb) set demangle-style auto
```

## Memory Debugging

```zig
// Use DebugAllocator (formerly GeneralPurposeAllocator) for leak detection
var da: std.heap.DebugAllocator(.{}) = .init;
defer {
    const leaked = da.deinit();
    if (leaked == .leak) std.debug.print("Memory leaked!\n", .{});
}
const allocator = da.allocator();

// Debug allocation failures
var da2: std.heap.DebugAllocator(.{
    .safety = true,           // Check for double free / invalid free
    .never_unmap = true,      // Keep memory mapped (detect UAF faster)
    .retain_metadata = true,  // Keep freed block metadata
}) = .init;
```

## Testing and Debug Assertions

```zig
const testing = std.testing;

// In tests
try testing.expect(x == 42);
try testing.expectEqual(@as(u32, 42), x);
try testing.expectEqualStrings("hello", result);
try testing.expectError(error.NotFound, fallible_fn());

// Debug assertions (only in Debug/ReleaseSafe)
std.debug.assert(x > 0);  // panics if false

// Custom assertion with message
if (x <= 0) {
    std.debug.panic("Expected positive x, got {d}", .{x});
}
```

## Zig-Specific GDB Breakpoints

```gdb
# Break on any Zig panic
(gdb) break __zig_panic_start

# Set via pattern matching for specific panic source
(gdb) rbreak zig.*panic

# Watch for slice OOB
(gdb) watch -l array_var.len

# Break in DebugAllocator.alloc (the symbol name includes the full config struct)
(gdb) rbreak ^heap\.debug_allocator\.DebugAllocator.*\.alloc$
```
