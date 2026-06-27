---
name: device-tree
description: Device tree skill for Linux hardware description. Use when writing DTS/DTSI, bindings, overlays, phandles, or debugging OF platform probe failures. Activates on queries about device tree, DTS syntax, phandle, devicetree bindings, DT overlay, or OF graph.
---

# Device Tree (Devicetree)

## Purpose

Guide agents through Linux device tree source (DTS): syntax, bindings, phandles, overlays, and how the kernel OF (Open Firmware) layer parses hardware description into `platform_device` instances.

## When to Use

- Platform driver not probing — DT mismatch
- Adding a new board `.dts` or fragment overlay
- Understanding `compatible`, `reg`, `interrupts`, `clocks` properties
- Cross-checking hardware with `skills/kernel-dev/platform-device-model`

## Workflow

### 1. DTS structure

```dts
/dts-v1/;
#include "soc.dtsi"

/ {
    model = "My Board";
    compatible = "vendor,my-board", "vendor,soc-family";

    soc {
        uart0: serial@40011000 {
            compatible = "vendor,uart";
            reg = <0x40011000 0x400>;
            interrupts = <GIC_SPI 38 IRQ_TYPE_LEVEL_HIGH>;
            clocks = <&clk_uart0>;
            status = "okay";
        };
    };
};
```

### 2. Key properties

| Property | Meaning |
|----------|---------|
| `compatible` | Driver match string (most specific first) |
| `reg` | MMIO address + length ( `#address-cells`, `#size-cells` ) |
| `interrupts` | IRQ specifier (interrupt parent defines cells) |
| `clocks` / `clock-names` | phandle to clock provider |
| `status` | `"disabled"` skips probe |

### 3. Phandles

```dts
clk_uart0: clock-uart {
    compatible = "vendor,clk";
    #clock-cells = <0>;
};

serial@... {
    clocks = <&clk_uart0>;  /* phandle reference */
};
```

### 4. Kernel parsing

```
OF core reads DTB at boot
├── of_platform_populate() creates platform_devices
└── driver `.of_match_table` matches `compatible`
```

```c
static const struct of_device_id my_of_match[] = {
    { .compatible = "vendor,uart" },
    { }
};
MODULE_DEVICE_TABLE(of, my_of_match);
```

### 5. Compile and inspect

```bash
dtc -I dts -O dtb -o board.dtb board.dts
dtc -I fs -O dts /proc/device-tree 2>/dev/null | less
ls /sys/firmware/devicetree/base/
```

Bindings live at [devicetree.org](https://www.devicetree.org/) — always cite binding name in commits.

### 6. Overlays (configfs)

```bash
# Runtime overlay apply (when CONFIG_OF_OVERLAY)
mkdir -p /config/device-tree/overlays/my-overlay
cat my-overlay.dtbo > /config/device-tree/overlays/my-overlay/dtbo
```

### 7. Agent usage

```
/device-tree Write DTS fragment for I2C sensor on i2c1 with interrupt on GPIO5
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Driver not bound | `compatible` typo | Match driver's `of_match_table` |
| Wrong MMIO | `#address-cells` mismatch | Follow SoC `.dtsi` |
| IRQ not firing | Wrong interrupt parent/cells | Copy from working board DTS |
| Probe defer loop | Clock/regulator missing | `-EPROBE_DEFER` supplier in DT |
| Overlay fails | Symbol unresolved | `__fixups__` / label exports |

## Related Skills

- `skills/kernel-dev/platform-device-model` — probe and sysfs
- `skills/kernel/device-drivers` — `devm_of_iomap`
- `skills/baremetal/datasheet-and-refmanual-reading` — HW to DT mapping
- `skills/embedded/zephyr` — Zephyr devicetree (different tooling)
- `skills/kernel-dev/bus-drivers-i2c-spi` — bus node children