---
name: af-xdp
description: AF_XDP skill for high-performance XDP sockets. Use when creating AF_XDP sockets, configuring UMEM and XSK rings, XDP_REDIRECT programs, copy vs zero-copy mode, or comparing with DPDK. Activates on queries about AF_XDP, xsk_umem, XDP_REDIRECT, libbpf xsk, or zero-copy XDP.
---

# AF_XDP

## Purpose

Guide agents through AF_XDP sockets for high-performance packet I/O: socket creation, UMEM setup, fill/completion/RX/TX rings, XDP programs with `XDP_REDIRECT` to XSK, copy vs zero-copy modes, libbpf helpers, performance comparison with DPDK, and production use cases.

## When to Use

- Building a userspace packet processor with lower overhead than raw sockets
- Redirecting XDP-filtered traffic to userspace without DPDK complexity
- Implementing a custom load balancer or IDS dataplane
- Comparing zero-copy vs copy mode on your NIC/driver
- Integrating with existing libbpf/XDP infrastructure
- Need kernel cooperation (firewall rules) plus userspace processing

## Workflow

### 1. Architecture overview

```
NIC → XDP program (BPF) → XDP_REDIRECT → AF_XDP socket → userspace
                ↓
           XDP_DROP/PASS/TX
```

Components:
- **UMEM** — shared memory region for frames
- **Fill ring** — userspace provides empty frame addresses to kernel
- **Completion ring** — kernel returns completed TX frames
- **RX ring** — kernel delivers received packets
- **TX ring** — userspace submits packets for transmission

### 2. UMEM and XSK socket creation

```c
#include <bpf/xsk.h>
#include <bpf/libbpf.h>
#include <xdp/xsk.h>

#define NUM_FRAMES     4096
#define FRAME_SIZE     XSK_UMEM__DEFAULT_FRAME_SIZE
#define RX_BATCH_SIZE  64

struct xsk_umem_info {
    struct xsk_ring_prod fill;
    struct xsk_ring_cons comp;
    struct xsk_umem *umem;
    void *buffer;
};

struct xsk_socket_info {
    struct xsk_ring_cons rx;
    struct xsk_ring_prod tx;
    struct xsk_socket *xsk;
};

int xsk_setup(struct xsk_umem_info *umem_info,
              struct xsk_socket_info *xsk_info,
              int ifindex, int queue_id, int xsk_flags)
{
    umem_info->buffer = mmap(NULL, NUM_FRAMES * FRAME_SIZE,
        PROT_READ | PROT_WRITE, MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);

    struct xsk_umem_config umem_cfg = {
        .fill_size = XSK_RING_PROD__DEFAULT_NUM_DESCS,
        .comp_size = XSK_RING_CONS__DEFAULT_NUM_DESCS,
        .frame_size = FRAME_SIZE,
        .frame_headroom = XSK_UMEM__DEFAULT_FRAME_HEADROOM,
        .flags = 0,
    };

    int ret = xsk_umem__create(&umem_info->umem, umem_info->buffer,
        NUM_FRAMES * FRAME_SIZE, &umem_info->fill, &umem_info->comp,
        &umem_cfg);
    if (ret)
        return ret;

    struct xsk_socket_config xsk_cfg = {
        .rx_size = XSK_RING_CONS__DEFAULT_NUM_DESCS,
        .tx_size = XSK_RING_PROD__DEFAULT_NUM_DESCS,
        .libbpf_flags = XSK_LIBBPF_FLAGS__INHIBIT_PROG_LOAD,
        .xdp_flags = XDP_FLAGS_UPDATE_IF_NOEXIST,
        .bind_flags = xsk_flags,  // XDP_ZEROCOPY or XDP_COPY
    };

    return xsk_socket__create(&xsk_info->xsk, "eth0", queue_id,
        umem_info->umem, &xsk_info->rx, &xsk_info->tx, &xsk_cfg);
}
```

### 3. Populate fill ring

```c
void populate_fill_ring(struct xsk_umem_info *umem) {
    uint32_t idx;
    uint32_t ret = xsk_ring_prod__reserve(&umem->fill, RX_BATCH_SIZE, &idx);
    for (uint32_t i = 0; i < ret; i++)
        *xsk_ring_prod__fill_addr(&umem->fill, idx + i) = i * FRAME_SIZE;
    xsk_ring_prod__submit(&umem->fill, ret);
}
```

Must keep fill ring stocked — kernel drops packets if no buffers available.

### 4. XDP redirect program

