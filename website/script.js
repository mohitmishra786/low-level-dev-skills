const skills = [
  // allocators
  { name: "custom-allocators", category: "allocators", desc: "Guide agents through memory allocator design and tuning: pool/slab/arena/buddy taxonomy, jemalloc internals and MALLOC_CONF, mimalloc des..." },
  { name: "numa-programming", category: "allocators", desc: "Guide agents through NUMA-aware programming: topology detection with numactl and sysfs, libnuma API (numa_alloc_onnode, mbind, set_mempol..." },
  // async-io
  { name: "af-xdp", category: "async-io", desc: "Guide agents through AF_XDP sockets for high-performance packet I/O: socket creation, UMEM setup, fill/completion/RX/TX rings, XDP progra..." },
  { name: "dpdk", category: "async-io", desc: "Guide agents through DPDK (Data Plane Development Kit): EAL initialization, poll-mode driver (PMD) concepts, rte_eth_rx_burst/tx_burst, m..." },
  { name: "io-uring", category: "async-io", desc: "Guide agents through Linux io_uring: the submission/completion queue model (SQE/CQE), liburing API, multi-shot accept/recv, provided buff..." },
  // baremetal
  { name: "adc-dac-baremetal", category: "baremetal", desc: "Configure ADC and DAC peripherals: channel selection, sampling times, calibration sequences, DMA circular buffers, and DAC static/dynamic..." },
  { name: "baremetal-startup", category: "baremetal", desc: "Guide agents through bare-metal startup from reset to main(): reset and exception vectors, .data/.bss initialization, stack and heap setu..." },
  { name: "bootloaders-embedded", category: "baremetal", desc: "Guide agents through embedded bootloader fundamentals: vector table relocation, safe handoff from bootloader to application, flash partit..." },
  { name: "datasheet-and-refmanual-reading", category: "baremetal", desc: "Teach agents a systematic methodology for reading MCU datasheets and reference manuals: which sections matter for firmware, how to cross-..." },
  { name: "dma-baremetal", category: "baremetal", desc: "Configure DMA controllers for memory-to-peripheral and peripheral-to-memory transfers: channel/stream setup, burst sizes, circular mode, ..." },
  { name: "gpio-baremetal", category: "baremetal", desc: "Configure and use GPIO without HAL: input/output modes, alternate function mapping, pull-up/down, speed/slew, and pin-change interrupts f..." },
  { name: "interrupts-and-exceptions-baremetal", category: "baremetal", desc: "Guide agents through bare-metal interrupt handling on ARM Cortex-M: NVIC configuration, ISR writing rules, exception handlers (HardFault,..." },
  { name: "low-power-embedded", category: "baremetal", desc: "Guide agents through MCU low-power modes: sleep vs deep sleep (stop/standby), peripheral and bus clock gating, wake-up source configurati..." },
  { name: "mmio-and-bit-manipulation", category: "baremetal", desc: "Guide agents through safe memory-mapped I/O: volatile semantics, read-modify-write patterns, bitfield pitfalls, alignment and endianness,..." },
  { name: "peripherals-from-datasheet", category: "baremetal", desc: "Guide agents through a repeatable methodology for writing peripheral drivers from MCU reference manuals: locating register maps, interpre..." },
  { name: "spi-i2c-baremetal", category: "baremetal", desc: "Implement SPI and I2C master drivers for sensor and memory chips: clock configuration, phase/polarity (SPI), START/ACK sequences (I2C), a..." },
  { name: "stm32-baremetal", category: "baremetal", desc: "Guide agents through a minimal STM32 bare-metal project using CMSIS device headers and startup code only \u2014 no STM32 HAL \u2014 covering clock ..." },
  { name: "timers-pwm-baremetal", category: "baremetal", desc: "Configure MCU timers for PWM output, input capture, and periodic scheduling: prescaler/ARR setup, compare channels, and SysTick as a simp..." },
  { name: "uart-serial-baremetal", category: "baremetal", desc: "Implement UART/USART for debug console and device communication: baud rate calculation, 8N1 framing, polling and interrupt-driven I/O, ov..." },
  // binaries
  { name: "binutils", category: "binaries", desc: "Guide agents through the binutils toolset for binary manipulation: static libraries, stripping, address-to-source mapping, and symbol dem..." },
  { name: "dynamic-linking", category: "binaries", desc: "Guide agents through Linux dynamic linking: shared library creation, RPATH/RUNPATH configuration, soname versioning, dlopen/dlsym plugin ..." },
  { name: "elf-inspection", category: "binaries", desc: "Guide agents through inspecting Linux ELF binaries: symbol tables, section layout, dynamic linking, debug info, and diagnosing linker err..." },
  { name: "linkers-lto", category: "binaries", desc: "Guide agents through linker selection, common linker flags, link-order issues, LTO setup, and symbol-visibility management." },
  // build-systems
  { name: "bazel", category: "build-systems", desc: "Guide agents through Bazel for C/C++ projects: writing BUILD files, cc_library/cc_binary rules, toolchain registration, remote execution,..." },
  { name: "build-acceleration", category: "build-systems", desc: "Guide agents through reducing C/C++ build times using caching (ccache/sccache), distributed compilation (distcc), unity/jumbo builds, pre..." },
  { name: "cmake", category: "build-systems", desc: "Guide agents through modern (target-first) CMake for C/C++ projects: out-of-source builds, dependency management, generator selection, an..." },
  { name: "conan-vcpkg", category: "build-systems", desc: "Guide agents through C/C++ dependency management with Conan and vcpkg: declaring dependencies, integrating with CMake, managing binary co..." },
  { name: "include-what-you-use", category: "build-systems", desc: "Guide agents through using IWYU to reduce unnecessary #include directives, interpret IWYU reports and mapping files, decide between forwa..." },
  { name: "make", category: "build-systems", desc: "Guide agents through idiomatic Makefile patterns for C/C++ projects: phony targets, pattern rules, automatic dependency generation, and c..." },
  { name: "meson", category: "build-systems", desc: "Guide agents through Meson project setup, build configuration, the wrap dependency system, and cross-compilation \u2014 covering the build sys..." },
  { name: "ninja", category: "build-systems", desc: "Guide agents through Ninja as a build executor: diagnosing failures, controlling parallelism, generating from CMake, and understanding th..." },
  { name: "static-analysis", category: "build-systems", desc: "Guide agents through selecting, running, and triaging static analysis tools for C/C++ \u2014 clang-tidy, cppcheck, and scan-build \u2014 including ..." },
  // compiler-internals
  { name: "code-generation-and-backends", category: "compiler-internals", desc: "Overview LLVM (and general compiler) backend code generation: IR legalization, SelectionDAG instruction selection, register allocation, a..." },
  { name: "compiler-frontend", category: "compiler-internals", desc: "Guide agents through building a compiler frontend: lexers (hand-written DFA vs flex), Pratt parsing for expressions, recursive-descent fo..." },
  { name: "compiler-optimizations-deep", category: "compiler-internals", desc: "Explain optimization phases beyond flags: mid-level IR opts, register allocation, instruction selection/scheduling, vectorization boundar..." },
  { name: "jit-compilation", category: "compiler-internals", desc: "Guide agents through just-in-time compilation: LLVM ORC JIT v2 (ExecutionSession, IRLayer, ObjectLayer), LLJIT for simpler use cases, Cra..." },
  { name: "llvm-ir-and-passes", category: "compiler-internals", desc: "Teach agents to read and reason about LLVM IR (SSA, types, terminators), navigate the standard pass pipeline, and use opt/llvm-dis for in..." },
  { name: "llvm-passes", category: "compiler-internals", desc: "Guide agents through writing LLVM optimization passes with the New Pass Manager: FunctionPass and ModulePass structure, PassPluginLibrary..." },
  { name: "mlir", category: "compiler-internals", desc: "Guide agents through MLIR (Multi-Level IR): ops, regions, blocks, and values; built-in dialects (arith, func, memref, affine, linalg); wr..." },
  // compilers
  { name: "clang", category: "compilers", desc: "Guide agents through Clang-specific features: superior diagnostics, sanitizer integration, optimization remarks, static analysis, and LLV..." },
  { name: "cpp-modules", category: "compilers", desc: "Guide agents through authoring, building, and debugging C++20 modules: named modules vs header units, module partitions, CMake integratio..." },
  { name: "cpp-templates", category: "compilers", desc: "Guide agents through reading and fixing template error messages, using concepts as cleaner constraints, understanding SFINAE vs concepts ..." },
  { name: "cross-gcc", category: "compilers", desc: "Guide agents through setting up and using cross-compilation GCC toolchains: triplets, sysroots, pkg-config, QEMU-based testing, and commo..." },
  { name: "gcc", category: "compilers", desc: "Guide agents through GCC invocation: flag selection, build modes, warning triage, PGO, LTO, and common error patterns. Assume the project..." },
  { name: "llvm", category: "compilers", desc: "Guide agents through LLVM as a user: generating and inspecting IR, running existing optimisation passes with opt, lowering to assembly wi..." },
  { name: "msvc-cl", category: "compilers", desc: "Guide agents through Windows C/C++ compilation: MSVC cl.exe, clang-cl as MSVC-compatible driver, MSBuild project settings, and runtime li..." },
  { name: "pgo", category: "compilers", desc: "Guide agents through the full PGO workflow: instrument build \u2192 representative workload \u2192 collect profile \u2192 optimised build, covering both..." },
  // computer-architecture
  { name: "abi-and-calling-conventions", category: "computer-architecture", desc: "Document application binary interface (ABI) rules: register roles, stack alignment, argument passing, return values, and variadic convent..." },
  { name: "branch-prediction-and-speculation", category: "computer-architecture", desc: "Explain how modern CPUs predict branches, execute speculatively, recover on mispredict, and why speculation created side channels (Spectr..." },
  { name: "cpu-pipelines-and-hazards", category: "computer-architecture", desc: "Explain classic and modern CPU pipeline concepts: stages, data and control hazards, forwarding/bypassing, stalls, and branch handling \u2014 f..." },
  { name: "memory-hierarchy-and-caches", category: "computer-architecture", desc: "Teach CPU memory hierarchy: cache levels, associativity, line size, coherence protocols, false sharing, and prefetch behavior \u2014 architect..." },
  { name: "virtual-memory-paging-and-tlb", category: "computer-architecture", desc: "Explain virtual memory: paging, multi-level page tables, TLB role, page faults, and address translation \u2014 bridging OS kernels, embedded M..." },
  // debuggers
  { name: "concurrency-debugging", category: "debuggers", desc: "Guide agents through diagnosing and fixing concurrency bugs: reading ThreadSanitizer race reports, using Helgrind for lock-order analysis..." },
  { name: "core-dumps", category: "debuggers", desc: "Guide agents through enabling, collecting, and analysing core dumps for post-mortem crash investigation without rerunning the buggy program." },
  { name: "debug-optimized-builds", category: "debuggers", desc: "Guide agents through debugging code compiled with optimization: choosing the right debug-friendly optimization level, reading inlined fra..." },
  { name: "dwarf-debug-format", category: "debuggers", desc: "Guide agents through understanding and working with DWARF debug information: the key DWARF sections, using dwarfdump and readelf for insp..." },
  { name: "gdb", category: "debuggers", desc: "Walk agents through GDB sessions from first launch to advanced workflows: crash diagnosis, reverse debugging, remote debugging, and multi..." },
  { name: "lldb", category: "debuggers", desc: "Guide agents through LLDB sessions and map existing GDB knowledge to LLDB. Covers command differences, Apple specifics, Python scripting,..." },
  // embedded
  { name: "embedded-rust", category: "embedded", desc: "Guide agents through embedded Rust development: flashing and debugging with probe-rs/cargo-embed, structured logging with defmt, the RTIC..." },
  { name: "freertos", category: "embedded", desc: "Guide agents through FreeRTOS application development: task creation and priorities, inter-task communication with queues and semaphores,..." },
  { name: "linker-scripts", category: "embedded", desc: "Guide agents through writing and modifying GNU ld linker scripts for embedded targets: MEMORY and SECTIONS commands, VMA vs LMA for code ..." },
  { name: "openocd-jtag", category: "embedded", desc: "Guide agents through configuring OpenOCD for JTAG and SWD targets, flashing firmware to microcontrollers, attaching GDB for bare-metal de..." },
  { name: "zephyr", category: "embedded", desc: "Guide agents through Zephyr application development: west build workflow, board configuration, Kconfig and devicetree, Zephyr shell and l..." },
  // gpu
  { name: "cuda", category: "gpu", desc: "Guide agents through NVIDIA CUDA C/C++ development: kernel launch configuration, the memory hierarchy from registers through global memor..." },
  { name: "cuda-debugging", category: "gpu", desc: "Guide agents through debugging CUDA programs with cuda-gdb for interactive GPU thread inspection, NVIDIA Compute Sanitizer for automated ..." },
  { name: "cuda-profiling", category: "gpu", desc: "Guide agents through profiling CUDA applications with Nsight Systems (timeline-level) and Nsight Compute (kernel-level metrics), using th..." },
  { name: "gpu-memory-model", category: "gpu", desc: "Explain the GPU execution and memory model for agents optimizing kernels: SIMT execution, warp (32) vs wavefront (64) divergence costs, g..." },
  { name: "hip-rocm", category: "gpu", desc: "Guide agents through AMD GPU programming with HIP: the HIP runtime API, hipcc compilation, porting CUDA code with HIPIFY (hipify-perl, hi..." },
  { name: "triton-lang", category: "gpu", desc: "Guide agents through writing GPU kernels in OpenAI Triton: the @triton.jit decorator, block-oriented tl.load/tl.store with masking, atomi..." },
  // hpc
  { name: "mpi", category: "hpc", desc: "Guide agents through MPI (Message Passing Interface) programming: point-to-point and collective communication, non-blocking operations, s..." },
  { name: "openmp", category: "hpc", desc: "Guide agents through OpenMP shared-memory parallelism: #pragma omp parallel for with scheduling clauses, reductions, data-sharing attribu..." },
  { name: "rdma-verbs", category: "hpc", desc: "Guide agents through RDMA programming with libibverbs: one-sided vs two-sided operations, RC/UC/UD transports, device setup (ibv_get_devi..." },
  // kernel
  { name: "device-drivers", category: "kernel", desc: "Guide agents through Linux kernel device driver development: the driver model (platform_driver, i2c_driver, spi_driver), character device..." },
  { name: "kernel-debugging", category: "kernel", desc: "Guide agents through debugging the Linux kernel: kgdb over serial or USB, kdb built-in debugger commands, ftrace and trace-cmd, kprobes a..." },
  { name: "kernel-internals", category: "kernel", desc: "Guide agents through Linux kernel internals: the CFS and EEVDF schedulers, runqueues and vruntime, the buddy allocator and SLUB, vmalloc ..." },
  { name: "kernel-testing", category: "kernel", desc: "Guide agents through testing the Linux kernel: KUnit in-kernel unit tests, the kselftest harness, syzkaller fuzzing with kcov coverage, L..." },
  { name: "os-dev-scratch", category: "kernel", desc: "Guide agents through building a minimal operating system from scratch: bootloader stages (BIOS/GRUB vs UEFI/limine), 64-bit long mode set..." },
  // kernel-dev
  { name: "bus-drivers-i2c-spi", category: "kernel-dev", desc: "Guide agents through Linux I2C and SPI client drivers: bus registration, i2c_transfer / spi_sync, regmap abstraction, DT compatible on bu..." },
  { name: "device-tree", category: "kernel-dev", desc: "Guide agents through Linux device tree source (DTS): syntax, bindings, phandles, overlays, and how the kernel OF (Open Firmware) layer pa..." },
  { name: "kernel-concurrency", category: "kernel-dev", desc: "Guide agents through synchronization in the Linux kernel: spinlocks, mutexes, semaphores, RCU, seqlocks, completions, and memory ordering..." },
  { name: "kernel-debugging-advanced", category: "kernel-dev", desc: "Extend skills/kernel/kernel-debugging with production-grade tracing: ftrace, trace-cmd, kernel perf, kprobes/kretprobes, kgdb, crash dump..." },
  { name: "kernel-memory-management", category: "kernel-dev", desc: "Guide agents through Linux kernel memory allocation: physical page allocator (buddy), SLUB kmalloc caches, vmalloc virtual mappings, zone..." },
  { name: "linux-kernel-architecture", category: "kernel-dev", desc: "Provide a mental map of the Linux kernel: boot sequence, major subsystems, key data structures, and where to look in source \u2014 complementi..." },
  { name: "platform-device-model", category: "kernel-dev", desc: "Explain the Linux driver model for platform (and similar) buses: struct device, device_driver, probe/remove, resource acquisition, sysfs,..." },
  { name: "qemu-for-kernel-development", category: "kernel-dev", desc: "Guide agents through QEMU-based kernel and driver development workflows: building/booting custom kernels, attaching virtio block/network,..." },
  { name: "writing-char-drivers", category: "kernel-dev", desc: "Guide agents through Linux character device implementation: struct file_operations, cdev registration, safe userspace copies, ioctl desig..." },
  // languages
  { name: "carbon-lang", category: "languages", desc: "Guide agents through the Carbon programming language: syntax fundamentals, bidirectional C++ interoperability via Carbon.h, building from..." },
  { name: "hare-lang", category: "languages", desc: "Guide agents through the Hare programming language: design philosophy (simple, stable, compiled), hare build/test/run workflows, stdlib o..." },
  // low-level-programming
  { name: "assembly-arm", category: "low-level-programming", desc: "Guide agents through AArch64 (64-bit) and ARM (32-bit Thumb) assembly: registers, calling conventions, inline asm, and NEON/SVE SIMD patt..." },
  { name: "assembly-riscv", category: "low-level-programming", desc: "Guide agents through RISC-V assembly programming: RV32/RV64 instruction sets, register naming and calling conventions (psABI), ISA extens..." },
  { name: "assembly-x86", category: "low-level-programming", desc: "Guide agents through x86-64 assembly: reading compiler output, understanding the ABI, writing inline asm, and common patterns." },
  { name: "cpp-coroutines", category: "low-level-programming", desc: "Guide agents through C++20 coroutine mechanics: co_await, co_yield, co_return, implementing the required promise_type, understanding coro..." },
  { name: "cpu-cache-opt", category: "low-level-programming", desc: "Guide agents through cache-aware programming: diagnosing cache misses with perf, data layout transformations (AoS\u2192SoA), false sharing det..." },
  { name: "interpreters", category: "low-level-programming", desc: "Guide agents through implementing efficient bytecode interpreters and simple JITs in C/C++: dispatch strategies, VM architecture choices,..." },
  { name: "linux-kernel-modules", category: "low-level-programming", desc: "Guide agents through writing loadable Linux kernel modules (LKMs): the Kbuild build system, module parameters, /proc and sysfs interfaces..." },
  { name: "memory-model", category: "low-level-programming", desc: "Guide agents through C++ and Rust memory models: memory orderings, the happens-before relation, atomic operations, fences, and practical ..." },
  { name: "simd-intrinsics", category: "low-level-programming", desc: "Guide agents through SIMD: reading auto-vectorization output, writing SSE2/AVX2/NEON intrinsics, runtime CPU feature detection, and choos..." },
  // observability
  { name: "ebpf", category: "observability", desc: "Guide agents through writing, loading, and debugging eBPF programs using libbpf, bpftrace, and bpftool. Covers map types, program types, ..." },
  { name: "ebpf-rust", category: "observability", desc: "Guide agents through building production eBPF programs in Rust using the Aya framework: writing kernel-side BPF code with aya-bpf, struct..." },
  // platform
  { name: "apple-silicon", category: "platform", desc: "Guide agents through Apple Silicon (M-series) development: unified memory architecture, AMX matrix coprocessor access via Accelerate, Met..." },
  { name: "arm-sve", category: "platform", desc: "Guide agents through ARM Scalable Vector Extension (SVE/SVE2) programming: vector-length agnostic (VLA) code, predicate registers, SVE in..." },
  { name: "riscv-privileged", category: "platform", desc: "Guide agents through the RISC-V privileged specification: M/S/U privilege modes, CSR registers, trap handling, PLIC and CLINT interrupt c..." },
  // profilers
  { name: "flamegraphs", category: "profilers", desc: "Guide agents through the pipeline from profiler data to SVG flamegraph, and teach interpretation of flamegraphs to drive concrete optimis..." },
  { name: "hardware-counters", category: "profilers", desc: "Guide agents through hardware performance counter analysis: collecting PMU events with perf stat -e, using the PAPI library for portable ..." },
  { name: "heaptrack", category: "profilers", desc: "Guide agents through heaptrack for heap allocation profiling on Linux: recording allocation traces, analysing with heaptrack_print, ident..." },
  { name: "intel-vtune-amd-uprof", category: "profilers", desc: "Guide agents through CPU microarchitecture profiling with Intel VTune Profiler (free Community Edition) and AMD uProf: hotspot identifica..." },
  { name: "linux-perf", category: "profilers", desc: "Guide agents through perf for CPU profiling: sampling, hardware counter measurement, hotspot identification, and integration with flamegr..." },
  { name: "strace-ltrace", category: "profilers", desc: "Guide agents through tracing system calls with strace and library calls with ltrace \u2014 the most effective tools for diagnosing incorrect b..." },
  { name: "valgrind", category: "profilers", desc: "Guide agents through Valgrind tools: Memcheck for memory errors, Cachegrind for cache simulation, Callgrind for call graphs, and Massif f..." },
  // qemu
  { name: "protocol-analysis", category: "qemu", desc: "Guide agents through software-side serial bus analysis: logic analyzer workflow, sigrok/PulseView decoding, correlating captures with fir..." },
  { name: "qemu-embedded-simulation", category: "qemu", desc: "Guide agents through QEMU for bare-metal and RTOS firmware: machine selection, loading ELF images, semihosting, peripheral models, and GD..." },
  { name: "resource-optimization-lowend", category: "qemu", desc: "Guide agents through flash and RAM optimization on constrained devices: compiler size flags, linker map analysis, stack usage measurement..." },
  { name: "verilog-basics-for-lowlevel", category: "qemu", desc: "Give firmware and kernel engineers enough Verilog/SystemVerilog literacy to read RTL: modules, clocks/resets, combinational vs sequential..." },
  // runtimes
  { name: "binary-hardening", category: "runtimes", desc: "Guide agents through enabling and verifying binary security mitigations: checksec analysis, compiler and linker hardening flags (RELRO, P..." },
  { name: "fuzzing", category: "runtimes", desc: "Guide agents through setting up and running coverage-guided fuzz testing: libFuzzer (in-process) and AFL++ (fork-based), with sanitizer i..." },
  { name: "sanitizers", category: "runtimes", desc: "Guide agents through choosing, enabling, and interpreting compiler runtime sanitizers for finding memory errors, undefined behaviour, dat..." },
  { name: "wasm-emscripten", category: "runtimes", desc: "Guide agents through compiling C/C++ to WebAssembly using Emscripten: emcc flag selection, function exports, memory model configuration, ..." },
  { name: "wasm-wasmtime", category: "runtimes", desc: "Guide agents through wasmtime: running WASM modules from the CLI, WASI APIs, the component model with WIT interfaces, embedding wasmtime ..." },
  // rust
  { name: "cargo-workflows", category: "rust", desc: "Guide agents through Cargo workspaces, feature management, build scripts (build.rs), CI integration, incremental compilation, and the Car..." },
  { name: "rust-async-internals", category: "rust", desc: "Guide agents through Rust async/await internals: the Future trait and poll loop, Pin/Unpin for self-referential types, tokio's task model..." },
  { name: "rust-build-times", category: "rust", desc: "Guide agents through diagnosing and improving Rust compilation speed: cargo-timings for build profiling, sccache for caching, the Craneli..." },
  { name: "rust-cross", category: "rust", desc: "Guide agents through Rust cross-compilation: adding rustup targets, using cross for hermetic Docker-based cross-builds, cargo-zigbuild fo..." },
  { name: "rust-debugging", category: "rust", desc: "Guide agents through debugging Rust programs: GDB/LLDB with Rust pretty-printers, backtrace configuration, panic triage, async debugging ..." },
  { name: "rust-ffi", category: "rust", desc: "Guide agents through Rust's Foreign Function Interface: calling C from Rust with bindgen, exporting Rust to C with cbindgen, writing safe..." },
  { name: "rust-no-std", category: "rust", desc: "Guide agents through #![no_std] Rust development: what core and alloc provide vs std, implementing custom global allocators, panic handle..." },
  { name: "rust-profiling", category: "rust", desc: "Guide agents through Rust performance profiling: flamegraphs via cargo-flamegraph, binary size analysis, monomorphization bloat measureme..." },
  { name: "rust-sanitizers-miri", category: "rust", desc: "Guide agents through runtime safety validation for Rust: ASan/TSan/MSan/UBSan via RUSTFLAGS, Miri for compile-time UB detection in unsafe..." },
  { name: "rust-security", category: "rust", desc: "Guide agents through Rust security practices: dependency auditing with cargo-audit, policy enforcement with cargo-deny, RUSTSEC advisory ..." },
  { name: "rust-unsafe", category: "rust", desc: "Guide agents through writing, reviewing, and reasoning about unsafe Rust: what operations require unsafe, how to write safe abstractions,..." },
  { name: "rustc-basics", category: "rust", desc: "Guide agents through Rust compiler invocation: RUSTFLAGS, Cargo profile configuration, build modes, MIR and assembly inspection, monomorp..." },
  // security
  { name: "kernel-security", category: "security", desc: "Guide agents through Linux kernel security: LSM frameworks (SELinux, AppArmor), seccomp-bpf with libseccomp, KASLR and bypass mitigations..." },
  { name: "reverse-engineering", category: "security", desc: "Guide agents through reverse engineering binaries: Ghidra project setup and decompilation, radare2 analysis workflow, Binary Ninja script..." },
  // virtualization
  { name: "containers-internals", category: "virtualization", desc: "Guide agents through Linux container internals: namespaces (clone, unshare, nsenter), cgroups v2 resource limits, overlayfs storage, runc..." },
  { name: "hypervisor-internals", category: "virtualization", desc: "Explain hardware virtualization internals for agents: Intel VT-x (VMXON, VMCS, VMLAUNCH/VMRESUME, VMEXIT reasons), AMD SVM (VMCB, #VMEXIT..." },
  { name: "qemu-kvm", category: "virtualization", desc: "Guide agents through QEMU system emulation and KVM acceleration: key qemu-system-x86_64 flags, virtio devices, VFIO device passthrough, Q..." },
  // zig
  { name: "zig-build-system", category: "zig", desc: "Guide agents through writing build.zig files: executables, libraries, C source integration, build options, test configuration, and build...." },
  { name: "zig-cinterop", category: "zig", desc: "Guide agents through Zig's C interoperability: @cImport/@cInclude for calling C, translate-c for header inspection, extern struct and pac..." },
  { name: "zig-compiler", category: "zig", desc: "Guide agents through Zig compiler invocation: optimization modes, output types, zig cc as a C compiler drop-in, error message interpretat..." },
  { name: "zig-comptime", category: "zig", desc: "Guide agents through Zig's comptime system: compile-time function evaluation, comptime type parameters, generics via anytype, type reflec..." },
  { name: "zig-cross", category: "zig", desc: "Guide agents through Zig's built-in cross-compilation: target triple selection, CPU feature targeting, zig cc for cross-compiling C proje..." },
  { name: "zig-debugging", category: "zig", desc: "Guide agents through debugging Zig programs: GDB/LLDB sessions, interpreting Zig panics and error return traces, std.debug.print logging,..." },
  { name: "zig-testing", category: "zig", desc: "Guide agents through Zig's testing system: zig build test and zig test, comptime testing patterns, test filters, the test allocator for l..." },
];

