---
name: rust-for-linux
description: Rust-for-Linux skill for writing Linux kernel modules and drivers in Rust. Use when setting up a kernel Rust toolchain, writing a module with the module! macro, using pin-init for locks and registrations, building out-of-tree Rust modules, writing misc or platform drivers in Rust, or testing kernel Rust code with KUnit. Activates on queries about Rust for Linux, CONFIG_RUST, kernel crate, module! macro, pin_init, try_pin_init!, KBox/KVec, rustavailable, or Rust kernel drivers.
---

# Rust for Linux

## Purpose

Guide agents through writing Linux kernel code in Rust (examples checked against Linux 7.3): toolchain setup, the `kernel` crate, pin-init, out-of-tree modules, misc and platform drivers, and testing with KUnit.

## Triggers

- "How do I write a Linux kernel module in Rust?"
- "`make rustavailable` says Rust is not available"
- "How does pin-init / `try_pin_init!` work for a kernel mutex?"
- "How do I build an out-of-tree Rust kernel module?"
- "Is there a Rust abstraction for this subsystem yet?"
- "How do I test kernel Rust code with KUnit?"

## Workflow

### 1. Status and when to use Rust

Rust stopped being experimental in Linux 7.0 (April 2026). In-tree users include the Android
Binder driver, the Nova (NVIDIA) and Tyr (Arm Mali) GPU drivers, the null block driver, several
PHY drivers and the DRM panic QR generator. Rust is still not enabled by default.

```text
New driver?
├── Subsystem has Rust abstractions (rust/kernel/<subsystem>.rs)?
│   ├── Yes → Rust is a good fit; follow samples/rust/ for the pattern
│   └── No  → C driver, or write the abstraction first (upstream review needed)
└── Touching an existing C driver → stay in C; Rust is per-module, not per-function
```

Abstractions change between releases. Check `rust/kernel/` and `samples/rust/` in the tree you
build against rather than copying code written for another version.

### 2. Toolchain setup

| Tool | Minimum for 7.3 (`scripts/min-tool-version.sh`) |
|------|--------------------------------------------------|
| rustc | 1.85.0 (1.95 powerpc, 1.96 s390) |
| bindgen | 0.71.1 (`bindgen-cli`) |
| LLVM/Clang | 17.0.1 |

```bash
# Rust toolchain plus the standard library source (core is rebuilt for the kernel)
rustup component add rust-src
cargo install --locked bindgen-cli

# Clang/LLVM build of the kernel (mixed GCC + Rust builds are still experimental)
make LLVM=1 rustavailable     # explains exactly what is missing

# Enable Rust: General setup → Rust support (CONFIG_RUST=y)
make LLVM=1 menuconfig
make LLVM=1 -j"$(nproc)"

# Editor support: writes rust-project.json for rust-analyzer
make LLVM=1 rust-analyzer
```

`CONFIG_RUST` cannot be enabled together with `RANDSTRUCT`/`GCC_PLUGIN_RANDSTRUCT`, or with
`MODVERSIONS` unless `GENDWARFKSYMS` is set. If the option does not show up in menuconfig, run
`rustavailable` and check those dependencies.

### 3. A minimal module

```rust
// hello_rust.rs
// SPDX-License-Identifier: GPL-2.0
//! Out-of-tree Rust module example.

use kernel::prelude::*;

module! {
    type: HelloRust,
    name: "hello_rust",
    authors: ["Example Author"],
    description: "Out-of-tree Rust module",
    license: "GPL",
    params: {
        count: u32 {
            default: 3,
            description: "Number of values to allocate",
        },
    },
}

struct HelloRust {
    values: KVec<u32>,
}

impl kernel::Module for HelloRust {
    fn init(_module: &'static ThisModule) -> Result<Self> {
        let n = module_parameters::count.value();
        // Every allocation takes GFP flags and can fail: no hidden panics
        let mut values = KVec::with_capacity(n as usize, GFP_KERNEL)?;
        for i in 0..n {
            values.push(i * i, GFP_KERNEL)?;
        }
        pr_info!("loaded with {} values\n", values.len());
        Ok(HelloRust { values })
    }
}

impl Drop for HelloRust {
    // Drop is the module exit path
    fn drop(&mut self) {
        pr_info!("unloading, values = {:?}\n", self.values);
    }
}
```

```make
# Kbuild
obj-m := hello_rust.o
```

```make
# Makefile
KDIR ?= /lib/modules/$(shell uname -r)/build

default:
	$(MAKE) LLVM=1 -C $(KDIR) M=$$PWD modules

clean:
	$(MAKE) LLVM=1 -C $(KDIR) M=$$PWD clean
```

