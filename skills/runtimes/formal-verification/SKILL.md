---
name: formal-verification
description: Formal verification skill for systems code in Rust and C. Use when proving absence of panics, overflow or out-of-bounds access, writing Kani proof harnesses or function contracts, bounded model checking C with CBMC, proving ACSL contracts with Frama-C WP, or choosing between model checking, deductive verification, fuzzing and Miri. Activates on queries about Kani, cargo kani, kani::any, CBMC, nondet, unwinding assertion, Frama-C, ACSL, WP, EVA, Verus, Creusot, ESBMC, or formal verification.
---

# Formal Verification for Systems Code

## Purpose

Guide agents through practical formal verification of Rust and C (checked with Kani 0.68, CBMC 6.6 and Frama-C 33.0): choosing a tool, writing harnesses and contracts, reading counterexamples, and fixing the common failures.

## Triggers

- "How do I prove this Rust function can't panic or overflow?"
- "How do I write a Kani proof harness?"
- "How do I model check C code with CBMC?"
- "What does 'unwinding assertion' mean?"
- "How do I prove an ACSL contract with Frama-C?"
- "Should I use fuzzing, Miri or a model checker?"

## Workflow

### 1. Choosing a tool

| Tool | Language | Technique | Proves |
|------|----------|-----------|--------|
| Kani | Rust | Bounded model checking (CBMC backend) | No panics, overflow, UB in `unsafe`; user `assert!`s; function contracts |
| CBMC | C/C++ | Bounded model checking | Bounds, pointer, overflow checks; user `assert`s, up to a loop bound |
| ESBMC | C/C++ | Bounded model checking (SMT) | Similar to CBMC |
| Frama-C WP | C | Deductive (ACSL contracts → provers) | Full contracts for all inputs, loops via invariants |
| Frama-C EVA | C | Abstract interpretation | Absence of runtime errors, sound but may raise false alarms |
| Verus, Creusot | Rust | Deductive | Full functional correctness, needs specs and invariants |

```text
What do you need?
├── Find bugs fast, any input → fuzzing (skills/runtimes/fuzzing)
├── Check one execution for UB in unsafe Rust → Miri
├── Prove a property for ALL inputs, bounded loops → Kani (Rust) / CBMC (C)
├── Prove a C contract for all inputs, unbounded loops → Frama-C WP
└── Prove a whole C program free of runtime errors → Frama-C EVA
```

Bounded model checkers are exhaustive up to the loop bound you give them. Code with unbounded
loops needs a bound plus an unwinding assertion, or contracts and invariants.

### 2. Kani: proof harnesses

```bash
cargo install --locked kani-verifier
cargo kani setup              # downloads the pinned toolchain and CBMC (needs rustup, curl)
cargo kani                    # run every #[kani::proof] in the crate
cargo kani --harness ring_fifo_order
```

```rust
// src/lib.rs
pub struct Ring<const N: usize> {
    head: usize,
    len: usize,
    buf: [u8; N],
}

impl<const N: usize> Ring<N> {
    pub fn new() -> Self { Ring { head: 0, len: 0, buf: [0; N] } }

    pub fn push(&mut self, v: u8) -> bool {
        if self.len == N { return false; }
        let tail = (self.head + self.len) % N;
        self.buf[tail] = v;
        self.len += 1;
        true
    }

    pub fn pop(&mut self) -> Option<u8> {
        if self.len == 0 { return None; }
        let v = self.buf[self.head];
        self.head = (self.head + 1) % N;
        self.len -= 1;
        Some(v)
    }
}

/// Midpoint with a classic overflow bug.
pub fn midpoint(a: u32, b: u32) -> u32 { (a + b) / 2 }

/// Fixed version.
pub fn midpoint_fixed(a: u32, b: u32) -> u32 { a / 2 + b / 2 + (a % 2 + b % 2) / 2 }

#[cfg(kani)]
mod proofs {
    use super::*;

    #[kani::proof]
    fn midpoint_no_overflow() {
        let a: u32 = kani::any();        // every possible u32
        let b: u32 = kani::any();
        let _ = midpoint(a, b);          // Kani reports the overflow
    }

    #[kani::proof]
    fn midpoint_fixed_correct() {
        let a: u32 = kani::any();
        let b: u32 = kani::any();
        let m = midpoint_fixed(a, b);
        assert!(m >= a.min(b) && m <= a.max(b));
        assert_eq!(m as u64, (a as u64 + b as u64) / 2);
    }

    #[kani::proof]
    #[kani::unwind(5)]                   // loops run at most 4 times
    fn ring_fifo_order() {
        let mut r: Ring<4> = Ring::new();
        let n: usize = kani::any();
        kani::assume(n <= 4);            // restrict the input space
        for i in 0..n { assert!(r.push(i as u8)); }
        for i in 0..n { assert_eq!(r.pop(), Some(i as u8)); }
        assert_eq!(r.pop(), None);
    }
}
```