function skillPath(skill) {
  const catDirMap = {
    "allocators": "allocators",
    "async-io": "async-io",
    "baremetal": "baremetal",
    "binaries": "binaries",
    "build-systems": "build-systems",
    "compiler-internals": "compiler-internals",
    "compilers": "compilers",
    "computer-architecture": "computer-architecture",
    "debuggers": "debuggers",
    "embedded": "embedded",
    "gpu": "gpu",
    "hpc": "hpc",
    "kernel": "kernel",
    "kernel-dev": "kernel-dev",
    "languages": "languages",
    "low-level-programming": "low-level-programming",
    "observability": "observability",
    "platform": "platform",
    "profilers": "profilers",
    "qemu": "qemu",
    "runtimes": "runtimes",
    "rust": "rust",
    "security": "security",
    "virtualization": "virtualization",
    "zig": "zig",
  };
  return `https://github.com/mohitmishra786/low-level-dev-skills/tree/main/skills/${catDirMap[skill.category]}/${skill.name}/SKILL.md`;
}

const tagInstalls = [
  {
    tag: 'c-cpp',
    label: 'C / C++',
    desc: 'Full C/C++ toolchain — compilers, debuggers, profilers, build systems, binaries, safety, and low-level programming',
    color: 'cyan',
    subcategories: [
      { label: 'Compilers', skills: ['gcc', 'clang', 'llvm', 'msvc-cl', 'cross-gcc', 'pgo', 'cpp-modules', 'cpp-templates'] },
      { label: 'Debuggers', skills: ['gdb', 'lldb', 'core-dumps', 'concurrency-debugging', 'debug-optimized-builds', 'dwarf-debug-format'] },
      { label: 'Profilers', skills: ['linux-perf', 'valgrind', 'flamegraphs', 'strace-ltrace', 'heaptrack', 'intel-vtune-amd-uprof', 'hardware-counters'] },
      { label: 'Build Systems', skills: ['cmake', 'make', 'ninja', 'meson', 'conan-vcpkg', 'static-analysis', 'build-acceleration', 'bazel', 'include-what-you-use'] },
      { label: 'Binaries', skills: ['elf-inspection', 'linkers-lto', 'binutils', 'dynamic-linking'] },
      { label: 'Safety & Runtimes', skills: ['sanitizers', 'fuzzing', 'binary-hardening'] },
      { label: 'Low-Level Programming', skills: ['assembly-x86', 'assembly-arm', 'assembly-riscv', 'simd-intrinsics', 'memory-model', 'cpu-cache-opt', 'interpreters', 'cpp-coroutines', 'linux-kernel-modules'] },
      { label: 'Computer Architecture', skills: ['cpu-pipelines-and-hazards', 'memory-hierarchy-and-caches', 'virtual-memory-paging-and-tlb', 'abi-and-calling-conventions', 'branch-prediction-and-speculation'] },
    ],
  },
  {
    tag: 'baremetal',
    label: 'Bare-Metal',
    desc: 'Bare-metal firmware — startup, MMIO, peripherals, STM32 CMSIS, bootloaders, and low power',
    color: 'green',
    subcategories: [
      { label: 'Bring-up', skills: ['baremetal-startup', 'mmio-and-bit-manipulation', 'interrupts-and-exceptions-baremetal', 'stm32-baremetal', 'bootloaders-embedded'] },
      { label: 'Peripherals', skills: ['gpio-baremetal', 'uart-serial-baremetal', 'spi-i2c-baremetal', 'timers-pwm-baremetal', 'adc-dac-baremetal', 'dma-baremetal'] },
      { label: 'Documentation', skills: ['peripherals-from-datasheet', 'datasheet-and-refmanual-reading'] },
      { label: 'Power & Size', skills: ['low-power-embedded', 'resource-optimization-lowend'] },
    ],
  },
  {
    tag: 'kernel',
    label: 'Kernel & Drivers',
    desc: 'Linux kernel architecture, memory, concurrency, device tree, char/bus drivers, and debugging',
    color: 'red',
    subcategories: [
      { label: 'Architecture & MM', skills: ['linux-kernel-architecture', 'kernel-memory-management', 'kernel-concurrency', 'kernel-internals'] },
      { label: 'Driver Model', skills: ['device-tree', 'platform-device-model', 'writing-char-drivers', 'bus-drivers-i2c-spi', 'device-drivers'] },
      { label: 'Debug & Test', skills: ['kernel-debugging', 'kernel-debugging-advanced', 'kernel-testing', 'qemu-for-kernel-development'] },
    ],
  },
  {
    tag: 'rust',
    label: 'Rust',
    desc: 'Full Rust toolchain — rustc, Cargo, debugging, profiling, FFI, cross-compilation, async internals, safety, and no_std',
    color: 'amber',
    subcategories: [
      { label: 'Compiler & Cargo', skills: ['rustc-basics', 'cargo-workflows', 'rust-build-times'] },
      { label: 'Debugging & Profiling', skills: ['rust-debugging', 'rust-profiling'] },
      { label: 'FFI & Cross-compilation', skills: ['rust-ffi', 'rust-cross', 'rust-no-std'] },
      { label: 'Async & Internals', skills: ['rust-async-internals', 'rust-unsafe'] },
      { label: 'Safety & Security', skills: ['rust-sanitizers-miri', 'rust-security'] },
    ],
  },
  {
    tag: 'zig',
    label: 'Zig',
    desc: 'Full Zig toolchain — compiler, build system, C interop, debugging, cross-compilation, testing, and comptime',
    color: 'magenta',
    subcategories: [
      { label: 'Compiler & Build', skills: ['zig-compiler', 'zig-build-system'] },
      { label: 'C Interop', skills: ['zig-cinterop'] },
      { label: 'Debugging & Cross', skills: ['zig-debugging', 'zig-cross'] },
      { label: 'Testing & Comptime', skills: ['zig-testing', 'zig-comptime'] },
    ],
  },
  {
    tag: 'embedded',
    label: 'Embedded & QEMU',
    desc: 'RTOS, hardware debug, linker scripts, embedded Rust, and QEMU simulation',
    color: 'green',
    subcategories: [
      { label: 'RTOS', skills: ['freertos', 'zephyr'] },
      { label: 'Debug & Flash', skills: ['openocd-jtag', 'cross-gcc'] },
      { label: 'Linker & Memory', skills: ['linker-scripts', 'embedded-rust', 'rust-no-std'] },
      { label: 'QEMU & Tools', skills: ['qemu-embedded-simulation', 'protocol-analysis', 'verilog-basics-for-lowlevel'] },
    ],
  },
  {
    tag: 'gpu-hpc',
    label: 'GPU & HPC',
    desc: 'CUDA, ROCm, Triton, GPU memory model, OpenMP, MPI, and RDMA',
    color: 'cyan',
    subcategories: [
      { label: 'GPU', skills: ['cuda', 'cuda-profiling', 'cuda-debugging', 'triton-lang', 'hip-rocm', 'gpu-memory-model'] },
      { label: 'HPC', skills: ['openmp', 'mpi', 'rdma-verbs'] },
    ],
  },
  {
    tag: 'systems',
    label: 'Systems & Internals',
    desc: 'Compiler internals, virtualization, async I/O, allocators, security, and platform-specific',
    color: 'amber',
    subcategories: [
      { label: 'Compiler Internals', skills: ['compiler-frontend', 'llvm-passes', 'llvm-ir-and-passes', 'compiler-optimizations-deep', 'code-generation-and-backends', 'mlir', 'jit-compilation'] },
      { label: 'Virtualization', skills: ['qemu-kvm', 'hypervisor-internals', 'containers-internals'] },
      { label: 'Async I/O', skills: ['io-uring', 'dpdk', 'af-xdp'] },
      { label: 'Allocators & NUMA', skills: ['custom-allocators', 'numa-programming'] },
      { label: 'Security', skills: ['reverse-engineering', 'kernel-security'] },
      { label: 'Platform', skills: ['arm-sve', 'riscv-privileged', 'apple-silicon'] },
    ],
  },
  {
    tag: 'observability',
    label: 'Observability & WASM',
    desc: 'eBPF tracing, WebAssembly runtimes, and binary hardening',
    color: 'red',
    subcategories: [
      { label: 'eBPF', skills: ['ebpf', 'ebpf-rust'] },
      { label: 'WebAssembly', skills: ['wasm-emscripten', 'wasm-wasmtime'] },
      { label: 'Hardening', skills: ['binary-hardening', 'rust-security'] },
    ],
  },
];

