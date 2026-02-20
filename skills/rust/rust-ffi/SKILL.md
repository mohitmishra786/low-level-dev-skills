---
name: rust-ffi
description: Rust FFI skill for C interoperability. Use when calling C libraries from Rust, generating Rust bindings with bindgen, exporting Rust functions to C with cbindgen, writing safe wrappers around unsafe FFI, or linking system and vendor libraries. Activates on queries about bindgen, cbindgen, extern "C", unsafe FFI, Rust C bindings, linking C from Rust, or sys crates.
---

# Rust FFI

## Purpose

Guide agents through Rust's Foreign Function Interface: calling C from Rust with bindgen, exporting Rust to C with cbindgen, writing safe wrappers, linking libraries via `build.rs`, and structuring sys crates.

## Triggers

- "How do I call a C library from Rust?"
- "How do I use bindgen to generate Rust bindings?"
- "How do I export Rust functions to be called from C?"
- "How do I write a safe wrapper around an unsafe C API?"
- "How do I link a system library in Rust?"
- "What is a sys crate and how do I structure one?"

## Workflow

### 1. Calling C without bindgen (manual declarations)

```rust
// Declare external C functions manually
use std::ffi::{c_int, c_char, c_void, CStr, CString};

extern "C" {
    fn strlen(s: *const c_char) -> usize;
    fn malloc(size: usize) -> *mut c_void;
    fn free(ptr: *mut c_void);
    fn my_lib_init(config: *const c_char) -> c_int;
    fn my_lib_process(handle: *mut c_void, data: *const u8, len: usize) -> c_int;
    fn my_lib_cleanup(handle: *mut c_void);
}

// Call unsafe C function safely
fn init(config: &str) -> Result<*mut c_void, Error> {
    let c_config = CString::new(config)?;
    let result = unsafe { my_lib_init(c_config.as_ptr()) };
    if result != 0 {
        return Err(Error::InitFailed(result));
    }
    // return handle...
    todo!()
}
```

### 2. bindgen for automatic binding generation

```toml
# Cargo.toml
[build-dependencies]
bindgen = "0.70"
```

```rust
// build.rs
use std::path::PathBuf;

fn main() {
    println!("cargo:rerun-if-changed=wrapper.h");
    println!("cargo:rustc-link-lib=mylib");
    println!("cargo:rustc-link-search=/usr/local/lib");

    let bindings = bindgen::Builder::default()
        .header("wrapper.h")
        .clang_arg("-I/usr/local/include")
        .clang_arg("-DMYLIB_VERSION=2")
        // Only generate bindings for this library (not system headers)
        .allowlist_function("mylib_.*")
        .allowlist_type("MyLib.*")
        .allowlist_var("MYLIB_.*")
        // Derive common traits on structs
        .derive_debug(true)
        .derive_default(true)
        // Block problematic types
        .blocklist_type("__va_list_tag")
        .generate()
        .expect("Unable to generate bindings");

    let out_path = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out_path.join("bindings.rs"))
        .expect("Couldn't write bindings!");
}
```

```rust
// src/lib.rs — include generated bindings
#![allow(non_upper_case_globals)]
#![allow(non_camel_case_types)]
#![allow(non_snake_case)]

include!(concat!(env!("OUT_DIR"), "/bindings.rs"));
```

### 3. sys crate pattern

Structure:
```
mylib-sys/
├── Cargo.toml
├── build.rs        # links the library
├── wrapper.h       # C headers to translate
└── src/
    └── lib.rs      # includes generated bindings

mylib/             # safe wrapper
├── Cargo.toml
└── src/
    └── lib.rs
```

```toml
# mylib-sys/Cargo.toml
[package]
name = "mylib-sys"
version = "0.1.0"
links = "mylib"          # tells Cargo this crate links libmylib

[build-dependencies]
bindgen = "0.70"
pkg-config = "0.3"       # for system library detection
```

