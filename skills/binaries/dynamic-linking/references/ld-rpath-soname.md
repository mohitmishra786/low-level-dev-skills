# RPATH, RUNPATH, and Soname Reference

## ld.so Search Path Configuration

### System-wide (/etc/ld.so.conf)

```text
# /etc/ld.so.conf.d/mylib.conf
/usr/local/lib/myapp
/opt/myapp/lib
```

```bash
# After editing conf files:
sudo ldconfig

# Verify
ldconfig -p | grep libmylib
```

### Per-user (LD_LIBRARY_PATH)

```bash
export LD_LIBRARY_PATH=/home/user/mylibs:$LD_LIBRARY_PATH
./myapp

# Avoid in production — security risk for suid binaries
# Use RUNPATH instead for deployable binaries
```

## RPATH / RUNPATH Deep Dive

### $ORIGIN Patterns

| Pattern | Resolves to |
|---------|------------|
| `$ORIGIN` | Directory containing the binary |
| `$ORIGIN/../lib` | `lib/` sibling directory |
| `$ORIGIN/../../lib` | Two levels up, then `lib/` |
| `$LIB` | Architecture lib dir (e.g., `lib/x86_64-linux-gnu`) |
| `$PLATFORM` | Platform string (e.g., `x86_64`) |

```bash
# Package layout using $ORIGIN
myapp/
├── bin/
│   └── myapp          # RUNPATH = $ORIGIN/../lib
└── lib/
    ├── libfoo.so.1
    └── libbar.so.2
```

### Modifying Existing RPATH

```bash
# View
patchelf --print-rpath ./myapp
chrpath -l ./myapp

# Change
patchelf --set-rpath '$ORIGIN/../lib' ./myapp
chrpath -r '$ORIGIN/../lib' ./myapp

# Remove
patchelf --remove-rpath ./myapp
chrpath -d ./myapp
```

### CMake RPATH Configuration

```cmake
# Set install RPATH
set(CMAKE_INSTALL_RPATH "$ORIGIN/../lib")

# Include build tree RPATH in build (useful for testing)
set(CMAKE_BUILD_WITH_INSTALL_RPATH FALSE)

# Add default install path to RPATH
set(CMAKE_INSTALL_RPATH_USE_LINK_PATH TRUE)

# Use RUNPATH (new dtags) instead of RPATH
set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -Wl,--enable-new-dtags")
```

## Soname Versioning Lifecycle

### Creating a versioned library

```bash
# Compile
gcc -fPIC -c libfoo.c -o libfoo.o

# Link with soname
gcc -shared -Wl,-soname,libfoo.so.1 \
    libfoo.o -o libfoo.so.1.0.0

# Symlinks
ln -sf libfoo.so.1.0.0 libfoo.so.1   # soname — what ldconfig maintains
ln -sf libfoo.so.1     libfoo.so      # linker name — what -lfoo uses
```

### Upgrading (minor ABI-compatible)

```bash
# New release
gcc -shared -Wl,-soname,libfoo.so.1 \
    libfoo.o -o libfoo.so.1.1.0

# Update only libfoo.so.1 symlink; libfoo.so.1.0.0 stays for rollback
ln -sf libfoo.so.1.1.0 libfoo.so.1
sudo ldconfig
```

### Breaking ABI (major bump)

```bash
# New major version
gcc -shared -Wl,-soname,libfoo.so.2 \
    libfoo.o -o libfoo.so.2.0.0

ln -sf libfoo.so.2.0.0 libfoo.so.2
ln -sf libfoo.so.2     libfoo.so

# Old libfoo.so.1* stays installed for binaries linked against it
sudo ldconfig
```

## Version Scripts (GNU ld)

```text
# libfoo.map — symbol versioning
LIBFOO_1.0 {
    global:
        foo_init;
        foo_process;
        foo_cleanup;
    local:
        *;
};

LIBFOO_1.1 {
    global:
        foo_process_ex;   # New in 1.1
} LIBFOO_1.0;             # Inherits 1.0 symbols
```

```bash
gcc -shared -Wl,--version-script=libfoo.map \
    -o libfoo.so.1 libfoo.o

# Check versioned symbols
readelf -s --wide libfoo.so.1 | grep LIBFOO
```

## Debugging Dynamic Linking

```bash
# Verbose library resolution
LD_DEBUG=libs ./myapp 2>&1 | head -50

# All linker debug options
LD_DEBUG=help ./myapp

# Common LD_DEBUG values:
# libs      — library search
# symbols   — symbol lookup
# bindings  — symbol binding
# files     — input files processed
# all       — everything (very verbose)

# Check what a binary needs
ldd -v ./myapp

# Check for missing symbols before running
ldd ./myapp | grep "not found"

# Simulate different library versions
LD_PRELOAD=/path/to/alternate/libfoo.so.1 ./myapp
```
