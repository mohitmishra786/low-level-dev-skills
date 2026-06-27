---
name: hare-lang
description: Hare language skill for simple systems programming. Use when building with hare build/test/run, Hare stdlib, C FFI with @extern, tagged union error handling, or comparing Hare vs C/Zig. Activates on queries about Hare language, hare build, @extern, tagged union, or Hare stdlib.
---

# Hare

## Purpose

Guide agents through the Hare programming language: design philosophy (simple, stable, compiled), `hare build`/`test`/`run` workflows, stdlib overview, C FFI with `@extern`, the type system (tagged unions, slices), error handling with `(T | error!)`, and comparison with C and Zig for systems utilities.

## When to Use

- Writing small system utilities with C-like control and modern safety
- Building CLI tools or daemons with minimal dependencies
- Calling C libraries from Hare or exporting Hare functions to C
- Preferring explicit error handling over exceptions
- Evaluating Hare vs C or Zig for a new project
- Needing a stable, auditable codebase without heavy runtime

## Workflow

### 1. Install Hare

```bash
# Linux/macOS — build from source
git clone https://git.sr.ht/~sircmpwn/hare
cd hare
make check   # builds and runs tests
sudo make install

hare version
```

```bash
# Create project (Hare has no project generator — lay out manually)
mkdir -p mytool && cd mytool
cat > hare.mod << 'EOF'
module mytool
EOF
```

### 2. Hello world and build

```hare
// main.ha
use fmt;

export fn main() void = {
	fmt::println("Hello, Hare!")!;
};
```

```bash
hare build -o mytool
./mytool

hare run .        # build and run
hare test         # run tests
```

### 3. Stdlib overview

| Module | Purpose |
|--------|---------|
| `fmt` | Formatted I/O (`printf`, `println`) |
| `io` | Reader/writer interfaces |
| `os` | Files, environment, args |
| `strings` | String manipulation |
| `bufio` | Buffered I/O |
| `encoding` | JSON, hex, etc. |
| `net` | TCP/UDP networking |
| `time` | Dates and durations |
| `mem` | Memory helpers |
| `types` | Platform integer types |

```hare
use os;
use fmt;
use strings;

export fn main() void = {
	const args = os::args;
	for (let i = 0z; i < len(args); i += 1) {
		fmt::println(args[i])!;
	};
};
```

### 4. Error handling

```hare
// Errors are tagged union values — explicit propagation with !
fn read_file(path: str) (str | os::error) = {
	const file = os::open(path)?;
	defer os::close(file);
	let buf: []u8 = [];
	io::readall(file, &buf)?;
	return strings::fromutf8(buf)!;
};

export fn main() void = {
	match (read_file("config.txt")) {
	case let s: str =>
		fmt::println(s)!;
	case let err: os::error =>
		fmt::fatalf("error: {}", err)!;
	};
};
```

`?` propagates errors; `!` asserts success in infallible context; `match` for handling.

### 5. Type system

```hare
// Tagged union
type color = (u8 | u16 | void);

fn get_color(c: color) u16 = {
	match (c) {
	case let v: u8 => return v: u16;
	case let v: u16 => return v;
	case => abort();
	};
};

// Slices — pointer + length
fn sum(nums: []i32) i32 = {
	let total = 0i32;
	for (let i = 0z; i < len(nums); i += 1) {
		total += nums[i];
	};
	return total;
};
```

No implicit conversions — explicit casts required.

### 6. C FFI — @extern

```hare
// Link against C library
use c;

@extern("c") fn strlen(s: *const u8) size;

export fn main() void = {
	const s = "hello";
	fmt::println(len(s))!;  // Hare strlen via strings module
};
```

Export Hare to C:

```hare
// Exported C ABI function
export fn my_add(a: i32, b: i32) i32 = {
	return a + b;
};
```

```bash
hare build -o libmytool.a
# Link from C with generated headers or manual declarations
```

```hare
// cgo-style module linking in hare.mod
module mytool
require (
    libc
)
```

### 7. Testing

```hare
@test fn test_add() void = {
	assert(sum(&[1i32, 2, 3]) == 6);
};

@test fn test_error() void = {
	match (read_file("/nonexistent")) {
	case => abort("expected error");
	case let err: os::error => void;
	};
};
```

```bash
hare test -v
```

### 8. Hare vs C vs Zig

| Aspect | Hare | C | Zig |
|--------|------|---|-----|
| Memory safety | Some (no null, tagged errors) | Manual | Manual + optional safety |
| Compile time | Fast | Fast | Comptime heavy |
| Stdlib | Minimal, stable | libc | Extensive |
| C interop | `@extern` | Native | `@cImport` |
| Generics | No (comptime limited) | No | Comptime generics |
| Best for | Utilities, tools | Everything | Systems with metaprogramming |

### 9. Use cases

```
Good Hare fits
├── CLI utilities (grep-like, init tools)
├── Build tools and scripts replacing shell
├── Network daemons with simple protocol
└── Auditable security-sensitive code

Consider C/Zig instead when
├── Heavy generic metaprogramming needed (Zig)
├── Existing massive C ecosystem glue
└── GPU/kernel domains with immature Hare support
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `unknown type` | Missing import | Add `use module;` |
| FFI link error | Library not in hare.mod | Add require; correct `-l` flags |
| Error not handled | Missing `?` or match | Propagate or handle all cases |
| UTF-8 error | Invalid bytes in string | Validate with `strings::fromutf8` |
| Test not found | Missing `@test` | Name fn with `@test` attribute |
| Platform syscall missing | Hare stdlib gap | Use `@extern` to libc |

## Related Skills

- `skills/zig/zig-compiler` — Zig as alternative systems language
- `skills/zig/zig-cinterop` — Zig C interop comparison
- `skills/compilers/gcc` — C toolchain alongside Hare
- `skills/languages/carbon-lang` — other emerging systems languages
- `skills/build-systems/make` — integrating Hare into Makefiles
- `skills/runtime-safety/sanitizers` — C interop safety testing