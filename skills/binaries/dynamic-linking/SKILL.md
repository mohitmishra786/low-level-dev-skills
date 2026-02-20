---
name: dynamic-linking
description: Dynamic linking skill for Linux/ELF shared libraries. Use when debugging library loading failures, configuring RPATH vs RUNPATH, understanding soname versioning, using dlopen/dlsym for plugin systems, LD_PRELOAD interposition, or controlling symbol visibility. Activates on queries about shared libraries, dlopen, LD_LIBRARY_PATH, RPATH, soname, LD_PRELOAD, symbol visibility, or "cannot open shared object file" errors.
---

# Dynamic Linking

## Purpose

Guide agents through Linux dynamic linking: shared library creation, RPATH/RUNPATH configuration, soname versioning, `dlopen`/`dlsym` plugin patterns, `LD_PRELOAD` interposition, and symbol visibility control.

## Triggers

- "Cannot open shared object file: No such file or directory"
- "How do I set RPATH so my binary finds its shared library?"
- "How do I use dlopen/dlsym for a plugin system?"
- "What's the difference between RPATH and RUNPATH?"
- "How do I use LD_PRELOAD to intercept a function?"
- "How do I version my shared library with soname?"

## Workflow

### 1. Creating a shared library

```bash
# Compile with -fPIC (position-independent code)
gcc -fPIC -c src/mylib.c -o mylib.o

# Link shared library with soname
gcc -shared -Wl,-soname,libmylib.so.1 \
    mylib.o -o libmylib.so.1.2.3

# Create symlinks (standard convention)
ln -s libmylib.so.1.2.3 libmylib.so.1   # soname link (used by ldconfig)
ln -s libmylib.so.1     libmylib.so      # link link (used at compile time)

# Register with ldconfig (system-wide)
sudo cp libmylib.so.1.2.3 /usr/local/lib/
sudo ldconfig
```

### 2. Soname versioning convention

```text
libfoo.so.MAJOR.MINOR.PATCH
         │
         └── soname = libfoo.so.MAJOR
```

| Version bump | When |
|-------------|------|
| PATCH | Bug fix, ABI unchanged |
| MINOR | New symbols added, backwards compatible |
| MAJOR | ABI break — existing binaries will break |

Inspect soname:

```bash
readelf -d libmylib.so.1.2.3 | grep SONAME
objdump -p libmylib.so.1.2.3 | grep SONAME
```

### 3. RPATH vs RUNPATH

```text
Both embed a library search path in the binary.

RPATH  → searched BEFORE LD_LIBRARY_PATH
RUNPATH → searched AFTER LD_LIBRARY_PATH (controllable at runtime)

Recommendation: prefer RUNPATH (-Wl,--enable-new-dtags)
                for deployment flexibility.
```

```bash
# Embed RPATH (old default)
gcc main.c -L./lib -lmylib \
    -Wl,-rpath,'$ORIGIN/../lib' -o myapp

# Embed RUNPATH (new default with --enable-new-dtags)
gcc main.c -L./lib -lmylib \
    -Wl,-rpath,'$ORIGIN/../lib' \
    -Wl,--enable-new-dtags -o myapp

# Inspect
readelf -d myapp | grep -E 'RPATH|RUNPATH'
chrpath -l myapp        # show
chrpath -r '/new/path' myapp  # modify existing
```

`$ORIGIN` resolves to the directory of the binary at runtime — use it for relocatable installations.

### 4. Library search order

```text
1. DT_RPATH (if no DT_RUNPATH present)
2. LD_LIBRARY_PATH (env var, ignored for suid binaries)
3. DT_RUNPATH
4. /etc/ld.so.cache  (populated by ldconfig from /etc/ld.so.conf)
5. /lib, /usr/lib
```

Debug with:

```bash
LD_DEBUG=libs ./myapp      # trace library loading decisions
ldd myapp                  # show resolved libraries
ldd -v myapp               # verbose with version requirements
```

### 5. dlopen / dlsym plugin pattern