const agents = [
  'Claude Code', 'Cursor', 'Codex', 'GitHub Copilot', 'Cline', 'Windsurf',
  'Gemini CLI', 'Kilo', 'Amp', 'Antigravity', 'Augment', 'Droid', 'Goose',
  'Kiro CLI', 'OpenCode', 'Roo', 'Trae', 'VSCode', 'and more...'
];

const steps = [
  { num: '01', text: 'Fork the repo' },
  { num: '02', text: 'Create skill in <code>skills/</code>' },
  { num: '03', text: 'Add <code>SKILL.md</code> + <code>references/</code>' },
  { num: '04', text: 'Submit a PR' },
];

const treeStructure = `<span class="dir">low-level-dev-skills/</span>
├── <span class="file">README.md</span>
├── <span class="file">AGENTS.md</span>
└── <span class="dir">skills/</span>    <span class="comment"># 142 skills across 25 categories</span>
    ├── <span class="dir">allocators/</span>  <span class="comment"># custom-allocators numa-programming</span>
    ├── <span class="dir">async-io/</span>  <span class="comment"># af-xdp dpdk io-uring</span>
    ├── <span class="dir">baremetal/</span>  <span class="comment"># adc-dac-baremetal baremetal-startup bootloaders-embedded datasheet-and-refmanual-reading dma-baremetal gpio-baremetal +8 more</span>
    ├── <span class="dir">binaries/</span>  <span class="comment"># binutils dynamic-linking elf-inspection linkers-lto</span>
    ├── <span class="dir">build-systems/</span>  <span class="comment"># bazel build-acceleration cmake conan-vcpkg include-what-you-use make +3 more</span>
    ├── <span class="dir">compiler-internals/</span>  <span class="comment"># code-generation-and-backends compiler-frontend compiler-optimizations-deep jit-compilation llvm-ir-and-passes llvm-passes +1 more</span>
    ├── <span class="dir">compilers/</span>  <span class="comment"># clang cpp-modules cpp-templates cross-gcc gcc llvm +2 more</span>
    ├── <span class="dir">computer-architecture/</span>  <span class="comment"># abi-and-calling-conventions branch-prediction-and-speculation cpu-pipelines-and-hazards memory-hierarchy-and-caches virtual-memory-paging-and-tlb</span>
    ├── <span class="dir">debuggers/</span>  <span class="comment"># concurrency-debugging core-dumps debug-optimized-builds dwarf-debug-format gdb lldb</span>
    ├── <span class="dir">embedded/</span>  <span class="comment"># embedded-rust freertos linker-scripts openocd-jtag zephyr</span>
    ├── <span class="dir">gpu/</span>  <span class="comment"># cuda cuda-debugging cuda-profiling gpu-memory-model hip-rocm triton-lang</span>
    ├── <span class="dir">hpc/</span>  <span class="comment"># mpi openmp rdma-verbs</span>
    ├── <span class="dir">kernel/</span>  <span class="comment"># device-drivers kernel-debugging kernel-internals kernel-testing os-dev-scratch</span>
    ├── <span class="dir">kernel-dev/</span>  <span class="comment"># bus-drivers-i2c-spi device-tree kernel-concurrency kernel-debugging-advanced kernel-memory-management linux-kernel-architecture +3 more</span>
    ├── <span class="dir">languages/</span>  <span class="comment"># carbon-lang hare-lang</span>
    ├── <span class="dir">low-level-programming/</span>  <span class="comment"># assembly-arm assembly-riscv assembly-x86 cpp-coroutines cpu-cache-opt interpreters +3 more</span>
    ├── <span class="dir">observability/</span>  <span class="comment"># ebpf ebpf-rust</span>
    ├── <span class="dir">platform/</span>  <span class="comment"># apple-silicon arm-sve riscv-privileged</span>
    ├── <span class="dir">profilers/</span>  <span class="comment"># flamegraphs hardware-counters heaptrack intel-vtune-amd-uprof linux-perf strace-ltrace +1 more</span>
    ├── <span class="dir">qemu/</span>  <span class="comment"># protocol-analysis qemu-embedded-simulation resource-optimization-lowend verilog-basics-for-lowlevel</span>
    ├── <span class="dir">runtimes/</span>  <span class="comment"># binary-hardening fuzzing sanitizers wasm-emscripten wasm-wasmtime</span>
    ├── <span class="dir">rust/</span>  <span class="comment"># cargo-workflows rust-async-internals rust-build-times rust-cross rust-debugging rust-ffi +6 more</span>
    ├── <span class="dir">security/</span>  <span class="comment"># kernel-security reverse-engineering</span>
    ├── <span class="dir">virtualization/</span>  <span class="comment"># containers-internals hypervisor-internals qemu-kvm</span>
    └── <span class="dir">zig/</span>  <span class="comment"># zig-build-system zig-cinterop zig-compiler zig-comptime zig-cross zig-debugging +1 more</span>`;

