const skills = [
  // Compilers
  { name: 'gcc', category: 'compilers', desc: 'GCC flags, optimization levels, warnings, diagnostics' },
  { name: 'clang', category: 'compilers', desc: 'Clang/LLVM tooling, diagnostics, sanitizer integration' },
  { name: 'llvm', category: 'compilers', desc: 'LLVM IR, passes, opt/llc pipeline' },
  { name: 'msvc-cl', category: 'compilers', desc: 'MSVC cl.exe and clang-cl, Windows toolchain' },
  { name: 'cross-gcc', category: 'compilers', desc: 'Cross-compilation triplets, sysroots, embedded targets' },
  { name: 'pgo', category: 'compilers', desc: 'Profile-guided optimization — GCC, Clang, and BOLT' },
  // Debuggers
  { name: 'gdb', category: 'debuggers', desc: 'GDB sessions, breakpoints, reverse debug, remote debug' },
  { name: 'lldb', category: 'debuggers', desc: 'LLDB commands, GDB migration, IDE integration' },
  { name: 'core-dumps', category: 'debuggers', desc: 'Core file analysis, debuginfod, production crash triage' },
  // Profilers
  { name: 'linux-perf', category: 'profilers', desc: 'perf record/report, flame data, kernel symbols' },
  { name: 'valgrind', category: 'profilers', desc: 'memcheck, cachegrind, suppression files' },
  { name: 'flamegraphs', category: 'profilers', desc: 'perf-to-SVG pipeline, reading frames' },
  { name: 'strace-ltrace', category: 'profilers', desc: 'Syscall and library call tracing, ENOENT/EPERM triage' },
  { name: 'heaptrack', category: 'profilers', desc: 'Heap allocation profiling, leak detection, hotspots' },
  // Build Systems
  { name: 'make', category: 'build-systems', desc: 'Idiomatic Makefiles, pattern rules, dep generation' },
  { name: 'cmake', category: 'build-systems', desc: 'Modern CMake, targets-first, toolchain files' },
  { name: 'ninja', category: 'build-systems', desc: 'Ninja diagnosis, parallelism, CMake integration' },
  { name: 'meson', category: 'build-systems', desc: 'Meson setup, wrap dependency system, cross-compilation' },
  { name: 'static-analysis', category: 'build-systems', desc: 'clang-tidy, cppcheck, scan-build triage workflow' },
  { name: 'conan-vcpkg', category: 'build-systems', desc: 'C/C++ package management with Conan and vcpkg' },
  // Binaries
  { name: 'elf-inspection', category: 'binaries', desc: 'readelf, objdump, nm, ldd, section analysis' },
  { name: 'linkers-lto', category: 'binaries', desc: 'GNU ld/gold/lld, -flto, link order, symbol issues' },
  { name: 'binutils', category: 'binaries', desc: 'ar, strip, objcopy, addr2line workflows' },
  { name: 'dynamic-linking', category: 'binaries', desc: 'dlopen, RPATH/RUNPATH, soname versioning, LD_PRELOAD' },
  // Runtimes
  { name: 'sanitizers', category: 'runtimes', desc: 'ASan/UBSan/TSan/MSan decision trees and report triage' },
  { name: 'fuzzing', category: 'runtimes', desc: 'libFuzzer/AFL, corpus, CI integration' },
  // Low-Level Programming
  { name: 'assembly-x86', category: 'low-level-programming', desc: 'x86-64 AT&T/Intel syntax, calling conventions, inline asm' },
  { name: 'assembly-arm', category: 'low-level-programming', desc: 'AArch64/ARM Thumb, AAPCS, inline asm' },
  { name: 'interpreters', category: 'low-level-programming', desc: 'Bytecode VMs, dispatch loops, JIT fundamentals' },
  { name: 'simd-intrinsics', category: 'low-level-programming', desc: 'SSE2/AVX2/NEON intrinsics, auto-vectorization reports' },
  { name: 'memory-model', category: 'low-level-programming', desc: 'C++/Rust memory orderings, acquire-release, lock-free patterns' },
  { name: 'cpu-cache-opt', category: 'low-level-programming', desc: 'Cache misses, AoS vs SoA, false sharing, prefetching' },
  // Rust
  { name: 'rustc-basics', category: 'rust', desc: 'RUSTFLAGS, Cargo profiles, MIR/asm output, monomorphization' },
  { name: 'cargo-workflows', category: 'rust', desc: 'Workspaces, feature flags, build.rs, nextest, cargo-deny' },
  { name: 'rust-debugging', category: 'rust', desc: 'rust-gdb/rust-lldb, backtraces, tokio-console, dbg! macro' },
  { name: 'rust-profiling', category: 'rust', desc: 'cargo-flamegraph, cargo-bloat, cargo-llvm-lines, Criterion' },
  { name: 'rust-ffi', category: 'rust', desc: 'bindgen, cbindgen, sys crates, safe FFI wrappers' },
  { name: 'rust-cross', category: 'rust', desc: 'cross tool, cargo-zigbuild, bare-metal targets, no_std' },
  { name: 'rust-sanitizers-miri', category: 'rust', desc: 'ASan/TSan with RUSTFLAGS, Miri for unsafe UB detection' },
  { name: 'rust-unsafe', category: 'rust', desc: 'Raw pointers, transmute, UnsafeCell, audit checklist' },
  // Zig
  { name: 'zig-compiler', category: 'zig', desc: 'zig build-exe/lib, optimize modes, zig cc, error messages' },
  { name: 'zig-build-system', category: 'zig', desc: 'build.zig, modules, C source integration, build.zig.zon' },
  { name: 'zig-cinterop', category: 'zig', desc: '@cImport, translate-c, extern struct, packed struct, exports' },
  { name: 'zig-debugging', category: 'zig', desc: 'GDB/LLDB with Zig, panics, error return traces, std.debug' },
  { name: 'zig-cross', category: 'zig', desc: 'Built-in cross-compilation, target triples, zig cc cross, WASM' },
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
    cmd: 'npx skills add mohitmishra786/low-level-dev-skills --skill gcc clang llvm msvc-cl cross-gcc pgo cmake make ninja meson conan-vcpkg static-analysis gdb lldb core-dumps linux-perf valgrind flamegraphs strace-ltrace heaptrack sanitizers fuzzing elf-inspection linkers-lto binutils dynamic-linking assembly-x86 assembly-arm interpreters simd-intrinsics memory-model cpu-cache-opt',
  },
  {
    tag: 'rust',
    label: 'Rust',
    desc: 'rustc, Cargo, debugging, profiling, FFI, cross-compilation, Miri',
    color: 'amber',
    cmd: 'npx skills add mohitmishra786/low-level-dev-skills --skill rustc-basics cargo-workflows rust-debugging rust-profiling rust-ffi rust-cross rust-sanitizers-miri rust-unsafe',
  },
  {
    tag: 'zig',
    label: 'Zig',
    desc: 'Compiler, build system, C interop, debugging, cross-compilation',
    color: 'magenta',
    cmd: 'npx skills add mohitmishra786/low-level-dev-skills --skill zig-compiler zig-build-system zig-cinterop zig-debugging zig-cross',
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
    desc: 'Sanitizers, fuzzing, Miri, strace — all runtime safety tools',
    color: 'red',
    cmd: 'npx skills add mohitmishra786/low-level-dev-skills --skill sanitizers fuzzing rust-sanitizers-miri rust-unsafe',
  },
  {
    tag: 'profilers',
    label: 'Profilers',
    desc: 'perf, flamegraphs, valgrind, heaptrack, strace',
    color: 'green',
    cmd: 'npx skills add mohitmishra786/low-level-dev-skills --skill linux-perf valgrind flamegraphs strace-ltrace heaptrack rust-profiling',
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
    ├── <span class="dir">compilers/</span>     <span class="comment"># gcc clang llvm msvc-cl cross-gcc pgo</span>
    ├── <span class="dir">debuggers/</span>     <span class="comment"># gdb lldb core-dumps</span>
    ├── <span class="dir">profilers/</span>     <span class="comment"># linux-perf valgrind flamegraphs strace-ltrace heaptrack</span>
    ├── <span class="dir">build-systems/</span> <span class="comment"># make cmake ninja meson static-analysis conan-vcpkg</span>
    ├── <span class="dir">binaries/</span>      <span class="comment"># elf-inspection linkers-lto binutils dynamic-linking</span>
    ├── <span class="dir">runtimes/</span>      <span class="comment"># sanitizers fuzzing</span>
    ├── <span class="dir">low-level-programming/</span> <span class="comment"># asm-x86 asm-arm simd memory-model cpu-cache interpreters</span>
    ├── <span class="dir">rust/</span>          <span class="comment"># rustc-basics cargo-workflows rust-debugging rust-profiling</span>
    │                  <span class="comment"># rust-ffi rust-cross rust-sanitizers-miri rust-unsafe</span>
    └── <span class="dir">zig/</span>           <span class="comment"># zig-compiler zig-build-system zig-cinterop zig-debugging zig-cross</span>`;

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
