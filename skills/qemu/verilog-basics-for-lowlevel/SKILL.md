---
name: verilog-basics-for-lowlevel
description: Verilog basics skill for firmware and kernel engineers. Use when reading RTL to understand hardware behavior, reset/clock domains, bus protocols, or collaborating with hardware teams. Activates on queries about Verilog basics, RTL, hardware description, clock domain, reset synchronizer, or MMU in hardware.
---

# Verilog Basics for Low-Level Engineers

## Purpose

Give firmware and kernel engineers enough Verilog/SystemVerilog literacy to read RTL: modules, clocks/resets, combinational vs sequential logic, bus interfaces, and why hardware behavior explains driver bugs — not a replacement for HDL design courses.

## When to Use

- Reference manual unclear — RTL clarifies register behavior
- Understanding CDC (clock domain crossing) bugs
- Correlating DMA/AXI transactions with driver ordering
- Reviewing SoC block diagram with hardware team

## Workflow

### 1. Module structure

```verilog
module uart_tx (
    input  wire       clk,
    input  wire       rst_n,   /* active-low async reset */
    input  wire       start,
    input  wire [7:0] data,
    output reg        busy
);
    /* sequential logic */
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n)
            busy <= 1'b0;
        else if (start)
            busy <= 1'b1;
        /* ... */
    end
endmodule
```

`wire` = combinational/network; `reg` in `always` block = flip-flop unless combinational `always @(*)`.

### 2. Synthesizable subset (what firmware folks need)

| Construct | Meaning |
|-----------|---------|
| `posedge clk` | Registered update |
| `assign x = a & b` | Combinational |
| `case` / `if` in `always @(*)` | Mux logic |
| Parameters `#(.WIDTH(32))` | Configurable width |

Avoid `#delay` in synthesizable RTL — simulation only.

### 3. Reset discipline

- Async assert, sync deassert common (`rst_sync_n`)
- Firmware must wait post-reset setup times — see RM reset chapter
- Multiple reset domains → peripheral may need explicit soft reset bit

### 4. Bus protocols (reading SoC diagrams)

| Bus | Typical use |
|-----|-------------|
| APB | Slow peripherals, simple reg interface |
| AHB | Higher throughput on-chip |
| AXI | DMA, modern SoCs — bursts, channels |

Linux `regmap` MMIO maps to APB/AXI slave decode in RTL address map.

### 5. Clock domains

Signals crossing `clk_a` → `clk_b` need synchronizers (2+ FFs). Metastability causes **intermittent** firmware bugs — not fixed in software alone.

### 6. Simulation vs silicon

```bash
# Typical open-source sim (conceptual)
iverilog -o sim.vvp design.v tb.v
vvp sim.vvp
```

QEMU/peripheral models may not match RTL edge cases.

### 7. Agent usage

```
/verilog-basics-for-lowlevel Explain this APB register block and when STATUS bit updates relative to WRITE
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Bit toggles once | Pulse in RTL | Poll latch / clear-on-read in driver |
| Random corruption | CDC | Hardware synchronizer; don't hack delays |
| Read stale data | Bus bridge buffer | Follow RM ordering / barrier |
| IRQ stuck | Level vs pulse in RTL | Match handler ACK sequence |
| Verilog vs VHDL | Mixed SoC docs | Focus on interface signals table |

## Related Skills

- `skills/baremetal/mmio-and-bit-manipulation` — register access from C
- `skills/baremetal/peripherals-from-datasheet` — RM ↔ RTL
- `skills/baremetal/datasheet-and-refmanual-reading` — doc navigation
- `skills/kernel-dev/device-tree` — hardware integration in Linux
- `skills/qemu/protocol-analysis` — validate bus timing