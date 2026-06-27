---
name: rdma-verbs
description: RDMA verbs skill for InfiniBand and RoCE programming. Use when using libibverbs API, creating queue pairs, RDMA read/write operations, or benchmarking with perftest. Activates on queries about libibverbs, ibv_reg_mr, ibv_create_qp, RDMA, RoCE, ib_send_bw, or rdma-sys.
---

# RDMA Verbs

## Purpose

Guide agents through RDMA programming with libibverbs: one-sided vs two-sided operations, RC/UC/UD transports, device setup (`ibv_get_device_list`, protection domains, memory registration, completion queues, queue pairs), work requests and completions, RoCE vs InfiniBand, perftest benchmarking, and Rust `rdma-sys` bindings.

## When to Use

- Building ultra-low-latency storage or database networking
- Bypassing CPU for remote memory access (one-sided RDMA)
- Setting up RoCE on Ethernet fabrics
- Benchmarking network fabric with perftest tools
- Integrating RDMA into MPI or custom RPC systems
- Debugging RDMA connection and completion errors

## Workflow

### 1. RDMA concepts

```
RDMA stack
├── Application (libibverbs)
├── Kernel RDMA driver (mlx5, rdma_rxe)
├── NIC/HCA hardware
└── Fabric (InfiniBand or RoCE/Ethernet)

Operation types
├── Two-sided: Send/Recv (both sides participate)
└── One-sided: RDMA Read/Write (remote CPU not involved)
```

Transports:

| Type | Reliable | Connection | Use |
|------|----------|------------|-----|
| RC (Reliable Connected) | Yes | 1:1 QP pair | General purpose |
| UC (Unreliable Connected) | No | 1:1 | Multicast-like |
| UD (Unreliable Datagram) | No | Many:Many | MPI, discovery |

### 2. Device discovery

```bash
# List RDMA devices
ibv_devices
ibv_devinfo

# RoCE link status
rdma link show
ibstat

# Perftest prerequisites
modprobe ib_umad
```

### 3. Minimal libibverbs setup

```c
#include <infiniband/verbs.h>
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int num_devices;
    struct ibv_device **dev_list = ibv_get_device_list(&num_devices);
    if (!dev_list || num_devices == 0) {
        fprintf(stderr, "No RDMA devices\n");
        return 1;
    }

    struct ibv_context *ctx = ibv_open_device(dev_list[0]);
    struct ibv_pd *pd = ibv_alloc_pd(ctx);

    char buf[4096];
    struct ibv_mr *mr = ibv_reg_mr(pd, buf, sizeof(buf),
        IBV_ACCESS_LOCAL_WRITE | IBV_ACCESS_REMOTE_WRITE);

    struct ibv_cq *cq = ibv_create_cq(ctx, 10, NULL, NULL, 0);

    struct ibv_qp_init_attr qp_attr = {
        .send_cq = cq,
        .recv_cq = cq,
        .cap = { .max_send_wr = 10, .max_recv_wr = 10,
                 .max_send_sge = 1, .max_recv_sge = 1 },
        .qp_type = IBV_QPT_RC,
    };
    struct ibv_qp *qp = ibv_create_qp(pd, &qp_attr);

    printf("QP num %u, MR lkey %u rkey %u\n",
           qp->qp_num, mr->lkey, mr->rkey);

    ibv_destroy_qp(qp);
    ibv_dereg_mr(mr);
    ibv_destroy_cq(cq);
    ibv_dealloc_pd(pd);
    ibv_close_device(ctx);
    ibv_free_device_list(dev_list);
    return 0;
}
```

```bash
gcc -o rdma_setup rdma_setup.c -libverbs
```

### 4. Connection setup (RC)

RC requires exchanging QP info (lid, gid, qp_num, psn) out-of-band:

```c
// Simplified: exchange via TCP socket before RDMA
struct qp_info {
    uint16_t lid;
    uint32_t qpn;
    uint32_t psn;
    union ibv_gid gid;
};

// Modify QP to INIT → RTR → RTS states
struct ibv_qp_attr attr = { .qp_state = IBV_QPS_INIT, ... };
ibv_modify_qp(qp, &attr, IBV_QP_STATE | IBV_QP_PKEY_INDEX | ...);
// RTR: set path_mtu, dest_qp_num, rq_psn, ah_attr
// RTS: set sq_psn, timeout, retry_cnt
```

