# heaptrack Analysis Reference

## heaptrack_print Complete Options

```bash
heaptrack_print [options] <heaptrack.data.zst>

Options:
  -p, --print-peaks N       Print top N peak allocation hotspots (default: 10)
  -a, --print-allocs N      Print top N allocation count hotspots
  -t, --print-temporary N   Print top N temporary allocation hotspots
  -l, --print-leaks N       Print top N leaked allocation hotspots
  -s, --short               Only print summary
  -f, --flamegraph          Print flamegraph-compatible folded stacks
  -m, --minimum-cost N      Only show stacks with cost >= N bytes
  --help                    Show help
```

## Output Sections Explained

```
total runtime: 5.23s
calls to allocation functions: 1,234,567 (236,049/s)
temporary allocations: 987,654 (188,847/s)
peak heap memory consumption: 123.45MB
peak RSS (including heap): 256.78MB
total memory leaked: 4.56MB
```

| Line | What to watch |
|------|--------------|
| `calls to allocation functions` | Very high count = excessive small allocations |
| `temporary allocations` | High % of total = allocation churn (use pools/arenas) |
| `peak heap consumption` | Actual max heap; compare to your memory budget |
| `peak RSS` | Includes mmap, stack, code; typically 2x peak heap |
| `total memory leaked` | Any non-zero = real leak |

## Hotspot Output Format

```
hotspot 1: 45.23MB peak in 12,345 allocations with 67,890 temporary allocations
  myapp::cache::Cache::insert at src/cache.cpp:142
    myapp::request::handle at src/request.cpp:89
      std::vector<...>::push_back at ...
```

Reading:
- First line: total bytes at peak, total allocations, temporary count
- Stack trace: top = leaf (where alloc happened), bottom = root caller

## Flamegraph from heaptrack

```bash
# Generate folded stacks
heaptrack_print -f heaptrack.myapp.*.zst > heaptrack.folded

# Flamegraph by peak allocation (default)
flamegraph.pl --title "Heap Allocations (Peak)" \
              --countname bytes \
              heaptrack.folded > heap-peak.svg

# Flamegraph by allocation count
heaptrack_print -f -a 100 heaptrack.myapp.*.zst > heaptrack-count.folded
flamegraph.pl --title "Allocation Count" heaptrack-count.folded > heap-count.svg

# View
xdg-open heap-peak.svg
```

## Common Allocation Hotspot Patterns

### Pattern: Excessive small allocations

```
hotspot: 50MB peak in 5,000,000 allocations
  std::string::operator= (copying small strings)
```

Fix: Use `std::string_view`, arena allocator, or SSO-optimised string.

### Pattern: Container growth

```
hotspot: 30MB peak in 100,000 allocations
  std::vector::push_back (repeated reallocations)
```

Fix: `vec.reserve(expected_size)` before push_back loop.

### Pattern: Leaked connection/handle

```
leak: 2MB in 100 allocations
  MyConnection::connect at src/conn.cpp:45
```

Fix: Check destructor, ensure RAII wrapper, add `unique_ptr`.

### Pattern: Temporary string allocations

```
temporary: 10M allocs/sec
  std::to_string(int) in hot loop
```

Fix: Use `fmt::to_string`, `std::format`, or pre-allocated buffer.

## Comparing Allocators

```bash
# Test with system allocator (baseline)
heaptrack ./myapp > baseline.txt

# Test with jemalloc
LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so heaptrack ./myapp > jemalloc.txt

# Test with mimalloc
LD_PRELOAD=/path/to/libmimalloc.so heaptrack ./myapp > mimalloc.txt

# Compare peak memory
grep "peak heap" baseline.txt jemalloc.txt mimalloc.txt
```

## heaptrack GUI (heaptrack_gui)

The Qt-based GUI shows:
- Timeline of heap usage over time
- Flamegraph view (interactive)
- Top allocations table
- Leak view

```bash
# Launch GUI
heaptrack_gui heaptrack.myapp.12345.zst

# Or analyse after the fact
heaptrack_gui  # File → Open
```

GUI tabs:
1. **Summary**: overall stats
2. **Bottom-Up**: callers → callees (who caused the allocation)
3. **Top-Down**: callees → callers (allocation call trees)
4. **Flame Graph**: visual allocation overview
5. **Consumed**: peak memory timeline

## Masif vs heaptrack Quick Command Comparison

| Task | Valgrind massif | heaptrack |
|------|----------------|-----------|
| Record | `valgrind --tool=massif ./prog` | `heaptrack ./prog` |
| Print summary | `ms_print massif.out.*` | `heaptrack_print -s heap*.zst` |
| Print hotspots | `ms_print massif.out.* \| head` | `heaptrack_print -p 10 heap*.zst` |
| Leaks | `valgrind --leak-check=full` | `heaptrack_print -l heap*.zst` |
| GUI | (none built-in) | `heaptrack_gui heap*.zst` |
| Flamegraph | manual conversion | `heaptrack_print -f heap*.zst \| flamegraph.pl` |
