---
name: fuzzing
description: Fuzzing skill for automated input-driven bug finding in C/C++. Use when setting up libFuzzer or AFL++ fuzz targets, defining fuzz entry points around parsing or I/O boundaries, integrating fuzzing into CI, managing corpora, or combining fuzzing with sanitizers. Activates on queries about libFuzzer, AFL, afl-fuzz, fuzz targets, corpus management, coverage-guided fuzzing, or OSS-Fuzz integration.
---

# Fuzzing

## Purpose

Guide agents through setting up and running coverage-guided fuzz testing: libFuzzer (in-process) and AFL++ (fork-based), with sanitizer integration and CI pipeline setup.

## Triggers

- "How do I fuzz-test my parser/deserializer?"
- "What is a fuzz target / how do I write one?"
- "How do I set up libFuzzer?"
- "How do I use AFL++ on my program?"
- "How do I run fuzzing in CI?"
- "Fuzzer found a crash — how do I reproduce it?"

## Workflow

### 1. Write a fuzz target (libFuzzer)

A fuzz target is a function that accepts arbitrary bytes and exercises the code under test.

```c
// fuzz_parser.c
#include <stdint.h>
#include <stddef.h>
#include "myparser.h"

// Entry point called by libFuzzer with random data
int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
    // Must not abort/exit on invalid input (that's expected)
    // Must not read outside [data, data+size)

    MyParser *p = parser_create();
    if (p) {
        parser_feed(p, (const char *)data, size);
        parser_destroy(p);
    }
    return 0;  // Always return 0 (non-zero means discard input)
}
```

Key rules:

- Never call `abort()`, `exit()`, or use global state that persists across calls
- Handle all inputs gracefully (crash = bug found)
- Keep the target fast: the fuzzer calls it millions of times

### 2. Build with libFuzzer

```bash
# Clang (libFuzzer is built into Clang)
clang -fsanitize=fuzzer,address -g -O1 \
    fuzz_parser.c myparser.c -o fuzz_parser

# With UBSan too
clang -fsanitize=fuzzer,address,undefined -g -O1 \
    fuzz_parser.c myparser.c -o fuzz_parser
```

`-fsanitize=fuzzer` links libFuzzer and provides `main()`. Do not provide your own `main()` in the fuzz target.

### 3. Run libFuzzer

```bash
# Create corpus directory
mkdir -p corpus

# Seed with known-good inputs (greatly accelerates coverage)
cp tests/inputs/* corpus/

# Run the fuzzer
./fuzz_parser corpus/ -max_len=65536 -timeout=10

# Run for a time limit
./fuzz_parser corpus/ -max_total_time=3600

# Run with specific number of jobs (parallel)
./fuzz_parser corpus/ -jobs=4 -workers=4

# Minimise a corpus (remove redundant inputs)
./fuzz_parser -merge=1 corpus_min/ corpus/
```

Common flags:

| Flag | Default | Effect |
|------|---------|--------|
| `-max_len=N` | 4096 | Max input size in bytes |
| `-timeout=N` | 1200 | Kill if single run takes > N seconds |
| `-max_total_time=N` | 0 (forever) | Total fuzzing time |
| `-runs=N` | -1 (infinite) | Total number of runs |
| `-dict=file` | none | Dictionary of interesting tokens |
| `-jobs=N` | 1 | Parallel jobs (each writes its own log) |
| `-merge=1` | off | Merge mode: minimise corpus |

### 4. Reproduce a crash

libFuzzer writes crash inputs to files named `crash-<hash>`, `oom-<hash>`, `timeout-<hash>`.

```bash
# Reproduce
./fuzz_parser crash-abc123

# Debug with GDB
gdb ./fuzz_parser
(gdb) run crash-abc123
```

### 5. AFL++ setup

AFL++ is a fork-based fuzzer that works on arbitrary programs (not just those with a fuzz entry point).

```bash
# Install
apt install afl++     # or build from source

# Instrument the target
CC=afl-clang-fast CXX=afl-clang-fast++ \
  cmake -S . -B build-afl -DCMAKE_BUILD_TYPE=Debug
cmake --build build-afl

# Or compile directly
afl-clang-fast -g -O1 -o prog_afl main.c myparser.c

# Create input corpus
mkdir -p afl-input afl-output
echo "hello" > afl-input/seed1

# Run
afl-fuzz -i afl-input -o afl-output -- ./prog_afl @@
# @@ is replaced with the input file path
# For stdin-based programs: remove @@
afl-fuzz -i afl-input -o afl-output -- ./prog_afl
```

### 6. AFL++ with persistent mode (faster)

Persistent mode avoids `fork()` per input — much faster for library fuzzing:

```c
// In your harness:
#include "myparser.h"

int main(int argc, char **argv) {
    while (__AFL_LOOP(1000)) {
        // Read input
        unsigned char *buf = NULL;
        ssize_t len = read(0, &buf, MAX_SIZE);  // or use afl_custom_mutator
        parser_feed((char*)buf, len);
        free(buf);
    }
    return 0;
}
```

### 7. Corpus management

```bash
# AFL++ corpus minimisation
afl-cmin -i afl-output/default/queue -o corpus_min -- ./prog_afl @@

# Merge libFuzzer corpora from multiple runs
./fuzz_parser -merge=1 merged_corpus/ run1_corpus/ run2_corpus/

# Show coverage (libFuzzer)
./fuzz_parser corpus/ -runs=0 -print_coverage=1
```

### 8. CI integration

```yaml
# GitHub Actions example
- name: Build fuzz targets
  run: |
    clang -fsanitize=fuzzer,address,undefined -g -O1 \
      fuzz_parser.c myparser.c -o fuzz_parser

- name: Short fuzz run (regression check)
  run: |
    ./fuzz_parser corpus/ -max_total_time=60 -error_exitcode=1
    # Also run known crash inputs if any:
    ls known_crashes/ 2>/dev/null | xargs -I{} ./fuzz_parser known_crashes/{}
```

For long-duration fuzzing, use OSS-Fuzz or ClusterFuzz infrastructure.

### 9. Dictionary files

Dictionaries contain interesting tokens to guide mutation:

```bash
# parser.dict
kw1="<"
kw2=">"
kw3="</"
kw4='="'
kw5="\x00"
kw6="\xff\xfe"
```

```bash
./fuzz_parser corpus/ -dict=parser.dict
```

## References

For fuzz target templates, corpus seed examples, and OSS-Fuzz integration guidance, see [references/targets.md](references/targets.md).

## Related skills

- Use `skills/runtimes/sanitizers` to add ASan/UBSan to fuzz builds
- Use `skills/compilers/clang` for Clang-specific libFuzzer flags
- Use `skills/debuggers/gdb` to debug crash inputs found by the fuzzer
