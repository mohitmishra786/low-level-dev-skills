---
name: containers-internals
description: Linux containers internals skill for namespaces, cgroups, and OCI. Use when understanding clone/unshare namespaces, cgroups v2 limits, overlayfs, runc, seccomp profiles, capabilities, or escape mitigations. Activates on queries about namespaces, cgroups, overlayfs, runc, seccomp-bpf, OCI spec, or container escape.
---

# Containers Internals

## Purpose

Guide agents through Linux container internals: namespaces (`clone`, `unshare`, `nsenter`), cgroups v2 resource limits, overlayfs storage, runc and the OCI runtime spec, seccomp-bpf filtering, Linux capabilities for privilege dropping, and container escape mitigations.

## When to Use

- Understanding how Docker/Podman isolate processes under the hood
- Debugging container resource limits (OOM, CPU throttling)
- Writing custom seccomp profiles for sandboxed workloads
- Building minimal containers without Docker
- Investigating container escape vulnerabilities
- Tuning cgroups v2 for Kubernetes pods

## Workflow

### 1. Namespaces

```bash
# List namespaces for a process
ls -la /proc/self/ns/
readlink /proc/self/ns/pid
readlink /proc/1234/ns/net

# Enter container namespaces
nsenter -t <pid> -m -u -i -n -p bash

# Unshare namespaces (manual container)
unshare --fork --mount-proc --pid --net --uts --ipc bash
```

| Namespace | Isolates |
|-----------|----------|
| `CLONE_NEWNS` (mount) | Mount points, filesystem roots |
| `CLONE_NEWPID` | Process IDs |
| `CLONE_NEWNET` | Network stack |
| `CLONE_NEWUTS` | Hostname |
| `CLONE_NEWIPC` | SysV IPC, POSIX message queues |
| `CLONE_NEWUSER` | UID/GID mappings |
| `CLONE_NEWCGROUP` | cgroup root view |

```c
// clone() with namespaces
#define _GNU_SOURCE
#include <sched.h>

int container_init(void *arg) {
    sethostname("container", 9);
    mount("proc", "/proc", "proc", 0, NULL);
    execv("/bin/sh", (char *[]){"/bin/sh", NULL});
    return 1;
}

int stack[1024 * 1024];
clone(container_init, stack + sizeof(stack)/sizeof(int),
      CLONE_NEWPID | CLONE_NEWNS | CLONE_NEWNET | SIGCHLD, NULL);
```

### 2. cgroups v2

```bash
# Unified hierarchy (cgroup v2)
mount -t cgroup2 none /sys/fs/cgroup

# Create cgroup and set limits
mkdir /sys/fs/cgroup/mycontainer
echo $$ > /sys/fs/cgroup/mycontainer/cgroup.procs

# Memory limit 256MB
echo 256M > /sys/fs/cgroup/mycontainer/memory.max

# CPU weight (relative to siblings, default 100)
echo 50 > /sys/fs/cgroup/mycontainer/cpu.weight

# IO weight
echo default 100 > /sys/fs/cgroup/mycontainer/io.weight
```

```bash
# Check current cgroup
cat /proc/self/cgroup

# OOM events
cat /sys/fs/cgroup/mycontainer/memory.events
```

### 3. overlayfs

```
overlayfs layers
├── lowerdir (read-only image layers)
├── upperdir (container writes)
├── workdir (internal bookkeeping)
└── merged (mount point seen by container)
```

```bash
mount -t overlay overlay \
  -o lowerdir=lower1:lower2,upperdir=upper,workdir=work \
  merged

# Docker stores layers in /var/lib/docker/overlay2/
```

Copy-on-write: reads from lower, writes go to upper.

### 4. runc and OCI spec

```bash
# Generate default OCI config
mkdir -p mycontainer/rootfs
runc spec

# Edit config.json — namespaces, mounts, process args
# Run container
sudo runc run mycontainer

# List
runc list
```

`config.json` key sections:

```json
{
  "ociVersion": "1.0.2",
  "process": {
    "args": ["/bin/sh"],
    "capabilities": { "bounding": ["CAP_NET_BIND_SERVICE"] }
  },
  "linux": {
    "namespaces": [
      {"type": "pid"}, {"type": "network"}, {"type": "mount"}
    ],
    "seccomp": { ... },
    "resources": {
      "memory": { "limit": 268435456 }
    }
  },
  "root": { "path": "rootfs", "readonly": false }
}
```

### 5. seccomp-bpf

```c
// libseccomp example — block mount
#include <seccomp.h>

scmp_filter_ctx ctx = seccomp_init(SCMP_ACT_ALLOW);
seccomp_rule_add(ctx, SCMP_ACT_ERRNO(EPERM), SCMP_SYS(mount), 0);
seccomp_rule_add(ctx, SCMP_ACT_ERRNO(EPERM), SCMP_SYS(pivot_root), 0);
seccomp_load(ctx);
```

```bash
# Docker default seccomp profile (JSON)
# https://github.com/moby/moby/blob/master/profiles/seccomp/default.json

# Audit blocked syscalls
# kernel: seccomp log via auditd
ausearch -m SECCOMP
```

| Action | Effect |
|--------|--------|
| `SCMP_ACT_KILL` | Kill process |
| `SCMP_ACT_ERRNO(n)` | Return error |
| `SCMP_ACT_TRACE` | Notify tracer |
| `SCMP_ACT_ALLOW` | Permit syscall |

### 6. Linux capabilities

```bash
# Drop all caps except needed
capsh --drop=all --add=net_bind_service -- -c '/app/server'

# File capabilities
setcap cap_net_bind_service+ep /usr/bin/myserver
getcap /usr/bin/myserver
```

In containers: default Docker drops `CAP_SYS_ADMIN`, `CAP_NET_RAW`, etc. Run as non-root with minimal bounding set.

### 7. User namespace rootless

```bash
# Rootless podman/docker maps root in container to unprivileged UID on host
cat /proc/self/uid_map
#          0       1000          1
# container UID 0 → host UID 1000
```

Rootless limits: cannot mount most filesystems, no `CAP_SYS_ADMIN`.

### 8. Escape mitigations

```
Defense layers
├── User namespace (rootless)
├── seccomp (block dangerous syscalls)
├── AppArmor/SELinux (MAC)
├── Capabilities drop (--cap-drop=ALL)
├── Read-only rootfs
├── no-new-privileges
└── Seccomp + Landlock for filesystem
```

```bash
docker run --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  --security-opt seccomp=default.json myimage
```

Known escape vectors: mounted docker.sock, privileged mode, kernel CVEs, `/proc` leaks.

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Container OOMKilled | memory.max exceeded | Raise limit or fix leak |
| CPU throttled | cpu.max quota low | Adjust `cpu.max` or weight |
| Permission denied in container | Capability dropped | Add specific cap or fix app |
| seccomp kill on start | Missing syscall in profile | `strace` to find; allow syscall |
| overlay mount fail | workdir not empty | Clean workdir; check permissions |
| Rootless mount fail | User namespace limits | Use volume mounts from host |

## Related Skills

- `skills/virtualization/qemu-kvm` — VM isolation vs containers
- `skills/security/kernel-security` — SELinux, AppArmor, seccomp depth
- `skills/observability/ebpf` — trace container syscalls
- `skills/runtimes/binary-hardening` — seccomp and capabilities in production
- `skills/kernel/kernel-internals` — cgroups and namespaces in kernel
- `skills/profilers/strace-ltrace` — syscall tracing for seccomp tuning