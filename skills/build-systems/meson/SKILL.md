---
name: meson
description: Meson build system skill for C/C++ projects. Use when setting up a Meson project, configuring build options, managing dependencies with the wrap system, cross-compiling, or integrating Meson with CI. Activates on queries about meson setup, meson compile, meson wrap, meson test, cross-file, meson.build, or migrating from CMake/Autotools to Meson.
---

# Meson

## Purpose

Guide agents through Meson project setup, build configuration, the wrap dependency system, and cross-compilation — covering the build system used by GLib, systemd, GStreamer, Mesa, and many major C/C++ projects.

## Triggers

- "How do I set up a Meson build?"
- "How do I add a dependency in Meson?"
- "How do I cross-compile with Meson?"
- "Meson wrap isn't finding my dependency"
- "How do I configure build options in Meson?"
- "How do I migrate from CMake/Autotools to Meson?"

## Workflow

### 1. Project setup

```bash
# Configure (source-dir, build-dir are positional)
meson setup builddir

# With options
meson setup builddir \
    --buildtype=release \
    --prefix=/usr/local \
    -Db_lto=true \
    -Db_sanitize=address

# Reconfigure (change options on existing builddir)
meson configure builddir -Dbuildtype=debug

# Show all available options
meson configure builddir
```

| `--buildtype` | Equivalent flags |
|---------------|-----------------|
| `debug` (default) | `-O0 -g` |
| `debugoptimized` | `-O2 -g` |
| `release` | `-O3 -DNDEBUG` |
| `minsize` | `-Os -DNDEBUG` |
| `plain` | No flags added |

### 2. Build and test

```bash
# Build (from source directory)
meson compile -C builddir

# Or enter builddir and use ninja directly
cd builddir && ninja

# Run tests
meson test -C builddir
meson test -C builddir --verbose          # show test output
meson test -C builddir -t 5               # 5x timeout multiplier
meson test -C builddir --suite unit       # run only 'unit' suite

# Install
meson install -C builddir
# Dry run
meson install -C builddir --dry-run
```

### 3. meson.build structure

```python
project('myapp', 'c', 'cpp',
  version : '1.0.0',
  default_options : [
    'c_std=c11',
    'cpp_std=c++17',
    'warning_level=2',
  ]
)

# Find system dependencies
glib_dep = dependency('glib-2.0', version : '>=2.68')
threads_dep = dependency('threads')

# Include directories
inc = include_directories('include')

# Library
mylib = static_library('mylib',
  sources : ['src/lib.c', 'src/util.c'],
  include_directories : inc,
)

# Executable
executable('myapp',
  sources : ['src/main.c'],
  include_directories : inc,
  link_with : mylib,
  dependencies : [glib_dep, threads_dep],
  install : true,
)

# Tests
test('basic', executable('test_basic',
  sources : ['tests/test_basic.c'],
  link_with : mylib,
))
```

### 4. Dependency management with wrap

```bash
# Search for a wrap
meson wrap search zlib

# Install a wrap (downloads .wrap file from wrapdb)
meson wrap install zlib
meson wrap install gtest

# List installed wraps
meson wrap list

# Update all wraps
meson wrap update
```

In `meson.build`:

```python
# Use wrap as fallback if system lib not found
zlib_dep = dependency('zlib',
  fallback : ['zlib', 'zlib_dep'],  # [wrap_name, dep_variable]
)

# Force wrap (for reproducible builds)
zlib_dep = dependency('zlib',
  fallback : ['zlib', 'zlib_dep'],
  default_options : ['default_library=static'],
)
```

`subprojects/zlib.wrap` structure:

```ini
[wrap-file]
directory = zlib-1.3
source_url = https://zlib.net/zlib-1.3.tar.gz
source_hash = <sha256>

[provide]
zlib = zlib_dep
```

### 5. Build options

Define in `meson_options.txt` (or `meson.options` in Meson ≥1.1):

```python
option('with_tests', type : 'boolean', value : true,
  description : 'Build unit tests')

option('backend', type : 'combo',
  choices : ['opengl', 'vulkan', 'software'],
  value : 'opengl',
  description : 'Rendering backend')

option('max_connections', type : 'integer',
  min : 1, max : 1024, value : 64)
```

Use in `meson.build`:

```python
if get_option('with_tests')
  subdir('tests')
endif
```

### 6. Cross-compilation

Create a cross file (`cross/arm-linux.ini`):

```ini
[binaries]
c = 'arm-linux-gnueabihf-gcc'
cpp = 'arm-linux-gnueabihf-g++'
ar = 'arm-linux-gnueabihf-ar'
strip = 'arm-linux-gnueabihf-strip'
pkgconfig = 'arm-linux-gnueabihf-pkg-config'

[properties]
sys_root = '/path/to/sysroot'

[host_machine]
system = 'linux'
cpu_family = 'arm'
cpu = 'cortex-a9'
endian = 'little'
```

```bash
meson setup builddir-arm --cross-file cross/arm-linux.ini
meson compile -C builddir-arm
```

### 7. CMake migration cheatsheet

| CMake | Meson equivalent |
|-------|-----------------|
| `add_executable` | `executable()` |
| `add_library` | `library()` / `static_library()` / `shared_library()` |
| `target_include_directories` | `include_directories` arg in target |
| `target_link_libraries` | `dependencies` / `link_with` |
| `find_package` | `dependency()` |
| `option()` | `option()` in `meson_options.txt` |
| `add_subdirectory` | `subdir()` |
| `install(TARGETS ...)` | `install : true` in target |

For wrap patterns and subproject configuration, see [references/meson-wrap.md](references/meson-wrap.md).

## Related skills

- Use `skills/build-systems/cmake` when CMake is required or preferred
- Use `skills/build-systems/ninja` — Meson uses Ninja as its backend
- Use `skills/compilers/cross-gcc` for cross-compiler toolchain setup
- Use `skills/compilers/gcc` or `skills/compilers/clang` for compiler flag context