Use rdmacm (`librdmacm`) for simplified connection management:

```c
#include <rdma/rdma_cma.h>
// rdma_create_event_channel, rdma_connect, rdma_accept
```

### 5. Send/Recv (two-sided)

```c
// Post receive
struct ibv_recv_wr recv_wr = {}, *bad_wr;
struct ibv_sge recv_sge = { .addr = (uint64_t)recv_buf, .length = 4096, .lkey = mr->lkey };
recv_wr.wr_id = 1;
recv_wr.sg_list = &recv_sge;
recv_wr.num_sge = 1;
ibv_post_recv(qp, &recv_wr, &bad_wr);

// Post send
struct ibv_send_wr send_wr = {}, *bad_send;
struct ibv_sge send_sge = { .addr = (uint64_t)send_buf, .length = msg_len, .lkey = mr->lkey };
send_wr.wr_id = 2;
send_wr.opcode = IBV_WR_SEND;
send_wr.sg_list = &send_sge;
send_wr.num_sge = 1;
ibv_post_send(qp, &send_wr, &bad_send);

// Poll completion
struct ibv_wc wc;
while (ibv_poll_cq(cq, 1, &wc) == 0);
if (wc.status != IBV_WC_SUCCESS)
    fprintf(stderr, "WC error: %s\n", ibv_wc_status_str(wc.status));
```

### 6. RDMA Write (one-sided)

```c
struct ibv_send_wr wr = {}, *bad;
struct ibv_sge sge = { .addr = (uint64_t)local_buf, .length = len, .lkey = local_mr->lkey };

wr.wr_id = 3;
wr.opcode = IBV_WR_RDMA_WRITE;
wr.send_flags = IBV_SEND_SIGNALED;
wr.sg_list = &sge;
wr.num_sge = 1;
wr.wr.rdma.remote_addr = remote_addr;  // from peer exchange
wr.wr.rdma.rkey = remote_rkey;

ibv_post_send(qp, &wr, &bad);
```

Remote CPU is not interrupted — data appears in remote memory directly.

### 7. RoCE vs InfiniBand

| | InfiniBand | RoCE |
|---|------------|------|
| Physical | Dedicated IB fabric | Ethernet (lossless DCB/PFC) |
| LID/GID | Both | Primarily GID (IPv6-like) |
| Setup | Subnet manager | DCB config, PFC, ECN |

```bash
# RoCEv2 GID
cat /sys/class/infiniband/mlx5_0/ports/1/gids/3
```

### 8. perftest benchmarking

```bash
# Server
ib_send_bw -d mlx5_0 -x 3

# Client
ib_send_bw -d mlx5_0 -x 3 <server_ip>

# Latency
ib_send_lat -d mlx5_0 <server_ip>

# RDMA write bandwidth
ib_write_bw -d mlx5_0 <server_ip>
```

### 9. Rust rdma-sys

```toml
# Cargo.toml
rdma-sys = "0.1"
```

Wrap libibverbs with safe abstractions or use `async-rdma` crate for higher-level API.

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ibv_reg_mr` fails | Memory limit or wrong permissions | Check `ulimit -l`; set access flags |
| WC status `rem_inv_req` | Bad rkey/addr | Re-exchange MR info after reconnect |
| QP RTS failure | Wrong PSN or path | Verify lid/gid match; subnet manager |
| RoCE packet loss | No PFC on switches | Enable lossless Ethernet; DCQCN |
| Low bandwidth | Small message size | Increase MTU; use larger WRs |
| Device not found | Driver not loaded | `modprobe mlx5_ib`; check `ibv_devices` |

## Related Skills

- `skills/hpc/mpi` — MPI often uses RDMA under UCX/IB verbs
- `skills/async-io/dpdk` — alternative userspace networking
- `skills/allocators/numa-programming` — NUMA-local MR registration
- `skills/profilers/linux-perf` — CPU-side RDMA completion polling
- `skills/kernel/device-drivers` — RDMA driver internals
- `skills/virtualization/qemu-kvm` — SR-IOV VF passthrough for RDMA