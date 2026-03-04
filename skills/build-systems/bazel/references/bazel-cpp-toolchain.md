# Bazel C++ Toolchain Reference

Source: https://bazel.build/docs/cc-toolchain-config-reference

## Minimal Custom Toolchain

```python
# toolchains/BUILD
load("@bazel_tools//tools/cpp:cc_toolchain_config.bzl", "cc_toolchain_config")

cc_toolchain_config(
    name = "k8_toolchain_config",
    cpu = "k8",
    compiler = "gcc",
    toolchain_identifier = "local",
    host_system_name = "local",
    target_system_name = "local",
    target_libc = "glibc_2.31",
    abi_version = "gcc",
    abi_libc_version = "glibc_2.31",
    tool_paths = {
        "ar":      "/usr/bin/ar",
        "cpp":     "/usr/bin/cpp",
        "gcc":     "/usr/bin/gcc",
        "gcov":    "/usr/bin/gcov",
        "ld":      "/usr/bin/ld",
        "nm":      "/usr/bin/nm",
        "objdump": "/usr/bin/objdump",
        "strip":   "/usr/bin/strip",
    },
    compile_flags = ["-Wall", "-Wextra"],
    opt_compile_flags = ["-O2", "-DNDEBUG"],
    dbg_compile_flags = ["-g", "-O0"],
    link_flags = ["-lpthread", "-lm"],
    cxx_flags = ["-std=c++17"],
)

cc_toolchain(
    name = "k8_toolchain",
    all_files = ":empty",
    ar_files = ":empty",
    as_files = ":empty",
    compiler_files = ":empty",
    dwp_files = ":empty",
    linker_files = ":empty",
    objcopy_files = ":empty",
    strip_files = ":empty",
    supports_param_files = 0,
    toolchain_config = ":k8_toolchain_config",
    toolchain_identifier = "k8-toolchain",
)

toolchain(
    name = "cc_toolchain_k8",
    exec_compatible_with = [
        "@platforms//cpu:x86_64",
        "@platforms//os:linux",
    ],
    target_compatible_with = [
        "@platforms//cpu:x86_64",
        "@platforms//os:linux",
    ],
    toolchain = ":k8_toolchain",
    toolchain_type = "@bazel_tools//tools/cpp:toolchain_type",
)

# placeholder
filegroup(name = "empty")
```

## Cross-Compilation Toolchain

```python
cc_toolchain_config(
    name = "arm64_toolchain_config",
    cpu = "aarch64",
    compiler = "gcc",
    toolchain_identifier = "cross-arm64",
    host_system_name = "x86_64-linux-gnu",
    target_system_name = "aarch64-linux-gnu",
    target_libc = "glibc_2.31",
    abi_version = "gcc",
    abi_libc_version = "glibc_2.31",
    tool_paths = {
        "ar":  "/usr/bin/aarch64-linux-gnu-ar",
        "gcc": "/usr/bin/aarch64-linux-gnu-gcc",
        "ld":  "/usr/bin/aarch64-linux-gnu-ld",
        "nm":  "/usr/bin/aarch64-linux-gnu-nm",
        "strip": "/usr/bin/aarch64-linux-gnu-strip",
    },
    compile_flags = ["--sysroot=/sysroots/aarch64"],
    link_flags = ["--sysroot=/sysroots/aarch64"],
    cxx_flags = ["-std=c++17"],
)
```

## Common Build Flags

```python
# Force optimized build
bazel build //... -c opt

# Force debug build
bazel build //... -c dbg

# Use specific toolchain
bazel build //... --extra_toolchains=//toolchains:cc_toolchain_k8

# Pass compiler flags
bazel build //... --copt=-fsanitize=address --linkopt=-fsanitize=address

# Target specific platform
bazel build //... --platforms=//platforms:linux_arm64
```