```toml
# Cargo.toml: silence the unknown-cfg warning for `cfg(kani)`
[lints.rust]
unexpected_cfgs = { level = "warn", check-cfg = ['cfg(kani)'] }
```

```text
Checking harness proofs::midpoint_no_overflow...
Failed Checks: attempt to add with overflow
VERIFICATION:- FAILED
...
Complete - 3 successfully verified harnesses, 1 failures, 4 total.
```

`cargo kani -Z concrete-playback --harness midpoint_no_overflow --concrete-playback=print` prints a
`#[test]` that reproduces the failing inputs.

### 3. Kani: function contracts

Contracts let Kani check a function once and reuse its specification at call sites:

```rust
#[cfg_attr(kani, kani::requires(divisor != 0))]
#[cfg_attr(kani, kani::ensures(|r: &u32| *r <= dividend))]
pub fn safe_div(dividend: u32, divisor: u32) -> u32 { dividend / divisor }

#[cfg(kani)]
#[kani::proof_for_contract(safe_div)]
fn safe_div_contract() {
    let _ = safe_div(kani::any(), kani::any());   // inputs constrained by `requires`
}
```

```bash
# Contracts are unstable: without the flag the crate fails to compile
cargo kani -Z function-contracts
# error otherwise: Using the proof_for_contract attribute requires activating
#                  the unstable `function-contracts` feature
```

Callers' harnesses can then use `#[kani::stub_verified(safe_div)]` to replace the body with its
contract (`cargo kani -Z function-contracts -Z stubbing`).

### 4. CBMC: bounded model checking C

```c
/* ring.c — fixed-size ring buffer with an off-by-one bug in ring_push */
#include <stddef.h>
#include <stdbool.h>
#include <stdint.h>

#define CAP 4

struct ring {
    uint8_t buf[CAP];
    size_t head, len;
};

bool ring_push(struct ring *r, uint8_t v)
{
    if (r->len > CAP)                 /* BUG: should be >= */
        return false;
    r->buf[(r->head + r->len) % CAP] = v;
    r->len++;
    return true;
}

bool ring_pop(struct ring *r, uint8_t *out)
{
    if (r->len == 0)
        return false;
    *out = r->buf[r->head];
    r->head = (r->head + 1) % CAP;
    r->len--;
    return true;
}
```

```c
/* harness.c — CBMC proof harness: any sequence of up to 6 pushes/pops */
#include <assert.h>
#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>

#define CAP 4
struct ring { uint8_t buf[CAP]; size_t head, len; };
bool ring_push(struct ring *r, uint8_t v);
bool ring_pop(struct ring *r, uint8_t *out);

bool nondet_bool(void);        /* CBMC treats undefined nondet_* functions as "any value" */
uint8_t nondet_u8(void);

int main(void)
{
    struct ring r = { .head = 0, .len = 0 };
    for (int i = 0; i < 6; i++) {
        if (nondet_bool()) {
            ring_push(&r, nondet_u8());
        } else {
            uint8_t v;
            ring_pop(&r, &v);
        }
        assert(r.len <= CAP);          /* invariant */
        assert(r.head < CAP);
    }
    return 0;
}
```

```bash
cbmc harness.c ring.c \
    --bounds-check --pointer-check --signed-overflow-check --unsigned-overflow-check \
    --unwind 7 --unwinding-assertions
# [main.assertion.1] line 25 assertion r.len <= CAP: FAILURE
# VERIFICATION FAILED

# Counterexample: the sequence of states leading to the failure
cbmc harness.c ring.c --bounds-check --pointer-check --unwind 7 --unwinding-assertions --trace
#   r.len=5ul ...  Violated property: file harness.c function main line 25

# After fixing `>` to `>=`:  ** 0 of 75 failed  /  VERIFICATION SUCCESSFUL
```

`--unwind N` must exceed the iteration count of every loop. With `--unwinding-assertions`, a bound
that is too small is reported (`unwinding assertion loop 0: FAILURE`) instead of silently
skipping paths. For multi-file builds use `goto-cc` to produce a goto binary, then run `cbmc` on it.

### 5. Frama-C WP: deductive proof of ACSL contracts

