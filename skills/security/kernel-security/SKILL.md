---
name: kernel-security
description: Linux kernel security skill for LSM, hardening, and exploit mitigations. Use when writing SELinux/AppArmor policies, seccomp-bpf filters, configuring KASLR/CET/PAC, or triaging kernel CVEs. Activates on queries about SELinux, AppArmor, seccomp, KASLR, CET, PAC, BTI, KASAN, or kernel CVE.
---

# Kernel Security

## Purpose

Guide agents through Linux kernel security: LSM frameworks (SELinux, AppArmor), seccomp-bpf with libseccomp, KASLR and bypass mitigations, Intel CET (Shadow Stack + IBT), ARM PAC and BTI, kernel sanitizers (KASAN, KMSAN), and CVE triage for kernel vulnerabilities.

## When to Use

- Writing SELinux or AppArmor policies for confined services
- Sandboxing processes with seccomp-bpf filters
- Hardening binaries with CET, PAC, or BTI
- Enabling KASAN on kernel builds for vulnerability research
- Triaging kernel CVE impact on your distro/kernel version
- Designing container or microservice security boundaries

## Workflow

### 1. LSM framework overview

```
Application syscall
    → DAC (uid/gid, file mode)
    → LSM hook (SELinux/AppArmor/Yama/...)
    → Capability check
    → seccomp filter
    → Kernel
```

```bash
# Active LSM
cat /sys/kernel/security/lsm
# common: lockdown,capability,yama,apparmor,safesetid
```

### 2. SELinux policy

```bash
# Check SELinux status
getenforce
sestatus

# Context of file/process
ls -Z /usr/sbin/nginx
ps -eZ | grep nginx

# Audit denials
ausearch -m avc -ts recent
sealert -a /var/log/audit/audit.log
```

Policy module example:

```te
# myapp.te
policy_module(myapp, 1.0.0)

type myapp_t;
type myapp_exec_t;
type myapp_log_t;

init_daemon_domain(myapp_t, myapp_exec_t)

allow myapp_t myapp_log_t:file { create write append open };
allow myapp_t self:tcp_socket { create bind listen accept };
```

```bash
checkmodule -M -m -o myapp.mod myapp.te
semodule_package -o myapp.pp -m myapp.mod
semodule -i myapp.pp
```

### 3. AppArmor profiles

```bash
# Generate complain-mode profile
aa-genprof /usr/bin/myapp

# Enforce
aa-enforce /etc/apparmor.d/usr.bin.myapp

# Check status
aa-status
```

```apparmor
# /etc/apparmor.d/usr.bin.myapp
#include <tunables/global>

/usr/bin/myapp {
  #include <abstractions/base>

  /usr/bin/myapp mr,
  /var/log/myapp.log w,
  /etc/myapp/config r,
  network bind tcp,
  deny /etc/shadow r,
}
```

### 4. seccomp-bpf with libseccomp

```c
#include <seccomp.h>

int sandbox(void) {
    scmp_filter_ctx ctx = seccomp_init(SCMP_ACT_KILL_PROCESS);

    // Allow read/write/exit/mmap
    seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(read), 0);
    seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(write), 0);
    seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(exit_group), 0);
    seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(mmap), 0);
    seccomp_rule_add(ctx, SCMP_ACT_ALLOW, SCMP_SYS(brk), 0);

    // Return EPERM instead of kill for open
    seccomp_rule_add(ctx, SCMP_ACT_ERRNO(EPERM), SCMP_SYS(open), 0);
    seccomp_rule_add(ctx, SCMP_ACT_ERRNO(EPERM), SCMP_SYS(openat), 0);

    return seccomp_load(ctx);
}
```

```bash
# Export BPF filter for audit
scmp_filter_ctx ctx = ...;
seccomp_export_bpf(ctx, fd);

# strace to find needed syscalls before tightening
strace -c ./myapp
```

### 5. KASLR

```bash
# Check KASLR enabled
cat /proc/sys/kernel/randomize_va_space   # 2 = full
dmesg | grep KASLR

# Kernel cmdline
grep kaslr /proc/cmdline
```

Mitigations against KASLR leaks:
- No `/proc/<pid>/maps` to untrusted
- Pointer hashing in `%pK` printk
- eBPF restricted on unprivileged

### 6. Intel CET

```bash
# Compile with CET
gcc -fcf-protection=full -o app app.c

# Verify shadow stack and IBT
readelf -n app | grep -E 'SHSTK|IBT'
readelf --notes app | grep -A2 GNU_PROPERTY
```

| Feature | Protects against |
|---------|------------------|
| SHSTK (Shadow Stack) | ROP return address overwrites |
| IBT (Indirect Branch Tracking) | CALL/JMP to non-ENDBR targets |

Requires CPU with CET (Intel Tiger Lake+; AMD Zen 3+ on CPUs with shadow-stack support) and kernel CET support.

### 7. ARM PAC and BTI

```bash
# GCC/Clang branch protection
gcc -mbranch-protection=standard -o app app.c
# PAC (pointer authentication) + BTI (branch target identification)

# Verify
readelf -n app | grep -E 'GNU_PROPERTY_AARCH64_FEATURE_1'
llvm-objdump -d app | grep bti
```

PAC signs return addresses and pointers with cryptographic keys (ARMv8.3+).
BTI marks valid branch targets — invalid jumps fault.

### 8. Kernel memory tagging

```bash
# KASAN kernel build
# CONFIG_KASAN=y in kernel .config
make menuconfig  # Kernel hacking → KASAN

# Boot with KASAN kernel
# Reports use-after-free, OOB with stack trace

# KMSAN (uninitialized memory)
# CONFIG_KMSAN=y — kernel equivalent of MSan
```

```bash
# KASAN report example fields
# BUG: KASAN: slab-out-of-bounds in ...
# Call trace: ...
```

### 9. CVE triage workflow

```bash
# Check kernel version
uname -r

# Distro security tracker
# Ubuntu: ubuntu-security-notices
# RHEL: errata

# NVD lookup
# https://nvd.nist.gov/vuln/detail/CVE-XXXX-XXXXX

# Is patch backported?
zgrep -l CVE-2024-XXXX /usr/share/doc/linux-*/changelog.Debian.gz
```

Triage checklist:
1. Affected subsystem (net, fs, drivers)?
2. Local or remote exploit?
3. Fixed in your kernel version?
4. Mitigation without patch (disable module, sysctl)?

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| SELinux denials | Missing allow rule | `audit2allow`; refine policy |
| AppArmor profile break | Path mismatch | Update profile paths; use globs |
| seccomp kills app | Missing syscall | `strace`; add allow rule |
| CET not active | Old CPU/kernel | Check `/proc/cpuinfo` flags |
| KASAN kernel slow | 2-5x overhead | Use only in test VMs |
| False sense of security | LSM bypass via kernel bug | Defense in depth; keep kernel updated |

## Related Skills

- `skills/virtualization/containers-internals` — container seccomp and caps
- `skills/runtimes/binary-hardening` — userspace CET, RELRO, PIE
- `skills/runtimes/sanitizers` — ASan/HWASan userspace counterparts
- `skills/observability/ebpf` — LSM BPF programs
- `skills/kernel/kernel-debugging` — analyze KASAN reports
- `skills/security/reverse-engineering` — exploit analysis