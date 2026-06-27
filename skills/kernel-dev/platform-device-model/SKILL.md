---
name: platform-device-model
description: Platform device model skill for Linux driver binding. Use when implementing platform_driver probe/remove, sysfs attributes, device properties, or deferred probe. Activates on queries about platform_device, platform_driver, driver model, sysfs, probe remove, or Linux device bus.
---

# Platform Device Model

## Purpose

Explain the Linux driver model for platform (and similar) buses: `struct device`, `device_driver`, `probe`/`remove`, resource acquisition, sysfs, and deferred probe — the glue between device tree and driver code.

## When to Use

- Implementing or debugging `platform_driver` lifecycle
- Exposing driver state via sysfs
- Understanding uevent / `udev` device node creation
- Before `skills/kernel-dev/writing-char-drivers`

## Workflow

### 1. Object hierarchy

```
bus_type (platform, amba, pci, i2c, spi)
├── struct device        — hardware instance
└── struct device_driver — driver logic
        └── probe(dev) / remove(dev)
```

Platform devices often come from DT (`of_platform`) or legacy board files.

### 2. Platform driver skeleton

```c
static int my_probe(struct platform_device *pdev)
{
    struct resource *res;
    void __iomem *base;

    res = platform_get_resource(pdev, IORESOURCE_MEM, 0);
    base = devm_ioremap_resource(&pdev->dev, res);
    if (IS_ERR(base))
        return PTR_ERR(base);

    platform_set_drvdata(pdev, priv);
    return 0;
}

static void my_remove(struct platform_device *pdev)
{
    /* devm_* auto-cleanup on remove */
}

static struct platform_driver my_pdrv = {
    .probe  = my_probe,
    .remove = my_remove,
    .driver = {
        .name = "my-dev",
        .of_match_table = my_of_match,
    },
};
module_platform_driver(my_pdrv);
```

Prefer `devm_*` helpers for automatic unwind.

### 3. Device properties (DT / ACPI)

```c
u32 speed;
device_property_read_u32(&pdev->dev, "clock-speed", &speed);
bool flag = device_property_present(&pdev->dev, "feature-x");
```

### 4. Sysfs (driver visibility)

```c
static ssize_t status_show(struct device *dev,
                           struct device_attribute *attr, char *buf)
{
    return sysfs_emit(buf, "ok\n");
}
static DEVICE_ATTR_RO(status);

/* in probe */
device_create_file(&pdev->dev, &dev_attr_status);
```

### 5. Deferred probe

Return `-EPROBE_DEFER` when a clock, regulator, or bus is not ready — core retries later.

### 6. Debug

```bash
ls /sys/bus/platform/devices/
ls /sys/bus/platform/drivers/
cat /sys/kernel/debug/devices_deferred  # if debugfs enabled
udevadm monitor
```

### 7. Agent usage

```
/platform-device-model Convert legacy board file driver to DT platform_driver with devm_ioremap
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `-EBUSY` on probe | Resource claimed twice | Check `status` / duplicate nodes |
| No `/dev` node | Char device not registered | See `writing-char-drivers` |
| Deferred forever | Supplier driver missing | Fix DT dependency chain |
| Remove crash | Manual free vs devm mismatch | Use devm consistently |
| Name mismatch | `.name` vs `compatible` | OF uses `of_match_table` |

## Related Skills

- `skills/kernel-dev/device-tree` — hardware description
- `skills/kernel/device-drivers` — IRQ, DMA, regmap depth
- `skills/kernel-dev/writing-char-drivers` — userspace interface
- `skills/kernel-dev/bus-drivers-i2c-spi` — other bus types
- `skills/low-level-programming/linux-kernel-modules` — module loading