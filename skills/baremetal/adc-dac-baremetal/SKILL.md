---
name: adc-dac-baremetal
description: Bare-metal ADC and DAC skill. Use when configuring analog sampling, DMA-driven ADC, calibration, or DAC output on MCUs. Activates on queries about ADC bare-metal, sampling time, DMA ADC, or DAC channel setup.
---

# ADC and DAC (Bare-Metal)

## Purpose

Configure ADC and DAC peripherals: channel selection, sampling times, calibration sequences, DMA circular buffers, and DAC static/dynamic output.

## When to Use

- Reading analog sensors (temperature, voltage)
- Audio or control voltage output via DAC
- Continuous sampling with DMA
- Post-reset ADC calibration on STM32

## Workflow

### 1. STM32 ADC single conversion

```c
/* Enable ADC1 and GPIOA clock; PA0 analog mode */
ADC1->CR2 |= ADC_CR2_ADON;
for (volatile int i = 0; i < 10000; i++);  /* stabilization — RM value */

ADC1->SMPR2 |= ADC_SMPR2_SMP0_2;  /* 84 cycles sample time ch0 */
ADC1->SQR3   = 0;                 /* channel 0, 1 conversion */
ADC1->CR2   |= ADC_CR2_SWSTART;

while (!(ADC1->SR & ADC_SR_EOC))
    ;
uint16_t sample = ADC1->DR;
```

Run `ADC_Calibration()` / `ADC_CR2_RSTCAL/CAL` per RM on F1/F4 families.

### 2. DMA circular ADC

```c
/* ADC1 → DMA2 Stream0, circular mode into buffer[64] */
/* Configure DMA: periph-to-mem, halfword, increment mem, circular */
ADC1->CR2 |= ADC_CR2_DMA | ADC_CR2_CONT;
DMA2_Stream0->CR |= DMA_SxCR_EN;
```

Half-transfer / transfer-complete IRQs for double buffering.

### 3. DAC output (STM32)

```c
RCC->APB1ENR |= RCC_APB1ENR_DACEN;
DAC->CR |= DAC_CR_EN1;
DAC->DHR12R1 = 2048;  /* mid-scale 3.3V reference */
```

### 4. Agent usage

```
/adc-dac-baremetal Set up ADC1 channel 0 with DMA circular buffer
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Noisy readings | Short sample time | Increase SMP bits |
| Stuck EOC | Clock not enabled | RCC ADC enable |
| Wrong voltage | Vref not 3.3V | Measure VDDA; calibrate |
| DMA corrupt | Buffer alignment | Use `uint16_t` aligned buffer |

## Related Skills

- `skills/baremetal/dma-baremetal` — ADC DMA streams
- `skills/baremetal/timers-pwm-baremetal` — ADC external trigger
- `skills/baremetal/gpio-baremetal` — analog pin mode