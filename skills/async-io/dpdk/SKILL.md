---
name: dpdk
description: DPDK skill for userspace packet I/O. Use when initializing EAL, configuring PMD drivers, using mbuf pools and rte_ring, setting up huge pages, RSS, or testpmd validation. Activates on queries about DPDK, EAL, rte_eth_rx_burst, hugepages, PMD, or testpmd.
---

# DPDK

## Purpose

Guide agents through DPDK (Data Plane Development Kit): EAL initialization, poll-mode driver (PMD) concepts, `rte_eth_rx_burst`/`tx_burst`, mbuf mempools, `rte_ring` queues, huge page setup, RSS configuration, testpmd validation, QEMU virtio testing, and pipeline vs run-to-completion models.

## When to Use

- Building a userspace packet forwarder bypassing the kernel network stack
- Achieving line-rate on 10/25/100 GbE NICs
- Prototyping NFV/vSwitch data plane components
- Testing NIC configuration with testpmd before custom code
- Comparing DPDK throughput with kernel networking or AF_XDP
- Running DPDK in VMs with virtio for development

## Workflow

### 1. Huge pages setup

```bash
# 2MB hugepages (common)
echo 1024 | sudo tee /sys/kernel/mm/hugepages/hugepages-2048kB/nr_hugepages

# 1GB hugepages (better TLB perf on large memory)
echo 4 | sudo tee /sys/kernel/mm/hugepages/hugepages-1048576kB/nr_hugepages

# Mount hugetlbfs
sudo mkdir -p /mnt/huge
sudo mount -t hugetlbfs nodev /mnt/huge

# Verify
grep Huge /proc/meminfo
```

DPDK EAL maps hugepages at startup — insufficient pages cause init failure.

### 2. EAL initialization

```c
#include <rte_eal.h>
#include <rte_ethdev.h>

int main(int argc, char **argv) {
    int ret = rte_eal_init(argc, argv);
    if (ret < 0)
        rte_exit(EXIT_FAILURE, "EAL init failed\n");
    // argc/argv adjusted — remaining args for app
    return run_dataplane(argc - ret, argv + ret);
}
```

```bash
# Typical EAL args
./dpdk_app -l 0-3 -n 4 --huge-dir=/mnt/huge -- -p 0x3

# Flags:
# -l 0-3     — cores for DPDK (lcore mask)
# -n 4       — memory channels
# --proc-type=primary
# --file-prefix=myapp  — multi-instance
```

### 3. Port configuration and PMD

```c
#include <rte_ethdev.h>

#define RX_RING_SIZE 1024
#define TX_RING_SIZE 1024
#define NUM_MBUFS    8191
#define MBUF_CACHE   250
#define BURST_SIZE   32

static const struct rte_eth_conf port_conf = {
    .rxmode = { .max_lro_pkt_size = RTE_ETHER_MAX_LEN },
};

struct rte_mempool *mbuf_pool;

int port_init(uint16_t port) {
    mbuf_pool = rte_pktmbuf_pool_create("MBUF_POOL", NUM_MBUFS,
        MBUF_CACHE, 0, RTE_MBUF_DEFAULT_BUF_SIZE, rte_socket_id());

    struct rte_eth_rxconf rxq_conf = dev_info.default_rxconf;
    ret = rte_eth_rx_queue_setup(port, 0, RX_RING_SIZE,
        rte_eth_dev_socket_id(port), &rxq_conf, mbuf_pool);
    // ... tx queue setup ...
    ret = rte_eth_dev_start(port);
    rte_eth_promiscuous_enable(port);
    return 0;
}
```

```bash
# List available PMDs
dpdk-devbind.py --status

# Bind NIC to vfio-pci (required for physical NICs)
sudo modprobe vfio-pci
sudo dpdk-devbind.py --bind=vfio-pci 0000:03:00.0
```

### 4. RX/TX burst loop

