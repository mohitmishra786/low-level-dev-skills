---
name: ebpf-rust
description: Rust eBPF skill using the Aya framework. Use when writing eBPF programs in Rust with aya-bpf and aya-log, defining BPF map types, integrating with tokio userspace, sharing maps between kernel and userspace, or debugging Aya compilation and loading errors. Activates on queries about Aya, aya-bpf, Rust eBPF, aya-log, eBPF in Rust, or BPF programs with tokio.
---

# eBPF with Rust (Aya)

## Purpose

Guide agents through building production eBPF programs in Rust using the Aya framework: writing kernel-side BPF code with `aya-bpf`, structured logging with `aya-log`, sharing maps between BPF and userspace, and integrating with async tokio.

## Triggers

- "How do I write an eBPF program in Rust?"
- "How do I use the Aya framework?"
- "How do I share a BPF map between kernel and userspace in Rust?"
- "How do I log from a BPF program in Rust?"
- "My Aya program fails to load — how do I debug it?"
- "How do I integrate an eBPF program with tokio?"

## Workflow

### 1. Project setup

```bash
# Install aya-tool (generates bindings from vmlinux BTF)
cargo install aya-tool

# Create new Aya project from template
cargo install cargo-generate
cargo generate https://github.com/aya-rs/aya-template

# Workspace layout (generated)
# my-ebpf/
# ├── my-ebpf-ebpf/    <- kernel-side crate (target: bpf)
# ├── my-ebpf/         <- userspace crate (runs on host)
# └── xtask/           <- build helper (cargo xtask build/run)
```

```bash
# Build both sides
cargo xtask build-ebpf          # builds BPF object
cargo xtask run                 # builds + runs with sudo
```

### 2. Kernel-side BPF program

```rust
// my-ebpf-ebpf/src/main.rs
#![no_std]
#![no_main]

use aya_bpf::{
    macros::{map, tracepoint},
    maps::HashMap,
    programs::TracePointContext,
    helpers::bpf_get_current_pid_tgid,
};
use aya_log_ebpf::info;

#[map]
static CALL_COUNT: HashMap<u32, u64> = HashMap::with_max_entries(1024, 0);

#[tracepoint]
pub fn trace_read(ctx: TracePointContext) -> u32 {
    let pid = (bpf_get_current_pid_tgid() >> 32) as u32;

    // Lookup or insert
    match unsafe { CALL_COUNT.get(&pid) } {
        Some(count) => {
            let _ = CALL_COUNT.insert(&pid, &(count + 1), 0);
        }
        None => {
            let _ = CALL_COUNT.insert(&pid, &1u64, 0);
        }
    }

    info!(&ctx, "read() called by pid {}", pid);
    0
}

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    unsafe { core::hint::unreachable_unchecked() }
}
```

### 3. Userspace loader with tokio

```rust
// my-ebpf/src/main.rs
use aya::{Bpf, programs::TracePoint, maps::HashMap};
use aya_log::BpfLogger;
use tokio::signal;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load compiled BPF object (embedded at build time)
    let mut bpf = Bpf::load(include_bytes_aligned!(
        "../../target/bpf/my-ebpf-ebpf.bpf.o"
    ))?;

    // Initialize structured logging from BPF programs
    BpfLogger::init(&mut bpf)?;

    // Attach tracepoint
    let program: &mut TracePoint = bpf.program_mut("trace_read").unwrap().try_into()?;
    program.load()?;
    program.attach("syscalls", "sys_enter_read")?;

    // Read from shared map
    let map: HashMap<_, u32, u64> = HashMap::try_from(bpf.map("CALL_COUNT").unwrap())?;

    // Wait for Ctrl+C
    signal::ctrl_c().await?;

    // Print final counts
    for (pid, count) in map.iter().filter_map(|r| r.ok()) {
        println!("PID {}: {} reads", pid, count);
    }
    Ok(())
}
```

### 4. Map types in Aya

```rust
use aya_bpf::maps::{HashMap, Array, RingBuf, PerfEventArray, LruHashMap};

// Hash map
#[map]
static MY_MAP: HashMap<u32, u64> = HashMap::with_max_entries(1024, 0);

// Ring buffer (preferred for events)
#[map]
static EVENTS: RingBuf = RingBuf::with_byte_size(256 * 1024, 0);

// LRU hash (connection tracking)
#[map]
static CONNS: LruHashMap<u32, ConnInfo> = LruHashMap::with_max_entries(10000, 0);

// Sending events via RingBuf (kernel side)
if let Ok(mut entry) = unsafe { EVENTS.reserve::<MyEvent>(0) } {
    entry.write(MyEvent { pid, ts });
    entry.submit(0);
}
```

```rust
// Reading RingBuf events (userspace)
use aya::maps::RingBuf;
use tokio::io::unix::AsyncFd;

let ring = RingBuf::try_from(bpf.take_map("EVENTS").unwrap())?;
let mut ring = AsyncFd::new(ring)?;

loop {
    let mut guard = ring.readable_mut().await?;
    let rb = guard.get_inner_mut();
    while let Some(item) = rb.next() {
        let event: &MyEvent = unsafe { &*(item.as_ptr() as *const MyEvent) };
        println!("Event from PID {}", event.pid);
    }
    guard.clear_ready();
}
```

### 5. Supported program types

| Aya macro | Program type | Attach target |
|-----------|-------------|---------------|
| `#[tracepoint]` | Tracepoint | `"syscalls", "sys_enter_read"` |
| `#[kprobe]` | kprobe | function name |
| `#[kretprobe]` | kretprobe | function name |
| `#[uprobe]` | uprobe | userspace binary + offset |
| `#[xdp]` | XDP | network interface |
| `#[tc]` | TC (traffic control) | netdevice + direction |
| `#[socket_filter]` | Socket filter | raw socket fd |
| `#[perf_event]` | Perf event | perf_event fd |
| `#[lsm]` | LSM hook | security hook name |
| `#[sk_msg]` | Sockmap | socket map |

### 6. Generating kernel type bindings

```bash
# Generate bindings from running kernel's BTF
aya-tool generate task_struct > src/vmlinux.rs

# Or use btf_type_tag and CO-RE
# aya-bpf supports CO-RE via bpf_core_read! macro
```

```rust
// CO-RE field access in Aya
use aya_bpf::helpers::bpf_core_read;

let dport: u16 = unsafe {
    bpf_core_read!(sk, __sk_common.skc_dport)?
};
```

### 7. Debugging load failures

```bash
# Check verifier errors (Aya surfaces them as Rust errors)
# Run with RUST_LOG=debug for verbose output
RUST_LOG=debug cargo xtask run 2>&1 | grep -A 20 "verifier"

# Check BTF info
bpftool btf dump file /sys/kernel/btf/vmlinux | grep task_struct

# Inspect loaded programs after load
bpftool prog list
bpftool prog dump xlated name trace_read
```

| Error | Cause | Fix |
|-------|-------|-----|
| `invalid mem access` | Unbounded pointer dereference | Add null check before reading |
| `Type not found` | BTF mismatch with kernel | Regenerate vmlinux bindings |
| `Permission denied` | No CAP_BPF or CAP_SYS_ADMIN | Run with `sudo` or set capability |
| `map already exists` | Map pinned, name collision | Unpin or rename map |

## Related skills

- Use `skills/observability/ebpf` for C-based eBPF with libbpf
- Use `skills/rust/rust-async-internals` for tokio async patterns used in userspace
- Use `skills/rust/rust-unsafe` for unsafe code patterns in BPF helpers
