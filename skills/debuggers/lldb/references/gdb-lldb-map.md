# GDB to LLDB Command Map

Source: <https://lldb.llvm.org/use/map.html>

## Table of Contents

1. [Process control](#process-control)
2. [Breakpoints](#breakpoints)
3. [Watchpoints](#watchpoints)
4. [Inspection](#inspection)
5. [Stack](#stack)
6. [Memory](#memory)
7. [Threads](#threads)
8. [Signals](#signals)
9. [Settings](#settings)

---

## Process control

| GDB | LLDB |
|-----|------|
| `run [args]` | `process launch [args]` / `r` |
| `run < file` | `process launch -i file` |
| `continue` | `process continue` / `c` |
| `next` | `thread step-over` / `n` |
| `step` | `thread step-in` / `s` |
| `nexti` | `thread step-inst-over` / `ni` |
| `stepi` | `thread step-inst` / `si` |
| `finish` | `thread step-out` / `finish` |
| `until N` | `thread until N` |
| `kill` | `process kill` |
| `quit` | `quit` / `q` |
| `set args a b c` | `settings set target.run-args a b c` |
| `show args` | `settings show target.run-args` |

---

## Breakpoints

| GDB | LLDB |
|-----|------|
| `break main` | `b main` / `breakpoint set -n main` |
| `break file.c:42` | `b file.c:42` / `breakpoint set -f file.c -l 42` |
| `break *0x400abc` | `b -a 0x400abc` / `breakpoint set -a 0x400abc` |
| `break foo if x > 0` | `b foo -c 'x > 0'` |
| `tbreak foo` | `breakpoint set -o -n foo` (`-o` = one-shot) |
| `rbreak regex` | `breakpoint set -r regex` |
| `info breakpoints` | `breakpoint list` / `br l` |
| `delete N` | `breakpoint delete N` / `br del N` |
| `disable N` | `breakpoint disable N` |
| `enable N` | `breakpoint enable N` |
| `ignore N count` | `breakpoint ignore N count` |

---

## Watchpoints

| GDB | LLDB |
|-----|------|
| `watch x` | `watchpoint set variable x` / `wa s v x` |
| `rwatch x` | `watchpoint set variable -w read x` |
| `awatch x` | `watchpoint set variable -w read_write x` |
| `info watchpoints` | `watchpoint list` / `wa l` |
| `delete N` (watchpoint) | `watchpoint delete N` |

---

## Inspection

| GDB | LLDB |
|-----|------|
| `print x` / `p x` | `p x` / `frame variable x` |
| `print/x x` | `p/x x` |
| `print *ptr` | `p *ptr` |
| `print arr[0]@10` | `p arr[0]` (no `@` syntax; use loop or Python) |
| `display x` | `target stop-hook add --one-liner 'p x'` |
| `info locals` | `frame variable` / `fr v` |
| `info args` | `frame variable --arguments` |
| `info registers` | `register read` |
| `ptype x` | `image lookup --type typename` / `type lookup typename` |
| `whatis x` | `p x` (shows type automatically) |
| `set var x = 5` | `expression x = 5` / `expr x = 5` |

---

## Stack

| GDB | LLDB |
|-----|------|
| `backtrace` / `bt` | `thread backtrace` / `bt` |
| `bt N` | `bt -c N` |
| `bt full` | `bt -e true` |
| `frame N` / `f N` | `frame select N` / `f N` |
| `up` | `up` |
| `down` | `down` |
| `info frame` | `frame info` |

---

## Memory

| GDB | LLDB |
|-----|------|
| `x/10wx addr` | `memory read -s4 -fx -c10 addr` / `x/10xw addr` |
| `x/s addr` | `memory read -T char -c100 addr` / `x/s addr` |
| `x/i $rip` | `memory read --force -fi -c1 $pc` / `di -s $pc -c1` |
| `set {int}addr = 42` | `memory write -s4 addr 42` |
| `find addr1, addr2, val` | `memory find -e val addr1 addr2` |

---

## Threads

| GDB | LLDB |
|-----|------|
| `info threads` | `thread list` |
| `thread N` | `thread select N` |
| `thread apply all bt` | `thread backtrace all` |
| `set scheduler-locking on` | `settings set target.process.thread.step-in-avoid-nodebug true` |

---

## Signals

| GDB | LLDB |
|-----|------|
| `info signals` | `process handle` |
| `handle SIGUSR1 nostop` | `process handle SIGUSR1 -n true -p true -s false` |
| `signal SIGUSR1` | `process signal SIGUSR1` |

---

## Settings

| GDB | LLDB |
|-----|------|
| `set print pretty on` | `settings set target.max-children-count 30` |
| `set pagination off` | `settings set term-width 0` |
| `source script.gdb` | `command source script.lldb` |
| `python ...` | `script ...` |
| `define cmd ...` | `command alias cmd ...` |
