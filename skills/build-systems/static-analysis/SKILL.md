---
name: static-analysis
description: Static analysis skill for C/C++ codebases. Use when hardening code quality, triaging noisy builds, running clang-tidy, cppcheck, or scan-build, interpreting check categories, suppressing false positives, or integrating static analysis into CI. Activates on queries about clang-tidy checks, cppcheck, scan-build, compile_commands.json, code hardening, or static analysis warnings.
---

# Static Analysis

## Purpose

Guide agents through selecting, running, and triaging static analysis tools for C/C++ — clang-tidy, cppcheck, and scan-build — including suppression strategies and CI integration.

## Triggers

- "How do I run clang-tidy on my project?"
- "What clang-tidy checks should I enable?"
- "cppcheck is reporting false positives — how do I suppress them?"
- "How do I set up scan-build for deeper analysis?"
- "My build is noisy with static analysis warnings"
- "How do I generate compile_commands.json for clang-tidy?"

## Workflow

### 1. Generate compile_commands.json

clang-tidy requires a compilation database:

```bash
# CMake (preferred)
cmake -S . -B build -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
ln -s build/compile_commands.json .

# Bear (for Make-based projects)
bear -- make

# compiledb (alternative for Make)
pip install compiledb
compiledb make
```

### 2. Run clang-tidy

```bash
# Single file
clang-tidy src/foo.c -- -std=c11 -I include/

# Whole project via compile_commands.json
run-clang-tidy -p build/ -j$(nproc)

# With specific checks enabled
clang-tidy -checks='bugprone-*,modernize-*,performance-*' src/foo.cpp

# Apply auto-fixes
clang-tidy -checks='modernize-use-nullptr' -fix src/foo.cpp
```

### 3. Check category decision tree

```text
Goal?
├── Find real bugs            → bugprone-*, clang-analyzer-*
├── Modernise C++ code        → modernize-*
├── Follow core guidelines    → cppcoreguidelines-*
├── Catch performance issues  → performance-*
├── Security hardening        → cert-*, hicpp-*
└── Readability / style       → readability-*, llvm-*
```

| Category | Key checks | What it catches |
|----------|-----------|-----------------|
| `bugprone-*` | `use-after-move`, `integer-division`, `suspicious-memset-usage` | Likely bugs |
| `modernize-*` | `use-nullptr`, `use-override`, `use-auto` | C++11/14/17 idioms |
| `cppcoreguidelines-*` | `avoid-goto`, `pro-bounds-*`, `no-malloc` | C++ Core Guidelines |
| `performance-*` | `unnecessary-copy-initialization`, `avoid-endl` | Performance regressions |
| `clang-analyzer-*` | `core.*`, `unix.*`, `security.*` | Path-sensitive bugs |
| `cert-*` | `err34-c`, `str51-cpp` | CERT coding standard |

### 4. .clang-tidy configuration file

```yaml
# .clang-tidy — place at project root
Checks: >
  bugprone-*,
  modernize-*,
  performance-*,
  -modernize-use-trailing-return-type,
  -bugprone-easily-swappable-parameters
WarningsAsErrors: 'bugprone-*,clang-analyzer-*'
HeaderFilterRegex: '^(src|include)/.*'
CheckOptions:
  - key: modernize-loop-convert.MinConfidence
    value: reasonable
  - key: readability-identifier-naming.VariableCase
    value: camelCase
```

### 5. Suppress false positives

```cpp
// Suppress a single line
int result = riskyOp(); // NOLINT(bugprone-signed-char-misuse)

// Suppress a block
// NOLINTNEXTLINE(cppcoreguidelines-avoid-magic-numbers)
constexpr int BUFFER_SIZE = 4096;

// Suppress whole function
[[clang::suppress("bugprone-*")]]
void legacy_code() { /* ... */ }
```

Or in `.clang-tidy`:

```yaml
# Exclude third-party directories
HeaderFilterRegex: '^(src|include)/.*'
# Disable specific checks
Checks: '-bugprone-easily-swappable-parameters'
```

### 6. Run cppcheck

```bash
# Basic run
cppcheck --enable=all --std=c11 src/

# With compile_commands.json
cppcheck --project=build/compile_commands.json

# Include specific checks and suppress noise
cppcheck --enable=warning,performance,portability \
         --suppress=missingIncludeSystem \
         --suppress=unmatchedSuppression \
         --error-exitcode=1 \
         src/

# Generate XML report for CI
cppcheck --xml --xml-version=2 src/ 2> cppcheck-report.xml
```

| `--enable=` value | What it checks |
|-------------------|----------------|
| `warning` | Undefined behaviour, bad practices |
| `performance` | Redundant operations, inefficient patterns |
| `portability` | Non-portable constructs |
| `information` | Configuration and usage notes |
| `all` | Everything above |

### 7. Path-sensitive analysis with scan-build

```bash
# Intercept a Make build
scan-build make

# Intercept CMake build
scan-build cmake --build build/

# Show HTML report
scan-view /tmp/scan-build-*/

# With specific checkers
scan-build -enable-checker security.insecureAPI.gets \
           -enable-checker alpha.unix.cstring.BufferOverlap \
           make
```

scan-build finds deeper bugs than clang-tidy: use-after-free across functions, dead stores from logic errors, null dereferences on complex paths.

### 8. CI integration

```yaml
# GitHub Actions
- name: Static analysis
  run: |
    cmake -S . -B build -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
    run-clang-tidy -p build -j$(nproc) -warnings-as-errors '*'

- name: cppcheck
  run: |
    cppcheck --enable=warning,performance \
             --suppress=missingIncludeSystem \
             --error-exitcode=1 \
             src/
```

For clang-tidy check details, see [references/clang-tidy-checks.md](references/clang-tidy-checks.md).

## Related skills

- Use `skills/compilers/clang` for Clang toolchain and diagnostic flags
- Use `skills/compilers/gcc` for GCC warnings as complementary analysis
- Use `skills/runtimes/sanitizers` for runtime bug detection alongside static analysis
- Use `skills/build-systems/cmake` for `CMAKE_EXPORT_COMPILE_COMMANDS` setup
