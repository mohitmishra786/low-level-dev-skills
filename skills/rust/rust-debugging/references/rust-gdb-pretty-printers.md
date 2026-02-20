# Rust GDB/LLDB Pretty-Printers Reference

## GDB Setup

### Automatic via rust-gdb

`rust-gdb` is a wrapper script installed with rustup that sources Rust pretty-printers:

```bash
# Find the wrapper
which rust-gdb
# /home/user/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/rust-gdb

# Use it
rust-gdb ./target/debug/myapp
```

### Manual ~/.gdbinit setup

```python
# ~/.gdbinit
python
import subprocess, sys

# Find rustc sysroot
sysroot = subprocess.check_output(['rustc', '--print', 'sysroot']).decode().strip()
sys.path.insert(0, f'{sysroot}/lib/rustlib/etc')
import gdb_lookup
end

# Enable pretty-printing
set print pretty on
set print array on
```

## GDB Commands for Rust

### Types

```gdb
# Print type of expression
(gdb) ptype my_var
(gdb) whatis my_var

# Inspect String
(gdb) p my_string
$1 = "hello world"

# Inspect Vec<T>
(gdb) p my_vec
$2 = vec![1, 2, 3, 4, 5]
(gdb) p my_vec.len

# Inspect Option<T>
(gdb) p my_option
$3 = Some(42)

# Inspect Result<T, E>
(gdb) p my_result
$4 = Ok(42)
# or
$4 = Err(MyError { ... })

# Inspect HashMap
(gdb) p my_map
$5 = HashMap{...}
```

### Breakpoints in Rust

```gdb
# Break on function by full path
(gdb) break myapp::module::function_name

# Break on trait method
(gdb) break '<MyType as MyTrait>::method'

# Break on closure (Rust closures get mangled names)
(gdb) break myapp::module::function_name::{closure#0}

# Break on panic
(gdb) break rust_panic
(gdb) break std::panicking::begin_panic

# Break on specific file:line
(gdb) break src/main.rs:42

# Conditional break
(gdb) break myapp::process if id == 100
```

### Thread debugging

```gdb
# List all threads
(gdb) info threads

# Switch to thread
(gdb) thread 2

# Apply command to all threads
(gdb) thread apply all bt

# Lock scheduler to current thread
(gdb) set scheduler-locking on
```

## LLDB Setup

### Automatic via rust-lldb

```bash
rust-lldb ./target/debug/myapp
```

### Manual setup

```bash
# Find Rust LLDB scripts
rustc --print sysroot
# /home/user/.rustup/toolchains/stable-x86_64-unknown-linux-gnu

# Source scripts in LLDB session
(lldb) command script import ~/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/etc/lldb_lookup.py
(lldb) command source ~/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/etc/lldb_commands
```

## LLDB Commands for Rust

```lldb
# Set breakpoint
(lldb) b myapp::module::function_name
(lldb) b src/main.rs:42

# Break on panic
(lldb) b rust_panic

# Print variable
(lldb) frame variable my_var
(lldb) p my_vec

# Print specific field
(lldb) p my_struct.field

# All locals
(lldb) frame variable

# Thread list
(lldb) thread list

# Backtrace
(lldb) thread backtrace
(lldb) thread backtrace all
```

## VS Code / IDE Integration

### CodeLLDB extension (recommended for Rust)

`.vscode/launch.json`:
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "lldb",
            "request": "launch",
            "name": "Debug myapp",
            "program": "${workspaceFolder}/target/debug/myapp",
            "args": ["--flag", "value"],
            "cwd": "${workspaceFolder}",
            "env": {
                "RUST_BACKTRACE": "1",
                "RUST_LOG": "debug"
            },
            "sourceMap": {
                "/rustc/...": "${env:HOME}/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/src/rust"
            }
        },
        {
            "type": "lldb",
            "request": "launch",
            "name": "cargo test -- module_name",
            "cargo": {
                "args": ["test", "--no-run", "--lib"],
                "filter": { "name": "myapp", "kind": "lib" }
            },
            "args": ["module_name"],
            "cwd": "${workspaceFolder}"
        }
    ]
}
```

## Debugging #[no_std] Binaries

```bash
# Connect to embedded target via OpenOCD + GDB
openocd -f interface/stlink.cfg -f target/stm32f4x.cfg &
rust-gdb target/thumbv7em-none-eabihf/debug/firmware \
    --ex "target remote localhost:3333"

# Or use probe-rs
cargo install probe-run
probe-run --chip STM32F411CE target/thumbv7em-none-eabihf/debug/firmware
```

## Symbol Demangling

```bash
# Demangle Rust symbols manually
echo '_ZN4core4fmt9Formatter9write_fmt17hb4f5d866d07ffa27E' | rustfilt
# core::fmt::Formatter::write_fmt

# Install rustfilt
cargo install rustfilt

# Or use c++filt
echo '_ZN4core4fmt9Formatter9write_fmt17hb4f5d866d07ffa27E' | c++filt
```
