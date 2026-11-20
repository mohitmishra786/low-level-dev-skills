---
name: zig-cinterop
description: Zig C interoperability skill. Use when calling C from Zig, calling Zig from C, translating headers with b.addTranslateC or @cImport, running translate-c on C headers, defining extern structs and packed structs, matching C ABI types, or building mixed C/Zig projects. Activates on queries about addTranslateC, @cImport, @cInclude, translate-c, extern struct, packed struct, Zig C ABI, calling C from Zig, exporting Zig to C, or bindgen equivalents.
---

# Zig C Interop

## Purpose

Guide agents through Zig's C interoperability: `b.addTranslateC` (and the deprecated `@cImport`) for calling C, `translate-c` for header inspection, `extern struct` and `packed struct` for ABI-compatible types, exporting Zig for C consumption, and `zig cc` for mixed C/Zig builds.

## Triggers

- "How do I call a C function from Zig?"
- "How do I call a C library from Zig (addTranslateC / @cImport)?"
- "How do I export Zig functions to be called from C?"
- "How do I define a struct that matches a C struct?"
- "What does translate-c do?"
- "How do I build a mixed C and Zig project?"

## Workflow

### 1. Calling C from Zig

Since Zig 0.16 the `@cImport` builtin is deprecated. Translate C headers in `build.zig` with
`b.addTranslateC` and import the result as a normal module.

```c
/* src/c.h — everything the Zig code needs from C */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "mylib.h"
```

```zig
// build.zig
const c_h = b.addTranslateC(.{
    .root_source_file = b.path("src/c.h"),
    .target = target,
    .optimize = optimize,
});
c_h.addIncludePath(b.path("include/"));
c_h.defineCMacro("MY_FEATURE", "1");  // equivalent to -DMY_FEATURE=1

const exe = b.addExecutable(.{
    .name = "app",
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
        .link_libc = true,  // required when calling libc
        .imports = &.{.{ .name = "c", .module = c_h.createModule() }},
    }),
});

// The header only declares the API; link the implementation too
exe.root_module.addIncludePath(b.path("include/"));
exe.root_module.addCSourceFile(.{ .file = b.path("src/mylib.c"), .flags = &.{"-std=c11"} });
// or, for a prebuilt library:
// exe.root_module.addLibraryPath(b.path("vendor/lib"));
// exe.root_module.linkSystemLibrary("mylib", .{});

b.installArtifact(exe);
```

```zig
// src/main.zig
const c = @import("c");

pub fn main() void {
    _ = c.printf("Hello from C: %d\n", @as(c_int, 42));

    var buf: [256]u8 = undefined;
    _ = c.snprintf(&buf, buf.len, "formatted: %d", @as(c_int, 100));
}
```

Older code uses `@cImport`, which still compiles on 0.16. `@cDefine` must come before the
`@cInclude` that depends on it:

```zig
const c = @cImport({
    @cDefine("MY_FEATURE", "1");
    @cInclude("stdio.h");
    @cInclude("mylib.h");
});
```

### 2. translate-c — inspect C header translation

`translate-c` converts C headers to Zig declarations, letting you see exactly how Zig sees a C API:

```bash
# Translate a header file
zig translate-c /usr/include/stdio.h > stdio.zig

# Translate with defines/includes
zig translate-c -I include/ -DFEATURE=1 mylib.h > mylib.zig

# Translate and inspect specific types
zig translate-c mylib.h | grep -A5 "struct MyStruct"
```

This is Zig's equivalent of `bindgen`. Use it to see what Zig generates; `b.addTranslateC` runs the
same translation as a build step.

### 3. C type mapping

| C type | Zig type |
|--------|----------|
| `int` | `c_int` |
| `unsigned int` | `c_uint` |
| `long` | `c_long` |
| `unsigned long` | `c_ulong` |
| `long long` | `c_longlong` |
| `size_t` | `usize` |
| `ssize_t` | `isize` |
| `char *` | `[*:0]u8` (null-terminated) |
| `const char *` | `[*:0]const u8` |
| `void *` | `*anyopaque` |
| `NULL` | `null` |
| `bool` | `bool` (C99) or `c_int` (older) |
| `float` | `f32` |
| `double` | `f64` |

