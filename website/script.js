const skills = [
  // Compilers
  { name: 'gcc', category: 'compilers', desc: 'GCC flags, optimization levels, warnings, diagnostics' },
  { name: 'clang', category: 'compilers', desc: 'Clang/LLVM tooling, diagnostics, sanitizer integration' },
  { name: 'llvm', category: 'compilers', desc: 'LLVM IR, passes, opt/llc pipeline' },
  { name: 'msvc-cl', category: 'compilers', desc: 'MSVC cl.exe and clang-cl, Windows toolchain' },
  { name: 'cross-gcc', category: 'compilers', desc: 'Cross-compilation triplets, sysroots, embedded targets' },
  { name: 'pgo', category: 'compilers', desc: 'Profile-guided optimization — GCC, Clang, and BOLT' },
  { name: 'cpp-modules', category: 'compilers', desc: 'C++20 modules: named modules, header units, CMake integration' },
  { name: 'cpp-templates', category: 'compilers', desc: 'Template error reading, concepts, requires-clauses, Templight' },
  // Debuggers
  { name: 'gdb', category: 'debuggers', desc: 'GDB sessions, breakpoints, reverse debug, remote debug' },
  { name: 'lldb', category: 'debuggers', desc: 'LLDB commands, GDB migration, IDE integration' },
  { name: 'core-dumps', category: 'debuggers', desc: 'Core file analysis, debuginfod, production crash triage' },
  { name: 'concurrency-debugging', category: 'debuggers', desc: 'TSan reports, deadlock triage, happens-before reasoning' },
  { name: 'debug-optimized-builds', category: 'debuggers', desc: 'RelWithDebInfo, -Og, inlined frames, "value optimized out"' },
  { name: 'dwarf-debug-format', category: 'debuggers', desc: 'DWARF sections, dwarfdump, split DWARF, debuginfod server' },
  // Profilers
  { name: 'linux-perf', category: 'profilers', desc: 'perf record/report, flame data, kernel symbols' },
  { name: 'valgrind', category: 'profilers', desc: 'memcheck, cachegrind, suppression files' },
  { name: 'flamegraphs', category: 'profilers', desc: 'perf-to-SVG pipeline, reading frames' },
  { name: 'strace-ltrace', category: 'profilers', desc: 'Syscall and library call tracing, ENOENT/EPERM triage' },
  { name: 'heaptrack', category: 'profilers', desc: 'Heap allocation profiling, leak detection, hotspots' },
  { name: 'intel-vtune-amd-uprof', category: 'profilers', desc: 'VTune hotspots, microarchitecture analysis, roofline model' },
  { name: 'hardware-counters', category: 'profilers', desc: 'perf stat -e, PAPI, cache miss rates, branch misprediction, IPC' },
  // Build Systems
  { name: 'make', category: 'build-systems', desc: 'Idiomatic Makefiles, pattern rules, dep generation' },
  { name: 'cmake', category: 'build-systems', desc: 'Modern CMake, targets-first, toolchain files' },
  { name: 'ninja', category: 'build-systems', desc: 'Ninja diagnosis, parallelism, CMake integration' },
  { name: 'meson', category: 'build-systems', desc: 'Meson setup, wrap dependency system, cross-compilation' },
  { name: 'static-analysis', category: 'build-systems', desc: 'clang-tidy, cppcheck, scan-build triage workflow' },
  { name: 'conan-vcpkg', category: 'build-systems', desc: 'C/C++ package management with Conan and vcpkg' },
  { name: 'build-acceleration', category: 'build-systems', desc: 'ccache, sccache, unity builds, PCH, split-DWARF, distcc' },
  { name: 'bazel', category: 'build-systems', desc: 'BUILD files, cc_library/cc_binary, remote execution, Bzlmod' },
  { name: 'include-what-you-use', category: 'build-systems', desc: 'IWYU with CMake, reports, forward declarations, compilation cascades' },
  // Binaries
  { name: 'elf-inspection', category: 'binaries', desc: 'readelf, objdump, nm, ldd, section analysis' },
  { name: 'linkers-lto', category: 'binaries', desc: 'GNU ld/gold/lld, -flto, link order, symbol issues' },
  { name: 'binutils', category: 'binaries', desc: 'ar, strip, objcopy, addr2line workflows' },
  { name: 'dynamic-linking', category: 'binaries', desc: 'dlopen, RPATH/RUNPATH, soname versioning, LD_PRELOAD' },
  // Runtimes
  { name: 'sanitizers', category: 'runtimes', desc: 'ASan/UBSan/TSan/MSan decision trees and report triage' },
  { name: 'fuzzing', category: 'runtimes', desc: 'libFuzzer/AFL, corpus, CI integration' },
  { name: 'binary-hardening', category: 'runtimes', desc: 'checksec, RELRO, PIE, CFI, shadow stack, seccomp-bpf' },
  { name: 'wasm-emscripten', category: 'runtimes', desc: 'emcc flags, EXPORTED_FUNCTIONS, memory model, Asyncify, WASI' },
  { name: 'wasm-wasmtime', category: 'runtimes', desc: 'wasmtime CLI, WASI preview2, component model, Rust embedding, fuel' },
  // Low-Level Programming
  { name: 'assembly-x86', category: 'low-level-programming', desc: 'x86-64 AT&T/Intel syntax, calling conventions, inline asm' },
  { name: 'assembly-arm', category: 'low-level-programming', desc: 'AArch64/ARM Thumb, AAPCS, inline asm' },
  { name: 'assembly-riscv', category: 'low-level-programming', desc: 'RV32/RV64 ISA, psABI calling convention, inline asm, QEMU' },
  { name: 'interpreters', category: 'low-level-programming', desc: 'Bytecode VMs, dispatch loops, JIT fundamentals' },
  { name: 'simd-intrinsics', category: 'low-level-programming', desc: 'SSE2/AVX2/NEON intrinsics, auto-vectorization reports' },
  { name: 'memory-model', category: 'low-level-programming', desc: 'C++/Rust memory orderings, acquire-release, lock-free patterns' },
  { name: 'cpu-cache-opt', category: 'low-level-programming', desc: 'Cache misses, AoS vs SoA, false sharing, prefetching' },
  { name: 'cpp-coroutines', category: 'low-level-programming', desc: 'co_await/co_yield/co_return, promise_type, frame layout, GDB' },
  { name: 'linux-kernel-modules', category: 'low-level-programming', desc: 'LKMs, Kbuild, /proc, sysfs, char devices, KGDB, module signing' },
  // Observability
  { name: 'ebpf', category: 'observability', desc: 'bpftool, libbpf, bpftrace, verifier errors, XDP, CO-RE portability' },
  { name: 'ebpf-rust', category: 'observability', desc: 'Aya framework, aya-bpf, aya-log, map sharing, tokio integration' },
  // Embedded
  { name: 'freertos', category: 'embedded', desc: 'Tasks, priorities, queues, mutexes, stack overflow, GDB debugging' },
  { name: 'zephyr', category: 'embedded', desc: 'west build, Kconfig, devicetree, logging subsystem, native_sim' },
  { name: 'openocd-jtag', category: 'embedded', desc: 'OpenOCD config, flash programming, GDB remote, JTAG vs SWD, J-Link' },
  { name: 'linker-scripts', category: 'embedded', desc: 'MEMORY/SECTIONS, VMA vs LMA, .bss/.data init, weak symbols' },
  { name: 'embedded-rust', category: 'embedded', desc: 'probe-rs, cargo-embed, defmt logging, RTIC, cortex-m-rt, no_std' },
  // Rust
  { name: 'rustc-basics', category: 'rust', desc: 'RUSTFLAGS, Cargo profiles, MIR/asm output, monomorphization' },
  { name: 'cargo-workflows', category: 'rust', desc: 'Workspaces, feature flags, build.rs, nextest, cargo-deny' },
  { name: 'rust-debugging', category: 'rust', desc: 'rust-gdb/rust-lldb, backtraces, tokio-console, dbg! macro' },
  { name: 'rust-profiling', category: 'rust', desc: 'cargo-flamegraph, cargo-bloat, cargo-llvm-lines, Criterion' },
  { name: 'rust-ffi', category: 'rust', desc: 'bindgen, cbindgen, sys crates, safe FFI wrappers' },
  { name: 'rust-cross', category: 'rust', desc: 'cross tool, cargo-zigbuild, bare-metal targets, no_std' },
  { name: 'rust-sanitizers-miri', category: 'rust', desc: 'ASan/TSan with RUSTFLAGS, Miri for unsafe UB detection' },
  { name: 'rust-unsafe', category: 'rust', desc: 'Raw pointers, transmute, UnsafeCell, audit checklist' },
  { name: 'rust-async-internals', category: 'rust', desc: 'Future/poll model, Pin/Unpin, tokio-console, waker leaks, select!' },
  { name: 'rust-security', category: 'rust', desc: 'cargo-audit, cargo-deny, RUSTSEC advisories, supply chain safety' },
  { name: 'rust-no-std', category: 'rust', desc: '#![no_std] constraints, core vs std, alloc crate, custom allocators' },
  { name: 'rust-build-times', category: 'rust', desc: 'cargo-timings, sccache, Cranelift backend, workspace splitting, mold' },
  // Zig
  { name: 'zig-compiler', category: 'zig', desc: 'zig build-exe/lib, optimize modes, zig cc, error messages' },
  { name: 'zig-build-system', category: 'zig', desc: 'build.zig, modules, C source integration, build.zig.zon' },
  { name: 'zig-cinterop', category: 'zig', desc: '@cImport, translate-c, extern struct, packed struct, exports' },
  { name: 'zig-debugging', category: 'zig', desc: 'GDB/LLDB with Zig, panics, error return traces, std.debug' },
  { name: 'zig-cross', category: 'zig', desc: 'Built-in cross-compilation, target triples, zig cc cross, WASM' },
  { name: 'zig-testing', category: 'zig', desc: 'zig build test, comptime testing, test allocators, fuzz testing' },
  { name: 'zig-comptime', category: 'zig', desc: 'comptime evaluation, anytype generics, @typeInfo reflection' },
];

