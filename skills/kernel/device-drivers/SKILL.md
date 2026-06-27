---
name: device-drivers
description: Linux device driver skill for kernel driver development. Use when writing platform/i2c/spi drivers, char device lifecycle, IRQ handling, DMA engine API, regmap, power management, or udev rules. Activates on queries about platform_driver, request_irq, dma_alloc_coherent, regmap, pm_runtime, or char devices.
---

# Device Drivers

## Purpose

Guide agents through Linux kernel device driver development: the driver model (`platform_driver`, `i2c_driver`, `spi_driver`), character device lifecycle, IRQ handling including threaded IRQs, DMA engine API, regmap for register abstraction, runtime power management, and udev rules for userspace device nodes.

## When to Use

- Writing a platform driver for memory-mapped hardware
- Implementing a character device with read/write/ioctl
- Handling hardware interrupts (hard IRQ vs threaded)
- Setting up DMA coherent or streaming mappings
- Abstracting register access with regmap
- Configuring udev rules for `/dev` node permissions

## Workflow

### 1. Driver model overview

```
Device tree / ACPI → bus (platform, i2c, spi, pci)
    → struct device → struct device_driver
        → probe() / remove()
```

```c
// platform_driver.c — minimal platform driver
#include <linux/module.h>
#include <linux/platform_device.h>

static int my_probe(struct platform_device *pdev)
{
    struct resource *res = platform_get_resource(pdev, IORESOURCE_MEM, 0);
    void __iomem *base = devm_ioremap_resource(&pdev->dev, res);
    if (IS_ERR(base))
        return PTR_ERR(base);
    dev_info(&pdev->dev, "probed at %pa\n", &res->start);
    return 0;
}

static void my_remove(struct platform_device *pdev)
{
    dev_info(&pdev->dev, "removed\n");
}

static struct platform_driver my_driver = {
    .probe  = my_probe,
    .remove = my_remove,
    .driver = { .name = "my-device", .owner = THIS_MODULE },
};

module_platform_driver(my_driver);
MODULE_LICENSE("GPL");
```

### 2. Character device lifecycle

```c
#include <linux/fs.h>
#include <linux/cdev.h>
#include <linux/uaccess.h>

#define DEVICE_NAME "mydev"
#define MINOR_BASE  0
#define MINOR_COUNT 1

static dev_t dev_num;
static struct cdev my_cdev;
static struct class *dev_class;

static ssize_t my_read(struct file *filp, char __user *buf,
                       size_t count, loff_t *ppos)
{
    char kbuf[64] = "hello from kernel\n";
    size_t len = strlen(kbuf);
    if (*ppos >= len)
        return 0;
    if (count > len - *ppos)
        count = len - *ppos;
    if (copy_to_user(buf, kbuf + *ppos, count))
        return -EFAULT;
    *ppos += count;
    return count;
}

static const struct file_operations my_fops = {
    .owner = THIS_MODULE,
    .read  = my_read,
};

static int __init mydev_init(void)
{
    int ret;
    ret = alloc_chrdev_region(&dev_num, MINOR_BASE, MINOR_COUNT, DEVICE_NAME);
    if (ret)
        return ret;

    cdev_init(&my_cdev, &my_fops);
    my_cdev.owner = THIS_MODULE;
    ret = cdev_add(&my_cdev, dev_num, MINOR_COUNT);
    if (ret)
        goto err_cdev;

    dev_class = class_create(DEVICE_NAME);
    device_create(dev_class, NULL, dev_num, NULL, DEVICE_NAME);
    return 0;

err_cdev:
    unregister_chrdev_region(dev_num, MINOR_COUNT);
    return ret;
}
```

```bash
# After loading module
ls -l /dev/mydev
cat /dev/mydev
```

### 3. IRQ handling

```c
#include <linux/interrupt.h>

static irqreturn_t my_hardirq(int irq, void *dev_id)
{
    // Minimal work: acknowledge, schedule bottom half
    return IRQ_WAKE_THREAD;
}

static irqreturn_t my_threaded(int irq, void *dev_id)
{
    // Process data — can sleep
    process_ring_buffer();
    return IRQ_HANDLED;
}

static int request_device_irq(struct device *dev, int irq)
{
    return devm_request_threaded_irq(dev, irq, my_hardirq, my_threaded,
                                     IRQF_ONESHOT, "mydev", dev);
}
```