```rust
// mylib-sys/build.rs
fn main() {
    // Try pkg-config first
    if let Ok(lib) = pkg_config::probe_library("mylib") {
        for path in lib.include_paths {
            println!("cargo:include={}", path.display());
        }
        return;
    }

    // Fallback: compile from vendored source
    cc::Build::new()
        .file("vendor/mylib/src/mylib.c")
        .include("vendor/mylib/include")
        .compile("mylib");

    println!("cargo:rerun-if-changed=vendor/mylib/src/mylib.c");
}
```

### 4. Writing safe wrappers

```rust
// mylib/src/lib.rs
use mylib_sys as ffi;
use std::ffi::{CStr, CString};

pub struct MyLib {
    handle: *mut ffi::mylib_t,
}

// Safety: handle is not shared across threads
unsafe impl Send for MyLib {}
unsafe impl Sync for MyLib {}

impl MyLib {
    pub fn new(config: &str) -> Result<Self, Error> {
        let c_config = CString::new(config).map_err(|_| Error::InvalidConfig)?;
        let handle = unsafe { ffi::mylib_create(c_config.as_ptr()) };
        if handle.is_null() {
            return Err(Error::InitFailed);
        }
        Ok(Self { handle })
    }

    pub fn process(&mut self, data: &[u8]) -> Result<usize, Error> {
        let result = unsafe {
            ffi::mylib_process(self.handle, data.as_ptr(), data.len())
        };
        if result < 0 {
            return Err(Error::ProcessFailed(result));
        }
        Ok(result as usize)
    }
}

impl Drop for MyLib {
    fn drop(&mut self) {
        unsafe { ffi::mylib_destroy(self.handle) };
    }
}
```

### 5. Exporting Rust to C with cbindgen

```toml
# Cargo.toml
[build-dependencies]
cbindgen = "0.27"
```

```rust
// src/lib.rs — exported Rust API
#[no_mangle]
pub extern "C" fn mylib_create(config: *const std::ffi::c_char) -> *mut MyLib {
    // ...
    Box::into_raw(Box::new(instance))
}

#[no_mangle]
pub extern "C" fn mylib_destroy(ptr: *mut MyLib) {
    if !ptr.is_null() {
        unsafe { drop(Box::from_raw(ptr)) };
    }
}

#[no_mangle]
pub extern "C" fn mylib_process(
    ptr: *mut MyLib,
    data: *const u8,
    len: usize,
) -> std::ffi::c_int {
    let lib = unsafe { &mut *ptr };
    match lib.process(unsafe { std::slice::from_raw_parts(data, len) }) {
        Ok(n) => n as std::ffi::c_int,
        Err(_) => -1,
    }
}
```

```rust
// build.rs
fn main() {
    let crate_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
    cbindgen::Builder::new()
        .with_crate(crate_dir)
        .with_language(cbindgen::Language::C)
        .generate()
        .expect("Unable to generate C bindings")
        .write_to_file("include/mylib.h");
}
```

### 6. Linking libraries in build.rs

```rust
// build.rs — common patterns
fn main() {
    // Static library
    println!("cargo:rustc-link-lib=static=mylib");
    println!("cargo:rustc-link-search=native=/path/to/lib");

    // Dynamic library
    println!("cargo:rustc-link-lib=dylib=mylib");

    // Framework (macOS)
    println!("cargo:rustc-link-lib=framework=CoreFoundation");

    // Build C source with cc crate
    cc::Build::new()
        .file("src/helper.c")
        .flag("-std=c11")
        .compile("helper");
}
```

For bindgen and cbindgen configuration details, see [references/bindgen-cbindgen.md](references/bindgen-cbindgen.md).

## Related skills

- Use `skills/rust/rustc-basics` for RUSTFLAGS affecting FFI builds
- Use `skills/rust/cargo-workflows` for build.rs integration and sys crate layout
- Use `skills/zig/zig-cinterop` for Zig's equivalent C interop approach
- Use `skills/binaries/dynamic-linking` for dynamic library linking details