// Map skill to GitHub path (some categories moved under new dirs)
function skillPath(skill) {
  const catDirMap = {
    'compilers': 'compilers',
    'debuggers': 'debuggers',
    'profilers': 'profilers',
    'build-systems': 'build-systems',
    'binaries': 'binaries',
    'runtimes': 'runtimes',
    'low-level-programming': 'low-level-programming',
    'observability': 'observability',
    'embedded': 'embedded',
    'rust': 'rust',
    'zig': 'zig',
  };
  return `https://github.com/mohitmishra786/low-level-dev-skills/tree/main/skills/${catDirMap[skill.category]}/${skill.name}/SKILL.md`;
}

const tagInstalls = [
  {
    tag: 'c-cpp',
    label: 'C / C++',
    desc: 'Compilers, debuggers, build systems, profilers, binaries',
    color: 'cyan',
    cmd: 'npx skills add mohitmishra786/low-level-dev-skills --skill gcc clang llvm msvc-cl cross-gcc pgo cpp-modules cpp-templates cmake make ninja meson conan-vcpkg static-analysis build-acceleration bazel include-what-you-use gdb lldb core-dumps concurrency-debugging debug-optimized-builds dwarf-debug-format linux-perf valgrind flamegraphs strace-ltrace heaptrack intel-vtune-amd-uprof hardware-counters sanitizers fuzzing binary-hardening elf-inspection linkers-lto binutils dynamic-linking assembly-x86 assembly-arm assembly-riscv interpreters simd-intrinsics memory-model cpu-cache-opt cpp-coroutines linux-kernel-modules',
  },
  {
    tag: 'rust',
    label: 'Rust',
    desc: 'rustc, Cargo, debugging, profiling, FFI, cross, async, security, no_std',
    color: 'amber',
    cmd: 'npx skills add mohitmishra786/low-level-dev-skills --skill rustc-basics cargo-workflows rust-debugging rust-profiling rust-ffi rust-cross rust-sanitizers-miri rust-unsafe rust-async-internals rust-security rust-no-std rust-build-times',
  },
  {
    tag: 'zig',
    label: 'Zig',
    desc: 'Compiler, build system, C interop, debugging, cross, testing, comptime',
    color: 'magenta',
    cmd: 'npx skills add mohitmishra786/low-level-dev-skills --skill zig-compiler zig-build-system zig-cinterop zig-debugging zig-cross zig-testing zig-comptime',
  },
  {
    tag: 'embedded',
    label: 'Embedded',
    desc: 'FreeRTOS, Zephyr, OpenOCD, linker scripts, embedded Rust',
    color: 'green',
    cmd: 'npx skills add mohitmishra786/low-level-dev-skills --skill freertos zephyr openocd-jtag linker-scripts embedded-rust embedded-rust rust-no-std cross-gcc',
  },
  {
    tag: 'observability',
    label: 'Observability & Security',
    desc: 'eBPF, eBPF Rust, binary hardening, WebAssembly',
    color: 'red',
    cmd: 'npx skills add mohitmishra786/low-level-dev-skills --skill ebpf ebpf-rust binary-hardening wasm-emscripten wasm-wasmtime rust-security',
  },
  {
    tag: 'core',
    label: 'Core Essentials',
    desc: 'Compiler + debugger + profiler for all three languages',
    color: 'green',
    cmd: 'npx skills add mohitmishra786/low-level-dev-skills --skill gcc clang rustc-basics zig-compiler gdb lldb linux-perf cmake cargo-workflows zig-build-system',
  },
  {
    tag: 'safety',
    label: 'Safety & Fuzzing',
    desc: 'Sanitizers, fuzzing, Miri, binary hardening, concurrency debugging',
    color: 'red',
    cmd: 'npx skills add mohitmishra786/low-level-dev-skills --skill sanitizers fuzzing rust-sanitizers-miri rust-unsafe binary-hardening concurrency-debugging rust-security',
  },
  {
    tag: 'profilers',
    label: 'Profilers',
    desc: 'perf, flamegraphs, valgrind, heaptrack, VTune, hardware counters',
    color: 'green',
    cmd: 'npx skills add mohitmishra786/low-level-dev-skills --skill linux-perf valgrind flamegraphs strace-ltrace heaptrack rust-profiling intel-vtune-amd-uprof hardware-counters',
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
└── <span class="dir">skills/</span>
    ├── <span class="dir">compilers/</span>      <span class="comment"># gcc clang llvm msvc-cl cross-gcc pgo cpp-modules cpp-templates</span>
    ├── <span class="dir">debuggers/</span>      <span class="comment"># gdb lldb core-dumps concurrency-debugging debug-optimized-builds dwarf-debug-format</span>
    ├── <span class="dir">profilers/</span>      <span class="comment"># linux-perf valgrind flamegraphs strace-ltrace heaptrack intel-vtune-amd-uprof hardware-counters</span>
    ├── <span class="dir">build-systems/</span>  <span class="comment"># make cmake ninja meson static-analysis conan-vcpkg build-acceleration bazel include-what-you-use</span>
    ├── <span class="dir">binaries/</span>       <span class="comment"># elf-inspection linkers-lto binutils dynamic-linking</span>
    ├── <span class="dir">runtimes/</span>       <span class="comment"># sanitizers fuzzing binary-hardening wasm-emscripten wasm-wasmtime</span>
    ├── <span class="dir">low-level-programming/</span> <span class="comment"># asm-x86 asm-arm asm-riscv simd memory-model cpu-cache interpreters cpp-coroutines linux-kernel-modules</span>
    ├── <span class="dir">observability/</span>  <span class="comment"># ebpf ebpf-rust</span>
    ├── <span class="dir">embedded/</span>       <span class="comment"># freertos zephyr openocd-jtag linker-scripts embedded-rust</span>
    ├── <span class="dir">rust/</span>           <span class="comment"># rustc-basics cargo-workflows rust-debugging rust-profiling rust-ffi rust-cross</span>
    │                   <span class="comment"># rust-sanitizers-miri rust-unsafe rust-async-internals rust-security rust-no-std rust-build-times</span>
    └── <span class="dir">zig/</span>            <span class="comment"># zig-compiler zig-build-system zig-cinterop zig-debugging zig-cross zig-testing zig-comptime</span>`;

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

function renderTagInstalls() {
  const grid = document.getElementById('tagGrid');
  if (!grid) return;
  grid.innerHTML = tagInstalls.map(t => `
    <div class="tag-card tag-card--${t.color}">
      <div class="tag-label">${t.label}</div>
      <p class="tag-desc">${t.desc}</p>
      <div class="tag-cmd-wrap">
        <code class="tag-cmd">${t.cmd}</code>
        <button class="tag-copy-btn" data-cmd="${t.cmd}" title="Copy">[COPY]</button>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.tag-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(btn.dataset.cmd).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'COPIED!';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      });
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
  renderSkills();
  renderAgents();
  renderSteps();
  renderTree();
  setupTabs();
  setupCopy();
  animateInstallOutput();
});
