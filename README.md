# low-level-dev-skills

A curated suite of AI agent skills for systems and low-level C/C++ development toolchains. These skills provide expert guidance for compilers, debuggers, profilers, build systems, and low-level programming tasks.

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

### In Claude Code
```
/gcc How do I enable link-time optimization?
/gdb Set a conditional breakpoint in GDB
/cmake What's the modern way to find packages?
```

### In Cursor
```
/sanitizers Which sanitizer should I use for detecting memory leaks?
/valgrind How do I suppress known false positives?
/linux-perf Generate a flame graph from perf data
```

### In Codex
```
/clang Enable all recommended warnings for production code
/assembly-x86 Explain the calling convention for x86-64 System V
/linkers-lto Debug "undefined reference" linker errors
```

## Skills

| Category | Skill | Purpose |
|----------|-------|---------|
| compilers | gcc | GCC flags, optimization levels, warnings, diagnostics |
| compilers | clang | Clang/LLVM tooling, diagnostics, sanitizer integration |
| compilers | llvm | LLVM IR, passes, opt/llc pipeline |
| compilers | msvc-cl | MSVC cl.exe and clang-cl, Windows toolchain |
| compilers | cross-gcc | Cross-compilation triplets, sysroots, embedded targets |
| debuggers | gdb | GDB sessions, breakpoints, reverse debug, remote debug |
| debuggers | lldb | LLDB commands, GDB migration, IDE integration |
| debuggers | core-dumps | Core file analysis, debuginfod, production crash triage |
| profilers | linux-perf | perf record/report, flame data, kernel symbols |
| profilers | valgrind | memcheck, cachegrind, suppression files |
| profilers | flamegraphs | perf-to-SVG pipeline, reading frames |
| build-systems | make | Idiomatic Makefiles, pattern rules, dep generation |
| build-systems | cmake | Modern CMake, targets-first, toolchain files |
| build-systems | ninja | Ninja diagnosis, parallelism, CMake integration |
| binaries | elf-inspection | readelf, objdump, nm, ldd, section analysis |
| binaries | linkers-lto | GNU ld/gold/lld, -flto, link order, symbol issues |
| binaries | binutils | ar, strip, objcopy, addr2line workflows |
| runtimes | sanitizers | ASan/UBSan/TSan/MSan decision trees and report triage |
| runtimes | fuzzing | libFuzzer/AFL, corpus, CI integration |
| low-level-programming | assembly-x86 | x86-64 AT&T/Intel syntax, calling conventions, inline asm |
| low-level-programming | assembly-arm | AArch64/ARM Thumb, AAPCS, inline asm |
| low-level-programming | interpreters | Bytecode VMs, dispatch loops, JIT fundamentals |

## Design

Each skill follows the [SKILL.md format](https://github.com/anthropics/skills). The body stays under 500 lines; detailed reference material lives in `references/` and is loaded only when needed (progressive disclosure).

Skills cross-reference each other where workflows overlap (e.g., `sanitizers` + `gcc` or `clang`, `flamegraphs` + `linux-perf`).

## Contributing

Contributions are welcome! To add or improve a skill:

1. Fork the repository
2. Create or modify skills in `skills/<category>/<skill-name>/SKILL.md`
3. Follow the SKILL.md format with required sections (Purpose, Triggers, Workflow, Related skills)
4. Submit a pull request

## Topics

`ai-agent-skills` `low-level-programming` `c-cpp-toolchain` `systems-programming` `compilers` `debuggers` `profilers` `build-systems`
