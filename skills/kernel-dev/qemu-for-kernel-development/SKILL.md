---
name: qemu-for-kernel-development
description: QEMU kernel development skill for driver and kernel testing. Use when booting custom kernels in QEMU, Buildroot/Yocto rootfs, virtio devices, or NFS root for driver iteration. Activates on queries about QEMU kernel dev, Buildroot QEMU, virtio block, kernel module test QEMU, or -append root=
---

# QEMU for Kernel Development

## Purpose

Guide agents through QEMU-based kernel and driver development workflows: building/booting custom kernels, attaching virtio block/network, using Buildroot or minimal initramfs, and rapid module test cycles — focused on kernel dev vs general `skills/virtualization/qemu-kvm`.

## When to Use

- Test kernel patch without bare metal
- Develop driver against virtio or emulated DT platform
- CI kernel boot smoke test
- NFS or 9p root for fast edit-compile-test

## Workflow

### 1. Minimal direct kernel boot (arm64 virt)

```bash
qemu-system-aarch64 \
  -machine virt -cpu cortex-a57 -smp 4 -m 2G \
  -kernel arch/arm64/boot/Image \
  -append "console=ttyAMA0 root=/dev/vda rw" \
  -drive if=virtio,file=rootfs.ext4,format=raw \
  -netdev user,id=net0 -device virtio-net-device,netdev=net0 \
  -nographic
```

x86_64:

```bash
qemu-system-x86_64 -enable-kvm -m 4G -smp 4 \
  -kernel arch/x86/boot/bzImage \
  -append "console=ttyS0 root=/dev/vda rw" \
  -drive file=rootfs.img,format=raw,if=virtio \
  -nographic
```

### 2. Buildroot rootfs loop

```bash
cd buildroot
make qemu_aarch64_virt_defconfig
make
# output/images/Image, rootfs.ext4
```

Integrate custom kernel: set `BR2_LINUX_KERNEL_CUSTOM_VERSION` or external tree.

### 3. Out-of-tree module test

```bash
# on host — cross build
make -C $KERNEL_SRC M=$PWD modules
# in guest or via initramfs
insmod mydriver.ko
dmesg | tail
```

Share tree with 9p:

```bash
-fsdev local,id=dev,path=$PWD,security_model=none \
-device virtio-9p-pci,fsdev=dev,mount_tag=hostshare
# guest: mount -t 9p -o trans=virtio hostshare /mnt
```

### 4. GDB stub for kernel

```bash
qemu-system-aarch64 ... -s -S
gdb vmlinux
(gdb) target remote :1234
(gdb) break start_kernel
```

Use `CONFIG_KGDB` for live kernel debugging after boot.

### 5. Device tree overrides

```bash
qemu-system-aarch64 -machine virt -dtb myboard.dtb ...
```

virt machine provides virtio devices; platform drivers can target QEMU `-device` models.

### 6. Agent usage

```
/qemu-for-kernel-development Boot arm64 virt with custom Image and virtio rootfs for driver CI
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Kernel panic no root | Wrong `root=` | `root=/dev/vda` for virtio blk |
| No console output | Missing `console=` on cmdline | `console=ttyAMA0` / `ttyS0` |
| Module vermagic error | Built against wrong tree | Same `KERNEL_SRC` as booted image |
| Slow without KVM | TCG emulation | `-enable-kvm` on x86 host |
| DTB mismatch | Wrong machine | Use `virt` DTB from kernel `make dtbs` |

## Related Skills

- `skills/virtualization/qemu-kvm` — KVM, VFIO, libvirt
- `skills/qemu/qemu-embedded-simulation` — bare-metal MCU QEMU
- `skills/kernel/kernel-testing` — KUnit, kselftest
- `skills/kernel-dev/device-tree` — DT for virt/platform
- `skills/debuggers/gdb` — remote GDB basics