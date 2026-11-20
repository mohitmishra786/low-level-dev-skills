# build.zig Advanced Patterns Reference

All examples target Zig 0.16. Artifacts take a `.root_module` created with `b.createModule`.
C sources, include paths and libraries are added to the module (`exe.root_module.*`).

## Multi-target Builds

```zig
pub fn build(b: *std.Build) void {
    const targets = [_]std.Target.Query{
        .{ .cpu_arch = .x86_64, .os_tag = .linux },
        .{ .cpu_arch = .aarch64, .os_tag = .linux },
        .{ .cpu_arch = .x86_64, .os_tag = .windows },
        .{ .cpu_arch = .aarch64, .os_tag = .macos },
    };

    // zig build release → zig-out/bin/myapp-<arch>-<os>[.exe]
    const release = b.step("release", "Build for all targets");
    for (targets) |t| {
        const exe = b.addExecutable(.{
            .name = b.fmt("myapp-{s}-{s}", .{
                @tagName(t.cpu_arch.?),
                @tagName(t.os_tag.?),
            }),
            .root_module = b.createModule(.{
                .root_source_file = b.path("src/main.zig"),
                .target = b.resolveTargetQuery(t),
                .optimize = .ReleaseFast,
            }),
        });
        release.dependOn(&b.addInstallArtifact(exe, .{}).step);
    }
}
```

Include the OS in the name. With the arch alone, `aarch64-linux` and `aarch64-macos` both install
as `myapp-aarch64`.

## Conditional Compilation

```zig
pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe = b.addExecutable(.{
        .name = "myapp",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = target,
            .optimize = optimize,
            .link_libc = true,
        }),
    });

    // Platform-specific sources
    const resolved = target.result;
    switch (resolved.os.tag) {
        .linux => exe.root_module.addCSourceFile(.{
            .file = b.path("src/platform/linux.c"),
            .flags = &.{"-std=c11"},
        }),
        .windows => exe.root_module.addCSourceFile(.{
            .file = b.path("src/platform/windows.c"),
            .flags = &.{"-std=c11"},
        }),
        .macos => exe.root_module.addCSourceFile(.{
            .file = b.path("src/platform/macos.c"),
            .flags = &.{"-std=c11"},
        }),
        else => {},
    }

    // Windows-specific linking
    if (resolved.os.tag == .windows) {
        exe.root_module.linkSystemLibrary("ws2_32", .{});
        exe.root_module.linkSystemLibrary("advapi32", .{});
    }
}
```

## External C Library Integration

### With pkg-config

```zig
// .use_pkg_config: .yes (default), .no, or .force
exe.root_module.linkSystemLibrary("libcurl", .{ .use_pkg_config = .force });
exe.root_module.linkSystemLibrary("openssl", .{});
exe.root_module.link_libc = true;
```

### With explicit paths (no pkg-config)

```zig
exe.root_module.addLibraryPath(b.path("vendor/mylib/lib"));
exe.root_module.addIncludePath(b.path("vendor/mylib/include"));
exe.root_module.linkSystemLibrary("mylib", .{ .use_pkg_config = .no });
exe.root_module.link_libc = true;
```

### Build C library from source

```zig
const mylib = b.addLibrary(.{
    .name = "mylib",
    .linkage = .static,
    .root_module = b.createModule(.{
        .target = target,
        .optimize = optimize,
        .link_libc = true,
    }),
});
mylib.root_module.addCSourceFiles(.{
    .files = &.{
        "vendor/mylib/src/a.c",
        "vendor/mylib/src/b.c",
    },
    .flags = &.{"-std=c99"},
});
mylib.root_module.addIncludePath(b.path("vendor/mylib/include"));
mylib.installHeader(b.path("vendor/mylib/include/mylib.h"), "mylib.h");

exe.root_module.linkLibrary(mylib);
exe.root_module.addIncludePath(b.path("vendor/mylib/include"));
```

## Testing Patterns

```zig
const mylib_mod = b.addModule("mylib", .{
    .root_source_file = b.path("src/lib.zig"),
    .target = target,
    .optimize = optimize,
});

// Unit tests; `zig build test -- <substring>` filters by test name
const lib_tests = b.addTest(.{
    .root_module = mylib_mod,
    .filters = b.args orelse &.{},
    // .test_runner = .{ .path = b.path("test_runner.zig"), .mode = .simple },
});

// Integration tests import the library module
const integration_tests = b.addTest(.{
    .root_module = b.createModule(.{
        .root_source_file = b.path("tests/integration.zig"),
        .target = target,
        .optimize = optimize,
        .imports = &.{.{ .name = "mylib", .module = mylib_mod }},
    }),
});

const test_step = b.step("test", "Run all tests");
test_step.dependOn(&b.addRunArtifact(lib_tests).step);
test_step.dependOn(&b.addRunArtifact(integration_tests).step);
```

## Install Layout Control

```zig
// Default: zig-out/bin/, zig-out/lib/
b.installArtifact(exe);

// Custom install locations (relative to --prefix)
b.installFile("config/default.conf", "etc/myapp/default.conf");
b.installDirectory(.{
    .source_dir = b.path("assets"),
    .install_dir = .prefix,
    .install_subdir = "share/myapp/assets",
});

// Headers installed alongside a library artifact
mylib.installHeader(b.path("src/mylib.h"), "mylib.h");

// Change install prefix at build time
// zig build --prefix /usr/local
```

## Generated Files and Code Generators

Generated files belong in the build cache, not in `src/`. Pass them to modules as `LazyPath`s.

```zig
// Generate a Zig file and import it as @import("version")
const wf = b.addWriteFiles();
const version_zig = wf.add("version.zig", b.fmt(
    \\pub const version = "{s}";
    \\pub const git_hash = "{s}";
    \\
, .{ "0.1.0", "abc1234" }));
exe.root_module.addAnonymousImport("version", .{ .root_source_file = version_zig });

// Run a code generator; its output path is managed by the build system
const gen = b.addSystemCommand(&.{ "python3", "scripts/gen_bindings.py" });
gen.addArg("--input");
gen.addFileArg(b.path("schema.json"));
gen.addArg("--output");
const bindings = gen.addOutputFileArg("bindings.zig");
exe.root_module.addAnonymousImport("bindings", .{ .root_source_file = bindings });

// Custom step alias
const check_step = b.step("check", "Check for compile errors");
check_step.dependOn(&exe.step);
```

## Inspecting the Build

```bash
# List steps and project options
zig build --help

# Show the step tree with timing and cache hits
zig build --summary all

# Print every compiler command that runs
zig build --verbose
```

## Build Variables Available

```zig
pub fn build(b: *std.Build) void {
    _ = b.graph.zig_exe;            // Path to zig compiler
    _ = b.graph.environ_map;        // Environment variables
    _ = b.graph.global_cache_root;  // Global cache
    _ = b.install_prefix;           // Install prefix (--prefix)
    _ = b.cache_root;               // Local cache directory
    _ = b.build_root;               // Project root
}
```
