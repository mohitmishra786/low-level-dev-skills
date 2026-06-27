---
name: qemu-kvm
description: QEMU/KVM skill for virtualization and kernel development. Use when running qemu-system-x86_64 with KVM, configuring virtio devices, VFIO passthrough, QMP monitor, libvirt, or booting custom kernels. Activates on queries about QEMU, KVM, virtio, VFIO, virsh, virt-install, or -kernel -append.
---

# QEMU / KVM

## Purpose

Guide agents through QEMU system emulation and KVM acceleration: key `qemu-system-x86_64` flags, virtio devices, VFIO device passthrough, QMP monitor protocol, libvirt/virsh management, and QEMU for kernel development with `-kernel -initrd -append`.

## When to Use

- Running Linux VMs with hardware acceleration
- Testing custom kernels without bare metal
- Passing through GPU or NIC to a VM with VFIO
- Managing VMs with libvirt and virsh
- Creating VM snapshots for reproducible testing
- Developing kernel or bootloader with direct kernel boot

## Workflow

### 1. Basic KVM VM

```bash
# Check KVM support
egrep -c '(vmx|svm)' /proc/cpuinfo
ls -l /dev/kvm

# Minimal Ubuntu VM
qemu-system-x86_64 \
  -enable-kvm \
  -cpu host \
  -m 4096 \
  -smp 4 \
  -drive file=ubuntu.img,format=qcow2 \
  -netdev user,id=net0 \
  -device virtio-net-pci,netdev=net0 \
  -display none \
  -serial mon:stdio
```

| Flag | Purpose |
|------|---------|
| `-enable-kvm` | Use KVM acceleration |
| `-cpu host` | Pass through host CPU features |
| `-m` | RAM in MB |
| `-smp` | vCPU count |
| `-drive` | Disk image |
| `-netdev` / `-device` | Network backend |

### 2. virtio devices

```bash
# virtio-blk (paravirtual disk — faster)
-device virtio-blk-pci,drive=hd0 \
-drive if=none,id=hd0,file=disk.qcow2,format=qcow2

# virtio-net
-netdev tap,id=net0,ifname=tap0,script=no,downscript=no \
-device virtio-net-pci,netdev=net0

# virtio-balloon (dynamic memory)
-device virtio-balloon-pci

# virtio-scsi
-device virtio-scsi-pci,id=scsi0 \
-device scsi-hd,drive=hd0,bus=scsi0.0
```

Always prefer virtio over emulated devices for performance.

### 3. VFIO device passthrough

```bash
# Bind device to vfio-pci
echo 10de 1c03 | sudo tee /sys/bus/pci/drivers/vfio-pci/new_id
sudo virsh nodedev-detach pci_0000_01_00_0

# QEMU with passthrough
qemu-system-x86_64 \
  -enable-kvm -m 8192 -smp 8 \
  -device vfio-pci,host=01:00.0 \
  ...
```

Requires IOMMU enabled (`intel_iommu=on` or `amd_iommu=on` in kernel cmdline).

### 4. QMP monitor

```bash
# Start with QMP socket
qemu-system-x86_64 ... \
  -qmp unix:/tmp/qmp.sock,server,nowait

# Send QMP commands
socat - UNIX-CONNECT:/tmp/qmp.sock
{"execute":"qmp_capabilities"}
{"execute":"query-status"}
{"execute":"system_powerdown"}
{"execute":"savevm", "arguments":{"name":"checkpoint1"}}
```

### 5. libvirt and virsh

```bash
# Define VM from XML
virsh define myvm.xml

# Start/stop
virsh start myvm
virsh shutdown myvm
virsh destroy myvm   # force power off

# Console
virsh console myvm

# Snapshot
virsh snapshot-create-as myvm snap1 "before upgrade"

# List
virsh list --all
```

```bash
# Create VM interactively
virt-install \
  --name ubuntu-vm \
  --ram 4096 \
  --vcpus 4 \
  --disk path=/var/lib/libvirt/images/ubuntu.qcow2,size=20 \
  --os-variant ubuntu22.04 \
  --network bridge=virbr0 \
  --graphics none \
  --console pty,target_type=serial \
  --location http://archive.ubuntu.com/ubuntu/dists/jammy/main/installer-amd64/ \
  --extra-args 'console=ttyS0,115200n8'
```

### 6. Kernel development boot

```bash
# Direct kernel boot (no disk install needed)
qemu-system-x86_64 \
  -enable-kvm \
  -m 512 \
  -kernel arch/x86/boot/bzImage \
  -initrd /path/to/initramfs.cpio.gz \
  -append "console=ttyS0 root=/dev/sda rw nokaslr" \
  -serial stdio \
  -display none \
  -no-reboot
```

```bash
# With custom rootfs on virtio disk
-drive file=rootfs.ext4,format=raw,if=virtio \
-append "console=ttyS0 root=/dev/vda rw"
```

### 7. Debugging kernel in QEMU

```bash
# GDB stub for kernel
qemu-system-x86_64 \
  -kernel bzImage -append "console=ttyS0 nokaslr" \
  -s -S \   # -s = gdb port 1234, -S = wait for gdb
  -serial stdio -display none

# Host GDB
gdb vmlinux
(gdb) target remote :1234
(gdb) break start_kernel
(gdb) continue
```

### 8. qcow2 disk management

```bash
qemu-img create -f qcow2 disk.qcow2 20G
qemu-img snapshot -c clean disk.qcow2
qemu-img convert -O raw disk.qcow2 disk.raw
qemu-img info disk.qcow2
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| KVM disabled warning | BIOS VT-x off or nested issue | Enable VT-x/AMD-V; check `/dev/kvm` |
| VM very slow | KVM not active | Add `-enable-kvm`; install kvm modules |
| VFIO group error | Device not in IOMMU group | Use `find /sys/kernel/iommu_groups/` |
| No network in VM | Wrong netdev backend | user networking vs tap/bridge |
| Kernel panic on boot | Wrong root= or missing driver | Add virtio drivers to initrd |
| QMP connection refused | Socket not ready | Wait for QEMU start; check path |

## Related Skills

- `skills/virtualization/hypervisor-internals` — VT-x/SVM theory under KVM
- `skills/kernel/kernel-testing` — boot test kernels in QEMU
- `skills/kernel/os-dev-scratch` — minimal OS development in QEMU
- `skills/kernel/kernel-debugging` — kgdb with QEMU `-s -S`
- `skills/async-io/dpdk` — DPDK with QEMU virtio
- `skills/platform/riscv-privileged` — `qemu-system-riscv64`