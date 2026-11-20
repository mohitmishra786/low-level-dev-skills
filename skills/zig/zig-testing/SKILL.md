---
name: zig-testing
description: Zig testing skill for writing and running tests. Use when using zig build test, writing comptime tests, using test filters, working with test allocators to detect leaks, or using Zig's built-in fuzz testing (std.testing.fuzz). Activates on queries about Zig tests, zig test, zig build test, comptime testing, test allocators, Zig fuzz testing, or detecting memory leaks in Zig tests.
---

# Zig Testing

## Purpose

Guide agents through Zig's testing system: `zig build test` and `zig test`, comptime testing patterns, test filters, the test allocator for leak detection, and Zig's built-in fuzz testing.

## Triggers

- "How do I write and run tests in Zig?"
- "How do I filter which Zig tests run?"
- "How do I detect memory leaks in Zig tests?"
- "How do I write comptime tests in Zig?"
- "How do I use Zig's built-in fuzzer?"
- "How do I test a Zig library?"

## Workflow

### 1. Writing and running tests

```zig
// src/math.zig
const std = @import("std");
const testing = std.testing;

pub fn add(a: i32, b: i32) i32 {
    return a + b;
}

pub fn divide(a: f64, b: f64) !f64 {
    if (b == 0.0) return error.DivisionByZero;
    return a / b;
}

// Tests live in the same file or a dedicated test file
test "add: basic addition" {
    try testing.expectEqual(@as(i32, 5), add(2, 3));
    try testing.expectEqual(@as(i32, -1), add(2, -3));
}

test "add: identity" {
    try testing.expectEqual(@as(i32, 42), add(42, 0));
}

test "divide: normal case" {
    const result = try divide(10.0, 2.0);
    try testing.expectApproxEqAbs(result, 5.0, 1e-9);
}

test "divide: by zero returns error" {
    try testing.expectError(error.DivisionByZero, divide(1.0, 0.0));
}
```

```bash
# Run all tests in a single file
zig test src/math.zig

# Run all tests via build system
zig build test

# Verbose output
zig build test -- --verbose

# Run specific test by name (substring match)
zig build test -- --test-filter "add"
```

### 2. build.zig test configuration

```zig
// build.zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const math_mod = b.createModule(.{
        .root_source_file = b.path("src/math.zig"),
        .target = target,
        .optimize = optimize,
    });

    // Unit test step
    const unit_tests = b.addTest(.{ .root_module = math_mod });
    const run_unit_tests = b.addRunArtifact(unit_tests);

    // Integration tests (separate test binary that imports the module)
    const integration_tests = b.addTest(.{
        .root_module = b.createModule(.{
            .root_source_file = b.path("tests/integration.zig"),
            .target = target,
            .optimize = optimize,
            .imports = &.{.{ .name = "math", .module = math_mod }},
        }),
    });
    const run_integration = b.addRunArtifact(integration_tests);

    // `zig build test` runs both
    const test_step = b.step("test", "Run all tests");
    test_step.dependOn(&run_unit_tests.step);
    test_step.dependOn(&run_integration.step);

    // `zig build test-unit` runs only unit tests
    const unit_step = b.step("test-unit", "Run unit tests");
    unit_step.dependOn(&run_unit_tests.step);
}
```

### 3. Test allocator — leak detection

`std.testing.allocator` is a `std.heap.DebugAllocator` that reports leaks at the end of each test:

```zig
const std = @import("std");
const testing = std.testing;

test "ArrayList: no leaks" {
    // std.ArrayList is unmanaged since 0.15: pass the allocator to each call
    var list: std.ArrayList(u32) = .empty;
    defer list.deinit(testing.allocator);   // MUST defer to return memory

    try list.append(testing.allocator, 1);
    try list.append(testing.allocator, 2);
    try list.append(testing.allocator, 3);

    try testing.expectEqual(@as(usize, 3), list.items.len);
    // If you forget defer list.deinit(), test reports a leak
}

test "custom allocation" {
    // DebugAllocator replaced GeneralPurposeAllocator
    var da: std.heap.DebugAllocator(.{}) = .init;
    defer {
        const leaked = da.deinit();
        // .ok means no leaks; .leak means memory was not freed
        testing.expect(leaked == .ok) catch @panic("memory leaked!");
    }
    const allocator = da.allocator();

    const buf = try allocator.alloc(u8, 1024);
    defer allocator.free(buf);  // leak if forgotten
}
```

