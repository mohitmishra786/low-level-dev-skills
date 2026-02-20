---
name: gdb
description: GDB debugger skill for C/C++ programs. Use when starting a GDB session, setting breakpoints, stepping through code, inspecting variables, debugging crashes, using reverse debugging (record/replay), remote debugging with gdbserver, or loading core dumps. Activates on queries about GDB commands, segfaults, hangs, watchpoints, conditional breakpoints, pretty-printers, Python GDB scripting, or multi-threaded debugging.
---

# GDB

## Purpose

Walk agents through GDB sessions from first launch to advanced workflows: crash diagnosis, reverse debugging, remote debugging, and multi-thread inspection.

## Triggers

- "My program segfaults / crashes — how do I debug it?"
- "How do I set a breakpoint on condition X?"
- "How do I inspect memory / variables in GDB?"
- "How do I debug a remote embedded target?"
- "GDB shows `??` frames / no source"
- "How do I replay a bug deterministically?" (record/replay)

## Workflow

### 1. Prerequisite: compile with debug info

Always compile with `-g` (GCC/Clang). Use `-Og` or `-O0` for most debuggable code.

```bash
gcc -g -Og -o prog main.c
```

For release builds: use `-g -O2` and keep the binary with symbols (strip separately with `objcopy`).

### 2. Start GDB

```bash
gdb ./prog                          # load binary
gdb ./prog core                     # load with core dump
gdb -p 12345                        # attach to running process
gdb --args ./prog arg1 arg2         # pass arguments
gdb -batch -ex 'run' -ex 'bt' ./prog  # non-interactive (CI)
```

### 3. Essential commands

| Command | Shortcut | Effect |
|---------|----------|--------|
| `run [args]` | `r` | Start the program |
| `continue` | `c` | Resume after break |
| `next` | `n` | Step over (source line) |
| `step` | `s` | Step into |
| `nexti` | `ni` | Step over (instruction) |
| `stepi` | `si` | Step into (instruction) |
| `finish` | | Run to end of current function |
| `until N` | | Run to line N |
| `return [val]` | | Force return from function |
| `quit` | `q` | Exit GDB |

### 4. Breakpoints and watchpoints

```gdb
break main                          # break at function
break file.c:42                     # break at line
break *0x400abc                     # break at address
break foo if x > 10                 # conditional break
tbreak foo                          # temporary breakpoint (fires once)
rbreak ^mylib_.*                    # regex breakpoint on all matching functions

watch x                             # watchpoint: break when x changes
watch *(int*)0x601060               # watch memory address
rwatch x                            # break when x is read
awatch x                            # break on read or write

info breakpoints                    # list all breakpoints
delete 3                            # delete breakpoint 3
disable 3                           # disable without deleting
enable 3
```

### 5. Inspect state

```gdb
print x                             # print variable
print/x x                           # print in hex
print *ptr                          # dereference pointer
print arr[0]@10                     # print 10 elements of array
display x                           # auto-print x on every stop
undisplay 1

info locals                         # all local variables
info args                           # function arguments
info registers                      # all CPU registers
info registers rip rsp rbp          # specific registers
x/10wx 0x7fff0000                   # examine 10 words at address
x/s 0x400abc                        # examine as string
x/i $rip                            # examine current instruction

backtrace                           # call stack (bt)
bt full                             # bt + local vars
frame 2                             # switch to frame 2
up / down                           # move up/down the stack
```

### 6. Multi-thread debugging

```gdb
info threads                        # list threads
thread 3                            # switch to thread 3
thread apply all bt                 # backtrace all threads
thread apply all bt full            # full bt all threads
set scheduler-locking on            # pause other threads while stepping
```

### 7. Reverse debugging (record/replay)

Record requires `target record-full` or `target record-btrace` (Intel PT):

```gdb
# Software record (slow but universal)
record                              # start recording
run
# ... trigger the bug ...
reverse-continue                    # go back to last break
reverse-next                        # step backwards
reverse-step
reverse-finish

# Intel Processor Trace (fast, hardware)
target record-btrace pt
run
# view instruction history
record instruction-history
```

### 8. Remote debugging with gdbserver

On target:

```bash
gdbserver :1234 ./prog
# Or attach:
gdbserver :1234 --attach 5678
```

On host:

```bash
gdb ./prog
(gdb) target remote 192.168.1.10:1234
(gdb) break main
(gdb) continue
```

For cross-compilation: use `aarch64-linux-gnu-gdb` on the host.

### 9. Common problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `No symbol table` | Binary not compiled with `-g` | Recompile with `-g` |
| `??` frames in backtrace | Missing debug info or stack corruption | Install debuginfo package; check for stack smash |
| `Cannot access memory at address` | Null dereference / freed memory | Check pointer before deref; use ASan |
| `SIGABRT` in backtrace | `abort()` or assertion failure | Go up frames to find the assertion |
| GDB hangs on `run` | Binary waiting for input | Redirect stdin: `run < /dev/null` |
| Breakpoint in wrong place | Optimiser moved code | Compile with `-Og`; or use `nexti` |

### 10. GDB init file (~/.gdbinit)

```gdb
set history save on
set history size 1000
set print pretty on
set print array on
set print array-indexes on
set pagination off
set confirm off
```

For a command cheatsheet, see [references/cheatsheet.md](references/cheatsheet.md).
For pretty-printers and Python scripting, see [references/scripting.md](references/scripting.md).

## Related skills

- Use `skills/debuggers/core-dumps` for loading core files
- Use `skills/debuggers/lldb` for LLDB-based workflows
- Use `skills/runtimes/sanitizers` to catch bugs before needing the debugger
- Use `skills/compilers/gcc` for `-g` flag details