```bash
make KDIR=~/src/linux          # tree built with CONFIG_RUST=y and the same toolchain
sudo insmod hello_rust.ko count=4
sudo rmmod hello_rust
```

The kernel must be built with `CONFIG_RUST=y` and the same `rustc` version as the module; the
`.rmeta` files of the `kernel` crate are not compatible across compiler versions.

### 4. Kernel crate essentials

| Userspace Rust | Kernel Rust | Notes |
|----------------|-------------|-------|
| `Vec<T>`, `Box<T>` | `KVec<T>`, `KBox<T>`, `VVec`/`KVVec` | Every allocation takes `GFP_KERNEL`/`GFP_ATOMIC` and returns `Result` |
| `println!` | `pr_info!`, `pr_err!`, `dev_info!(dev, ...)` | `pr_*!` prefix the module name; end messages with `\n` |
| `std::io::Error` | `kernel::error::Error` (`EINVAL`, `ENOMEM`, `ENOTTY`, ...) | `Result<T>` = `Result<T, Error>`; errors map to `-errno` for C |
| `&CStr` from bytes | `c"name"` literals | Passed straight to C APIs |
| `std::sync::Mutex` | `kernel::sync::Mutex`, `SpinLock`, `Arc` | Must be pinned (section 5) |
| `unwrap()` | `?` | A panic is a kernel BUG; avoid `unwrap`/`expect`/indexing that can panic |

### 5. Pin-init: locks and registrations

Kernel locks, list heads and device registrations must not move after initialization. Rust
expresses this with `Pin` and the pin-init macros, which build the value in place:

```rust
//! Misc device whose per-open state holds a pinned mutex.

use kernel::{
    miscdevice::{MiscDevice, MiscDeviceOptions, MiscDeviceRegistration},
    new_mutex,
    prelude::*,
    sync::Mutex,
};

module! {
    type: MyModule,
    name: "my_misc",
    authors: ["Example Author"],
    description: "Misc device with pinned state",
    license: "GPL",
}

#[pin_data]
struct MyModule {
    #[pin]
    _miscdev: MiscDeviceRegistration<MyDevice>,   // registered in place, never moved
}

// InPlaceModule: init returns an initializer instead of a value
impl kernel::InPlaceModule for MyModule {
    fn init(_module: &'static ThisModule) -> impl PinInit<Self, Error> {
        let options = MiscDeviceOptions { name: c"my-misc" };
        try_pin_init!(Self {
            _miscdev <- MiscDeviceRegistration::register(options),   // `<-` = pinned init
        })
    }
}

#[pin_data]
struct MyDevice {
    #[pin]
    inner: Mutex<KVVec<u8>>,
}

#[vtable]
impl MiscDevice for MyDevice {
    type Ptr = Pin<KBox<Self>>;

    // Called on open(2): allocate per-file state, pinned on the heap
    fn open(_file: &kernel::fs::File, _misc: &MiscDeviceRegistration<Self>) -> Result<Self::Ptr> {
        KBox::try_pin_init(
            try_pin_init!(MyDevice { inner <- new_mutex!(KVVec::new()) }),
            GFP_KERNEL,
        )
    }
}
```

Key rules:

- `#[pin_data]` on the struct, `#[pin]` on fields that must not move.
- `field <- initializer` for pinned fields; `field: value` for ordinary ones.
- `try_pin_init!` when an initializer can fail; it returns `impl PinInit<T, Error>`.
- Custom destructors on pinned types use `#[pin_data(PinnedDrop)]` and `#[pinned_drop] impl PinnedDrop`.
- File operations you do not implement return `EINVAL` (here, `read(2)` on `/dev/my-misc`).
- `samples/rust/rust_misc_device.rs` adds `read_iter`/`write_iter`/`ioctl` with `UserSlice` for user copies.

### 6. Drivers

Bus drivers implement a trait (`platform::Driver`, `pci::Driver`, `i2c::Driver`, ...) and register
with a macro that also generates the `module!` boilerplate:

```rust
//! Minimal platform driver matched from the device tree.

use kernel::{of, platform, prelude::*, sync::aref::ARef};

struct MyDriver {
    pdev: ARef<platform::Device>,
}

kernel::of_device_table!(
    OF_TABLE,
    <MyDriver as platform::Driver>::IdInfo,
    [(of::DeviceId::new(c"vendor,my-device"), ())]
);

impl platform::Driver for MyDriver {
    type IdInfo = ();
    type Data<'bound> = Self;
    const OF_ID_TABLE: Option<of::IdTable<Self::IdInfo>> = Some(&OF_TABLE);

    fn probe<'bound>(
        pdev: &'bound platform::Device<kernel::device::Core<'_>>,
        _info: Option<&'bound Self::IdInfo>,
    ) -> impl PinInit<Self, Error> + 'bound {
        dev_info!(pdev.as_ref(), "probed\n");
        Ok(Self { pdev: pdev.into() })
    }
}

impl Drop for MyDriver {
    fn drop(&mut self) {
        dev_info!(self.pdev.as_ref(), "removed\n");
    }
}

kernel::module_platform_driver! {
    type: MyDriver,
    name: "my_platform_driver",
    authors: ["Example Author"],
    description: "Rust platform driver",
    license: "GPL v2",
}
```

