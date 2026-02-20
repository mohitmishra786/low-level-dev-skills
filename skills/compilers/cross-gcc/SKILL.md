---
name: cross-gcc
description: Cross-compilation with GCC skill for embedded and multi-architecture targets. Use when setting up cross-gcc toolchains, configuring sysroots, building for ARM/AArch64/RISC-V/MIPS from an x86-64 host, troubleshooting wrong-architecture errors, or running cross-compiled binaries under QEMU. Activates on queries about cross-compilation triplets, sysroot, pkg-config for cross builds, embedded toolchains, or Yocto/Buildroot integration.
---

# Cross-GCC

## Purpose

Guide agents through setting up and using cross-compilation GCC toolchains: triplets, sysroots, pkg-config, QEMU-based testing, and common failure modes.

## Triggers

- "How do I compile for ARM on my x86 machine?"
- "I'm getting 'wrong ELF class' or 'cannot execute binary file'"
- "How do I set up a sysroot for cross-compilation?"
- "pkg-config returns host libraries in my cross build"
- "How do I debug a cross-compiled binary with QEMU + GDB?"

## Workflow

### 1. Understand the triplet

A GNU triplet has the form `<arch>-<vendor>-<os>-<abi>` (often 3 or 4 parts):

| Triplet | Target |
|---------|--------|
| `aarch64-linux-gnu` | 64-bit ARM Linux (glibc) |
| `arm-linux-gnueabihf` | 32-bit ARM Linux hard-float |
| `arm-none-eabi` | Bare-metal ARM (no OS) |
| `riscv64-linux-gnu` | 64-bit RISC-V Linux |
| `x86_64-w64-mingw32` | Windows (MinGW) from Linux |
| `mipsel-linux-gnu` | Little-endian MIPS Linux |

### 2. Install the toolchain

```bash
# Debian/Ubuntu
sudo apt install gcc-aarch64-linux-gnu g++-aarch64-linux-gnu binutils-aarch64-linux-gnu

# For bare-metal ARM (Cortex-M)
sudo apt install gcc-arm-none-eabi binutils-arm-none-eabi

# Verify
aarch64-linux-gnu-gcc --version
```

### 3. Basic cross-compilation

```bash
# C
aarch64-linux-gnu-gcc -O2 -o hello hello.c

# C++
aarch64-linux-gnu-g++ -O2 -std=c++17 -o hello hello.cpp

# Bare-metal (no stdlib, no OS)
arm-none-eabi-gcc -mcpu=cortex-m4 -mthumb -mfloat-abi=hard -mfpu=fpv4-sp-d16 \
    -ffreestanding -nostdlib -T linker.ld -o firmware.elf startup.s main.c
```

### 4. Sysroot

A sysroot is a directory containing the target's headers and libraries. Required when your code links against target-specific libraries.

```bash
# Use a sysroot
aarch64-linux-gnu-gcc --sysroot=/path/to/aarch64-sysroot -O2 -o prog main.c

# Common sysroot sources:
# - Raspberry Pi: download from raspbian/raspios
# - Debian multiarch: debootstrap --arch arm64 bullseye /tmp/sysroot
# - Yocto/Buildroot: generated automatically in build output
```

Verify the sysroot is correct:

```bash
aarch64-linux-gnu-gcc --sysroot=/path/to/sysroot -v -E - < /dev/null 2>&1 | grep sysroot
```

### 5. pkg-config for cross builds

`pkg-config` will return host library paths by default. Override:

```bash
export PKG_CONFIG_SYSROOT_DIR=/path/to/sysroot
export PKG_CONFIG_LIBDIR=${PKG_CONFIG_SYSROOT_DIR}/usr/lib/aarch64-linux-gnu/pkgconfig:${PKG_CONFIG_SYSROOT_DIR}/usr/share/pkgconfig
export PKG_CONFIG_PATH=   # clear host path

pkg-config --libs libssl  # now returns target paths
```

### 6. CMake cross-compilation

Create a toolchain file `aarch64.cmake`:

```cmake
set(CMAKE_SYSTEM_NAME Linux)
set(CMAKE_SYSTEM_PROCESSOR aarch64)

set(CMAKE_C_COMPILER   aarch64-linux-gnu-gcc)
set(CMAKE_CXX_COMPILER aarch64-linux-gnu-g++)

set(CMAKE_SYSROOT /path/to/aarch64-sysroot)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
```

```bash
cmake -S . -B build -DCMAKE_TOOLCHAIN_FILE=aarch64.cmake
cmake --build build
```

### 7. Test with QEMU

```bash
# User-mode emulation (Linux binaries, no full OS)
sudo apt install qemu-user-static

qemu-aarch64-static ./hello
# Or set binfmt_misc for transparent execution:
# Then just: ./hello

# GDB remote debug via QEMU
qemu-aarch64-static -g 1234 ./hello &
aarch64-linux-gnu-gdb -ex "target remote :1234" ./hello
```

### 8. Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `cannot execute binary file: Exec format error` | Running target binary on host without QEMU | Use `qemu-<arch>-static` |
| `wrong ELF class: ELFCLASS64` (or 32) | Wrong-architecture object linked | Check triplet; ensure all objects use same toolchain |
| `/usr/bin/ld: cannot find -lfoo` | Host library path used for cross-link | Set `--sysroot`; fix `PKG_CONFIG_LIBDIR` |
| `undefined reference to '__aeabi_*'` | Missing ARM ABI runtime | Link with `-lgcc` or `-lclang_rt.builtins` |
| `relocation R_AARCH64_ADR_PREL_PG_HI21 out of range` | Distance too large | Use `-mcmodel=large` or restructure |
| `unrecognized opcode` | Wrong `-mcpu` or `-march` | Set correct CPU flags for target |

### 9. Environment variables

```bash
# Tell build systems to use cross-compiler
export CC=aarch64-linux-gnu-gcc
export CXX=aarch64-linux-gnu-g++
export AR=aarch64-linux-gnu-ar
export STRIP=aarch64-linux-gnu-strip
export OBJDUMP=aarch64-linux-gnu-objdump

# For autoconf projects
./configure --host=aarch64-linux-gnu --prefix=/usr
```

For a reference on ARM-specific GCC flags, see [references/arm-flags.md](references/arm-flags.md).

## Related skills

- Use `skills/compilers/gcc` for GCC flag details
- Use `skills/debuggers/gdb` for remote debugging with `gdbserver`
- Use `skills/low-level-programming/assembly-arm` for AArch64 assembly specifics
- Use `skills/build-systems/cmake` for toolchain file setup
