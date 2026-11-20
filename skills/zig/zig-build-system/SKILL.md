---
name: zig-build-system
description: Zig build system skill for multi-file Zig projects. Use when writing or debugging build.zig files, adding executables or libraries, integrating C source files, configuring build-time options, running tests with zig build test, or managing build.zig.zon package manifests. Activates on queries about build.zig, b.addExecutable, addCSourceFiles, b.option, zig build, build.zig.zon, or Zig package management.
---

# Zig Build System

## Purpose

Guide agents through writing `build.zig` files for Zig 0.16: executables, libraries, C source integration, build options, test configuration, and `build.zig.zon` package manifests.

## Triggers

- "How do I set up a build.zig file?"
- "How do I add a C library to a Zig project?"
- "How do I define build-time options in Zig?"
- "How do I run Zig tests with zig build test?"
- "What is build.zig.zon and how do I use it?"
- "How do I add a Zig package dependency?"

## Workflow

### 1. Project initialization

```bash
# Initialize a new project
mkdir myproject && cd myproject
zig init          # creates build.zig, build.zig.zon, src/main.zig, src/root.zig

# Build
zig build

# Run
zig build run

# Test
zig build test
```

### 2. build.zig structure

Since Zig 0.15, every artifact is built from a root module created with `b.createModule`.
Source file, target, optimize mode, libc linking and imports are module settings.

```zig
const std = @import("std");

pub fn build(b: *std.Build) void {
    // Standard options (-Doptimize=..., -Dtarget=...)
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const exe_mod = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });

    const exe = b.addExecutable(.{
        .name = "myapp",
        .root_module = exe_mod,
    });

    // Install step (zig build → copies to zig-out/bin/)
    b.installArtifact(exe);

    // Run step (zig build run)
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }
    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);

    // Test step (zig build test) — tests the same module
    const unit_tests = b.addTest(.{
        .root_module = exe_mod,
    });
    const run_unit_tests = b.addRunArtifact(unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_unit_tests.step);
}
```

### 3. Libraries

```zig
const lib_mod = b.createModule(.{
    .root_source_file = b.path("src/mylib.zig"),
    .target = target,
    .optimize = optimize,
});

// Static library (addStaticLibrary was removed; use addLibrary)
const lib = b.addLibrary(.{
    .name = "mylib",
    .linkage = .static,
    .root_module = lib_mod,
});
b.installArtifact(lib);

// Shared library
const shared_lib = b.addLibrary(.{
    .name = "mylib",
    .linkage = .dynamic,
    .root_module = lib_mod,
    .version = .{ .major = 1, .minor = 0, .patch = 0 },
});
b.installArtifact(shared_lib);

// Link library into executable
exe.root_module.linkLibrary(lib);
```

### 4. Adding C source files

C sources, include paths and system libraries are added to a module, not to the artifact.
`exe.addCSourceFile(...)`, `exe.linkLibC()` and similar `Compile` methods no longer exist.

```zig
// Single C file
exe.root_module.addCSourceFile(.{
    .file = b.path("src/legacy.c"),
    .flags = &.{ "-std=c11", "-Wall", "-Wextra" },
});

// Multiple C files
exe.root_module.addCSourceFiles(.{
    .files = &.{
        "src/a.c",
        "src/b.c",
        "src/c.c",
    },
    .flags = &.{ "-std=c11", "-O2" },
});

// Include directories
exe.root_module.addIncludePath(b.path("include/"));
exe.root_module.addIncludePath(.{ .cwd_relative = "/usr/local/include" });

// System libraries (second argument: needed/weak/use_pkg_config/...)
exe.root_module.linkSystemLibrary("curl", .{});
exe.root_module.linkSystemLibrary("ssl", .{});
exe.root_module.link_libc = true;  // or .link_libc = true in createModule
```

### 5. Build-time options

