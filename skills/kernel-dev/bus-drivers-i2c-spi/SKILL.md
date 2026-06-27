---
name: bus-drivers-i2c-spi
description: I2C and SPI bus driver skill for Linux client drivers. Use when writing i2c_driver or spi_driver, register access over bus, DMA SPI transfers, or ACPI/DT client binding. Activates on queries about i2c_client, spi_driver, regmap I2C, SPI transfer, or Linux I2C SPI subsystem.
---

# Bus Drivers (I2C and SPI)

## Purpose

Guide agents through Linux I2C and SPI **client** drivers: bus registration, `i2c_transfer` / `spi_sync`, regmap abstraction, DT `compatible` on bus children, and probe patterns — complementing platform MMIO drivers in `skills/kernel/device-drivers`.

## When to Use

- Sensor or PMIC on I2C/SPI bus
- Converting bare-metal SPI register reads to kernel driver
- Using `regmap` for multi-byte register access
- Debugging `-EREMOTEIO` or missing ACK

## Workflow

### 1. I2C client driver

```c
#include <linux/i2c.h>
#include <linux/mod_devicetable.h>

static int my_probe(struct i2c_client *client)
{
    struct regmap *map;

    map = devm_regmap_init_i2c(client, &my_regmap_config);
    if (IS_ERR(map))
        return PTR_ERR(map);

    dev_info(&client->dev, "probed at 0x%02x\n", client->addr);
    return 0;
}

static const struct of_device_id my_of_id[] = {
    { .compatible = "vendor,sensor" },
    { }
};
MODULE_DEVICE_TABLE(of, my_of_id);

static const struct i2c_device_id my_id[] = {
    { "mysensor", 0 },
    { }
};
MODULE_DEVICE_TABLE(i2c, my_id);

static struct i2c_driver my_driver = {
    .probe    = my_probe,
    .remove   = my_remove,
    .driver   = { .name = "mysensor", .of_match_table = my_of_id },
    .id_table = my_id,
};
module_i2c_driver(my_driver);
```

DT child:

```dts
i2c1 {
    sensor@48 {
        compatible = "vendor,sensor";
        reg = <0x48>;
    };
};
```

### 2. Raw I2C transfer

```c
u8 reg = 0x0F, val;
struct i2c_msg msgs[] = {
    { .addr = client->addr, .flags = 0,       .len = 1, .buf = &reg },
    { .addr = client->addr, .flags = I2C_M_RD, .len = 1, .buf = &val },
};
ret = i2c_transfer(client->adapter, msgs, 2);
```

### 3. SPI driver

```c
static int spi_probe(struct spi_device *spi)
{
    spi->mode = SPI_MODE_0;
    spi->bits_per_word = 8;
    spi_setup(spi);

    struct spi_transfer t = {
        .tx_buf = tx,
        .rx_buf = rx,
        .len    = len,
    };
    struct spi_message m;
    spi_message_init(&m);
    spi_message_add_tail(&t, &m);
    return spi_sync(spi, &m);
}

static struct spi_driver spi_drv = {
    .probe  = spi_probe,
    .driver = { .name = "my-spi", .of_match_table = my_of_match },
};
module_spi_driver(spi_drv);
```

### 4. regmap (preferred for register maps)

```c
static const struct regmap_config my_regmap_config = {
    .reg_bits   = 8,
    .val_bits   = 8,
    .max_register = 0x7F,
};

regmap_read(map, REG_STATUS, &val);
regmap_write(map, REG_CTRL, CTRL_ENABLE);
regmap_update_bits(map, REG_CTRL, MASK, ENABLE);
```

### 5. Debug

```bash
i2cdetect -y 1
i2cdump -y 1 0x48
cat /sys/bus/i2c/devices/i2c-1/1-0048/name
```

### 6. Agent usage

```
/bus-drivers-i2c-spi Write regmap-based driver for I2C PMIC at 0x58
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `-EREMOTEIO` | NACK — wrong address | `i2cdetect`; check `reg` in DT |
| SPI mode wrong | CPOL/CPHA mismatch | Match datasheet + `spi->mode` |
| Probe defer | Regulator/clock supplier | Return `-EPROBE_DEFER` |
| regmap -EIO | 16-bit vs 8-bit reg | Set `reg_bits`, `val_bits` |
| DMA not used | Small `spi_sync` OK | `spi_sync_transfer` for bulk |

## Related Skills

- `skills/kernel/device-drivers` — IRQ, DMA, PM runtime
- `skills/kernel-dev/device-tree` — bus child nodes
- `skills/baremetal/spi-i2c-baremetal` — register-level protocol
- `skills/kernel-dev/platform-device-model` — driver model parallels
- `skills/kernel-dev/writing-char-drivers` — expose sensor via char dev