```c
static inline void lcore_main(void) {
    const uint16_t port = 0;
    struct rte_mbuf *bufs[BURST_SIZE];

    while (1) {
        uint16_t nb_rx = rte_eth_rx_burst(port, 0, bufs, BURST_SIZE);
        if (nb_rx == 0)
            continue;

        uint16_t nb_tx = rte_eth_tx_burst(port, 0, bufs, nb_rx);
        // Free unsent mbufs
        if (nb_tx < nb_rx) {
            for (uint16_t i = nb_tx; i < nb_rx; i++)
                rte_pktmbuf_free(bufs[i]);
        }
    }
}
```

Poll-mode: no interrupts — cores spin for packets. Assign one core per queue for scaling.

### 5. rte_ring for inter-core queues

```c
#include <rte_ring.h>

struct rte_ring *ring = rte_ring_create("RX_RING", 1024,
    rte_socket_id(), RING_F_SP_ENQ | RING_F_SC_DEQ);

// Producer (RX core)
rte_ring_enqueue_bulk(ring, (void **)bufs, nb_rx, NULL);

// Consumer (worker core)
uint16_t nb_deq = rte_ring_dequeue_bulk(ring, (void **)bufs, BURST_SIZE, NULL);
```

### 6. RSS configuration

```c
static const struct rte_eth_rss_conf rss_conf = {
    .rss_key = NULL,
    .rss_hf = RTE_ETH_RSS_IP | RTE_ETH_RSS_TCP | RTE_ETH_RSS_UDP,
};

struct rte_eth_conf port_conf = {
    .rxmode = { .mq_mode = RTE_ETH_MQ_RX_RSS },
    .rx_adv_conf = { .rss_conf = rss_conf },
};
```

Distributes flows across RX queues — map queues to cores for parallelism.

### 7. testpmd validation

```bash
# Build testpmd
cd dpdk/build
ninja -C build dpdk-testpmd

# Forward mode test
sudo ./build/app/dpdk-testpmd -l 0-3 -n 4 -- -i --forward-mode=io

testpmd> show port stats all
testpmd> start tx_first
testpmd> show port stats all
```

Forward modes: `io`, `mac`, `macswap`, `flowgen` for throughput testing.

### 8. QEMU virtio testing

```bash
qemu-system-x86_64 \
  -cpu host -m 4096 -smp 4 \
  -netdev user,id=net0 \
  -device virtio-net-pci,netdev=net0,mq=on,vectors=10 \
  -object memory-backend-file,id=mem,size=2G,mem-path=/dev/hugepages,share=on \
  -numa node,memdev=mem \
  ...
```

Inside VM: bind virtio PCI to `vfio-pci` or use `vhost-user` for higher perf.

### 9. Pipeline vs run-to-completion

```
Run-to-completion (simple)
├── One core: RX → process → TX
└── Good for low latency, simple logic

Pipeline (scaled)
├── Core 0: RX → ring
├── Core 1-N: process from ring → ring
└── Core N+1: TX
    └── Better for complex per-packet processing
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| EAL: Cannot init hugepages | Insufficient hugepages | Increase `nr_hugepages`; mount hugetlbfs |
| `No probed ethernet devices` | NIC not bound to DPDK driver | `dpdk-devbind.py --bind=vfio-pci` |
| RX drops climbing | Mbuf pool exhausted | Increase `NUM_MBUFS`; check leak (free mbufs) |
| 0 Mbps in testpmd | Port not started | `start` in testpmd; check link status |
| VFIO permission error | No IOMMU group access | `chmod`/`chown` vfio group; enable IOMMU |
| Poor multi-core scaling | RSS not distributing | Enable RSS; multiple RX queues |

## Related Skills

- `skills/async-io/af-xdp` — lighter-weight XDP alternative
- `skills/async-io/io-uring` — kernel async I/O comparison
- `skills/observability/ebpf` — XDP programs redirecting to AF_XDP
- `skills/virtualization/qemu-kvm` — QEMU setup for virtio testing
- `skills/allocators/numa-programming` — NUMA-aware DPDK memory
- `skills/profilers/linux-perf` — profile DPDK lcore hot paths