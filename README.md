# low-level-dev-skills

A curated suite of AI agent skills for systems and low-level C/C++ development toolchains. Install via the `skills` CLI:

```
npx skills add chessman/low-level-dev-skills
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
