# clang-tidy Check Reference

## High-Value Check Groups

### bugprone-* (always enable)

| Check | What it catches |
|-------|-----------------|
| `bugprone-use-after-move` | Using a C++ moved-from object |
| `bugprone-integer-division` | Integer division assigned to float |
| `bugprone-suspicious-memset-usage` | `memset(p, 0, sizeof(p))` on pointer |
| `bugprone-macro-parentheses` | Unparenthesised macro arguments |
| `bugprone-signed-char-misuse` | Signed char used as array index |
| `bugprone-string-constructor` | `std::string(0)` instead of `""` |
| `bugprone-narrowing-conversions` | Narrowing int → smaller type |
| `bugprone-branch-clone` | Identical if/else branches |
| `bugprone-infinite-loop` | Loop with no exit condition |

### clang-analyzer-* (deep path analysis)

| Check | What it catches |
|-------|-----------------|
| `clang-analyzer-core.NullDereference` | Null pointer deref |
| `clang-analyzer-core.UndefinedBinaryOperatorResult` | Uninit value in expr |
| `clang-analyzer-unix.Malloc` | malloc/free misuse |
| `clang-analyzer-unix.API` | POSIX API misuse |
| `clang-analyzer-security.insecureAPI.*` | `gets`, `strcpy`, `rand` |
| `clang-analyzer-cplusplus.NewDelete` | new/delete mismatches |

### modernize-* (C++11/14/17 upgrades)

| Check | Migration |
|-------|-----------|
| `modernize-use-nullptr` | `NULL` → `nullptr` |
| `modernize-use-override` | Add `override` to virtual |
| `modernize-use-auto` | Deduce obvious types |
| `modernize-use-emplace` | `push_back(T(...))` → `emplace_back` |
| `modernize-loop-convert` | `for` index loops → range-for |
| `modernize-use-default-member-init` | In-class member init |
| `modernize-use-nodiscard` | Add `[[nodiscard]]` |

### performance-*

| Check | What it catches |
|-------|-----------------|
| `performance-unnecessary-copy-initialization` | Copy when const ref suffices |
| `performance-avoid-endl` | `std::endl` flushes; use `'\n'` |
| `performance-for-range-copy` | Range-for copies when ref suffices |
| `performance-move-const-arg` | `std::move` on const has no effect |

## Recommended Starter Configuration

```yaml
Checks: >
  bugprone-*,
  clang-analyzer-core.*,
  clang-analyzer-unix.*,
  clang-analyzer-security.*,
  modernize-use-nullptr,
  modernize-use-override,
  performance-*,
  -modernize-use-trailing-return-type,
  -bugprone-easily-swappable-parameters,
  -bugprone-implicit-widening-of-multiplication-result
WarningsAsErrors: 'bugprone-*,clang-analyzer-*'
HeaderFilterRegex: '^(src|include)/.*'
```

## Suppressions Reference

```cpp
// Per-line
foo(); // NOLINT
foo(); // NOLINT(check-name)

// Per-next-line
// NOLINTNEXTLINE(check-name)
foo();

// Per-block
// NOLINTBEGIN(check-name)
...
// NOLINTEND(check-name)
```

## Common False Positive Patterns

| False positive | Suppression strategy |
|----------------|----------------------|
| Third-party headers | `HeaderFilterRegex` to exclude |
| Platform-specific compat code | NOLINT at call site |
| Legacy C-style casts in C code | `-modernize-use-*` for C projects |
| `bugprone-easily-swappable-parameters` on intentional API | Disable globally |