| Pattern | Use when |
|---------|----------|
| Hard IRQ only | Microsecond work, no blocking |
| Threaded IRQ | I2C/SPI reads, scheduling, mutex |
| `IRQF_ONESHOT` | Level-triggered; IRQ masked until threaded handler returns |

### 4. DMA engine API

```c
#include <linux/dma-mapping.h>

// Coherent (consistent) mapping — CPU and device see same memory
void *cpu_addr;
dma_addr_t dma_handle;
cpu_addr = dma_alloc_coherent(dev, size, &dma_handle, GFP_KERNEL);

// Streaming (single) mapping for already-allocated buffers
dma_addr_t dma = dma_map_single(dev, kernel_buf, size, DMA_TO_DEVICE);
dma_sync_single_for_device(dev, dma, size, DMA_TO_DEVICE);
// ... device reads ...
dma_unmap_single(dev, dma, size, DMA_TO_DEVICE);
```

```bash
# Debug DMA mappings
cat /sys/kernel/debug/dma_buf/bufinfo 2>/dev/null
```

### 5. regmap abstraction

```c
#include <linux/regmap.h>

static const struct regmap_config my_regmap_config = {
    .reg_bits   = 8,
    .val_bits   = 8,
    .max_register = 0xFF,
};

// I2C regmap (typical for sensors)
static struct regmap *regmap;

regmap_write(regmap, 0x01, 0x80);  // set config register
regmap_read(regmap, 0x02, &val);   // read status
regmap_update_bits(regmap, 0x03, MASK, VALUE);
```

regmap handles locking, caching, and bulk access — prefer over raw `i2c_smbus_*` in new drivers.

### 6. Power management

```c
#include <linux/pm_runtime.h>

static int my_runtime_suspend(struct device *dev)
{
    // Gate clocks, put hardware in low-power state
    return 0;
}

static int my_runtime_resume(struct device *dev)
{
    // Restore registers, enable clocks
    return 0;
}

static const struct dev_pm_ops my_pm_ops = {
    .runtime_suspend = my_runtime_suspend,
    .runtime_resume  = my_runtime_resume,
};

// In probe:
pm_runtime_enable(&pdev->dev);
pm_runtime_get_sync(&pdev->dev);  // ensure powered on
```

### 7. udev rules

```bash
# /etc/udev/rules.d/99-mydev.rules
KERNEL=="mydev", MODE="0666", GROUP="plugdev"
SUBSYSTEM=="i2c-dev", KERNEL=="i2c-1", GROUP="i2c", MODE="0660"
```

```bash
sudo udevadm control --reload-rules
sudo udevadm trigger
udevadm info -a -n /dev/mydev
```

### 8. I2C and SPI driver stubs

```c
// i2c_driver
static const struct i2c_device_id my_i2c_id[] = {
    { "sensor-chip", 0 },
    { }
};
MODULE_DEVICE_TABLE(i2c, my_i2c_id);

static struct i2c_driver my_i2c_driver = {
    .driver = { .name = "sensor-chip" },
    .probe  = my_i2c_probe,
    .remove = my_i2c_remove,
    .id_table = my_i2c_id,
};
module_i2c_driver(my_i2c_driver);
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `probe failed with -EBUSY` | Resource conflict or double probe | Check device tree `status`; `devm_*` cleanup |
| IRQ storm | Missing acknowledge in handler | ACK interrupt in hardirq; use `IRQF_ONESHOT` |
| DMA coherency bug | Wrong sync direction | `dma_sync_single_for_cpu/device` at boundaries |
| `/dev/node` missing | class_create/device_create failed | Check `dmesg`; verify `cdev_add` return |
| `copy_to_user` fault | Invalid userspace pointer | Validate with `access_ok` |
| Runtime PM hang | Missing `pm_runtime_put` | Balance get/put; use `devm_pm_runtime_enable` |

## Related Skills

- `skills/kernel/kernel-internals` — VFS, memory allocators underlying drivers
- `skills/low-level-programming/linux-kernel-modules` — Kbuild, module loading, signing
- `skills/kernel/kernel-debugging` — kgdb, ftrace for driver bugs
- `skills/embedded/zephyr` — embedded RTOS driver model comparison
- `skills/observability/ebpf` — trace driver events without modifying kernel
- `skills/kernel/kernel-testing` — KUnit tests for driver logic