---
name: core-dumps
description: Core dump analysis skill for production crash triage. Use when loading core files in GDB or LLDB, enabling core dump generation on Linux/macOS, mapping symbols with debuginfo or debuginfod, or extracting backtraces from crashes without re-running the program. Activates on queries about core files, ulimit, coredumpctl, debuginfod, crash triage, or analyzing segfaults from production binaries.
---

# Core Dumps

## Purpose

Guide agents through enabling, collecting, and analysing core dumps for post-mortem crash investigation without rerunning the buggy program.

## Triggers

- "My program crashed in production — how do I analyse the core?"
- "How do I enable core dumps on Linux?"
- "I have a core file but no symbols / source"
- "How do I use debuginfod to get symbols for a core?"
- "coredumpctl show me the crash"

## Workflow

### 1. Enable core dumps (Linux)

```bash
# Per-session (lost on logout)
ulimit -c unlimited

# Persistent (add to /etc/security/limits.conf)
*   soft   core   unlimited
*   hard   core   unlimited

# Check current limit
ulimit -c

# Set core pattern (where and how cores are named)
# Default: 'core' in CWD — often not useful
sudo sysctl -w kernel.core_pattern=/tmp/core-%e-%p-%t
# %e = executable, %p = PID, %t = timestamp

# Persistent (add to /etc/sysctl.d/99-core.conf)
kernel.core_pattern=/tmp/core-%e-%p-%t
kernel.core_uses_pid=1
```

### 2. systemd/coredumpctl (modern Linux)

If systemd manages core dumps (common on Ubuntu 20+, Fedora, Arch):

```bash
# List recent crashes
coredumpctl list

# Show details of the latest crash
coredumpctl info

# Load latest crash in GDB
coredumpctl gdb

# Load specific PID crash
coredumpctl gdb 12345

# Export core file
coredumpctl dump -o myapp.core PID
```

Core storage location: `/var/lib/systemd/coredump/`.

### 3. Enable core dumps (macOS)

```bash
# macOS uses /cores by default (must be root-writable)
ulimit -c unlimited

# Check
ls /cores/

# launchd-launched services: set in plist
# <key>HardResourceLimits</key>
# <dict><key>Core</key><integer>9223372036854775807</integer></dict>
```

### 4. Analyse a core with GDB

```bash
# Load binary and core
gdb ./prog core.12345

# If the binary was stripped, provide the unstripped copy
gdb ./prog-with-symbols core.12345

# Essential first commands
(gdb) bt                    # call stack
(gdb) bt full               # stack + locals
(gdb) info registers        # CPU state at crash
(gdb) frame 2               # jump to interesting frame
(gdb) info locals           # local variables in frame
(gdb) print ptr             # inspect a pointer

# All threads (multi-threaded crash)
(gdb) thread apply all bt full
```

### 5. Analyse a core with LLDB

```bash
lldb ./prog -c core.12345

# Or
lldb
(lldb) target create ./prog --core core.12345

# Commands
(lldb) bt
(lldb) thread backtrace all
(lldb) frame select 2
(lldb) frame variable
```

### 6. Missing symbols: debuginfod

`debuginfod` serves debug symbols from a central server, mapping build IDs to DWARF data.

```bash
# Install client (Debian/Ubuntu)
sudo apt install debuginfod

# Enable (add to ~/.bashrc or /etc/environment)
export DEBUGINFOD_URLS="https://debuginfod.ubuntu.com https://debuginfod.elfutils.org"

# GDB auto-fetches symbols when DEBUGINFOD_URLS is set
gdb ./prog core

# Manually query
debuginfod-find debuginfo <build-id>
debuginfod-find source <build-id> /path/to/file.c
```

### 7. Missing symbols: manual approach

```bash
# Check if binary has a build ID
readelf -n ./prog | grep Build

# Find the correct debug package
# Debian: apt install prog-dbg or prog-dbgsym
# RPM: dnf install prog-debuginfo

# Point GDB to debug symbols directory
(gdb) set debug-file-directory /usr/lib/debug

# Or use eu-readelf to dump build ID, then find .debug file
eu-readelf -n ./prog
find /usr/lib/debug -name "*.debug" | xargs eu-readelf -n 2>/dev/null | grep <build-id>
```

### 8. Strip binaries and keep symbols

Best practice: build with symbols, strip for distribution, keep an unstripped copy.

```bash
# Build
gcc -g -O2 -o prog main.c

# Separate debug info
objcopy --only-keep-debug prog prog.debug
objcopy --strip-debug prog prog.stripped

# Add a debuglink so GDB finds the debug file automatically
objcopy --add-gnu-debuglink=prog.debug prog.stripped

# Deploy prog.stripped; keep prog.debug in a symbols store indexed by build-id
```

### 9. Quick triage from core without full debug session

```bash
# Print backtrace non-interactively
gdb -batch -ex 'bt full' -ex 'thread apply all bt full' ./prog core 2>&1 | tee crash.txt

# Print registers
gdb -batch -ex 'info registers' ./prog core

# Check signal that caused crash
gdb -batch -ex 'info signal' ./prog core
```

For a full cheatsheet covering core pattern tokens, coredumpctl, GDB/LLDB commands, debuginfod servers, and strip/symbol workflows, see [references/cheatsheet.md](references/cheatsheet.md).

## Related skills

- Use `skills/debuggers/gdb` for full GDB session details
- Use `skills/debuggers/lldb` for LLDB-based analysis
- Use `skills/runtimes/sanitizers` to catch the bug before it reaches production
- Use `skills/binaries/elf-inspection` for `readelf`, build IDs, and binary inspection