```c
#include <dlfcn.h>

typedef int (*plugin_fn_t)(const char *input);

void load_plugin(const char *path) {
    // RTLD_NOW: resolve all symbols immediately (fail fast)
    // RTLD_LAZY: resolve on first call (default)
    // RTLD_LOCAL: symbols not visible to other loaded libs
    // RTLD_GLOBAL: symbols visible globally
    void *handle = dlopen(path, RTLD_NOW | RTLD_LOCAL);
    if (!handle) {
        fprintf(stderr, "dlopen: %s\n", dlerror());
        return;
    }

    // Clear previous errors
    dlerror();

    plugin_fn_t fn = (plugin_fn_t)dlsym(handle, "plugin_run");
    const char *err = dlerror();
    if (err) {
        fprintf(stderr, "dlsym: %s\n", err);
        dlclose(handle);
        return;
    }

    fn("hello");
    dlclose(handle);
}
```

Link with `-ldl`:

```bash
gcc main.c -ldl -o myapp
```

### 6. LD_PRELOAD interposition

`LD_PRELOAD` loads a library before all others — its symbols override the application's.

```c
// myinterpose.c — intercept malloc
#define _GNU_SOURCE
#include <stdio.h>
#include <dlfcn.h>

void *malloc(size_t size) {
    static void *(*real_malloc)(size_t) = NULL;
    if (!real_malloc)
        real_malloc = dlsym(RTLD_NEXT, "malloc");  // find next malloc in chain

    void *ptr = real_malloc(size);
    fprintf(stderr, "malloc(%zu) = %p\n", size, ptr);
    return ptr;
}
```

```bash
gcc -shared -fPIC -o myinterpose.so myinterpose.c -ldl

# Apply to any binary
LD_PRELOAD=./myinterpose.so ./myapp
LD_PRELOAD=/path/to/libfaketime.so ./myapp  # time manipulation
```

### 7. Symbol visibility control

Limit exported symbols to reduce binary size and avoid clashes:

```c
// Mark default: visible to linker
__attribute__((visibility("default")))
int public_api(void) { return 42; }

// Hidden: internal, not exported
__attribute__((visibility("hidden")))
static int internal_helper(void) { return 0; }
```

Or use a linker version script:

```text
# mylib.map
MYLIB_1.0 {
    global:
        mylib_init;
        mylib_process;
    local:
        *;          # hide everything else
};
```

```bash
gcc -shared -fPIC -Wl,--version-script=mylib.map \
    -o libmylib.so mylib.c

# Check exported symbols
nm -D --defined-only libmylib.so
objdump -T libmylib.so
```

Build with `-fvisibility=hidden` by default and explicitly mark public API:

```bash
gcc -shared -fPIC -fvisibility=hidden \
    mylib.c -o libmylib.so
```

### 8. Common errors

| Error | Cause | Fix |
|-------|-------|-----|
| `cannot open shared object file` | Library not in search path | Set RPATH, `LD_LIBRARY_PATH`, or run `ldconfig` |
| `symbol lookup error: undefined symbol` | Missing library or wrong version | Check `ldd`, add `-l` flag or fix link order |
| `FATAL: kernel too old` | Version requirement mismatch | Rebuild against older glibc |
| `relocation R_X86_64_32 against .rodata` | Non-PIC code in shared lib | Add `-fPIC` to compilation |
| `version 'GLIBC_2.29' not found` | Binary built on newer glibc | Rebuild on older system or use `-static` |

For RPATH, soname, and `ld.so` configuration details, see [references/ld-rpath-soname.md](references/ld-rpath-soname.md).

## Related skills

- Use `skills/binaries/elf-inspection` to inspect shared library sections and symbols
- Use `skills/binaries/linkers-lto` for linker flags and symbol resolution
- Use `skills/binaries/binutils` for `nm`, `objdump`, `strip` on shared libs
- Use `skills/compilers/gcc` for `-fPIC`, `-shared` and related compiler flags