```c
// xdp_redirect.c
#include <linux/bpf.h>
#include <bpf/bpf_helpers.h>

struct {
    __uint(type, BPF_MAP_TYPE_XSKMAP);
    __uint(max_entries, 64);
    __type(key, int);
    __type(value, int);
} xsks_map SEC(".maps");

SEC("xdp")
int xdp_redirect_prog(struct xdp_md *ctx)
{
    int index = ctx->rx_queue_index;
    return bpf_redirect_map(&xsks_map, index, 0);
}
```

```bash
# Load and attach
bpftool prog load xdp_redirect.o /sys/fs/bpf/xdp_redirect
ip link set dev eth0 xdp obj xdp_redirect.o sec xdp

# Pin xsks_map and update with socket fd
```

### 5. RX processing loop

```c
while (running) {
    uint32_t idx_rx = 0, rcvd;
    rcvd = xsk_ring_cons__peek(&xsk_info->rx, RX_BATCH_SIZE, &idx_rx);
    if (!rcvd)
        continue;

    for (uint32_t i = 0; i < rcvd; i++) {
        const struct xdp_desc *desc = xsk_ring_cons__rx_desc(&xsk_info->rx, idx_rx + i);
        uint64_t addr = desc->addr;
        uint32_t len = desc->len;
        uint8_t *pkt = (uint8_t *)xsk_umem__get_data(umem_info->buffer, addr);
        process_packet(pkt, len);
    }
    xsk_ring_cons__release(&xsk_info->rx, rcvd);

    // Return frames to fill ring
    refill_fill_ring(umem_info, rcvd);
}
```

### 6. Copy vs zero-copy

| Mode | Flag | Requirements |
|------|------|--------------|
| Copy | `XDP_COPY` (default) | Any driver; kernel copies to UMEM |
| Zero-copy | `XDP_ZEROCOPY` | Driver support (i40e, ixgbe, mlx5, etc.) |

```bash
# Check driver ZC support
ethtool -i eth0
# Kernel log on bind:
dmesg | grep xsk
# "Zero-copy enabled" or "Copy mode"
```

Zero-copy: NIC DMAs directly into UMEM frames — lowest latency. Copy mode: safer, universal.

### 7. libbpf xsk.h helpers

```bash
# Modern libbpf includes xsk API
pkg-config --libs libbpf
# -lbpf -lxdp (if separate libxdp installed)
```

Key functions:
- `xsk_umem__create` / `xsk_umem__delete`
- `xsk_socket__create` / `xsk_socket__delete`
- `xsk_umem__get_data` — pointer from frame address
- `xsk_socket__fd` — for epoll/poll integration

### 8. Performance vs DPDK

| Factor | AF_XDP | DPDK |
|--------|--------|------|
| Setup complexity | Moderate | High (hugepages, EAL) |
| Kernel integration | XDP filter in kernel | Full bypass |
| Typical throughput | Near-DPDK with ZC | Highest |
| NIC binding | Stays on kernel driver | vfio/uio binding |
| Use case fit | Filter + selective userspace | Full dataplane takeover |

### 9. Production patterns

```
Common deployments
├── CDN edge cache — XDP_DROP junk, redirect cacheable to XSK
├── DDoS mitigation — XDP_DROP attack patterns
├── Load balancer — XDP_TX hairpin or redirect to backend XSK
└── Observability — mirror subset to XSK for analysis
```

```bash
# Multi-queue: one XSK per RX queue, pinned to CPU
taskset -c 2 ./xsk_app --queue 2
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| No packets in RX ring | XDP program not redirecting | Verify xsks_map entry for queue index |
| `EBUSY` on socket create | XDP already attached | `ip link set dev eth0 xdp off` first |
| Zero-copy fallback to copy | Driver lacks ZC | Check dmesg; use supported NIC |
| Packet drops | Fill ring empty | Aggressive refill; increase NUM_FRAMES |
| TX not working | Completion ring not polled | Process comp ring to recycle frames |
| Permission denied | CAP_NET_RAW needed | Run with appropriate capabilities |

## Related Skills

- `skills/observability/ebpf` — XDP/BPF program development
- `skills/async-io/dpdk` — full kernel bypass alternative
- `skills/async-io/io-uring` — async I/O for non-packet workloads
- `skills/observability/ebpf-rust` — Aya for XDP in Rust
- `skills/profilers/linux-perf` — profile XDP program CPU usage
- `skills/allocators/numa-programming` — NUMA-local UMEM allocation