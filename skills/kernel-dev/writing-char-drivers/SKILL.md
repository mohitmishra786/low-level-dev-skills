---
name: writing-char-drivers
description: Character driver skill for Linux kernel char devices. Use when implementing file_operations, cdev, copy_to_user, ioctl, or mmap for userspace interfaces. Activates on queries about char device, cdev, file_operations, copy_from_user, ioctl, or kernel mmap.
---

# Writing Character Drivers

## Purpose

Guide agents through Linux character device implementation: `struct file_operations`, `cdev` registration, safe userspace copies, `ioctl` design, and basic `mmap` — focused depth beyond `skills/kernel/device-drivers`.

## When to Use

- Exposing hardware to `/dev/mydev`
- Implementing `read`/`write`/`poll` from kernel
- Defining `ioctl` commands with type-safe macros
- Mapping device MMIO to userspace (carefully)

## Workflow

### 1. Char device registration

```c
#include <linux/fs.h>
#include <linux/cdev.h>
#include <linux/uaccess.h>

#define MY_MAJOR 0   /* 0 = dynamic alloc */
#define MY_MINOR 0

static dev_t devno;
static struct cdev my_cdev;
static struct class *class;

static const struct file_operations my_fops = {
    .owner          = THIS_MODULE,
    .open           = my_open,
    .release        = my_release,
    .read           = my_read,
    .write          = my_write,
    .unlocked_ioctl = my_ioctl,
    .llseek         = no_llseek,
};

static int __init my_init(void)
{
    int ret = alloc_chrdev_region(&devno, MY_MINOR, 1, "mydev");
    if (ret)
        return ret;

    cdev_init(&my_cdev, &my_fops);
    ret = cdev_add(&my_cdev, devno, 1);
    if (ret)
        goto err_cdev;

    class = class_create("mydev");
    device_create(class, NULL, devno, NULL, "mydev");
    return 0;

err_cdev:
    unregister_chrdev_region(devno, 1);
    return ret;
}
```

Modern drivers often use `devm_*` variants inside `probe`.

### 2. Safe userspace I/O

```c
static ssize_t my_read(struct file *filp, char __user *buf,
                       size_t count, loff_t *ppos)
{
    char kbuf[128];
    ssize_t len;

    if (*ppos >= sizeof(kbuf))
        return 0;
    len = min(count, sizeof(kbuf) - *ppos);
    memcpy(kbuf, "data", 4);
    if (copy_to_user(buf, kbuf + *ppos, len))
        return -EFAULT;
    *ppos += len;
    return len;
}
```

Never dereference `__user` pointers directly.

### 3. ioctl pattern

```c
#include <linux/ioctl.h>

#define MY_IOC_MAGIC 'k'
#define MY_IOC_RESET  _IO(MY_IOC_MAGIC, 0)
#define MY_IOC_SET    _IOW(MY_IOC_MAGIC, 1, int)

static long my_ioctl(struct file *filp, unsigned int cmd, unsigned long arg)
{
    switch (cmd) {
    case MY_IOC_RESET:
        return 0;
    case MY_IOC_SET: {
        int val;
        if (copy_from_user(&val, (void __user *)arg, sizeof(val)))
            return -EFAULT;
        return 0;
    }
    default:
        return -ENOTTY;
    }
}
```

Use `_IOWR` with fixed-size structs; prefer `compat_ioctl` on bi-arch.

### 4. mmap (device memory)

```c
static int my_mmap(struct file *filp, struct vm_area_struct *vma)
{
    unsigned long size = vma->vm_end - vma->vm_start;
    phys_addr_t phys = device_phys_base;

    vma->vm_page_prot = pgprot_noncached(vma->vm_page_prot);
    return remap_pfn_range(vma, vma->vm_start, phys >> PAGE_SHIFT,
                           size, vma->vm_page_prot);
}
```

Prefer `mmap` of DMA buffers only with explicit size limits and permission checks.

### 5. poll / async I/O

Implement `poll` + `wake_up_interruptible` for blocking reads; use `fasync_helper` for SIGIO.

### 6. Agent usage

```
/writing-char-drivers Add unlocked_ioctl SET_SPEED to existing platform driver
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `-EFAULT` | Bad user pointer | Validate `access_ok` (older) / rely on `copy_*` |
| `ENOTTY` | Wrong ioctl magic | Match userspace `ioctl.h` |
| Major conflict | Static major taken | Use `alloc_chrdev_region` |
| mmap SIGSEGV | Cached mapping to device | `pgprot_noncached` |
| Sleep in ioctl | Holding spinlock | Drop lock before blocking |

## Related Skills

- `skills/kernel-dev/platform-device-model` — probe context
- `skills/kernel/device-drivers` — full driver lifecycle
- `skills/kernel/kernel-concurrency` — locking in file ops
- `skills/kernel-dev/kernel-debugging-advanced` — trace ioctl path
- `skills/low-level-programming/linux-kernel-modules` — module boilerplate