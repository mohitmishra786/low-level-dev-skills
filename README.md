# low-level-dev-skills

A curated suite of AI agent skills for systems and low-level programming — C/C++, Rust, and Zig toolchains. These skills provide expert guidance for compilers, debuggers, profilers, build systems, sanitizers, low-level programming, embedded development, observability, and WebAssembly.

**[View on skills.sh](https://skills.sh/mohitmishra786/low-level-dev-skills)**

## Installation

Install all skills with a single command:

```bash
npx skills add mohitmishra786/low-level-dev-skills --all
```

Or select specific skills interactively:

```bash
npx skills add mohitmishra786/low-level-dev-skills
```

Install globally to make skills available in all projects:

```bash
npx skills add mohitmishra786/low-level-dev-skills --all --global
```

### Install by language / tag

Install specific skill bundles using the `--skill` flag (space-separated list):

```bash
# C/C++ toolchain (compilers, debuggers, build systems, profilers)
npx skills add mohitmishra786/low-level-dev-skills --skill gcc clang llvm msvc-cl cross-gcc pgo cmake make ninja meson conan-vcpkg static-analysis gdb lldb core-dumps linux-perf valgrind flamegraphs strace-ltrace heaptrack sanitizers fuzzing elf-inspection linkers-lto binutils dynamic-linking assembly-x86 assembly-arm interpreters simd-intrinsics memory-model cpu-cache-opt

# Rust bundle (compiler, Cargo, debugging, profiling, FFI, cross, sanitizers, async, security)
npx skills add mohitmishra786/low-level-dev-skills --skill rustc-basics cargo-workflows rust-debugging rust-profiling rust-ffi rust-cross rust-sanitizers-miri rust-unsafe rust-async-internals rust-security rust-no-std rust-build-times

# Zig bundle (compiler, build system, C interop, debugging, cross, testing, comptime)
npx skills add mohitmishra786/low-level-dev-skills --skill zig-compiler zig-build-system zig-cinterop zig-debugging zig-cross zig-testing zig-comptime

# Embedded (FreeRTOS, Zephyr, OpenOCD, linker scripts, embedded Rust)
npx skills add mohitmishra786/low-level-dev-skills --skill freertos zephyr openocd-jtag linker-scripts embedded-rust

# Observability (eBPF, binary hardening)
npx skills add mohitmishra786/low-level-dev-skills --skill ebpf ebpf-rust binary-hardening

# WebAssembly
npx skills add mohitmishra786/low-level-dev-skills --skill wasm-emscripten wasm-wasmtime

# The core essentials (compiler + debugger + profiler for all languages)
npx skills add mohitmishra786/low-level-dev-skills --skill gcc clang rustc-basics zig-compiler gdb lldb linux-perf cmake cargo-workflows zig-build-system

# Build systems only
npx skills add mohitmishra786/low-level-dev-skills --skill cmake make ninja meson conan-vcpkg static-analysis zig-build-system cargo-workflows build-acceleration bazel include-what-you-use

# Profilers and performance tools
npx skills add mohitmishra786/low-level-dev-skills --skill linux-perf valgrind flamegraphs strace-ltrace heaptrack rust-profiling intel-vtune-amd-uprof hardware-counters

# Runtime safety (sanitizers, fuzzing, Miri, binary hardening)
npx skills add mohitmishra786/low-level-dev-skills --skill sanitizers fuzzing rust-sanitizers-miri rust-unsafe binary-hardening rust-security

# Binary analysis (ELF, linkers, dynamic linking, binutils, DWARF)
npx skills add mohitmishra786/low-level-dev-skills --skill elf-inspection linkers-lto binutils dynamic-linking dwarf-debug-format
```

## Supported Agents

Skills work with 30+ AI coding agents:

| Agent | Skill Directory |
|-------|-----------------|
| [Claude Code](https://claude.com/product/claude-code) | `.claude/skills/` |
| [Cursor](https://cursor.sh) | `.cursor/skills/` |
| [Codex](https://openai.com/codex) | `.codex/skills/` |
| [GitHub Copilot](https://github.com/features/copilot) | `.github/copilot/skills/` |
| [Cline](https://cline.bot) | `.cline/skills/` |
| [Windsurf](https://codeium.com/windsurf) | `.windsurf/skills/` |
| [Gemini CLI](https://gemini.google.com) | `.gemini/skills/` |
| [Kilo](https://kilo.ai) | `.kilo/skills/` |

And many more including: Amp, Antigravity, Augment, Droid, Goose, Kiro CLI, OpenCode, Roo, Trae, VSCode, and others.

## Usage Examples

After installation, invoke skills in your AI agent:

### C/C++ toolchain
```
/gcc How do I enable link-time optimization?
/gdb Set a conditional breakpoint in GDB
/cmake What's the modern way to find packages?
/static-analysis Run clang-tidy on my whole project
/pgo Walk me through a GCC PGO workflow
/dynamic-linking My binary can't find its shared library
/cpp-modules How do I write a C++20 named module?
/cpp-templates How do I use concepts as constraints?
/binary-hardening How do I add RELRO and PIE to my binary?
```

### Rust
```
/rustc-basics Configure a release build for maximum performance
/cargo-workflows Set up a Cargo workspace with multiple crates
/rust-debugging Debug a Rust panic with GDB
/rust-profiling Generate a flamegraph for my Rust binary
/rust-ffi Generate bindings to a C library with bindgen
/rust-cross Cross-compile Rust for ARM with cargo-zigbuild
/rust-async-internals Debug a waker leak in my async code
/rust-security Audit my dependencies with cargo-deny
/rust-no-std Set up a no_std crate for embedded
/rust-build-times Speed up my Rust workspace compilation
```

### Zig
```
/zig-compiler What optimization mode should I use?
/zig-build-system Add a C library to my build.zig
/zig-cinterop Call a C function from Zig using @cImport
/zig-cross Cross-compile Zig for Raspberry Pi
/zig-testing How do I detect memory leaks in Zig tests?
/zig-comptime Write a generic Stack using comptime
```

### Embedded
```
/freertos How do I detect stack overflow in FreeRTOS?
/zephyr Build and flash a Zephyr app with west
/openocd-jtag Connect GDB to my STM32 via OpenOCD
/linker-scripts Place my code in CCM RAM with a linker script
/embedded-rust Flash and debug with probe-rs and defmt
```

### Observability and security
```
/ebpf Write a bpftrace one-liner to trace system calls
/ebpf-rust Write an eBPF program in Rust with Aya
/binary-hardening Check my binary with checksec
/wasm-emscripten Compile my C library to WebAssembly
/wasm-wasmtime Embed wasmtime in my Rust application
```

### Profiling & analysis
```
/linux-perf Generate a flame graph from perf data
/strace-ltrace Trace system calls to find a missing config file
/sanitizers Which sanitizer should I use for memory leaks?
/valgrind How do I suppress known false positives?
/heaptrack Find allocation hotspots in my C++ server
/intel-vtune-amd-uprof Analyze pipeline stalls in my hot function
/hardware-counters Measure cache miss rate with perf stat
```

### Advanced debugging
```
/concurrency-debugging Read a TSan data race report
/debug-optimized-builds Why does GDB say "value optimized out"?
/dwarf-debug-format Set up debuginfod for automatic symbols
```

## Skills

### C/C++ Compilers (8 skills)

| Skill | Purpose |
|-------|---------|
| `gcc` | GCC flags, optimization levels, warnings, diagnostics |
| `clang` | Clang/LLVM tooling, diagnostics, sanitizer integration |
| `llvm` | LLVM IR, passes, opt/llc pipeline |
| `msvc-cl` | MSVC cl.exe and clang-cl, Windows toolchain |
| `cross-gcc` | Cross-compilation triplets, sysroots, embedded targets |
| `pgo` | Profile-guided optimization — GCC, Clang, BOLT |
| `cpp-modules` | C++20 modules: named modules, header units, CMake integration |
| `cpp-templates` | Template error reading, concepts, requires-clauses, Templight |

### Debuggers (6 skills)

| Skill | Purpose |
|-------|---------|
| `gdb` | GDB sessions, breakpoints, reverse debug, remote debug |
| `lldb` | LLDB commands, GDB migration, IDE integration |
| `core-dumps` | Core file analysis, debuginfod, production crash triage |
| `concurrency-debugging` | TSan reports, deadlock triage, happens-before reasoning |
| `debug-optimized-builds` | RelWithDebInfo, -Og, inlined frames, "value optimized out" |
| `dwarf-debug-format` | DWARF sections, dwarfdump, split DWARF, debuginfod |

### Profilers (7 skills)

| Skill | Purpose |
|-------|---------|
| `linux-perf` | perf record/report, flame data, kernel symbols |
| `valgrind` | memcheck, cachegrind, suppression files |
| `flamegraphs` | perf-to-SVG pipeline, reading frames |
| `strace-ltrace` | Syscall and library call tracing, ENOENT/EPERM triage |
| `heaptrack` | Heap allocation profiling, leak detection, hotspots |
| `intel-vtune-amd-uprof` | VTune hotspots, microarchitecture analysis, roofline model |
| `hardware-counters` | perf stat -e, PAPI, cache miss rates, IPC analysis |

### Build Systems (9 skills)

| Skill | Purpose |
|-------|---------|
| `make` | Idiomatic Makefiles, pattern rules, dep generation |
| `cmake` | Modern CMake, targets-first, toolchain files |
| `ninja` | Ninja diagnosis, parallelism, CMake integration |
| `meson` | Meson setup, wrap system, cross-compilation |
| `static-analysis` | clang-tidy, cppcheck, scan-build — triage workflow |
| `conan-vcpkg` | C/C++ package management with Conan and vcpkg |
| `build-acceleration` | ccache, sccache, unity builds, PCH, split-DWARF |
| `bazel` | BUILD files, cc_library/cc_binary, remote execution, Bzlmod |
| `include-what-you-use` | IWYU with CMake, reports, forward declarations |

### Binary Analysis (4 skills)

| Skill | Purpose |
|-------|---------|
| `elf-inspection` | readelf, objdump, nm, ldd, section analysis |
| `linkers-lto` | GNU ld/gold/lld, -flto, link order, symbol issues |
| `binutils` | ar, strip, objcopy, addr2line workflows |
| `dynamic-linking` | dlopen, RPATH/RUNPATH, soname versioning, LD_PRELOAD |

### Runtime Safety (6 skills)

| Skill | Purpose |
|-------|---------|
| `sanitizers` | ASan/UBSan/TSan/MSan decision trees and report triage |
| `fuzzing` | libFuzzer/AFL, corpus, CI integration |
| `binary-hardening` | checksec, RELRO, PIE, CFI, shadow stack, seccomp-bpf |
| `wasm-emscripten` | emcc flags, EXPORTED_FUNCTIONS, memory model, Asyncify |
| `wasm-wasmtime` | wasmtime CLI, WASI preview2, component model, Rust embedding |

### Low-Level Programming (9 skills)

| Skill | Purpose |
|-------|---------|
| `assembly-x86` | x86-64 AT&T/Intel syntax, calling conventions, inline asm |
| `assembly-arm` | AArch64/ARM Thumb, AAPCS, inline asm |
| `assembly-riscv` | RV32/RV64 ISA, psABI, inline asm, QEMU simulation |
| `interpreters` | Bytecode VMs, dispatch loops, JIT fundamentals |
| `simd-intrinsics` | SSE2/AVX2/NEON intrinsics, auto-vectorization reports |
| `memory-model` | C++/Rust memory orderings, acquire-release, lock-free patterns |
| `cpu-cache-opt` | Cache misses, AoS vs SoA, false sharing, prefetching |
| `cpp-coroutines` | co_await/co_yield/co_return, promise_type, frame layout, GDB |
| `linux-kernel-modules` | LKMs, Kbuild, /proc, sysfs, char devices, KGDB |

### Observability (2 skills)

| Skill | Purpose |
|-------|---------|
| `ebpf` | bpftool, libbpf, bpftrace, verifier errors, XDP, CO-RE |
| `ebpf-rust` | Aya framework, aya-bpf, aya-log, map sharing, tokio integration |

### Embedded (5 skills)

| Skill | Purpose |
|-------|---------|
| `freertos` | Tasks, queues, mutexes, stack overflow detection, GDB debugging |
| `zephyr` | west build, Kconfig, devicetree, logging, native_sim target |
| `openocd-jtag` | OpenOCD config, flash programming, GDB remote, JTAG vs SWD |
| `linker-scripts` | MEMORY/SECTIONS, VMA vs LMA, .bss/.data init, weak symbols |
| `embedded-rust` | probe-rs, cargo-embed, defmt, RTIC, cortex-m-rt, no_std |

### Rust (12 skills)

| Skill | Purpose |
|-------|---------|
| `rustc-basics` | RUSTFLAGS, Cargo profiles, MIR/asm output, monomorphization |
| `cargo-workflows` | Workspaces, features, build.rs, nextest, cargo-deny |
| `rust-debugging` | rust-gdb/rust-lldb, backtraces, tokio-console, dbg! |
| `rust-profiling` | cargo-flamegraph, cargo-bloat, cargo-llvm-lines, Criterion |
| `rust-ffi` | bindgen, cbindgen, sys crates, safe FFI wrappers |
| `rust-cross` | cross tool, cargo-zigbuild, bare-metal, no_std |
| `rust-sanitizers-miri` | ASan/TSan with RUSTFLAGS, Miri for unsafe UB detection |
| `rust-unsafe` | Raw pointers, transmute, UnsafeCell, audit checklist |
| `rust-async-internals` | Future/poll model, Pin/Unpin, tokio-console, select!/join! |
| `rust-security` | cargo-audit, cargo-deny, RUSTSEC, safe FFI, fuzzing pipeline |
| `rust-no-std` | #![no_std], core vs std, alloc crate, custom allocators |
| `rust-build-times` | cargo-timings, sccache, Cranelift, workspace splitting, mold |

### Zig (7 skills)

| Skill | Purpose |
|-------|---------|
| `zig-compiler` | zig build-exe/lib, optimize modes, zig cc, error messages |
| `zig-build-system` | build.zig, modules, C integration, build.zig.zon packages |
| `zig-cinterop` | @cImport, translate-c, extern struct, packed struct, exports |
| `zig-debugging` | GDB/LLDB with Zig, panics, error return traces, std.debug |
| `zig-cross` | Built-in cross-compilation, target triples, zig cc cross, WASM |
| `zig-testing` | zig build test, comptime testing, test allocators, fuzz testing |
| `zig-comptime` | comptime evaluation, anytype generics, @typeInfo reflection |

**Total: 74 skills**

## Design

Each skill follows the [SKILL.md format](https://github.com/anthropics/skills). The body stays under 500 lines; detailed reference material lives in `references/` and is loaded only when needed (progressive disclosure).

Skills cross-reference each other where workflows overlap (e.g., `rust-profiling` + `linux-perf`, `zig-cinterop` + `zig-build-system`, `sanitizers` + `fuzzing`, `embedded-rust` + `linker-scripts`, `ebpf` + `ebpf-rust`).

## Contributing

Contributions are welcome! To add or improve a skill:

1. Fork the repository
2. Create or modify skills in `skills/<category>/<skill-name>/SKILL.md`
3. Follow the SKILL.md format with required sections (Purpose, Triggers, Workflow, Related skills)
4. Add reference files in `references/` for content that exceeds 500 lines
5. Submit a pull request

## Topics

`ai-agent-skills` `low-level-programming` `c-cpp-toolchain` `systems-programming` `compilers` `debuggers` `profilers` `build-systems` `rust` `zig` `embedded` `cross-compilation` `ebpf` `webassembly` `freertos` `zephyr` `risc-v`