### 4. Testing assertions

```zig
const testing = std.testing;

// Equality
try testing.expectEqual(expected, actual);
try testing.expectEqualStrings("hello", result_str);
try testing.expectEqualSlices(u8, expected_slice, actual_slice);

// Approximate equality (for floats)
try testing.expectApproxEqAbs(expected, actual, tolerance);
try testing.expectApproxEqRel(expected, actual, tolerance);

// Errors
try testing.expectError(error.MyError, might_fail());
try testing.expect(condition);    // basic boolean assertion

// Comparison
try testing.expect(a < b);
try testing.expectStringStartsWith(str, "prefix");
try testing.expectStringEndsWith(str, "suffix");
```

### 5. Comptime testing

Zig can run tests at comptime — useful for compile-time constants and type-level checks:

```zig
const std = @import("std");
const testing = std.testing;

// Test comptime functions
fn isPowerOfTwo(n: comptime_int) bool {
    return n > 0 and (n & (n - 1)) == 0;
}

// Comptime assert (compile error if false)
comptime {
    std.debug.assert(isPowerOfTwo(16));
    std.debug.assert(!isPowerOfTwo(15));
    std.debug.assert(isPowerOfTwo(1024));
}

// Test with comptime-known values (runs at comptime in test mode)
test "isPowerOfTwo: comptime" {
    comptime {
        try testing.expect(isPowerOfTwo(8));
        try testing.expect(!isPowerOfTwo(7));
    }
}

// Type-level testing
test "type properties" {
    // Verify alignment and size at comptime
    comptime {
        try testing.expectEqual(8, @alignOf(u64));
        try testing.expectEqual(4, @sizeOf(u32));
        try testing.expectEqual(true, @typeInfo(u8).int.signedness == .unsigned);
    }
}
```

### 6. Fuzz testing

Zig has a built-in coverage-guided fuzzer, driven by `zig build test --fuzz`. Since 0.16 a fuzz
test receives a `*std.testing.Smith`, which hands out fuzzer-chosen values, instead of a byte slice.

```zig
const std = @import("std");

fn parseInput(data: []const u8) !u32 {
    if (data.len < 4) return error.TooShort;
    const magic = std.mem.readInt(u32, data[0..4], .little);
    if (magic != 0xDEADBEEF) return error.BadMagic;
    return magic;
}

fn fuzzParse(_: void, smith: *std.testing.Smith) !void {
    var buf: [256]u8 = undefined;
    const len = smith.slice(&buf);   // fuzzer-chosen length and bytes
    _ = parseInput(buf[0..len]) catch {};
}

test "fuzz parseInput" {
    try std.testing.fuzz({}, fuzzParse, .{
        // Corpus entries are Smith input streams, not raw parser bytes:
        // slice() reads a 4-byte little-endian length, then that many bytes
        .corpus = &.{
            "\x04\x00\x00\x00\xef\xbe\xad\xde",  // slice = ef be ad de (the magic)
            "\x03\x00\x00\x00abc",                // slice = "abc"
        },
    });
}
```

```bash
# Normal test run: each fuzz test runs once per corpus entry, plus once with empty input
zig build test

# Fuzz until stopped (implies --webui, live coverage in the browser), or for N runs.
# Zig 0.16.0's test runner fails to compile in Debug fuzz mode, so use a release mode.
zig build test --fuzz -Doptimize=ReleaseSafe
zig build test --fuzz=100K -Doptimize=ReleaseSafe
```

Other `Smith` helpers: `value(T)`, `valueRangeAtMost(T, lo, hi)`, `bytes(buf)`, `eos()` (end of
sequence, for loops). The crash message names the file holding a crashing input. Reproduce it by
adding the input to `.corpus`, for example with `@embedFile`.

## Related skills

- Use `skills/zig/zig-build-system` for build.zig configuration and test step setup
- Use `skills/zig/zig-comptime` for comptime evaluation patterns tested via comptime asserts
- Use `skills/runtimes/fuzzing` for libFuzzer/AFL as alternative fuzz frameworks
- Use `skills/runtimes/sanitizers` for AddressSanitizer with Zig tests
