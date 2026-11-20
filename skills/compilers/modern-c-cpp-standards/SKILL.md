---
name: modern-c-cpp-standards
description: Modern C and C++ standards skill for C23, C2y and C++20/26. Use when a compiler upgrade changes the default language standard, migrating code to C23 or C++20, using C23 features such as nullptr, constexpr, #embed and checked arithmetic, trying C++26 static reflection or contracts, or detecting language features portably. Activates on queries about C23, C2y, C++26, -std=c23, -std=c++26, -freflection, -fcontracts, pre/post/contract_assert, std::meta, #embed, _BitInt, stdckdint.h, inplace_vector, or __cpp feature-test macros.
---

# Modern C and C++ Standards

## Purpose

Guide agents through current C and C++ standards on real compilers (checked with GCC 14/15/16.2 and Clang 23.1): changed defaults, C23 and C2y features, the C++20 default in GCC 16, C++26 reflection and contracts, library hardening, and feature detection.

## Triggers

- "My code stopped compiling after upgrading to GCC 15/16"
- "What changed in C23 and how do I use `#embed` / `nullptr` / `ckd_add`?"
- "How do I try C++26 reflection?"
- "How do C++26 contracts (`pre`, `post`, `contract_assert`) work?"
- "Which compiler supports which C++26 feature?"
- "How do I detect language features portably?"

## Workflow

### 1. Which standard am I compiling with?

| Compiler | Default C | Default C++ |
|----------|-----------|-------------|
| GCC 14 | `gnu17` (`201710L`) | `gnu++17` (`201703L`) |
| GCC 15 | `gnu23` (`202311L`) | `gnu++17` |
| GCC 16 | `gnu23` | `gnu++20` (`202002L`) |
| Clang 23 | `gnu17` | `gnu++17` |

```bash
# Print the effective standard version macros
gcc -dM -E -x c /dev/null | grep __STDC_VERSION__
g++ -dM -E -x c++ /dev/null | grep '__cplusplus '

# Pin the standard in the build instead of relying on defaults
gcc -std=gnu17 ...      # CMake: set(CMAKE_C_STANDARD 17), set(CMAKE_CXX_STANDARD 17)
```

```text
Build broke after a compiler upgrade?
├── C file → new default is C23 → section 2 (or pin -std=gnu17 while fixing)
├── C++ file with GCC 16 → new default is C++20 → section 4 (or pin -std=gnu++17)
└── Neither → check release notes for new warnings promoted to errors
```

### 2. Moving C code to C23

| C17 code | C23 behaviour | Fix |
|----------|---------------|-----|
| `typedef int bool;` / `#define bool int` | `bool`, `true`, `false` are keywords: `'bool' cannot be defined via 'typedef'` | Remove; use the keyword (or `<stdbool.h>` is a no-op) |
| `int f();` then `f(1, 2)` | `()` means `(void)`: `too many arguments to function 'f'` | Write the full prototype |
| K&R definitions `int f(a, b) int a, b; {...}` | Removed from C23 | Convert to prototype form |
| Identifiers `nullptr`, `constexpr`, `typeof`, `static_assert`, `alignas`, `thread_local` | Now keywords | Rename |

GCC 15/16 accept the old code with `-std=gnu17`; use that as a stopgap, not a fix.

### 3. C23 features

```c
// c23.c — gcc -std=c23 (GCC 15+), clang -std=c23
#include <stdbit.h>
#include <stdckdint.h>
#include <stdio.h>

constexpr int N = 4;                     // constexpr objects
static const unsigned char blob[] = {
#embed "c23.c" limit(8)                  // embed a file's bytes at compile time
};

[[nodiscard]] static int twice(int x) { return 2 * x; }

int main(void) {
    int *p = nullptr;                    // nullptr / nullptr_t
    typeof(N) arr[N] = {};               // typeof, empty initializer
    bool ok = true;                      // bool/true/false are keywords
    auto y = twice(21);                  // auto type inference
    _BitInt(12) small = 2047wb;          // bit-precise integers
    unsigned u = 0b1010'0000;            // binary literal + digit separators
    int sum;
    if (ckd_add(&sum, 2147483647, 1))    // checked arithmetic, returns true on overflow
        puts("overflow detected");
    printf("%d %d %d %u %d\n", (int)sizeof arr, y, ok, stdc_count_ones(u), (int)small);
    printf("embed first byte: %c\n", blob[0]);
    return p == nullptr ? 0 : 1;
}
```

`#embed` needs GCC 15+ (GCC 14 reports `invalid preprocessing directive #embed`). Clang 23 builds
this file with `-std=c23`.

C2y (next C standard) in GCC 16 with `-std=c2y`:

```c
int a[7];
printf("%zu\n", _Countof(a));            // element count, replaces sizeof(a)/sizeof(a[0])
if (int n = 3; n > 2) { /* ... */ }      // declarations in if conditions
```

### 4. GCC 16: C++20 by default

Code that built as C++17 can fail or warn under C++20:

| C++17 code | C++20 result | Fix |
|------------|--------------|-----|
| `const char* s = u8"text";` | error: `u8` literals are `const char8_t[]` | Use `char8_t`, or `-fno-char8_t` temporarily |
| `struct A { A() = delete; int x; }; A a{1};` | error: a user-declared constructor makes it a non-aggregate | Remove the declaration or add a real constructor |
| Non-const `bool operator==(const T&)` | warning: ambiguous with the reversed candidate | Make `operator==` `const` |
| `volatile int v; v++;` | warning: deprecated (`-Wvolatile`) | `v = v + 1` or use atomics |

### 5. C++26 status

