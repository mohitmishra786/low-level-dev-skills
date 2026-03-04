---
name: ebpf
description: eBPF skill for Linux observability and networking. Use when writing eBPF programs with libbpf or bpftrace, attaching kprobes/tracepoints/XDP hooks, debugging verifier errors, working with eBPF maps, or achieving CO-RE portability across kernel versions. Activates on queries about eBPF, bpftool, bpftrace, XDP programs, libbpf, verifier errors, eBPF maps, or kernel tracing with BPF.
---

# eBPF

## Purpose

Guide agents through writing, loading, and debugging eBPF programs using libbpf, bpftrace, and bpftool. Covers map types, program types, verifier errors, XDP networking, and CO-RE portability.

## Triggers

- "How do I write an eBPF program to trace system calls?"
- "My eBPF program fails with a verifier error"
- "How do I use bpftrace to trace kernel events?"
- "How do I share data between kernel eBPF and userspace?"
- "How do I write an XDP program for packet filtering?"
- "How do I make my eBPF program portable across kernel versions (CO-RE)?"

## Workflow

### 1. Choose the right tool

```
Goal?
├── One-liner kernel tracing / scripting → bpftrace
├── Production eBPF program with userspace → libbpf (C) or aya (Rust)
├── Inspect loaded programs and maps → bpftool
└── High-performance packet processing → XDP + libbpf
```

### 2. bpftrace — quick kernel tracing

```bash
# Trace all execve calls with comm and args
bpftrace -e 'tracepoint:syscalls:sys_enter_execve { printf("%s %s\n", comm, str(args->filename)); }'

# Count syscalls by process
bpftrace -e 'tracepoint:raw_syscalls:sys_enter { @[comm] = count(); }'

# Latency histogram for read() syscall
bpftrace -e '
  tracepoint:syscalls:sys_enter_read { @start[tid] = nsecs; }
  tracepoint:syscalls:sys_exit_read  { @us = hist((nsecs - @start[tid]) / 1000); delete(@start[tid]); }'

# List available tracepoints
bpftrace -l 'tracepoint:syscalls:*'
bpftrace -l 'kprobe:tcp_*'
```

### 3. libbpf skeleton — minimal C program

```c
// counter.bpf.c — kernel-side
#include <vmlinux.h>
#include <bpf/bpf_helpers.h>

struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __type(key, u32);
    __type(value, u64);
    __uint(max_entries, 1024);
} call_count SEC(".maps");

SEC("tracepoint/syscalls/sys_enter_read")
int trace_read(struct trace_event_raw_sys_enter *ctx)
{
    u32 pid = bpf_get_current_pid_tgid() >> 32;
    u64 *cnt = bpf_map_lookup_elem(&call_count, &pid);
    if (cnt)
        (*cnt)++;
    else {
        u64 one = 1;
        bpf_map_update_elem(&call_count, &pid, &one, BPF_ANY);
    }
    return 0;
}

char LICENSE[] SEC("license") = "GPL";
```

```c
// counter.c — userspace loader
#include "counter.skel.h"

int main(void) {
    struct counter_bpf *skel = counter_bpf__open_and_load();
    counter_bpf__attach(skel);
    // read map, print results
    counter_bpf__destroy(skel);
}
```

```bash
# Build with libbpf
clang -g -O2 -target bpf -D__TARGET_ARCH_x86 -I/usr/include/bpf \
      -c counter.bpf.c -o counter.bpf.o
bpftool gen skeleton counter.bpf.o > counter.skel.h
gcc -o counter counter.c -lbpf -lelf -lz
```

### 4. eBPF map types

| Map type | Key→Value | Use case |
|----------|-----------|----------|
| `BPF_MAP_TYPE_HASH` | arbitrary→arbitrary | Per-PID counters, state |
| `BPF_MAP_TYPE_ARRAY` | u32→fixed | Config, metrics indexed by CPU |
| `BPF_MAP_TYPE_PERCPU_HASH` | key→per-CPU val | High-frequency counters without locks |
| `BPF_MAP_TYPE_RINGBUF` | — | Efficient kernel→userspace events |
| `BPF_MAP_TYPE_PERF_EVENT_ARRAY` | — | Legacy perf event output |
| `BPF_MAP_TYPE_LRU_HASH` | key→val | Connection tracking, limited size |
| `BPF_MAP_TYPE_PROG_ARRAY` | u32→prog | Tail calls, program chaining |
| `BPF_MAP_TYPE_XSKMAP` | — | AF_XDP socket redirection |

