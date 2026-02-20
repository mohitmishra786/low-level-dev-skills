# Meson Wrap Reference

## Wrap File Types

### wrap-file (archive download)

```ini
[wrap-file]
directory = libfoo-1.2.3
source_url = https://example.com/libfoo-1.2.3.tar.gz
source_hash = abc123...sha256...

[provide]
libfoo = libfoo_dep
```

### wrap-git (git clone)

```ini
[wrap-git]
url = https://github.com/example/libfoo.git
revision = v1.2.3
depth = 1

[provide]
libfoo = libfoo_dep
```

### wrap-redirect (alias to another wrap)

```ini
[wrap-redirect]
filename = subprojects/packagefiles/libfoo/meson.build
```

## Wrapdb Popular Packages

```bash
# View available packages
meson wrap search ""

# Common packages
meson wrap install zlib
meson wrap install openssl
meson wrap install sqlite3
meson wrap install gtest
meson wrap install benchmark  # Google Benchmark
meson wrap install nlohmann_json
meson wrap install fmt
meson wrap install spdlog
meson wrap install libuv
meson wrap install expat
```

## Subproject Without wrapdb

Place source in `subprojects/libfoo/`:

```text
subprojects/
└── libfoo/
    ├── meson.build      # Must define libfoo_dep
    └── src/
        └── ...
```

Reference in main `meson.build`:

```python
libfoo_proj = subproject('libfoo')
libfoo_dep = libfoo_proj.get_variable('libfoo_dep')
```

## Patching Wrapped Projects

```text
subprojects/
├── zlib.wrap
└── packagefiles/
    └── zlib/
        └── meson.build   # Provides Meson build for non-Meson project
```

In `.wrap`:

```ini
[wrap-file]
directory = zlib-1.3
source_url = https://zlib.net/zlib-1.3.tar.gz
source_hash = ...
patch_directory = zlib   # Merges subprojects/packagefiles/zlib/ into source
```

## Dependency Fallback Patterns

```python
# Pattern 1: system-first, wrap fallback
zlib_dep = dependency('zlib', fallback : ['zlib', 'zlib_dep'])

# Pattern 2: wrap-only (reproducible builds)
zlib_dep = dependency('zlib',
  fallback : ['zlib', 'zlib_dep'],
  allow_fallback : true,
)

# Pattern 3: required=false, manual check
zlib_dep = dependency('zlib', required : false)
if not zlib_dep.found()
  zlib_dep = subproject('zlib').get_variable('zlib_dep')
endif

# Pattern 4: force static from wrap
gtest_dep = dependency('gtest',
  fallback : ['gtest', 'gtest_dep'],
  default_options : ['default_library=static'],
)
```

## Common meson.build Patterns

### Conditional compilation

```python
conf = configuration_data()
conf.set('VERSION', meson.project_version())
conf.set10('HAVE_FEATURE', cc.has_function('feature_func'))
configure_file(input : 'config.h.in', output : 'config.h',
               configuration : conf)
```

### Compiler checks

```python
cc = meson.get_compiler('c')

# Check for function
have_mmap = cc.has_function('mmap', prefix : '#include <sys/mman.h>')

# Check for header
have_sys_epoll = cc.has_header('sys/epoll.h')

# Check for type
have_int128 = cc.has_type('__int128')

# Compile check
have_atomics = cc.compiles('''
  #include <stdatomic.h>
  int main() { atomic_int x = 0; return atomic_load(&x); }
''', name : 'C11 atomics')
```

### Install targets

```python
executable('myapp', ..., install : true)
install_headers('include/mylib.h', subdir : 'mylib')
install_data('data/config.json', install_dir : get_option('datadir') / 'myapp')
install_man('doc/myapp.1')
```
