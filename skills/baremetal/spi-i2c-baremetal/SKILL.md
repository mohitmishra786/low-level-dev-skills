---
name: spi-i2c-baremetal
description: Bare-metal SPI and I2C skill for serial peripheral buses. Use when implementing master-mode transfers, register read/write protocols, or debugging bus stalls. Activates on queries about SPI bare-metal, I2C START/STOP, sensor register read, or clock phase/polarity.
---

# SPI and I2C (Bare-Metal)

## Purpose

Implement SPI and I2C master drivers for sensor and memory chips: clock configuration, phase/polarity (SPI), START/ACK sequences (I2C), and common register-oriented transaction patterns.

## When to Use

- Reading an I2C sensor (WHO_AM_I register)
- SPI flash or display bring-up
- Debugging NACK or stuck SCL
- Replacing HAL_I2C/SPI with minimal code

## Workflow

### 1. SPI master (STM32)

```c
/* Mode 0: CPOL=0, CPHA=0 — check slave datasheet */
SPI1->CR1 = SPI_CR1_MSTR | SPI_CR1_SSM | SPI_CR1_SSI
          | (3 << SPI_CR1_BR_Pos);  /* baud divider */
SPI1->CR1 |= SPI_CR1_SPE;

uint8_t spi_xfer(SPI_TypeDef *spi, uint8_t tx) {
    while (!(spi->SR & SPI_SR_TXE))
        ;
    *(volatile uint8_t *)&spi->DR = tx;
    while (!(spi->SR & SPI_SR_RXNE))
        ;
    return *(volatile uint8_t *)&spi->DR;
}
```

CS (GPIO bit-bang):

```c
GPIO_CS_LOW();
spi_xfer(SPI1, reg | 0x80);  /* read */
uint8_t val = spi_xfer(SPI1, 0xFF);
GPIO_CS_HIGH();
```

### 2. I2C master — register read

```c
/* START → addr+W → reg → repeated START → addr+R → data → STOP */
bool i2c_read_reg(I2C_TypeDef *i2c, uint8_t dev7, uint8_t reg, uint8_t *out) {
    if (!i2c_start(i2c)) return false;
    if (!i2c_tx(i2c, (dev7 << 1) | 0)) return false;
    if (!i2c_tx(i2c, reg)) return false;
    if (!i2c_restart(i2c)) return false;
    if (!i2c_tx(i2c, (dev7 << 1) | 1)) return false;
    *out = i2c_rx(i2c, false);  /* NACK last byte */
    i2c_stop(i2c);
    return true;
}
```

Poll `SB`, `ADDR`, `TXE`, `RXNE`, `BTF` per reference manual.

### 3. Common protocols

| Pattern | Bus |
|---------|-----|
| `reg + write data` | I2C/SPI |
| `0x80|reg` read (MSB set) | SPI sensors |
| 16-bit big-endian length prefix | SPI flash |

### 4. Agent usage

```
/spi-i2c-baremetal I2C read of register 0x0F from device 0x68
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| I2C NACK | Wrong 7-bit addr (8-bit in datasheet) | Shift addr; check R/W bit |
| SPI garbage | CPOL/CPHA mismatch | Match slave mode table |
| Bus stuck SCL low | Slave clock stretch / fault | Bus recovery (clock pulses) |
| CS glitch | CS timing vs clock | Assert CS before first SCK |

## Related Skills

- `skills/baremetal/gpio-baremetal` — CS, SDA, SCL pins
- `skills/baremetal/peripherals-from-datasheet` — timing requirements
- `skills/kernel-dev/bus-drivers-i2c-spi` — Linux kernel side