# translate-c Guide and C ABI Types Reference

## Using translate-c

### Basic usage

```bash
# Translate a system header
zig translate-c /usr/include/fcntl.h 2>/dev/null | head -100

# Translate with include paths and defines
zig translate-c \
    -I /usr/include \
    -I ./vendor/mylib/include \
    -DLINUX \
    -D_GNU_SOURCE \
    ./vendor/mylib/include/mylib.h > mylib_translated.zig

# Cross-platform translation
zig translate-c \
    -target aarch64-linux-gnu \
    /usr/include/sys/socket.h > socket_arm.zig
```

### What translate-c produces

Given C:
```c
typedef struct {
    int x;
    int y;
    float z;
} Vec3;

int process(Vec3 *v, size_t count, const char *name);

#define MAX_ITEMS 1024
```

translate-c generates:
```zig
pub const Vec3 = extern struct {
    x: c_int = @import("std").mem.zeroes(c_int),
    y: c_int = @import("std").mem.zeroes(c_int),
    z: f32 = @import("std").mem.zeroes(f32),
};

pub extern fn process(v: ?*Vec3, count: usize, name: ?[*:0]const u8) c_int;

pub const MAX_ITEMS = @as(c_int, 1024);
```

### Workflow: translate-c → @cImport

1. Run `translate-c` to see Zig's interpretation of the C API
2. Identify type mappings, function signatures, pointer nullability
3. Use `@cImport` in actual code (handles the translation automatically)
4. Only use the translated output as a manual reference, not as source

## C ABI Type Mapping Reference

### Integer types

| C | Zig builtin | Notes |
|---|------------|-------|
| `char` | `u8` / `i8` | Sign is implementation-defined |
| `signed char` | `i8` | Always signed |
| `unsigned char` | `u8` | Always unsigned |
| `short` | `c_short` | Platform-dependent size |
| `unsigned short` | `c_ushort` | |
| `int` | `c_int` | Typically 32-bit |
| `unsigned int` | `c_uint` | |
| `long` | `c_long` | 32-bit on Windows, 64-bit on Linux/macOS |
| `unsigned long` | `c_ulong` | |
| `long long` | `c_longlong` | 64-bit |
| `unsigned long long` | `c_ulonglong` | |
| `size_t` | `usize` | |
| `ssize_t` | `isize` | |
| `ptrdiff_t` | `isize` | |
| `intptr_t` | `isize` | |
| `uintptr_t` | `usize` | |
| `int8_t` | `i8` | |
| `uint8_t` | `u8` | |
| `int16_t` | `i16` | |
| `uint16_t` | `u16` | |
| `int32_t` | `i32` | |
| `uint32_t` | `u32` | |
| `int64_t` | `i64` | |
| `uint64_t` | `u64` | |

### Pointer types

| C | Zig |
|---|-----|
| `void *` | `*anyopaque` |
| `const void *` | `*const anyopaque` |
| `char *` (null-terminated) | `[*:0]u8` |
| `const char *` (null-terminated) | `[*:0]const u8` |
| `char *` (known length) | `[*]u8` or `[]u8` |
| `T *` (nullable) | `?*T` |
| `T *` (non-null) | `*T` |
| `T **` | `*?*T` or `**T` |
| `void (*fn)(int)` | `*const fn (c_int) callconv(.C) void` |

### Enum types

```c
// C enum
typedef enum {
    STATUS_OK = 0,
    STATUS_ERR = 1,
    STATUS_BUSY = 2,
} Status;
```

```zig
// Zig equivalent with C ABI
const Status = enum(c_int) {
    ok = 0,
    err = 1,
    busy = 2,
};
```

## Common Patterns

### Callback functions (function pointers)

```c
// C API with callback
typedef void (*callback_t)(void *ctx, int event);
void register_callback(callback_t cb, void *ctx);
```

```zig
const c = @cImport(@cInclude("mylib.h"));

fn my_callback(ctx: ?*anyopaque, event: c_int) callconv(.C) void {
    const self = @as(*MyType, @ptrCast(@alignCast(ctx)));
    self.handle(event);
}

// Register
c.register_callback(my_callback, @ptrCast(my_obj));
```

### Error handling (C errno pattern)

```zig
const c = @cImport({
    @cInclude("errno.h");
    @cInclude("string.h");
});

fn open_file(path: [*:0]const u8) !void {
    const fd = c.open(path, c.O_RDONLY);
    if (fd < 0) {
        const err = c.__errno_location().*;  // Linux
        const msg = c.strerror(err);
        std.log.err("open failed: {s}", .{msg});
        return error.OpenFailed;
    }
    defer _ = c.close(fd);
}
```

### Memory management with C allocator

```zig
const c = @cImport({
    @cInclude("stdlib.h");
    @cInclude("string.h");
});

// Allocate C memory (must free with c.free)
const buf = c.malloc(1024) orelse return error.OutOfMemory;
defer c.free(buf);

const typed: [*]u8 = @ptrCast(buf);

// Use Zig allocator as C allocator via std.heap.c_allocator
const allocator = std.heap.c_allocator;
const data = try allocator.alloc(u8, 1024);
defer allocator.free(data);
```

## Null Safety

Zig's pointer model forces explicit null handling:

```zig
// C: char *result = get_name(id);  // might return NULL
// Zig: ?[*:0]const u8

const result: ?[*:0]const u8 = c.get_name(id);
if (result) |name| {
    std.debug.print("name: {s}\n", .{name});
} else {
    std.debug.print("not found\n", .{});
}

// Or with orelse
const name = c.get_name(id) orelse {
    return error.NotFound;
};
```
