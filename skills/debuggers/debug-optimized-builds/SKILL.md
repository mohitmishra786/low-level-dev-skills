---
name: debug-optimized-builds
description: Debugging optimized builds skill for diagnosing issues in release code. Use when debugging RelWithDebInfo builds, using -Og for debuggable optimization, working with split-DWARF, applying GDB scheduler-locking, reading inlined frames, or understanding "value optimized out" messages. Activates on queries about debugging optimized code, RelWithDebInfo, -Og, inlined functions in GDB, value optimized out, GDB with -O2, or debugging release builds.
---

# Debugging Optimized Builds

## Purpose

Guide agents through debugging code compiled with optimization: choosing the right debug-friendly optimization level, reading inlined frames, diagnosing "value optimized out", using split-DWARF for faster debug builds, and applying GDB techniques specific to optimized code.

## Triggers

- "GDB says 'value optimized out' — what does that mean?"
- "How do I debug a release build?"
- "How do I see inlined function frames in GDB?"
- "What's the difference between -O0 and -Og for debugging?"
- "How do I use RelWithDebInfo with CMake?"
- "Breakpoints in optimized code land on wrong lines"

## Workflow

### 1. Choose the right build configuration

```
Goal?
├── Full debuggability, no optimization
│   → -O0 -g                        (slowest, all vars visible)
├── Debuggable, some optimization (recommended for most dev work)
│   → -Og -g                        (-Og keeps debug experience good)
├── Release build with debug info (shipped, debuggable crashes)
│   → -O2 -g -gsplit-dwarf          (or -O2 -g1 for lighter info)
└── Full release (no debug symbols)
    → -O2 -DNDEBUG
```

**`-Og`**: GCC's "debug-friendly optimization" — enables optimizations that don't interfere with debugging. Variables stay in registers where GDB can see them. Line numbers stay accurate. **Best balance for development.**

```bash
# GCC / Clang
gcc -Og -g -Wall main.c -o prog

# CMake build types
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug          # -O0 -g
cmake -S . -B build -DCMAKE_BUILD_TYPE=RelWithDebInfo # -O2 -g -DNDEBUG
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release        # -O2 -DNDEBUG
```

### 2. "Value optimized out" — causes and workarounds

```text
(gdb) print my_variable
$1 = <optimized out>
```

This means the compiler decided the variable's value doesn't need to be stored at this point — it might be:
- Kept only in a register (not the one GDB is looking at)
- Folded into a constant by constant propagation
- Eliminated because it's not used after this point
- Replaced by a later optimized value

**Workarounds:**

```c
// 1. Mark variable volatile (prevents optimization away)
volatile int counter = 0;
// Use sparingly — changes semantics

// 2. Use GCC attribute
int counter __attribute__((used)) = 0;

// 3. Compile problematic TU at lower optimization
// In CMake:
set_source_files_properties(tricky.c PROPERTIES COMPILE_FLAGS "-O0")

// 4. Use -Og instead of -O2 for the whole build

// 5. Look at register values directly
// (gdb) info registers
// (gdb) p/x $rax       # value may be in a register
```

### 3. Reading inlined frames in GDB

With optimization, frequently-called small functions get inlined. GDB shows these as extra frames:

```text
(gdb) bt
#0  process_packet (data=0x7ff..., len=<optimized out>)
    at network.c:45
#1  0x0000... in dispatch_handler (pkt=0x7ff...)
    at handler.c:102
#2  (inlined by) event_loop () at main.c:78
#3  0x0000... in main () at main.c:200

# (inlined by) frames are virtual — they show the call chain
# that was inlined into the actual frame above
```

```bash
# Navigate inlined frames
(gdb) frame 2          # jump to the inlined frame
(gdb) up               # move up through frames (including inlined)
(gdb) down             # move down

# Show all frames including inlined
(gdb) backtrace full

# Set breakpoint inside inlined function
(gdb) break network.c:45      # may hit multiple inlined call sites
(gdb) break process_packet    # hits all inline expansions
```

### 4. Line number discrepancies

Optimizers reorder instructions, so the "current line" in GDB may jump around:

```bash
# See which instructions map to which source lines
(gdb) disassemble /s function_name    # interleaved source and asm

# Step by machine instruction (more accurate in optimized code)
(gdb) si        # stepi — one machine instruction
(gdb) ni        # nexti — one machine instruction (no step into)

# Show mixed source/asm at current point
(gdb) layout split   # TUI mode: source + asm side by side
(gdb) set disassemble-next-line on

# Jump to specific address (when line stepping is unreliable)
(gdb) jump *0x400a2c
```

### 5. GDB scheduler-locking for optimized multithreaded code

With optimization, threads may race in unexpected ways when stepping:

```bash
# Lock the scheduler — only the current thread runs while stepping
(gdb) set scheduler-locking on

# Modes:
# off      — all threads run freely (default)
# on       — only current thread runs while stepping
# step     — only current thread runs while single-stepping
#            (all run on continue)
# replay   — for reverse debugging

# Common debugging session
(gdb) set scheduler-locking step    # prevent other threads interfering with step
(gdb) break my_function
(gdb) continue
(gdb) set scheduler-locking on     # lock while examining
(gdb) next
(gdb) set scheduler-locking off    # unlock to continue normally
```

### 6. split-DWARF — faster debug builds

Split DWARF offloads debug info to `.dwo` files, reducing linker input:

```bash
# Compile with split DWARF
gcc -g -gsplit-dwarf -O2 -c file.c -o file.o
# Creates: file.o (object) + file.dwo (DWARF sidecar)

# Link — no debug info in final binary, just references
gcc -g -gsplit-dwarf file.o -o prog

# GDB finds .dwo files via the path embedded in the binary
gdb prog    # works automatically if .dwo files are next to the binary

# Package all .dwo into a single .dwp for distribution
dwp -o prog.dwp prog    # GNU dwp tool
gdb prog    # with .dwp in same directory

# CMake
add_compile_options(-gsplit-dwarf)
```

### 7. Useful GDB commands for optimized builds

```bash
# Show where variables actually live (register vs stack)
(gdb) info locals           # all locals (may show <optimized out>)
(gdb) info args             # function arguments

# Force evaluation of an expression
(gdb) call (int)my_func(42)  # call actual function to get value

# Watch a memory address directly (not a variable name)
(gdb) watch *0x7fffffffe430

# Print memory contents
(gdb) x/10xw $rsp           # 10 words at stack pointer (hex)
(gdb) x/s 0x4008a0          # string at address

# Catch crashes without debug symbols
(gdb) bt             # backtrace — shows addresses even without symbols
(gdb) info sharedlibrary    # shows loaded libs for symbol resolution

# .gdbinit helpers for optimized debugging
# set print pretty on
# set print array on
# set disassembly-flavor intel
```

## Related skills

- Use `skills/debuggers/gdb` for full GDB session management
- Use `skills/debuggers/dwarf-debug-format` for DWARF debug info details
- Use `skills/debuggers/core-dumps` for post-mortem debugging of optimized crashes
- Use `skills/compilers/gcc` for `-Og`, `-g`, and debug flag selection