function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('clock').textContent = `${hours}:${mins}:${secs}`;
}

function typeWriter(element, text, speed = 50) {
  let i = 0;
  function type() {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  type();
}

const categoryLabels = {
  'low-level-programming': 'low-level',
  'computer-architecture': 'arch',
  'compiler-internals': 'compiler-int',
  'kernel-dev': 'kernel-dev',
};

function renderCategoryTabs() {
  const container = document.getElementById('categoryTabs');
  if (!container) return;

  const categories = [...new Set(skills.map(s => s.category))].sort();
  const tabs = [
    `<button class="tab active" data-category="all">all (${skills.length})</button>`,
    ...categories.map(cat => {
      const count = skills.filter(s => s.category === cat).length;
      const label = categoryLabels[cat] || cat;
      return `<button class="tab" data-category="${cat}">${label} (${count})</button>`;
    }),
  ];
  container.innerHTML = tabs.join('');
}

function renderSkills(filter = 'all') {
  const grid = document.getElementById('skillsGrid');
  const filtered = filter === 'all' ? skills : skills.filter(s => s.category === filter);

  grid.innerHTML = filtered.map(skill => `
    <a href="${skillPath(skill)}"
       class="skill-card" target="_blank" rel="noopener">
      <div class="skill-header">
        <span class="skill-category">${skill.category}</span>
      </div>
      <div class="skill-name">/${skill.name}</div>
      <p class="skill-desc">${skill.desc}</p>
    </a>
  `).join('');
}

const BASE_CMD = 'npx skills add mohitmishra786/low-level-dev-skills --skill';

function buildCmd(skills) {
  return `${BASE_CMD} ${skills.join(' ')}`;
}

function allSkillsFor(entry) {
  return entry.subcategories.flatMap(s => s.skills);
}

function renderTagInstalls() {
  const grid = document.getElementById('tagGrid');
  if (!grid) return;

  grid.innerHTML = tagInstalls.map(t => {
    const allSkills = allSkillsFor(t);
    const allCmd = buildCmd(allSkills);

    const subcatRows = t.subcategories.map(sub => {
      const subCmd = buildCmd(sub.skills);
      return `
        <div class="subcat-row">
          <span class="subcat-label">${sub.label}</span>
          <span class="subcat-skills">${sub.skills.map(s => `<code class="subcat-skill-chip">${s}</code>`).join('')}</span>
          <button class="tag-copy-btn subcat-copy-btn" data-cmd="${subCmd}" title="Copy ${sub.label} skills">[COPY]</button>
        </div>`;
    }).join('');

    return `
      <div class="tag-card tag-card--${t.color}">
        <div class="tag-card-header">
          <div>
            <div class="tag-label">${t.label}</div>
            <p class="tag-desc">${t.desc}</p>
          </div>
          <button class="tag-toggle-btn" aria-expanded="false" aria-label="Show subcategories for ${t.label}">[+]</button>
        </div>
        <div class="tag-cmd-wrap">
          <code class="tag-cmd">${allCmd}</code>
          <button class="tag-copy-btn" data-cmd="${allCmd}" title="Copy all ${t.label} skills">[COPY ALL]</button>
        </div>
        <div class="tag-subcats" hidden>
          ${subcatRows}
        </div>
      </div>`;
  }).join('');

  // Wire up copy buttons
  grid.querySelectorAll('.tag-copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(btn.dataset.cmd).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'COPIED!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      });
    });
  });

  // Wire up expand/collapse toggles
  grid.querySelectorAll('.tag-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.tag-card');
      const subcats = card.querySelector('.tag-subcats');
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
      btn.textContent = expanded ? '[+]' : '[-]';
      if (expanded) {
        subcats.setAttribute('hidden', '');
      } else {
        subcats.removeAttribute('hidden');
      }
    });
  });
}

