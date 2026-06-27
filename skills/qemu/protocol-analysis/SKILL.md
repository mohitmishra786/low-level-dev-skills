---
name: protocol-analysis
description: Protocol analysis skill for serial bus debugging. Use when decoding I2C/SPI/UART with logic analyzer concepts, sigrok/PulseView, or Python capture scripts. Activates on queries about logic analyzer, sigrok, PulseView, decode I2C SPI UART, or bus protocol capture.
---

# Protocol Analysis (I2C / SPI / UART)

## Purpose

Guide agents through software-side serial bus analysis: logic analyzer workflow, sigrok/PulseView decoding, correlating captures with firmware drivers, and Python-based parsing — bridging `skills/baremetal/spi-i2c-baremetal` and hardware bring-up.

## When to Use

- Sensor not responding — verify clock and data on bus
- Compare kernel driver transactions vs datasheet
- Document expected transaction format for CI/regression
- Teaching protocol layers without expensive lab gear (sim + decode)

## Workflow

### 1. Capture stack

```
Physical probe → logic analyzer hardware (or GPIO bit-bang)
├── sigrok-cli / PulseView GUI
├── Protocol decoder (i2c, spi, uart)
└── Export VCD/CSV for scripts
```

Open-source: [sigrok](https://sigrok.org/) with cheap FX2LA boards.

### 2. PulseView quick start

```bash
# List devices
pulseview

# CLI capture (device-dependent)
sigrok-cli --driver fx2lafw --config samplerate=1MHz \
  --channels 0=SDA,1=SCL \
  --samples 1m \
  --protocols i2c
```

### 3. I2C decode expectations

| Phase | Lines |
|-------|-------|
| START | SDA fall while SCL high |
| Address + R/W | 7 bits + ACK |
| Data bytes | ACK per byte |
| STOP | SDA rise while SCL high |

NACK at address → wrong `0x48` or device held in reset.

### 4. SPI decode

Check mode (CPOL/CPHA), bit order (MSB first typical), CS polarity, and word size. Compare to `spi_setup()` in `skills/kernel-dev/bus-drivers-i2c-spi`.

### 5. UART decode

Set baud (9600/115200), frame (8N1), and signal polarity. Async — sample rate must be ≥ 4× baud for LA.

### 6. Python post-process (csv)

```python
import csv

with open("capture.csv") as f:
    for ts, ch0, ch1 in csv.reader(f):
        # edge detect, reconstruct bits
        pass
```

### 7. Correlate with firmware

```
Logic capture timestamp
├── Match driver reg write sequence
├── Compare inter-byte delay vs datasheet max
└── Flag extra clock pulses (mode fault)
```

### 8. Agent usage

```
/protocol-analysis Decode this I2C capture — device NACKs after register 0x0F write
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Garbage decode | Wrong samplerate | ≥ 4× bus speed |
| Floating lines | Missing pull-ups | Enable internal pull or external |
| SPI shifted bits | Mode mismatch | CPOL/CPHA table from RM |
| UART framing errors | Baud drift | Measure actual bit time |
| No decoder | Missing sigrok build | Install `sigrok-cli` + decoders |

## Related Skills

- `skills/baremetal/spi-i2c-baremetal` — firmware-side protocol
- `skills/baremetal/uart-serial-baremetal` — UART config
- `skills/kernel-dev/bus-drivers-i2c-spi` — kernel transactions
- `skills/profilers/strace-ltrace` — userspace syscall trace analog
- `skills/embedded/openocd-jtag` — scope alongside SWD debug