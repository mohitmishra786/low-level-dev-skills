# clang-tidy Reference

Source: <https://clang.llvm.org/extra/clang-tidy/>

## Configuration (.clang-tidy)

```yaml
---
Checks: >
  clang-analyzer-*,
  bugprone-*,
  modernize-*,
  performance-*,
  readability-identifier-naming,
  -modernize-use-trailing-return-type,
  -readability-magic-numbers
WarningsAsErrors: 'bugprone-*'
HeaderFilterRegex: '.*'
FormatStyle: file
CheckOptions:
  - key: readability-identifier-naming.VariableCase
    value: camelCase
```

## Common invocations

```bash
# Single file
clang-tidy src.cpp -- -std=c++17 -I./include

# All files using compile_commands.json
clang-tidy $(find src -name '*.cpp') -p build/

# Apply fixits (creates in-place changes)
clang-tidy -fix src.cpp -- -std=c++17

# Parallel (requires run-clang-tidy script)
run-clang-tidy -j4 -p build/ 2>&1 | tee tidy.log

# Generate compile_commands.json with CMake
cmake -DCMAKE_EXPORT_COMPILE_COMMANDS=ON -S . -B build
ln -sf build/compile_commands.json .
```

## Key check families

| Family | Description |
|--------|-------------|
| `bugprone-*` | Use-after-move, dangling reference, suspicious constructs |
| `clang-analyzer-*` | CSA: memory leaks, null deref, API misuse |
| `modernize-*` | C++11/14/17/20 upgrade patterns |
| `performance-*` | Unnecessary copies, pass-by-value candidates |
| `readability-*` | Naming, complexity, clarity |
| `cppcoreguidelines-*` | C++ Core Guidelines |
| `cert-*` | CERT coding standard checks |
| `hicpp-*` | HIC++ standard checks |
| `portability-*` | Cross-platform issues |

## Suppressing checks

```cpp
// NOLINT: suppress all checks on this line
int x = getValue();  // NOLINT

// NOLINT(check-name): suppress specific check
int y = getValue();  // NOLINT(bugprone-narrowing-conversions)

// NOLINTNEXTLINE: suppress on next line
// NOLINTNEXTLINE(modernize-use-auto)
MyType* ptr = new MyType();
```

In `.clang-tidy`, prefix a check with `-` to disable:

```yaml
Checks: 'modernize-*,-modernize-use-trailing-return-type'
```
