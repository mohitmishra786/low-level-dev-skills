---
name: cpp-templates
description: C++ template skill for reading template errors and optimizing compile times. Use when deciphering template error stacks, setting -ftemplate-backtrace-limit, writing concepts and requires-clauses, understanding SFINAE vs concepts, or profiling template instantiation bottlenecks with Templight. Activates on queries about C++ templates, template error messages, concepts, requires expressions, SFINAE, template metaprogramming, or slow template compilation.
---

# C++ Templates

## Purpose

Guide agents through reading and fixing template error messages, using concepts as cleaner constraints, understanding SFINAE vs concepts trade-offs, and profiling template instantiation depth and compile times with Templight.

## Triggers

- "How do I read this massive C++ template error?"
- "How do I use concepts to constrain a template?"
- "What's the difference between SFINAE and concepts?"
- "My templates make compilation very slow"
- "How do I write a requires-clause?"
- "How do I profile template instantiation times?"

## Workflow

### 1. Reading template error messages

Template errors print full instantiation chains. Strategy: read from the bottom up.

```text
prog.cpp:25:5: error: no matching function for call to 'sort'
  std::sort(v.begin(), v.end());
  ^~~~~~~~~
/usr/include/c++/13/bits/stl_algo.h:4869:5: note: candidate:
    template<class _RAIter>
    void std::sort(_RAIter, _RAIter)
note: template argument deduction/substitution failed:
prog.cpp:25:5: note: 'MyType' is not a valid type for this template
                             ^~~~~~~~
```

Rules for reading:
1. Find the first error line (top of output) — that's your code
2. Skip all the `note:` lines until you find "required from here" or "in instantiation of"
3. The bottom of the stack shows the type that failed substitution

```bash
# Limit backtrace depth to reduce noise
g++   -ftemplate-backtrace-limit=3  prog.cpp
clang -ftemplate-depth=32           prog.cpp   # default 1024

# Show simplified errors (GCC 12+)
g++ -fconcepts-diagnostics-depth=3  prog.cpp   # for concept failures
```

### 2. SFINAE — legacy constraint technique

SFINAE (Substitution Failure Is Not An Error) silently removes overloads that fail substitution:

```cpp
#include <type_traits>

// Enable function only for arithmetic types
template <typename T,
    std::enable_if_t<std::is_arithmetic_v<T>, int> = 0>
T square(T x) { return x * x; }

// SFINAE with return type
template <typename T>
auto to_string(T x) -> std::enable_if_t<std::is_integral_v<T>, std::string> {
    return std::to_string(x);
}

// Void-t technique for detecting member existence
template <typename, typename = void>
struct has_size : std::false_type {};

template <typename T>
struct has_size<T, std::void_t<decltype(std::declval<T>().size())>>
    : std::true_type {};
```

SFINAE errors are cryptic. Prefer concepts (C++20) for new code.

### 3. Concepts — modern constraints (C++20)

```cpp
#include <concepts>

// Define a concept
template <typename T>
concept Arithmetic = std::is_arithmetic_v<T>;

template <typename T>
concept Printable = requires(T x) {
    { std::cout << x } -> std::same_as<std::ostream&>;
};

template <typename T>
concept Container = requires(T c) {
    c.begin();
    c.end();
    c.size();
    typename T::value_type;
};

// Apply concept as constraint
template <Arithmetic T>
T square(T x) { return x * x; }

// Abbreviated function template (C++20)
auto square(Arithmetic auto x) { return x * x; }

// requires-clause (more complex conditions)
template <typename T>
    requires Arithmetic<T> && (sizeof(T) >= 4)
T big_square(T x) { return x * x; }

// Concept in auto parameter
void print_container(const Container auto& c) {
    for (const auto& elem : c) std::cout << elem << ' ';
}
```

### 4. Requires expressions

```cpp
// requires { expression; } — checks expression is valid
// requires { expression -> type; } — checks type of expression

template <typename T>
concept HasPush = requires(T c, typename T::value_type v) {
    c.push_back(v);                          // must be valid
    { c.front() } -> std::same_as<typename T::value_type&>;  // type check
    { c.size() } -> std::convertible_to<std::size_t>;        // convertible
    requires std::default_initializable<T>;  // nested requirement
};

// Compound requires (all must hold)
template <typename T>
concept Sortable = requires(T a, T b) {
    { a < b } -> std::convertible_to<bool>;
    { a == b } -> std::convertible_to<bool>;
};
```

### 5. SFINAE vs concepts comparison

| Aspect | SFINAE | Concepts |
|--------|--------|---------|
| Syntax | Complex, verbose | Clean, readable |
| Error messages | Cryptic wall-of-text | Clear constraint failure |
| Compile time | Can be slow (many substitutions) | Generally faster |
| C++ version | C++11 | C++20 |
| Short-circuit | No | Yes (concept subsumption) |
| Use in `if constexpr` | Awkward | Natural |
| Overload ranking | Manually via priority | Automatic by constraint specificity |

Migration: replace `enable_if` with concept constraints; replace `void_t` helpers with `requires`.

### 6. Template instantiation profiling with Templight

```bash
# Install Templight (Clang-based profiler)
# https://github.com/mikael-s-persson/templight

# Build with Templight tracing
clang++ -Xtemplight -profiler -Xtemplight -memory \
        -std=c++17 prog.cpp -o prog

# Convert trace to visualizable format
templight-convert -f callgrind -o prof.out templight.pb

# View with KCachegrind
kcachegrind prof.out

# Find top template instantiation costs (without Templight)
# ClangBuildAnalyzer (easier)
ClangBuildAnalyzer --start /tmp/build
cmake --build build
ClangBuildAnalyzer --stop /tmp/build capture.bin
ClangBuildAnalyzer --analyze capture.bin | head -50
```

### 7. Reducing template compile times

```cpp
// 1. Explicit instantiation — compile once, use everywhere
// header.h
template <typename T>
T transform(T x);

extern template int transform<int>(int);    // suppress instantiation

// impl.cpp
#include "header.h"
template int transform<int>(int);           // instantiate here only

// 2. Prefer function templates over class templates when possible
// (functions instantiate lazily; class templates instantiate eagerly)

// 3. Use concepts to short-circuit failed substitutions
// (concept check is faster than full substitution failure)

// 4. Split heavy template headers from lightweight ones
// - Put type definitions in forward_decls.h
// - Put template implementations in impl.h (include only where needed)

// 5. Use if constexpr instead of specialization
template <typename T>
void process(T x) {
    if constexpr (std::is_integral_v<T>) {
        handle_int(x);
    } else {
        handle_other(x);
    }
}
```

## Related skills

- Use `skills/build-systems/build-acceleration` for ccache and PCH to reduce overall compile time
- Use `skills/compilers/clang` for Clang-specific diagnostics and concept error output
- Use `skills/low-level-programming/cpp-coroutines` for another advanced C++20 feature