function renderAgents() {
  const grid = document.getElementById('agentsGrid');
  grid.innerHTML = agents.map(agent => `<span class="agent-pill">${agent}</span>`).join('');
}

function renderSteps() {
  const container = document.getElementById('stepsContainer');
  container.innerHTML = steps.map(step => `
    <div class="step">
      <div class="step-number">${step.num}</div>
      <div class="step-text">${step.text}</div>
    </div>
  `).join('');
}

function renderTree() {
  document.getElementById('treeView').innerHTML = treeStructure;
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderSkills(tab.dataset.category);
    });
  });
}

function setupCopy() {
  const btn = document.getElementById('copyBtn');
  const cmd = 'npx skills add mohitmishra786/low-level-dev-skills --all';

  btn.addEventListener('click', () => {
    navigator.clipboard.writeText(cmd).then(() => {
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 2000);
    });
  });
}

function animateInstallOutput() {
  const output = document.getElementById('installOutput');
  const lines = output.querySelectorAll('.output-line');

  lines.forEach((line, i) => {
    line.style.opacity = '0';
    setTimeout(() => {
      line.style.opacity = '1';
    }, 500 + (i * 300));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);

  const heroText = document.getElementById('heroText');
  typeWriter(heroText, 'make your agents smarter with systems programming skills', 40);

  renderTagInstalls();
  renderCategoryTabs();
  renderSkills();
  renderAgents();
  renderSteps();
  renderTree();
  setupTabs();
  setupCopy();
  animateInstallOutput();
});
