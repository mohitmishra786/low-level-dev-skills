# GDB Command Cheatsheet

Source: <https://sourceware.org/gdb/documentation/>
Source: <https://aaronbloomfield.github.io/pdr/docs/gdb_vs_lldb.html>

## Table of Contents

1. [Startup](#startup)
2. [Execution control](#execution-control)
3. [Breakpoints & watchpoints](#breakpoints--watchpoints)
4. [Inspection](#inspection)
5. [Stack](#stack)
6. [Memory](#memory)
7. [Threads](#threads)
8. [Reverse debugging](#reverse-debugging)
9. [Display formats](#display-formats)

---

## Startup

```gdb
gdb prog                         Load binary
gdb prog core                    Load with core
gdb -p PID                       Attach to process
gdb --args prog a b c            Pass arguments
gdb -batch -ex 'run' -ex 'bt'   Non-interactive
set args a b c                   Set args after load
```

---

## Execution control

```gdb
run / r [args]                   Start
continue / c                     Resume
next / n                         Step over (source)
step / s                         Step into (source)
nexti / ni                       Step over (instruction)
stepi / si                       Step into (instruction)
finish                           Run to end of function
until N                          Run to line N in current file
until file.c:N                   Run to specific line
advance foo                      Run to next call of foo
return [expr]                    Force return value
signal SIGUSR1                   Deliver signal
kill                             Kill program
```

---

## Breakpoints & watchpoints

```gdb
break main                       Function
break file.c:42                  Line
break *0x400abc                  Address
break foo if x > 0               Conditional
tbreak foo                       Temporary (once)
rbreak regex                     All matching functions
catch throw                      C++ exception thrown
catch syscall mmap               Syscall breakpoint

watch var                        Write watchpoint
rwatch var                       Read watchpoint
awatch var                       Read/write watchpoint
watch *(int*)addr                Memory watchpoint

info breakpoints / info watch    List
delete N                         Remove breakpoint N
disable N / enable N             Toggle
ignore N count                   Skip N times
commands N                       Run commands on hit
```

---

## Inspection

```gdb
print expr / p expr              Print expression
print/x expr                     Print hex
print/t expr                     Print binary
print/f expr                     Print float
print/c expr                     Print char
print/d expr                     Print signed int
print/u expr                     Print unsigned int
print/a expr                     Print as address

print arr@N                      Print N elements
print *ptr                       Dereference
print *((int*)ptr)               Cast and deref

display expr                     Print on every stop
undisplay N                      Remove auto-display
info display                     List

ptype var                        Print type of var
whatis var                       Brief type info
info locals                      All locals
info args                        Function arguments
info variables                   All global variables
```

---

## Stack

```gdb
backtrace / bt                   Call stack
bt N                             Top N frames
bt full                          Frames + locals
bt -N                            Bottom N frames
frame N / f N                    Select frame N
up / down                        Move in stack
info frame                       Frame info
info args                        Current frame args
info locals                      Current frame locals
```

---

## Memory

```gdb
x/Nuf addr                       Examine memory
  N = count
  u = unit: b(byte) h(half=2) w(word=4) g(giant=8)
  f = format: x(hex) d(dec) u(uint) o(octal) t(bin) f(float) s(string) i(insn)

Examples:
x/10wx 0x7fff0000                10 words (hex)
x/4gx $rsp                       4 giants at stack top
x/20i $rip                       20 instructions from RIP
x/s 0x400abc                     String
x/b &var                         Single byte

set {int}0xaddr = 42             Write memory
set var = 42                     Set variable
```

---

## Threads

```gdb
info threads                     List threads
thread N                         Switch to thread N
thread apply all bt              Backtrace all
thread apply all bt full
thread apply 1 2 print x         Apply to specific threads
set scheduler-locking on/off     Lock/unlock other threads during step
```

---

## Reverse debugging

```gdb
record                           Start software record
record btrace                    Start hardware trace
record stop                      Stop recording
reverse-continue / rc            Go backward to last event
reverse-next / rn                Reverse step-over
reverse-step / rs                Reverse step-into
reverse-finish                   Reverse finish
set exec-direction reverse       Make n/s go backward
set exec-direction forward       Restore
record instruction-history       Show recorded instructions (btrace)
record function-call-history     Show call history (btrace)
```

---

## Display formats

| Format | Code | Example |
|--------|------|---------|
| Hex | `/x` | `p/x var` |
| Decimal | `/d` | `p/d var` |
| Binary | `/t` | `p/t var` |
| Float | `/f` | `p/f var` |
| Char | `/c` | `p/c var` |
| String | `/s` | `x/s ptr` |
| Instruction | `/i` | `x/5i $pc` |