```zig
// Passing strings to C
const str = "hello";
_ = c.puts(str);  // Zig string literals are [*:0]const u8

// Dynamic strings — need a null terminator
var buf: [64]u8 = undefined;
const msg = try std.fmt.bufPrintSentinel(&buf, "hello {d}", .{42}, 0);  // [:0]u8
_ = c.puts(msg.ptr);
```

### 4. extern struct — ABI-compatible structs

Use `extern struct` to match a C struct's memory layout exactly:

```zig
// Matches: struct Point { int x; int y; };
const Point = extern struct {
    x: c_int,
    y: c_int,
};

// Matches: struct Header { uint32_t magic; uint16_t version; uint16_t flags; };
const Header = extern struct {
    magic: u32,
    version: u16,
    flags: u16,
};

// translate-c already generates c.struct_Point; use it directly
var p = c.struct_Point{ .x = 10, .y = 20 };
_ = c.draw_point(&p);

// A hand-written extern struct is a distinct type: cast the pointer
var zp = Point{ .x = 10, .y = 20 };
_ = c.draw_point(@ptrCast(&zp));
```

### 5. packed struct — bit-level layout

```zig
// Matches C bitfield: struct { uint8_t flags : 4; uint8_t type : 4; };
const Flags = packed struct(u8) {
    mode: u4,
    kind: u4,
};

// Packed struct for wire protocols
const IpHeader = packed struct(u32) {
    ihl: u4,
    version: u4,
    tos: u8,
    total_length: u16,
};

var h: IpHeader = @bitCast(@as(u32, raw_bytes));
```

### 6. Exporting Zig to C

```zig
// Export a function callable from C
export fn zig_add(a: c_int, b: c_int) c_int {
    return a + b;
}

// Export under a chosen name with @export (calling convention is .c; .C no longer exists)
fn myFunc(x: u32) callconv(.c) u32 {
    return x * 2;
}
comptime {
    @export(&myFunc, .{ .name = "my_func" });
}

// Export a constant
export const VERSION: c_int = 42;
```

Generate a C header (manual or with tools):
```c
/* mylib.h */
#ifndef MYLIB_H
#define MYLIB_H
#include <stdint.h>

int zig_add(int a, int b);
uint32_t my_func(uint32_t x);
extern const int VERSION;

#endif
```

### 7. Calling Zig from C in build.zig

```zig
// Build Zig as a C-compatible static library
const lib = b.addLibrary(.{
    .name = "myzig",
    .linkage = .static,
    .root_module = b.createModule(.{
        .root_source_file = b.path("src/lib.zig"),
        .target = target,
        .optimize = optimize,
    }),
});

// The C code that uses the Zig library
const c_exe = b.addExecutable(.{
    .name = "c_consumer",
    .root_module = b.createModule(.{
        .target = target,
        .optimize = optimize,
        .link_libc = true,
    }),
});
c_exe.root_module.addCSourceFile(.{
    .file = b.path("src/main.c"),
    .flags = &.{"-std=c11"},
});
c_exe.root_module.linkLibrary(lib);
b.installArtifact(c_exe);
```

### 8. Opaque types and forward declarations

```zig
// Forward-declared C struct (opaque)
const FILE = opaque {};
extern fn fopen(path: [*:0]const u8, mode: [*:0]const u8) ?*FILE;
extern fn fclose(file: *FILE) c_int;
extern fn fprintf(file: *FILE, fmt: [*:0]const u8, ...) c_int;

// Opaque handle pattern
const MyHandle = opaque {};
extern fn lib_create() ?*MyHandle;
extern fn lib_destroy(h: *MyHandle) void;
```

### 9. Variadic functions

```zig
// Variadic C functions translated from headers can be called directly
const c = @import("c");  // translated with b.addTranslateC (section 1)

_ = c.printf("value: %d\n", @as(c_int, 42));

// For custom variadic C functions, use extern with ...
extern fn my_log(level: c_int, fmt: [*:0]const u8, ...) void;
```

For translate-c output guide and C ABI types reference, see [references/translate-c-guide.md](references/translate-c-guide.md).

## Related skills

- Use `skills/zig/zig-compiler` for `zig cc` C compilation and basic Zig builds
- Use `skills/zig/zig-build-system` for `build.zig` with mixed C/Zig projects
- Use `skills/binaries/elf-inspection` to verify symbol exports and ABI
- Use `skills/rust/rust-ffi` for comparison with Rust's C FFI approach