The driver signatures (`'bound` lifetimes, `Data<'bound>`, `Core` device context) are the 7.3
form. They changed in recent releases; copy from `samples/rust/rust_driver_platform.rs` in your tree.

### 7. Unsafe code and C interop

```rust
// Raw C API: generated bindings live in the `bindings` crate
// SAFETY: explain why every precondition of the C function holds here
let ret = unsafe { kernel::bindings::some_c_function(ptr) };
```

- Drivers should use safe abstractions; `unsafe` belongs in `rust/kernel/` abstractions.
- Every `unsafe` block needs a `// SAFETY:` comment; every `unsafe fn` a `/// # Safety` section.
- Static inline C functions and macros are reached through `rust/helpers/*.c` wrappers.
- `make LLVM=1 CLIPPY=1` lints, `make LLVM=1 rustfmtcheck` checks formatting.

### 8. Testing

```rust
// Unit tests run as KUnit tests inside the kernel
#[cfg(CONFIG_RUST_MYMOD_KUNIT_TEST)]
#[kunit_tests(rust_kernel_mymod)]
mod tests {
    use super::*;

    #[test]
    fn test_sum() -> Result {
        let mut v = KVec::new();
        v.push(2u32, GFP_KERNEL)?;
        v.push(3u32, GFP_KERNEL)?;
        assert_eq!(v.iter().sum::<u32>(), 5);
        Ok(())
    }
}
```

```bash
# Doctests of the kernel crate run as KUnit tests: CONFIG_RUST_KERNEL_DOCTESTS=y
./tools/testing/kunit/kunit.py run --make_options LLVM=1 \
    --kconfig_add CONFIG_RUST=y --kconfig_add CONFIG_RUST_KERNEL_DOCTESTS=y

# Host-side tests for the macros and other host crates
make LLVM=1 rusttest

# Generated API documentation for your tree
make LLVM=1 rustdoc     # output: Documentation/output/rust/rustdoc/kernel/index.html
```

Useful debug options: `CONFIG_RUST_DEBUG_ASSERTIONS`, `CONFIG_RUST_OVERFLOW_CHECKS`.

### 9. Common problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `rustavailable` reports a missing or too old tool | rustc/bindgen/libclang below the minimum | Install versions from section 2; set `RUSTC=`/`BINDGEN=` if several are installed |
| `Rust support` not offered in menuconfig | A conflicting option (RANDSTRUCT, MODVERSIONS without GENDWARFKSYMS) or `RUST_IS_AVAILABLE=n` | Disable the conflict; rerun `rustavailable` |
| Source for `core` not found | `rust-src` component missing (distro toolchains) | `rustup component add rust-src`, or set `RUST_LIB_SRC` |
| Out-of-tree module fails with crate version errors | Module built with a different rustc than the kernel | Use the exact rustc used for the kernel tree |
| `CONFIG_RUST` disappears after `olddefconfig` | Toolchain check failed (e.g. no `rust-src`), so `RUST_IS_AVAILABLE=n` and Kconfig drops `RUST` silently | Run `make LLVM=1 rustavailable`, fix it, re-enable `CONFIG_RUST` |
| `insmod: invalid module format`, dmesg: `.gnu.linkonce.this_module section size must match` | `.ko` built against an older config of the tree | `make clean` in the module directory and rebuild |
| `error[E0277]` on a lock or registration field | Value not pinned | Use `#[pin_data]`, `#[pin]` and `<-` in `try_pin_init!` |
| Missing abstraction for a C API | Not wrapped yet | Write a safe wrapper in `rust/kernel/` (upstream review) or keep that part in C |

## Related skills

- Use `skills/kernel-dev/writing-char-drivers` for the C equivalent of misc/char devices
- Use `skills/kernel-dev/platform-device-model` for platform devices and device tree matching
- Use `skills/rust/rust-no-std` for `core`/`alloc` without `std`
- Use `skills/rust/rust-unsafe` for writing and documenting `unsafe` code
- Use `skills/kernel/kernel-testing` for KUnit and kselftest
- Use `skills/kernel-dev/qemu-for-kernel-development` to boot test kernels quickly
