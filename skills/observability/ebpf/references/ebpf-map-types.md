# eBPF Map Types Reference

Source: https://docs.kernel.org/bpf/maps.html

## Table of Contents

1. [Core Map Types](#core-map-types)
2. [Map Operations](#map-operations)
3. [Ringbuf vs Perf Event Array](#ringbuf-vs-perf-event-array)
4. [Map Pinning](#map-pinning)

## Core Map Types

| Type | Max Key | Max Value | Notes |
|------|---------|-----------|-------|
| `BPF_MAP_TYPE_HASH` | 512 bytes | 65536 bytes | General-purpose hash map |
| `BPF_MAP_TYPE_ARRAY` | u32 | 65536 bytes | Fixed-size, pre-allocated, zero-initialized |
| `BPF_MAP_TYPE_PROG_ARRAY` | u32 | 4 bytes (prog fd) | Tail call table |
| `BPF_MAP_TYPE_PERF_EVENT_ARRAY` | u32 | 4 bytes | Perf ring buffer per CPU |
| `BPF_MAP_TYPE_PERCPU_HASH` | 512 bytes | 65536 bytes | Per-CPU values, no locking needed |
| `BPF_MAP_TYPE_PERCPU_ARRAY` | u32 | 65536 bytes | Per-CPU array |
| `BPF_MAP_TYPE_STACK_TRACE` | u32 | stack IDs | Stack trace storage |
| `BPF_MAP_TYPE_CGROUP_ARRAY` | u32 | 4 bytes | cgroup file descriptor |
| `BPF_MAP_TYPE_LRU_HASH` | 512 bytes | 65536 bytes | LRU eviction (kernel ≥4.10) |
| `BPF_MAP_TYPE_LRU_PERCPU_HASH` | 512 bytes | 65536 bytes | Per-CPU LRU hash |
| `BPF_MAP_TYPE_LPM_TRIE` | variable | 65536 bytes | Longest prefix match (for IPs) |
| `BPF_MAP_TYPE_ARRAY_OF_MAPS` | u32 | 4 bytes (map fd) | Inner maps (map-in-map) |
| `BPF_MAP_TYPE_HASH_OF_MAPS` | 512 bytes | 4 bytes (map fd) | Inner maps (map-in-map) |
| `BPF_MAP_TYPE_DEVMAP` | u32 | 4 bytes | XDP device redirect |
| `BPF_MAP_TYPE_SOCKMAP` | u32 | 4 bytes | Socket redirect (BPF_SK_MSG) |
| `BPF_MAP_TYPE_CPUMAP` | u32 | 4 bytes | XDP CPU redirect |
| `BPF_MAP_TYPE_XSKMAP` | u32 | 4 bytes | AF_XDP socket redirect |
| `BPF_MAP_TYPE_SOCKHASH` | variable | 4 bytes | Socket hash redirect |
| `BPF_MAP_TYPE_CGROUP_STORAGE` | cgroup id | 65536 bytes | Per-cgroup storage |
| `BPF_MAP_TYPE_RINGBUF` | — | — | Shared ring buffer (kernel ≥5.8) |
| `BPF_MAP_TYPE_INODE_STORAGE` | inode ptr | 65536 bytes | Per-inode local storage |
| `BPF_MAP_TYPE_TASK_STORAGE` | task ptr | 65536 bytes | Per-task local storage |
| `BPF_MAP_TYPE_BLOOM_FILTER` | — | — | Probabilistic membership test |

## Map Operations

### From eBPF program (kernel side)

```c
// Lookup
void *bpf_map_lookup_elem(void *map, const void *key);

// Update (flags: BPF_ANY, BPF_NOEXIST, BPF_EXIST)
int bpf_map_update_elem(void *map, const void *key, const void *value, u64 flags);

// Delete
int bpf_map_delete_elem(void *map, const void *key);

// Atomic add (ARRAY and PERCPU_ARRAY only)
// Use __sync_fetch_and_add() for atomic increment
```

### From userspace (libbpf)

```c
#include <bpf/libbpf.h>

struct bpf_map *map = bpf_object__find_map_by_name(obj, "my_map");
int map_fd = bpf_map__fd(map);

// Lookup
bpf_map_lookup_elem(map_fd, &key, &value);

// Update
bpf_map_update_elem(map_fd, &key, &value, BPF_ANY);

// Delete
bpf_map_delete_elem(map_fd, &key);

// Iterate all keys
void *prev_key = NULL;
while (bpf_map_get_next_key(map_fd, prev_key, &key) == 0) {
    bpf_map_lookup_elem(map_fd, &key, &value);
    prev_key = &key;
}
```

## Ringbuf vs Perf Event Array

| Feature | BPF_MAP_TYPE_RINGBUF | BPF_MAP_TYPE_PERF_EVENT_ARRAY |
|---------|---------------------|-------------------------------|
| Kernel version | ≥5.8 | ≥4.3 |
| Memory sharing | Single shared buffer | Per-CPU buffers |
| Variable-size records | Yes | Yes (with padding) |
| Overhead | Lower | Higher |
| Ordering | Preserved across CPUs | Not preserved |
| API | `bpf_ringbuf_reserve/submit` | `bpf_perf_event_output` |

```c
// Ringbuf usage (preferred)
struct {
    __uint(type, BPF_MAP_TYPE_RINGBUF);
    __uint(max_entries, 256 * 1024); // 256KB
} events SEC(".maps");

SEC("tracepoint/syscalls/sys_enter_read")
int trace(void *ctx)
{
    struct event *e = bpf_ringbuf_reserve(&events, sizeof(*e), 0);
    if (!e) return 0;
    e->pid = bpf_get_current_pid_tgid() >> 32;
    bpf_get_current_comm(&e->comm, sizeof(e->comm));
    bpf_ringbuf_submit(e, 0);
    return 0;
}
```

## Map Pinning

Pin maps to the BPF filesystem to share between programs:

```bash
# Pin via bpftool
bpftool map pin id 42 /sys/fs/bpf/my_map

# Load pinned map in libbpf
int map_fd = bpf_obj_get("/sys/fs/bpf/my_map");

# Mount bpffs if needed
mount -t bpf bpf /sys/fs/bpf
```

Pin map in BPF C code (auto-pinned by libbpf skeleton):

```c
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 1024);
    __type(key, u32);
    __type(value, u64);
    __uint(pinning, LIBBPF_PIN_BY_NAME); // pins to /sys/fs/bpf/<name>
} my_map SEC(".maps");
```
