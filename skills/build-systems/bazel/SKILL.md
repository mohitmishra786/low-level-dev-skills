---
name: bazel
description: Bazel build system skill for C/C++ projects. Use when writing BUILD files with cc_library and cc_binary rules, registering toolchains, configuring remote execution, debugging sandbox issues, using query and cquery for dependency graphs, or migrating from CMake to Bazel. Activates on queries about Bazel, BUILD files, cc_library, cc_binary, Bzlmod, bazel query, remote execution, or Bazel toolchain registration.
---

# Bazel

## Purpose

Guide agents through Bazel for C/C++ projects: writing BUILD files, cc_library/cc_binary rules, toolchain registration, remote execution, dependency graph queries, Bzlmod dependency management, and sandbox debugging.

## Triggers

- "How do I write a Bazel BUILD file for a C++ library?"
- "How do I add external dependencies with Bzlmod?"
- "How do I debug Bazel sandbox errors?"
- "How do I query the Bazel dependency graph?"
- "How do I set up remote execution with Bazel?"
- "How do I register a custom C++ toolchain?"

## Workflow

### 1. Workspace structure

```
my-project/
├── MODULE.bazel         # Bzlmod dependency file (Bazel ≥6)
├── WORKSPACE            # legacy (still needed for some features)
├── BUILD                # root build file
├── src/
│   ├── BUILD
│   └── main.cc
└── lib/
    ├── BUILD
    ├── mylib.cc
    └── mylib.h
```

### 2. Basic BUILD file — cc_library / cc_binary

```python
# lib/BUILD
cc_library(
    name = "mylib",
    srcs = ["mylib.cc"],
    hdrs = ["mylib.h"],
    copts = ["-Wall", "-Wextra", "-std=c++17"],
    visibility = ["//visibility:public"],
    deps = [
        "@com_google_absl//absl/strings",     # external dep
        "//util:helpers",                      # internal dep
    ],
)

cc_test(
    name = "mylib_test",
    srcs = ["mylib_test.cc"],
    deps = [
        ":mylib",
        "@com_google_googletest//:gtest_main",
    ],
)
```

```python
# src/BUILD
cc_binary(
    name = "main",
    srcs = ["main.cc"],
    deps = ["//lib:mylib"],
    linkopts = ["-lpthread"],
)
```

```bash
# Build
bazel build //src:main
bazel build //...           # build everything

# Test
bazel test //lib:mylib_test
bazel test //...            # run all tests

# Run
bazel run //src:main -- arg1 arg2

# Output path
bazel-bin/src/main
```

### 3. Bzlmod — modern dependency management

```python
# MODULE.bazel
module(
    name = "my_project",
    version = "1.0",
)

bazel_dep(name = "abseil-cpp", version = "20240116.2")
bazel_dep(name = "googletest", version = "1.14.0")
bazel_dep(name = "rules_cc", version = "0.0.9")
bazel_dep(name = "platforms", version = "0.0.8")

# For http_archive deps not yet in BCR (Bazel Central Registry)
# Use module extensions
```

```bash
# Check available versions
bazel mod graph | head -30

# Show dependency tree
bazel mod deps --depth=2
```

### 4. Dependency graph queries

```bash
# Show all dependencies of a target
bazel query "deps(//src:main)"

# Find reverse dependencies (who depends on this?)
bazel query "rdeps(//..., //lib:mylib)"

# Find what changed between builds
bazel query "filter('//lib', deps(//src:main))"

# cquery — configuration-aware query
bazel cquery "deps(//src:main)" --output=files

# Show include paths for a target
bazel cquery "//lib:mylib" --output=build

# Find cycles in the build graph
bazel query --nohost_deps --noimplicit_deps \
  "somepath(//src:main, //lib:mylib)"

# aquery — action graph (shows compiler flags, inputs, outputs)
bazel aquery "//src:main"
bazel aquery "//src:main" --output=jsonproto | jq '.actions[0].arguments'
```

### 5. Toolchain registration

```python
# platforms/BUILD
platform(
    name = "linux_x86_64",
    constraint_values = [
        "@platforms//os:linux",
        "@platforms//cpu:x86_64",
    ],
)

# toolchains/BUILD
cc_toolchain_suite(
    name = "my_toolchain",
    toolchains = {
        "k8": ":my_k8_toolchain",
    },
)

cc_toolchain(
    name = "my_k8_toolchain",
    all_files = ":empty",
    compiler_files = ":compiler_wrapper",
    # ... other file groups
)

toolchain(
    name = "my_cc_toolchain",
    toolchain = ":my_k8_toolchain",
    toolchain_type = "@bazel_tools//tools/cpp:toolchain_type",
    target_compatible_with = ["@platforms//os:linux"],
)
```

```python
# MODULE.bazel — register toolchain
register_toolchains("//toolchains:my_cc_toolchain")
```

### 6. Remote execution

```bash
# Use --remote_executor flag
bazel build //... \
  --remote_executor=grpc://buildgrid.example.com:50051 \
  --remote_instance_name=main

# Google Cloud Build Remote Execution
bazel build //... \
  --remote_executor=remotebuildexecution.googleapis.com \
  --remote_instance_name=projects/my-project/instances/default \
  --google_default_credentials

# Caching (without remote execution)
bazel build //... \
  --remote_cache=grpc://cache.example.com:9092

# Show what's cached
bazel build //... --remote_upload_local_results=true
```

### 7. Sandbox debugging

```bash
# Show sandbox inputs and outputs
bazel build //src:main --sandbox_debug

# Run build with verbose sandboxing
bazel build //src:main --verbose_failures --sandbox_debug

# Disable sandbox entirely (for debugging)
bazel build //src:main --spawn_strategy=local

# Common sandbox errors
# "No such file or directory" → missing data dependency
#   Fix: add file to `data = [...]` attribute
# "Permission denied" → trying to write outside sandbox
#   Fix: use genrule output paths instead of hardcoded paths
# "FAILED: Build did NOT complete successfully" → check verbose output

# See the exact command Bazel ran
bazel build //src:main --subcommands
```

For Bazel C++ toolchain configuration, see [references/bazel-cpp-toolchain.md](references/bazel-cpp-toolchain.md).

## Related skills

- Use `skills/build-systems/cmake` for CMake as an alternative build system
- Use `skills/build-systems/build-acceleration` for sccache integration with Bazel remote cache
- Use `skills/compilers/gcc` or `skills/compilers/clang` for compiler flags used in Bazel `copts`