C++26 was finalized by WG21 in March 2026, but the ISO DIS ballot failed on 23 October 2026,
mainly over contracts. WG21's November 2026 meeting is deciding how to proceed. Treat contracts
as subject to change. Implementations are experimental and behind flags:

| Feature | GCC 16.2 | Clang 23.1 (upstream) |
|---------|----------|-----------------------|
| Static reflection (P2996) | `-std=c++26 -freflection` | No (Bloomberg fork `clang-p2996`) |
| Contracts (P2900) | `-std=c++26 -fcontracts` | No (`-fcontracts` unknown) |
| Expansion statements (`template for`) | Yes | No |
| Pack indexing `ts...[0]` | Yes | Yes |
| `= delete("reason")`, placeholder `_` | Yes | Yes |
| `std::inplace_vector` | libstdc++ 16 | Not in libc++ 23 |

### 6. Static reflection (GCC 16)

```cpp
// g++ -std=c++26 -freflection refl.cpp
#include <meta>
#include <print>
#include <string>

struct Packet {
    int id;
    float value;
    std::string name;
};

// Print every non-static data member, generated at compile time
template <typename T>
void dump(const T& obj) {
    template for (constexpr auto m :
                  std::define_static_array(std::meta::nonstatic_data_members_of(
                      ^^T, std::meta::access_context::unchecked()))) {
        std::println("{} = {}", std::meta::identifier_of(m), obj.[:m:]);
    }
}

enum class Color { red, green, blue };

template <typename E>
constexpr std::string_view enum_name(E e) {
    template for (constexpr auto en :
                  std::define_static_array(std::meta::enumerators_of(^^E))) {
        if (e == [:en:]) return std::meta::identifier_of(en);
    }
    return "<unknown>";
}

int main() {
    dump(Packet{7, 2.5f, "probe"});       // id = 7, value = 2.5, name = probe
    std::println("{}", enum_name(Color::green));
    static_assert(std::meta::identifier_of(^^Packet) == "Packet");
}
```

- `^^T` reflects an entity into a `std::meta::info` value; `[:r:]` splices it back.
- `template for` expands at compile time over a constant range; `define_static_array` makes one.
- Without `-freflection`, GCC 16 reports `'std::meta' has not been declared`.

### 7. Contracts (GCC 16)

```cpp
// g++ -std=c++26 -fcontracts -fcontract-evaluation-semantic=enforce contracts.cpp
#include <cstdio>

int divide(const int a, const int b)   // postconditions may only name const params
    pre(b != 0)
    post(r: r * b <= a)
{
    return a / b;
}

int main(int argc, char**) {
    int x = divide(10, 3);
    contract_assert(x == 3);
    std::printf("ok %d\n", x);
    return divide(1, argc - 1);   // argc == 1 → precondition violation
}
```

| `-fcontract-evaluation-semantic=` | On violation |
|-----------------------------------|--------------|
| `enforce` | Calls the handler (prints the violation), then terminates |
| `observe` | Calls the handler, then continues |
| `quick_enforce` | Terminates immediately, no handler |
| `ignore` | Predicate not evaluated |

```cpp
// Replaceable violation handler: log, then decide whether to continue
#include <contracts>
#include <cstdio>
#include <cstdlib>

void handle_contract_violation(const std::contracts::contract_violation& v) {
    std::fprintf(stderr, "contract failed: %s (%s:%u)\n", v.comment(),
                 v.location().file_name(), v.location().line());
    if (v.is_terminating()) std::abort();
}
```

- A postcondition naming a non-const parameter is an error: `a value parameter used in a postcondition must be const`.
- Without `-fcontracts`, GCC 16.2 still parses the syntax in C++26 mode but the link fails with
  `undefined reference to handle_contract_violation(...)` unless you define the handler yourself.

### 8. Standard library hardening

```bash
# libstdc++: bounds and precondition checks (abort with a message)
g++ -O2 -D_GLIBCXX_ASSERTIONS app.cpp

# GCC 14+: -fhardened turns on _GLIBCXX_ASSERTIONS plus FORTIFY, stack protector, PIE, RELRO, ...
g++ -O2 -fhardened app.cpp

# libc++: fast hardening mode (traps on violation)
clang++ -stdlib=libc++ -O2 -D_LIBCPP_HARDENING_MODE=_LIBCPP_HARDENING_MODE_FAST app.cpp
```

With `_GLIBCXX_ASSERTIONS`, `v[5]` on a 3-element vector aborts with
`Assertion '__n < this->size()' failed`; libc++ fast mode stops with `SIGTRAP`.

### 9. Feature detection

| Check | Meaning |
|-------|---------|
| `__STDC_VERSION__ >= 202311L` | C23 |
| `__has_include(<stdckdint.h>)` | Checked arithmetic header available |
| `__has_embed("file")` | `#embed` can find the file |
| `__cplusplus >= 202002L` | C++20 (C++26 mode on GCC 16/Clang 23 reports `202400L`) |
| `__cpp_impl_reflection` | Reflection (GCC 16: `202603L`) |
| `__cpp_contracts` | Contracts (GCC 16: `202502L`) |
| `__cpp_expansion_statements` | `template for` |
| `__cpp_pack_indexing` | `ts...[i]` |
| `__cpp_lib_inplace_vector` | `std::inplace_vector` (include `<version>` first) |

```cpp
#include <version>
#if defined(__cpp_impl_reflection)
    // reflection path
#else
    // fallback: macros or code generation
#endif
```

## Related skills

- Use `skills/compilers/gcc` for GCC flags and diagnostics
- Use `skills/compilers/clang` for Clang flags and libc++
- Use `skills/compilers/cpp-templates` for the template techniques reflection replaces
- Use `skills/compilers/cpp-modules` for C++20 modules
- Use `skills/runtimes/binary-hardening` for `-fhardened` and other hardening flags