```zig
pub fn build(b: *std.Build) void {
    // Boolean option
    const enable_logging = b.option(
        bool,
        "logging",
        "Enable debug logging",
    ) orelse false;

    // Enum option
    const Backend = enum { opengl, vulkan, software };
    const backend = b.option(
        Backend,
        "backend",
        "Rendering backend",
    ) orelse .opengl;

    // Integer option
    const max_connections = b.option(
        u32,
        "max-connections",
        "Maximum concurrent connections",
    ) orelse 64;

    // Pass to Zig code as compile-time constant
    const options = b.addOptions();
    options.addOption(bool, "enable_logging", enable_logging);
    options.addOption(Backend, "backend", backend);
    options.addOption(u32, "max_connections", max_connections);

    exe.root_module.addOptions("build_options", options);
}
```

In Zig source:

```zig
const build_options = @import("build_options");

pub fn main() void {
    if (build_options.enable_logging) {
        std.debug.print("Logging enabled\n", .{});
    }
}
```

```bash
# Pass options on command line
zig build -Dlogging=true -Dbackend=vulkan -Dmax-connections=256
```

### 6. Module system

```zig
// Public module: other packages can import it via b.dependency(...).module("mymodule")
const mymodule = b.addModule("mymodule", .{
    .root_source_file = b.path("src/mymodule.zig"),
});

// Use module in executable
exe.root_module.addImport("mymodule", mymodule);

// Private module shared between exe and tests
const utils = b.createModule(.{
    .root_source_file = b.path("src/utils.zig"),
});
exe.root_module.addImport("utils", utils);
unit_tests.root_module.addImport("utils", utils);

// Imports can also be listed when the module is created
const app_mod = b.createModule(.{
    .root_source_file = b.path("src/app.zig"),
    .target = target,
    .optimize = optimize,
    .imports = &.{
        .{ .name = "utils", .module = utils },
    },
});
const app = b.addExecutable(.{ .name = "app", .root_module = app_mod });
b.installArtifact(app);
```

In Zig source:

```zig
const utils = @import("utils");
const mymodule = @import("mymodule");
```

### 7. Package management with build.zig.zon

`zig init` writes a `build.zig.zon` with a generated `fingerprint`. The package `name` is an enum
literal, not a string. Zig 0.16 refuses to build a package, or a dependency, that has no
fingerprint or uses a string name.

```zig
// build.zig.zon
.{
    .name = .myapp,
    .version = "0.1.0",
    .fingerprint = 0x8798022aacdd7f5b, // generated by zig init; never copy between packages
    .minimum_zig_version = "0.16.0",

    .dependencies = .{
        .clap = .{
            .url = "https://github.com/Hejsil/zig-clap/archive/refs/tags/0.12.0.tar.gz",
            .hash = "...", // filled in by zig fetch --save
        },
    },

    .paths = .{
        "build.zig",
        "build.zig.zon",
        "src",
        "LICENSE",
        "README.md",
    },
}
```

```bash
# Add a dependency and write its hash into build.zig.zon
zig fetch --save https://github.com/Hejsil/zig-clap/archive/refs/tags/0.12.0.tar.gz

# Missing or wrong fingerprint: zig build prints the value to use
zig build    # error: missing top-level 'fingerprint' field; suggested value: 0x...
```

```zig
// build.zig — use the dependency
const clap_dep = b.dependency("clap", .{
    .target = target,
    .optimize = optimize,
});
exe.root_module.addImport("clap", clap_dep.module("clap"));
```

```bash
# zig build fetches missing dependencies into ./zig-pkg/ (Zig 0.16+)
zig build

# Work on a local checkout of a dependency without editing build.zig.zon
zig build --fork=../zig-clap
```

### 8. Custom build steps

```zig
// Code generation step
const gen_step = b.addSystemCommand(&.{
    "python3", "scripts/gen.py", "--output", "src/generated.zig",
});
exe.step.dependOn(&gen_step.step);

// Custom install step
const install_config = b.addInstallFile(
    b.path("config/default.toml"),
    "share/myapp/config.toml",
);
b.getInstallStep().dependOn(&install_config.step);
```

For advanced build.zig patterns, see [references/build-zig-patterns.md](references/build-zig-patterns.md).

## Related skills

- Use `skills/zig/zig-compiler` for single-file builds and compiler flags
- Use `skills/zig/zig-cinterop` for C library integration in build.zig
- Use `skills/zig/zig-cross` for cross-compilation in build.zig
- Use `skills/build-systems/cmake` when embedding Zig into a CMake project
