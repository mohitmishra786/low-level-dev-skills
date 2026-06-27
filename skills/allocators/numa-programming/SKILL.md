---
name: numa-programming
description: NUMA programming skill for multi-socket memory locality. Use when detecting NUMA topology, binding processes with numactl, using libnuma API, building NUMA-aware data structures, or measuring remote access penalties. Activates on queries about numactl, libnuma, NUMA topology, mbind, lstopo, or remote memory access.
---

# NUMA Programming

## Purpose

Guide agents through NUMA-aware programming: topology detection with `numactl` and sysfs, libnuma API (`numa_alloc_onnode`, `mbind`, `set_mempolicy`), process binding with `numactl`, NUMA-aware data structures, remote access diagnosis with `perf stat`, and `lstopo` visualization.

## When to Use

- Multi-socket server shows poor scaling despite low CPU utilization
- Memory bandwidth saturation on one NUMA node
- Binding database or cache process to local memory
- Designing per-node freelists or sharded allocators
- Measuring remote vs local memory access latency
- Tuning HPC, DPDK, or custom allocator for socket locality

## Workflow

### 1. Topology detection

```bash
# Hardware topology summary
numactl --hardware

# Detailed topology with distances
lstopo --of console

# sysfs nodes
ls /sys/devices/system/node/
cat /sys/devices/system/node/node0/meminfo
cat /sys/devices/system/node/node0/cpulist
```

Typical output:

```
available: 2 nodes (0-1)
node 0 cpus: 0-15
node 0 size: 65536 MB
node 1 cpus: 16-31
node 1 size: 65536 MB
node distances:
node   0   1
  0:  10  21
  1:  21  10
```

Distance 10 = local, higher = remote (cross-socket).

### 2. Process binding with numactl

```bash
# Bind to node 0 CPUs and memory
numactl --cpunodebind=0 --membind=0 ./myapp

# Interleave memory across all nodes
numactl --interleave=all ./myapp

# Preferred node (fallback if full)
numactl --preferred=0 ./myapp

# Show process NUMA policy
numactl --show
cat /proc/self/numa_maps
```

### 3. libnuma API

```c
#include <numa.h>
#include <numaif.h>
#include <stdio.h>

int main(void) {
    if (numa_available() < 0) {
        fprintf(stderr, "NUMA not available\n");
        return 1;
    }
    int node = numa_node_of_cpu(0);
    printf("CPU 0 on node %d\n", node);

    // Allocate on specific node
    size_t size = 1024 * 1024 * 1024;
    void *mem = numa_alloc_onnode(size, 0);
    if (!mem) return 1;

    // Bind existing memory
    unsigned long nodemask = 1UL << 0;
    mbind(mem, size, MPOL_BIND, &nodemask, sizeof(nodemask) * 8, 0);

    numa_free(mem, size);
    return 0;
}
```

```bash
gcc -o numa_test numa_test.c -lnuma
```

| API | Purpose |
|-----|---------|
| `numa_alloc_onnode` | Allocate on specific node |
| `numa_alloc_local` | Allocate on current CPU's node |
| `mbind` | Set policy on existing mapping |
| `set_mempolicy` | Default policy for subsequent allocs |
| `move_pages` | Migrate pages to target node |

### 4. NUMA-aware data structures

```c
// Per-node freelist — avoids cross-node synchronization
#define MAX_NODES 8
struct per_node_pool {
    void *free_list[MAX_NODES];
    int   node_count;
};

void *pool_alloc_numa(struct per_node_pool *p) {
    int node = numa_node_of_cpu(sched_getcpu());
    void *blk = p->free_list[node];
    if (blk) {
        p->free_list[node] = *(void **)blk;
        return blk;
    }
    return numa_alloc_onnode(BLOCK_SIZE, node);
}
```

Pin threads to cores on the same node as their pool.

### 5. Thread affinity alignment

```bash
# Pin thread 0 to CPU 0 (node 0), allocate on node 0
numactl --cpunodebind=0 --membind=0 ./worker --id 0
numactl --cpunodebind=1 --membind=1 ./worker --id 1
```

```c
#include <pthread.h>
#include <sched.h>

cpu_set_t cpuset;
CPU_ZERO(&cpuset);
CPU_SET(target_cpu, &cpuset);
pthread_setaffinity_np(pthread_self(), sizeof(cpuset), &cpuset);
```

### 6. Remote access diagnosis

```bash
# Cache misses often spike with remote memory
perf stat -e cache-misses,cache-references,node-load-misses \
    numactl --cpunodebind=0 --membind=1 ./myapp

# Compare local vs remote binding
perf stat numactl --cpunodebind=0 --membind=0 ./myapp
perf stat numactl --cpunodebind=0 --membind=1 ./myapp
```

```bash
# NUMA hit/miss stats (if available)
perf stat -e node-loads,node-load-misses,node-stores ./myapp
```

### 7. Measuring remote penalty

```c
// Microbenchmark: touch 1GB on local vs remote node
clock_t start = clock();
for (size_t i = 0; i < size; i += 4096)
    sum += ((char *)mem)[i];
```

Expect 1.5–3x slowdown for remote access depending on interconnect (QPI/UPI/Infinity Fabric).

### 8. lstopo visualization

```bash
# Graphical (if X11)
lstopo

# Text with memory/PCI
lstopo --of ascii

# Export for documentation
lstopo file.png
```

Shows: NUMA nodes, cores, caches, PCI devices — essential for DPDK NIC placement.

### 9. Decision tree

```
Poor scaling on multi-socket?
├── Check numactl --hardware
├── Verify thread and memory on same node
├── perf stat node-load-misses
├── Remote misses high?
│   ├── numactl --membind=local
│   └── Per-node data partitioning
└── Still slow → memory bandwidth bound; reduce sharing
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| OOM on one node despite free RAM elsewhere | MPOL_BIND too strict | Use `--preferred` or interleave |
| 2x slower after scaling threads | Remote memory access | `numactl --membind` matching CPU node |
| Inconsistent benchmark results | OS migrated pages | `mbind` MPOL_BIND; mlock if needed |
| DPDK NIC on wrong socket | PCI far from CPU | `lstopo`; bind EAL to local socket |
| libnuma not found | Package not installed | `apt install libnuma-dev` |
| First-touch policy surprise | Alloc on node 0, run on node 1 | Allocate from bound thread |

## Related Skills

- `skills/allocators/custom-allocators` — per-node pool allocators
- `skills/async-io/dpdk` — `rte_malloc_socket`, NIC NUMA locality
- `skills/hpc/mpi` — MPI process binding per NUMA node
- `skills/profilers/hardware-counters` — cache miss measurement
- `skills/profilers/linux-perf` — perf NUMA events
- `skills/low-level-programming/cpu-cache-opt` — cache locality fundamentals