Use `BPF_MAP_TYPE_RINGBUF` over `PERF_EVENT_ARRAY` for new code — lower overhead, variable-size records.

### 5. Verifier error triage

| Error message | Root cause | Fix |
|---------------|-----------|-----|
| `invalid mem access 'scalar'` | Dereferencing unbounded pointer | Check pointer with null test before use |
| `R0 !read_ok` | Return without setting R0 | Ensure all paths set a return value |
| `jump out of range` | Branch target beyond program end | Restructure conditionals |
| `back-edge detected` | Backward jump (loop) | Use `bpf_loop()` helper (kernel ≥5.17) or bounded loop |
| `unreachable insn` | Dead code after return | Remove dead branches |
| `invalid indirect read` | Stack read of uninitialised bytes | Zero-init structs: `struct foo x = {}` |
| `misaligned stack access` | Pointer arithmetic off alignment | Align reads to `__u64` boundaries |

```bash
# Get detailed verifier log
bpftool prog load prog.bpf.o /sys/fs/bpf/prog type kprobe \
    2>&1 | head -100

# Check loaded programs
bpftool prog list
bpftool prog dump xlated id 42
```

### 6. XDP programs

```c
// xdp_drop_icmp.bpf.c
#include <vmlinux.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_endian.h>

SEC("xdp")
int xdp_filter(struct xdp_md *ctx)
{
    void *data_end = (void *)(long)ctx->data_end;
    void *data     = (void *)(long)ctx->data;
    struct ethhdr *eth = data;

    if ((void *)(eth + 1) > data_end)
        return XDP_PASS;

    if (bpf_ntohs(eth->h_proto) != ETH_P_IP)
        return XDP_PASS;

    struct iphdr *ip = (void *)(eth + 1);
    if ((void *)(ip + 1) > data_end)
        return XDP_PASS;

    if (ip->protocol == IPPROTO_ICMP)
        return XDP_DROP;

    return XDP_PASS;
}
char LICENSE[] SEC("license") = "GPL";
```

```bash
# Attach XDP program to interface
ip link set dev eth0 xdp obj xdp_drop_icmp.bpf.o sec xdp
# Remove
ip link set dev eth0 xdp off
# Use native (driver) mode for best performance
ip link set dev eth0 xdp obj prog.bpf.o sec xdp mode native
```

XDP return codes: `XDP_PASS`, `XDP_DROP`, `XDP_TX` (hairpin), `XDP_REDIRECT`.

### 7. CO-RE — compile once, run everywhere

CO-RE (Compile Once - Run Everywhere) uses BTF type info to relocate field accesses at load time.

```c
// Use BTF-based field access (CO-RE aware)
#include <vmlinux.h>        // generated from running kernel's BTF
#include <bpf/bpf_core_read.h>

SEC("kprobe/tcp_connect")
int trace_connect(struct pt_regs *ctx)
{
    struct sock *sk = (struct sock *)PT_REGS_PARM1(ctx);
    u16 dport = BPF_CORE_READ(sk, __sk_common.skc_dport);
    // BPF_CORE_READ relocates the field offset at load time
    bpf_printk("connect to port %d\n", bpf_ntohs(dport));
    return 0;
}
```

```bash
# Generate vmlinux.h from running kernel
bpftool btf dump file /sys/kernel/btf/vmlinux format c > vmlinux.h

# Verify BTF is enabled
ls /sys/kernel/btf/vmlinux
```

For the full map types reference, see [references/ebpf-map-types.md](references/ebpf-map-types.md).

## Related skills

- Use `skills/observability/ebpf-rust` for Aya framework Rust eBPF programs
- Use `skills/profilers/linux-perf` for perf-based tracing without eBPF
- Use `skills/runtimes/binary-hardening` for seccomp-bpf syscall filtering
- Use `skills/low-level-programming/linux-kernel-modules` for kernel module development
