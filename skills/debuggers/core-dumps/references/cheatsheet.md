# Core Dump Cheatsheet

Source: <https://man7.org/linux/man-pages/man5/core.5.html>
Source: <https://sourceware.org/gdb/current/onlinedocs/gdb.html/Core-File-Generation.html>
Source: <https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/8/html-single/developing_c_and_cpp_applications_in_rhel_8/index>

## Table of Contents

1. [Enable core dumps](#enable-core-dumps)
2. [Core pattern configuration](#core-pattern-configuration)
3. [systemd / coredumpctl](#systemd--coredumpctl)
4. [Analyse with GDB](#analyse-with-gdb)
5. [Analyse with LLDB](#analyse-with-lldb)
6. [debuginfod for symbols](#debuginfod-for-symbols)
7. [Non-interactive triage](#non-interactive-triage)
8. [macOS cores](#macos-cores)
9. [Stripping and symbol management](#stripping-and-symbol-management)

---

## Enable core dumps

```bash
# Per-session (temporary)
ulimit -c unlimited

# Per-process (in code or shell script)
#include <sys/resource.h>
struct rlimit rl = { RLIM_INFINITY, RLIM_INFINITY };
setrlimit(RLIMIT_CORE, &rl);

# Persistent (all users): add to /etc/security/limits.conf
*   soft   core   unlimited
*   hard   core   unlimited

# Check current limit
ulimit -c              # current shell
cat /proc/self/limits  # current process (Linux)

# Check if cores are being generated
ls -la /tmp/ | grep core
ls -la $(cat /proc/sys/kernel/core_pattern | sed 's/%[epstu]//g' | xargs dirname 2>/dev/null)
```

---

## Core pattern configuration

```bash
# Show current pattern
cat /proc/sys/kernel/core_pattern

# Common useful pattern (temporary)
sudo sysctl -w kernel.core_pattern=/tmp/core-%e-%p-%t
# %e = executable name, %p = PID, %t = Unix timestamp
# Other tokens: %u=UID, %g=GID, %s=signal, %h=hostname

# Persistent: create /etc/sysctl.d/99-core.conf
[Unit]
kernel.core_pattern=/tmp/core-%e-%p-%t
kernel.core_uses_pid=1

sudo sysctl -p /etc/sysctl.d/99-core.conf

# Check if pipe handler is active (like systemd-coredump or apport)
cat /proc/sys/kernel/core_pattern
# If it starts with '|', a pipe handler is active:
# | /usr/lib/systemd/systemd-coredump ...   <- systemd
# | /usr/share/apport/apport %p ...         <- Ubuntu apport
```

**Core pattern tokens:**

| Token | Meaning |
|-------|---------|
| `%e` | Executable filename (without path) |
| `%E` | Executable path (/ → !) |
| `%p` | PID |
| `%P` | PID of dump process (tid if thread-specific) |
| `%u` | UID |
| `%g` | GID |
| `%s` | Signal number |
| `%t` | Unix timestamp |
| `%h` | Hostname |
| `%c` | Core file size soft limit |

---

## systemd / coredumpctl

```bash
# List all recorded crashes
coredumpctl list

# Show crashes for a specific executable
coredumpctl list myapp

# Show detailed info about latest crash
coredumpctl info

# Show info for specific PID
coredumpctl info 12345

# Open latest crash in GDB
coredumpctl gdb

# Open specific crash in GDB
coredumpctl gdb myapp
coredumpctl gdb PID

# Export core file
coredumpctl dump -o /tmp/myapp.core
coredumpctl dump PID -o /tmp/myapp.core

# Show journal log around crash
coredumpctl info --no-pager | grep -A5 "MESSAGE="

# Core storage location
ls /var/lib/systemd/coredump/

# Disable coredumpctl (revert to kernel default)
# In /etc/systemd/coredump.conf:
[Coredump]
Storage=none
```

---

## Analyse with GDB

```bash
# Load binary and core
gdb ./prog /tmp/core-prog-12345-1700000000

# If binary is stripped, use the debug build
gdb ./prog-with-debug-symbols /tmp/core

# Essential first session
(gdb) bt                         # call stack
(gdb) bt full                    # stack + locals in each frame
(gdb) info registers             # CPU registers at crash
(gdb) frame 2                    # jump to frame 2
(gdb) info locals                # local variables in that frame
(gdb) print ptr                  # inspect a pointer
(gdb) x/10wx $rsp                # examine memory near stack pointer

# All threads
(gdb) thread apply all bt full

# What signal caused the crash?
(gdb) info signals               # list signal handling
(gdb) print $_siginfo            # signal info struct (Linux)

# Check for SIGABRT (assertion failure)
(gdb) bt                         # look for __assert_fail or abort in stack

# Print a struct nicely
(gdb) set print pretty on
(gdb) print *my_struct_ptr

# Find where a pointer points
(gdb) info symbol 0x7fff12345678
(gdb) x/s 0x7fff12345678         # if it might be a string
```

---

## Analyse with LLDB

```bash
# Load core
lldb ./prog -c core.12345
# Or:
lldb
(lldb) target create ./prog --core core.12345

# Essential commands
(lldb) bt                         # backtrace
(lldb) bt all                     # all threads
(lldb) thread backtrace all
(lldb) frame select 2             # select frame
(lldb) frame variable             # locals
(lldb) register read              # CPU registers
(lldb) memory read -s8 -fx -c10 0x7fff0000  # examine memory

# Inspect signal
(lldb) thread info
```

---

## debuginfod for symbols

```bash
# Install client
sudo apt install debuginfod      # Debian/Ubuntu
sudo dnf install elfutils-debuginfod-client  # Fedora/RHEL

# Set URL (add to ~/.bashrc or /etc/environment)
export DEBUGINFOD_URLS="https://debuginfod.ubuntu.com https://debuginfod.elfutils.org"

# GDB auto-uses debuginfod when DEBUGINFOD_URLS is set
gdb ./stripped-prog core

# Check build ID (needed for debuginfod lookup)
readelf -n ./prog | grep 'Build ID'
file ./prog | grep BuildID

# Manual lookup
debuginfod-find debuginfo <build-id-hex>
debuginfod-find source  <build-id-hex> /path/to/source.c

# Warm cache manually
DEBUGINFOD_PROGRESS=1 gdb ./prog core
```

**Public debuginfod servers:**

| Distro | URL |
|--------|-----|
| Ubuntu | `https://debuginfod.ubuntu.com` |
| Fedora | `https://debuginfod.fedoraproject.org` |
| Debian | `https://debuginfod.debian.net` |
| Arch Linux | `https://debuginfod.archlinux.org` |
| openSUSE | `https://debuginfod.opensuse.org` |
| Generic | `https://debuginfod.elfutils.org` |

---

## Non-interactive triage

```bash
# Quick backtrace from core (CI / automated)
gdb -batch \
    -ex 'set print thread-events off' \
    -ex 'thread apply all bt full' \
    -ex 'info registers' \
    -ex 'quit' \
    ./prog core 2>&1 | tee crash_report.txt

# One-liner: print backtrace and registers
gdb -batch -ex 'bt full' -ex 'info registers' ./prog core

# Check signal number from core metadata
eu-readelf -n core | grep -i signal
readelf -n core 2>/dev/null | head -30

# Print core metadata without GDB
file core                 # shows signal, PID, architecture
```

---

## macOS cores

```bash
# Enable
ulimit -c unlimited
# Cores go to /cores/core.<PID>

# Check
ls /cores/

# Load in LLDB
lldb ./prog -c /cores/core.12345

# Enable for a specific process
taskgated policy ...     # complex; usually just run with ulimit set

# Disable Crash Reporter (prevent dialog)
# sudo defaults write com.apple.CrashReporter DialogType none

# Check crash logs (Crash Reporter writes .crash files)
ls ~/Library/Logs/DiagnosticReports/
ls /Library/Logs/DiagnosticReports/
```

---

## Stripping and symbol management

```bash
# Best practice: keep an unstripped copy indexed by build ID
BUILD_ID=$(readelf -n prog | grep 'Build ID' | awk '{print $3}')
mkdir -p /srv/symbols/${BUILD_ID:0:2}
cp prog /srv/symbols/${BUILD_ID:0:2}/${BUILD_ID:2}.debug

# Strip for distribution
objcopy --only-keep-debug prog prog.debug
strip --strip-debug prog
objcopy --add-gnu-debuglink=prog.debug prog

# Install debug symbols (Debian)
sudo apt install myapp-dbgsym   # or myapp-dbg

# Install debug symbols (Fedora/RHEL)
sudo dnf install myapp-debuginfo

# Tell GDB where debug files live
(gdb) set debug-file-directory /usr/lib/debug:/srv/symbols
```