```c
/* abs.c — prove the contract, including absence of overflow */
#include <limits.h>

/*@ requires x > INT_MIN;
    assigns \nothing;
    ensures \result >= 0;
    ensures x >= 0 ==> \result == x;
    ensures x <  0 ==> \result == -x;
*/
int my_abs(int x)
{
    return x < 0 ? -x : x;
}

/*@ requires n >= 0 && \valid_read(a + (0 .. n-1));
    assigns \nothing;
    ensures \forall integer i; 0 <= i < n ==> \result >= a[i];
*/
int max_of(const int *a, int n)
{
    int m = INT_MIN;
    /*@ loop invariant 0 <= i <= n;
        loop invariant \forall integer j; 0 <= j < i ==> m >= a[j];
        loop assigns i, m;
        loop variant n - i;
    */
    for (int i = 0; i < n; i++)
        if (a[i] > m) m = a[i];
    return m;
}
```

```bash
# -wp-rte adds runtime-error goals (overflow, division by zero, invalid access)
frama-c -wp -wp-rte abs.c
# [wp] Proved goals:   22 / 22

# Without `requires x > INT_MIN`, the overflow goal cannot be proved:
# [wp] [Timeout] typed_my_abs_assert_rte_signed_overflow
# [wp] Proved goals:    2 / 3
```

Loops need `loop invariant`, `loop assigns` and a `loop variant` (termination). A goal that times
out is either false or needs a stronger invariant; try `-wp-timeout 30` before rewriting.
Frama-C publishes `framac/frama-c` Docker images (amd64); distributions often lag behind.

### 6. Frama-C EVA: absence of runtime errors

EVA analyses a whole program from `main`. Use `Frama_C_interval` for nondeterministic inputs and
ACSL assertions for properties:

```c
#include "__fc_builtin.h"   /* Frama_C_interval */
/* ... same ring declarations as the CBMC harness ... */
int main(void)
{
    struct ring r = { .head = 0, .len = 0 };
    for (int i = 0; i < 6; i++) {
        if (Frama_C_interval(0, 1))
            ring_push(&r, (uint8_t)Frama_C_interval(0, 255));
        else { uint8_t v; ring_pop(&r, &v); }
        //@ assert r.len <= CAP;
        //@ assert r.head < CAP;
    }
    return 0;
}
```

```bash
frama-c -eva -eva-precision 3 harness_eva.c ring.c
# buggy ring:  [eva:alarm] harness_eva.c:24: Warning: assertion got status unknown.
# fixed ring:  100% of the logical properties reached have been proven.
```

Comments inside a `//@` annotation are a parse error (`unexpected block-comment opening`).

### 7. Running proofs in CI

- Keep harnesses small and focused; a harness per function or invariant parallelizes well.
- Pin tool versions (`cargo install kani-verifier --version ...`, a Frama-C image tag).
- Kani: `cargo kani --output-format terse` prints a compact summary; make the job fail when any harness fails.
- CBMC: commit the exact command line with `--unwind` values next to the harness.
- Use proofs alongside fuzzing: fuzzers cover unbounded behaviour, proofs cover all inputs within bounds.

### 8. Common problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `unwinding assertion loop N: FAILURE` | `--unwind`/`#[kani::unwind]` below the loop's iteration count | Raise the bound, or constrain inputs with `assume` |
| Kani/CBMC runs for hours | State space too large (big arrays, deep loops, many nondet values) | Smaller bounds, smaller types, stubs for heavy functions |
| `proof_for_contract ... requires activating the unstable function-contracts feature` | Contracts are unstable in Kani | `cargo kani -Z function-contracts` |
| Kani check `unsupported_construct` | Code Kani cannot model (some intrinsics, foreign calls) | `#[kani::stub(f, f_stub)]` with `-Z stubbing`, or a contract |
| `cargo kani setup` fails downloading | No `curl`, or `CARGO_HOME` without rustup | Install curl; keep the default rustup/cargo homes |
| WP goal `Timeout` | Goal is false, or invariant too weak | Check with a counterexample tool, strengthen invariants, raise `-wp-timeout` |
| EVA alarm on CBMC-style `nondet_*()` | EVA has no spec for undefined functions | Use `Frama_C_interval` from `__fc_builtin.h` |

## Related skills

- Use `skills/runtimes/fuzzing` for finding bugs with libFuzzer/AFL and cargo-fuzz
- Use `skills/rust/rust-sanitizers-miri` for Miri and sanitizers on Rust code
- Use `skills/rust/rust-unsafe` for the invariants Kani checks in `unsafe` code
- Use `skills/build-systems/static-analysis` for clang-tidy, cppcheck and other analyzers
