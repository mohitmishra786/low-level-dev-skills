---
name: lldb
description: LLDB debugger skill for C/C++/Swift/Objective-C programs. Use when debugging with LLDB on macOS, FreeBSD, or Linux-clang environments, mapping GDB mental models to LLDB commands, using LLDB in Xcode or VS Code, or debugging Swift/Objective-C. Activates on queries about LLDB commands, GDB to LLDB migration, Apple platform debugging, LLDB Python scripting, or IDE-integrated debugging with clang-built binaries.
---

# LLDB

## Purpose

Guide agents through LLDB sessions and map existing GDB knowledge to LLDB. Covers command differences, Apple specifics, Python scripting, and IDE integration.

## Triggers

- "I'm on macOS and need to debug a C++ program"
- "How does LLDB differ from GDB?"
- "How do I do [GDB command] in LLDB?"
- "LLDB shows `<unavailable>` for variables"
- "How do I use LLDB in VS Code?"
- "How do I write an LLDB Python script?"

## Workflow

### 1. Start LLDB

```bash
lldb ./prog                         # load binary
lldb ./prog -- arg1 arg2            # with arguments
lldb -p 12345                       # attach to PID
lldb -c core.1234                   # load core dump
lldb ./prog core.1234               # binary + core
```

### 2. GDB → LLDB command map

Source: https://lldb.llvm.org/use/map.html

| GDB | LLDB | Notes |
|-----|------|-------|
| `run [args]` | `process launch [args]` / `r` | |
| `continue` | `process continue` / `c` | |
| `next` | `thread step-over` / `n` | |
| `step` | `thread step-in` / `s` | |
| `nexti` | `thread step-inst-over` / `ni` | |
| `stepi` | `thread step-inst` / `si` | |
| `finish` | `thread step-out` / `finish` | |
| `break main` | `breakpoint set -n main` / `b main` | |
| `break file.c:42` | `breakpoint set -f file.c -l 42` / `b file.c:42` | |
| `break *0x400abc` | `breakpoint set -a 0x400abc` / `b -a 0x400abc` | |
| `watch x` | `watchpoint set variable x` / `wa s v x` | |
| `print x` | `frame variable x` / `p x` | |
| `print/x x` | `p/x x` | |
| `info locals` | `frame variable` / `fr v` | |
| `info args` | `frame variable --arguments` | |
| `backtrace` | `thread backtrace` / `bt` | |
| `frame N` | `frame select N` / `f N` | |
| `info threads` | `thread list` | |
| `thread N` | `thread select N` | |
| `thread apply all bt` | `thread backtrace all` | |
| `x/10wx addr` | `memory read -s4 -fx -c10 addr` / `x/10xw addr` | |
| `set var = 42` | `expression var = 42` / `expr var = 42` | |
| `quit` | `quit` / `q` | |

### 3. Breakpoints

```lldb
# By name
b main
breakpoint set --name foo
breakpoint set --name foo --condition 'x > 0'

# By file:line
b file.c:42
breakpoint set --file file.c --line 42

# By address
b -a 0x100003f20

# By regex
breakpoint set --func-regex '^MyClass::'

# List
breakpoint list / br l

# Delete
breakpoint delete 2

# Disable/enable
breakpoint disable 1
breakpoint enable 1

# Commands on hit
breakpoint command add 1
  > p x
  > continue
  > DONE
```

### 4. Inspect state

```lldb
# Print variable
p x
frame variable x
p *ptr
p arr[0]

# Print expression
expression x * 2 + 1
expr (int)sqrt(9.0)

# All locals
frame variable
fr v -a          # include arguments

# Registers
register read
register read rip rsp

# Memory
memory read --size 4 --format x --count 10 0x7fff0000
x/10xw 0x7fff0000          # GDB-compatible syntax

# Type info
image lookup --type MyClass
type lookup MyClass
```

### 5. Watchpoints

```lldb
watchpoint set variable x           # write watchpoint
watchpoint set variable -w read x   # read watchpoint
watchpoint set variable -w read_write x
watchpoint set expression -- &x     # by address

watchpoint list
watchpoint delete 1
```

### 6. Threads

```lldb
thread list
thread select 3
thread backtrace all
thread backtrace --count 5           # limit depth

# Per-thread stepping
thread step-over                     # step this thread only
```

### 7. macOS / Apple specifics

```lldb
# Symbol lookup in shared cache
image lookup --address 0x18ab12345
image lookup --name objc_msgSend

# Objective-C method breakpoint
b "-[NSArray objectAtIndex:]"
b "+[NSString stringWithFormat:]"

# Inspect Objective-C object
po myObject                          # print-object (calls -description)
po [arr count]

# Show loaded libraries
image list
image list -b                        # brief (names only)
```

### 8. VS Code integration

Install the `CodeLLDB` extension. `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug (lldb)",
      "type": "lldb",
      "request": "launch",
      "program": "${workspaceFolder}/build/prog",
      "args": [],
      "cwd": "${workspaceFolder}",
      "preLaunchTask": "build"
    }
  ]
}
```

### 9. LLDB Python scripting

```python
import lldb

def print_all_threads(debugger, command, result, internal_dict):
    target = debugger.GetSelectedTarget()
    process = target.GetProcess()
    for thread in process:
        print(f"Thread {thread.GetIndexID()}: {thread.GetName()}")
        for frame in thread:
            print(f"  {frame}")

def __lldb_init_module(debugger, internal_dict):
    debugger.HandleCommand('command script add -f myscript.print_all_threads pthreads')
```

Load: `command script import /path/to/myscript.py`

For a full GDB↔LLDB command map, see [references/gdb-lldb-map.md](references/gdb-lldb-map.md).

## Related skills

- Use `skills/debuggers/gdb` for GDB workflows
- Use `skills/debuggers/core-dumps` for core dump analysis
- Use `skills/compilers/clang` for building with debug info
