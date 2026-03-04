---
name: cpp-coroutines
description: C++20 coroutines skill for understanding coroutine mechanics and debugging. Use when working with co_await, co_yield, co_return, implementing promise_type, understanding coroutine frame layout, debugging suspended coroutines in GDB, or inspecting frame allocation with Compiler Explorer. Activates on queries about C++20 coroutines, co_await, co_yield, promise_type, coroutine_handle, coroutine suspension, or coroutine frame.
---

# C++20 Coroutines

## Purpose

Guide agents through C++20 coroutine mechanics: `co_await`, `co_yield`, `co_return`, implementing the required `promise_type`, understanding coroutine frame memory layout, debugging suspended coroutines in GDB, and reducing frame allocation overhead.

## Triggers

- "How do co_await, co_yield, and co_return work?"
- "How do I implement promise_type for a coroutine?"
- "How does a coroutine suspend and resume?"
- "How do I debug a suspended coroutine in GDB?"
- "How much memory does a coroutine frame use?"
- "How do I write a generator with co_yield?"

## Workflow

### 1. The three coroutine keywords

```cpp
// co_return — return a value and end the coroutine
co_return value;

// co_yield — produce a value, suspend, resume later
co_yield value;

// co_await — suspend until an awaitable completes
auto result = co_await some_awaitable;
```

A function is a coroutine if it contains any of these three keywords. Its return type must be a coroutine type with a `promise_type`.

### 2. Minimal coroutine type — Task

```cpp
#include <coroutine>
#include <stdexcept>
#include <optional>

template <typename T>
struct Task {
    struct promise_type {
        std::optional<T> value;
        std::exception_ptr exception;

        Task get_return_object() {
            return Task{std::coroutine_handle<promise_type>::from_promise(*this)};
        }

        std::suspend_always initial_suspend() { return {}; }  // lazy start
        std::suspend_always final_suspend() noexcept { return {}; }

        void return_value(T v) { value = std::move(v); }

        void unhandled_exception() { exception = std::current_exception(); }
    };

    std::coroutine_handle<promise_type> handle;

    explicit Task(std::coroutine_handle<promise_type> h) : handle(h) {}

    Task(Task&&) = default;
    Task& operator=(Task&&) = default;

    ~Task() { if (handle) handle.destroy(); }

    T get() {
        handle.resume();                      // resume to completion
        if (handle.promise().exception)
            std::rethrow_exception(handle.promise().exception);
        return std::move(*handle.promise().value);
    }
};

// Usage
Task<int> compute() {
    co_return 42;
}

int main() {
    auto task = compute();
    int result = task.get();   // 42
}
```

### 3. Generator with co_yield

```cpp
template <typename T>
struct Generator {
    struct promise_type {
        T current_value;

        Generator get_return_object() {
            return Generator{std::coroutine_handle<promise_type>::from_promise(*this)};
        }

        std::suspend_always initial_suspend() { return {}; }
        std::suspend_always final_suspend() noexcept { return {}; }
        void return_void() {}
        void unhandled_exception() { throw; }

        std::suspend_always yield_value(T value) {
            current_value = value;
            return {};                     // suspend after yielding
        }
    };

    std::coroutine_handle<promise_type> handle;

    explicit Generator(std::coroutine_handle<promise_type> h) : handle(h) {}
    ~Generator() { if (handle) handle.destroy(); }

    struct iterator {
        std::coroutine_handle<promise_type> handle;
        bool done;

        iterator& operator++() {
            handle.resume();
            done = handle.done();
            return *this;
        }
        T operator*() const { return handle.promise().current_value; }
        bool operator!=(std::default_sentinel_t) const { return !done; }
    };

    iterator begin() {
        handle.resume();                   // advance to first yield
        return {handle, handle.done()};
    }
    std::default_sentinel_t end() { return {}; }
};

// Usage
Generator<int> iota(int start, int end) {
    for (int i = start; i < end; ++i)
        co_yield i;
}

for (int x : iota(0, 5)) {
    std::cout << x << ' ';   // 0 1 2 3 4
}
```

### 4. Awaitable — custom co_await target

```cpp
// An awaitable has three methods:
// await_ready() — true means don't suspend
// await_suspend(handle) — suspend: store handle, schedule resume
// await_resume() — return value of co_await expression

struct TimerAwaitable {
    int delay_ms;

    bool await_ready() const noexcept { return delay_ms <= 0; }

    void await_suspend(std::coroutine_handle<> h) {
        // Schedule h.resume() to be called after delay
        std::thread([h, this]() {
            std::this_thread::sleep_for(std::chrono::milliseconds(delay_ms));
            h.resume();
        }).detach();
    }

    void await_resume() const noexcept {}  // no return value
};

// suspend_always and suspend_never are built-in awaitables
std::suspend_always{};   // always suspends
std::suspend_never{};    // never suspends (no-op)
```

### 5. Coroutine frame layout and memory

The compiler allocates a coroutine frame (heap object) containing:
- Local variables that live across suspension points
- The promise object
- The current suspension state (where to resume)
- A pointer to the resumption/destruction functions

```cpp
// Inspect frame size with Compiler Explorer (godbolt.org)
// Compile with: g++ -std=c++20 -O2 -S
// Look for: operator new call size in the generated asm
// Or: clang -std=c++20 -O2 -emit-llvm -S | grep "coro.size"

// Reduce frame size:
// 1. Don't keep large objects alive across co_await
struct Bad {
    std::vector<char> large_buf;   // whole vector lives in frame
    co_return large_buf.size();    // large_buf crosses suspension
};

// 2. Move data out before suspending
std::vector<char> buf = get_data();
size_t sz = buf.size();            // capture only what's needed
buf.clear();                       // release before suspension
co_await next_event;
// sz still valid; buf released
```

### 6. Debugging suspended coroutines in GDB

```bash
# Coroutines appear as regular stack frames after resume()
# To inspect a suspended coroutine:

(gdb) info locals
# Look for coroutine_handle variables

# Print the promise object
(gdb) p *(promise_type*)(handle.__handle_)
# GDB 14+ has coroutine-specific support
(gdb) info coroutines        # GCC coroutine support (experimental)

# Step through coroutine execution
(gdb) step     # enters co_await implementation
(gdb) finish   # returns from coroutine frame function
(gdb) next     # step over suspension point

# View all threads (coroutines running on thread pool)
(gdb) info threads
(gdb) thread 2
(gdb) bt
```

### 7. Common pitfalls

| Issue | Cause | Fix |
|-------|-------|-----|
| `co_await` in a non-coroutine | Function missing coroutine return type | Change return type to a coroutine type |
| Dangling handle after `co_return` | Using handle after coroutine finishes | Check `handle.done()` before resume |
| Double-resume | Resuming an already-resumed coroutine | Track state; only resume when suspended |
| Coroutine frame never freed | Forgot `handle.destroy()` | Use RAII wrapper (Task, Generator) |
| Heap allocation overhead | New frame per coroutine call | Enable HALO (Heap Allocation eLision Optimization) with `-O2` |
| Recursive co_await depth | Stack overflow from deep chains | Use `std::coroutine_handle<>` tail-call pattern |

## Related skills

- Use `skills/compilers/cpp-templates` for other advanced C++20 features
- Use `skills/rust/rust-async-internals` for Rust's equivalent Future/Poll model
- Use `skills/debuggers/gdb` for GDB session management
