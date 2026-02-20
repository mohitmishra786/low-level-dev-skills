# Sanitizer Report Interpretation

## ASan report types

### heap-buffer-overflow
```
ERROR: AddressSanitizer: heap-buffer-overflow on address 0x602000000050
WRITE of size 4 at 0x602000000050 thread T0
    #0 0x401234 in write_past_end main.c:12
    #1 0x401567 in main main.c:40

0x602000000050 is located 0 bytes after a 40-byte region
allocated by thread T0 here:
    #0 0x7f... in malloc
    #1 0x401400 in main main.c:8
```

**Diagnosis:** Frame `#0` in the first stack is where the OOB write happened (line 12). The allocation was at line 8 with size 40 bytes. Access is 0 bytes *after* the region end — classic off-by-one.

**Fix pattern:** Check loop bounds; ensure `i < n` not `i <= n`; check `malloc(n * sizeof(T))` includes all elements.

---

### use-after-free
```
ERROR: AddressSanitizer: heap-use-after-free on address 0x602000000050
READ of size 8 at 0x602000000050 thread T0
    #0 0x401234 in use_ptr main.c:20

0x602000000050 is located 8 bytes inside a 40-byte region
freed by thread T0 here:
    #0 0x7f... in free
    #1 0x401300 in cleanup main.c:15
allocated by thread T0 here:
    #0 0x7f... in malloc
    #1 0x401200 in init main.c:5
```

**Diagnosis:** Pointer freed at line 15, read again at line 20. Find ownership mistake between `cleanup` and `use_ptr`.

---

### stack-buffer-overflow
```
ERROR: AddressSanitizer: stack-buffer-overflow on address 0x7fff...
WRITE of size 1 at 0x7fff... thread T0
    #0 0x401234 in foo main.c:8

Address 0x7fff... is located at offset 28 in frame <main.c:5:foo>
  This frame has 1 object(s):
    [0, 28) 'buf' (line 6)
```

**Diagnosis:** 28-byte stack array `buf`, write at offset 28 = one past the end. Check `gets()`, `strcpy()`, `sprintf()`.

---

### double-free
```
ERROR: AddressSanitizer: attempting double-free on 0x602000000050
    #0 0x401234 in bad_free main.c:25

allocated here:
    ...
freed here (1st time):
    ...
freed here (2nd time / current):
    #0 0x401234 in bad_free main.c:25
```

---

## UBSan report types

### signed-integer-overflow
```
src/main.c:15:12: runtime error: signed integer overflow: 2147483647 + 1 cannot be represented in type 'int'
```
Fix: use `int64_t` or check for overflow before the operation.

### null pointer dereference
```
src/main.c:20:3: runtime error: member access within null pointer of type 'struct Foo'
```
Fix: check pointer != NULL before deref.

### shift exponent too large
```
src/main.c:8:14: runtime error: shift exponent 32 is too large for 32-bit type 'int'
```
Fix: cast to `uint64_t` before shifting, or use `__builtin_expect`.

### misaligned access
```
src/main.c:12:10: runtime error: load of misaligned address 0x... for type 'int', which requires 4-byte alignment
```
Fix: use `memcpy` to read unaligned data; or ensure pointer is correctly aligned.

---

## TSan report types

### data race
```
WARNING: ThreadSanitizer: data race (pid=12345)
  Write of size 4 at 0x7f... by thread T2:
    #0 counter_increment counter.c:8
  Previous read of size 4 at 0x7f... by thread T1:
    #0 counter_read counter.c:3
  Location is global 'g_counter' of size 4 at 0x... (prog+0x...)
```

**Diagnosis:** `g_counter` is written by T2 and read by T1 without synchronisation.
**Fix:** Add mutex, atomic, or use `__atomic_*` / `std::atomic`.

### lock order inversion (deadlock risk)
```
WARNING: ThreadSanitizer: lock-order-inversion (potential deadlock)
  Mutex M1 acquired here while holding M2:
  Mutex M2 acquired here while holding M1:
```
Fix: establish a global lock ordering; always acquire M1 before M2.

---

## LSan report

```
==12345==ERROR: LeakSanitizer: detected memory leaks

Direct leak of 40 byte(s) in 1 object(s) allocated from:
    #0 0x7f... in malloc
    #1 0x401234 in create_thing main.c:10
    #2 0x401567 in main main.c:35

SUMMARY: AddressSanitizer: 40 byte(s) leaked in 1 allocation(s).
```

**Diagnosis:** `create_thing` allocates 40 bytes that are never freed. Trace who owns the returned object and should call `free()`.
