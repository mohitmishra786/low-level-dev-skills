const skills = [
  { name: 'gcc', category: 'compilers', desc: 'GCC flags, optimization levels, warnings, diagnostics' },
  { name: 'clang', category: 'compilers', desc: 'Clang/LLVM tooling, diagnostics, sanitizer integration' },
  { name: 'llvm', category: 'compilers', desc: 'LLVM IR, passes, opt/llc pipeline' },
  { name: 'msvc-cl', category: 'compilers', desc: 'MSVC cl.exe and clang-cl, Windows toolchain' },
  { name: 'cross-gcc', category: 'compilers', desc: 'Cross-compilation triplets, sysroots, embedded targets' },
  { name: 'gdb', category: 'debuggers', desc: 'GDB sessions, breakpoints, reverse debug, remote debug' },
  { name: 'lldb', category: 'debuggers', desc: 'LLDB commands, GDB migration, IDE integration' },
  { name: 'core-dumps', category: 'debuggers', desc: 'Core file analysis, debuginfod, production crash triage' },
  { name: 'linux-perf', category: 'profilers', desc: 'perf record/report, flame data, kernel symbols' },
  { name: 'valgrind', category: 'profilers', desc: 'memcheck, cachegrind, suppression files' },
  { name: 'flamegraphs', category: 'profilers', desc: 'perf-to-SVG pipeline, reading frames' },
  { name: 'make', category: 'build-systems', desc: 'Idiomatic Makefiles, pattern rules, dep generation' },
  { name: 'cmake', category: 'build-systems', desc: 'Modern CMake, targets-first, toolchain files' },
  { name: 'ninja', category: 'build-systems', desc: 'Ninja diagnosis, parallelism, CMake integration' },
  { name: 'elf-inspection', category: 'binaries', desc: 'readelf, objdump, nm, ldd, section analysis' },
  { name: 'linkers-lto', category: 'binaries', desc: 'GNU ld/gold/lld, -flto, link order, symbol issues' },
  { name: 'binutils', category: 'binaries', desc: 'ar, strip, objcopy, addr2line workflows' },
  { name: 'sanitizers', category: 'runtimes', desc: 'ASan/UBSan/TSan/MSan decision trees and report triage' },
  { name: 'fuzzing', category: 'runtimes', desc: 'libFuzzer/AFL, corpus, CI integration' },
  { name: 'assembly-x86', category: 'low-level-programming', desc: 'x86-64 AT&T/Intel syntax, calling conventions, inline asm' },
  { name: 'assembly-arm', category: 'low-level-programming', desc: 'AArch64/ARM Thumb, AAPCS, inline asm' },
  { name: 'interpreters', category: 'low-level-programming', desc: 'Bytecode VMs, dispatch loops, JIT fundamentals' },
];

const agents = [
  'Claude Code', 'Cursor', 'Codex', 'GitHub Copilot', 'Cline', 'Windsurf',
  'Gemini CLI', 'Kilo', 'Amp', 'Antigravity', 'Augment', 'Droid', 'Goose',
  'Kiro CLI', 'OpenCode', 'Roo', 'Trae', 'VSCode', 'and more...'
];

const steps = [
  { num: '01', text: 'Fork the repo' },
  { num: '02', text: 'Create skill in <code>skills/</code>' },
  { num: '03', text: 'Add <code>SKILL.md</code>' },
  { num: '04', text: 'Submit a PR' },
];

const treeStructure = `<span class="dir">low-level-dev-skills/</span>
├── <span class="file">README.md</span>
├── <span class="file">AGENTS.md</span>
└── <span class="dir">skills/</span>
    ├── <span class="dir">compilers/</span>
    │   ├── <span class="dir">gcc/</span>
    │   ├── <span class="dir">clang/</span>
    │   ├── <span class="dir">llvm/</span>
    │   ├── <span class="dir">msvc-cl/</span>
    │   └── <span class="dir">cross-gcc/</span>
    ├── <span class="dir">debuggers/</span>
    │   ├── <span class="dir">gdb/</span>
    │   ├── <span class="dir">lldb/</span>
    │   └── <span class="dir">core-dumps/</span>
    ├── <span class="dir">profilers/</span>
    │   ├── <span class="dir">linux-perf/</span>
    │   ├── <span class="dir">valgrind/</span>
    │   └── <span class="dir">flamegraphs/</span>
    ├── <span class="dir">build-systems/</span>
    │   ├── <span class="dir">make/</span>
    │   ├── <span class="dir">cmake/</span>
    │   └── <span class="dir">ninja/</span>
    ├── <span class="dir">binaries/</span>
    │   ├── <span class="dir">elf-inspection/</span>
    │   ├── <span class="dir">linkers-lto/</span>
    │   └── <span class="dir">binutils/</span>
    ├── <span class="dir">runtimes/</span>
    │   ├── <span class="dir">sanitizers/</span>
    │   └── <span class="dir">fuzzing/</span>
    └── <span class="dir">low-level-programming/</span>
        ├── <span class="dir">assembly-x86/</span>
        ├── <span class="dir">assembly-arm/</span>
        └── <span class="dir">interpreters/</span>`;

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
    <a href="https://github.com/mohitmishra786/low-level-dev-skills/tree/main/skills/${skill.category}/${skill.name}/SKILL.md" 
       class="skill-card" target="_blank" rel="noopener">
      <div class="skill-header">
        <span class="skill-category">${skill.category}</span>
      </div>
      <div class="skill-name">/${skill.name}</div>
      <p class="skill-desc">${skill.desc}</p>
    </a>
  `).join('');
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
  
  renderSkills();
  renderAgents();
  renderSteps();
  renderTree();
  setupTabs();
  setupCopy();
  animateInstallOutput();
});
