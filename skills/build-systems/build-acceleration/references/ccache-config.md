# ccache Configuration Reference

Source: https://ccache.dev/manual/latest.html

## Table of Contents

1. [Configuration File Locations](#configuration-file-locations)
2. [Key Settings](#key-settings)
3. [CI / Shared Cache](#ci--shared-cache)
4. [Troubleshooting Hit Rate](#troubleshooting-hit-rate)

## Configuration File Locations

ccache reads config in order (later overrides earlier):
1. `/etc/ccache.conf` — system-wide
2. `$CCACHE_CONFIGPATH` — override path
3. `~/.config/ccache/ccache.conf` — user config
4. `$CCACHE_DIR/ccache.conf` — per-cache-dir

## Key Settings

```ini
# Cache storage
max_size = 20G              # Maximum cache size (K, M, G, T suffix)
cache_dir = /var/cache/ccache  # Non-default location

# Compression (significant space saving, slight CPU cost)
compression = true
compression_level = 6       # 1-9, default 6

# Debug (disable in production)
log_file = /tmp/ccache.log
debug = false

# Hashing behavior
hash_dir = false            # Don't include CWD in hash (helps shared cache)
base_dir = /project         # Strip this prefix from file paths in hash

# Include handling
sloppiness = include_file_mtime,include_file_ctime,time_macros
# time_macros: ignore __DATE__ and __TIME__ macro changes
# include_file_mtime: don't stat all included files (faster, slight risk)

# PCH support
sloppiness = pch_defines,time_macros  # needed for GCC PCH
```

## CI / Shared Cache

For GitHub Actions / Jenkins with shared NFS:

```yaml
# .github/workflows/build.yml
- name: Restore ccache
  uses: actions/cache@v4
  with:
    path: ~/.cache/ccache
    key: ccache-${{ runner.os }}-${{ hashFiles('**/CMakeLists.txt') }}
    restore-keys: ccache-${{ runner.os }}-

- name: Configure ccache
  run: |
    ccache --set-config=max_size=500M
    ccache --set-config=compression=true
    ccache --set-config=hash_dir=false
    ccache --set-config=base_dir=${{ github.workspace }}

- name: Build
  run: cmake --build build -j$(nproc)

- name: ccache stats
  run: ccache -s
```

## Troubleshooting Hit Rate

```bash
# Full stats
ccache -s -v

# Key miss reasons:
# "called for preprocessing"  → compiler called as preprocessor, not supported
# "unsupported code directive" → inline asm or pragmas ccache can't handle
# "cache miss"                → normal first-time compilation
# "preprocessor error"        → fix the preprocessor invocation

# Reset statistics (not cache)
ccache --zero-stats

# Force a cache hit check without compilation
CCACHE_READONLY=1 make
```

Common miss reasons and fixes:

| Miss reason | Fix |
|-------------|-----|
| Absolute paths in source | Set `base_dir` to project root |
| `__DATE__`/`__TIME__` macros | Add `time_macros` to `sloppiness` |
| PCH changes invalidate all | Add `pch_defines` to `sloppiness` |
| Different working directory | Set `hash_dir=false` |
| Compiler version change | Expected — correct behavior |
| Response files (`@file`) | Use `CCACHE_COMPILERCHECK=content` |
