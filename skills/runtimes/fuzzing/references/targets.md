# Fuzzing Targets and Corpus Reference

Source: <https://llvm.org/docs/LibFuzzer.html>
Source: <https://github.com/AFLplusplus/AFLplusplus/blob/stable/docs/fuzzing_in_depth.md>
Source: <https://google.github.io/clusterfuzz/>

## Table of Contents

1. [libFuzzer flags reference](#libfuzzer-flags-reference)
2. [AFL++ flags reference](#afl-flags-reference)
3. [Writing good fuzz targets](#writing-good-fuzz-targets)
4. [Corpus management](#corpus-management)
5. [Dictionary format](#dictionary-format)
6. [Sanitizer combinations for fuzzing](#sanitizer-combinations-for-fuzzing)
7. [CI integration patterns](#ci-integration-patterns)
8. [OSS-Fuzz integration](#oss-fuzz-integration)

---

## libFuzzer flags reference

Run `./fuzz_target -help=1` to see all options.

### Common flags

| Flag | Default | Effect |
|------|---------|--------|
| `-max_len=N` | 4096 | Maximum input size in bytes |
| `-min_len=N` | 0 | Minimum input size |
| `-len_control=N` | 100 | How fast to grow input length |
| `-timeout=N` | 1200 | Kill a single run after N seconds |
| `-rss_limit_mb=N` | 2048 | Kill if RSS exceeds N MB |
| `-malloc_limit_mb=N` | 0 | Kill if malloc exceeds N MB (0=off) |
| `-max_total_time=N` | 0 | Total fuzzing time (0=infinite) |
| `-runs=N` | -1 | Total number of executions (-1=infinite) |
| `-jobs=N` | 1 | Number of parallel fuzzing jobs |
| `-workers=N` | N/2 | Threads per job |
| `-dict=file` | none | Token dictionary |
| `-seed=N` | 0 | Random seed (0=use time) |
| `-seed_inputs=f1,f2` | none | Comma-separated seed files |
| `-merge=1` | off | Corpus merge mode |
| `-minimize_crash=1` | off | Minimise a crash input |
| `-print_coverage=1` | off | Print coverage on exit |
| `-use_value_profile=1` | off | Use value comparison profiling |
| `-error_exitcode=N` | 77 | Exit code when a bug is found |
| `-artifact_prefix=dir/` | `./` | Where to write crash files |
| `-exact_artifact_path=f` | none | Exact path for crash artifact |
| `-verbosity=N` | 1 | 0=silent, 1=normal, 2=verbose |

### Corpus minimisation

```bash
# Merge corpus: keeps only inputs that add new coverage
./fuzz_target -merge=1 corpus_min/ corpus_old/ run1/ run2/

# Minimise a single crash input (reduce to smallest reproducer)
./fuzz_target -minimize_crash=1 -max_total_time=60 crash-abc123
```

---

## AFL++ flags reference

Run `afl-fuzz -h` for full help.

### Core flags

| Flag | Effect |
|------|--------|
| `-i dir` | Input corpus directory |
| `-o dir` | Output directory (findings go here) |
| `-t msec` | Per-execution timeout in milliseconds |
| `-m MB` | Memory limit in MB (default 50) |
| `-f file` | Input file path (if not using `@@`) |
| `-x dict` | Token dictionary |
| `-s seed` | Random seed |
| `-n` | Dumb mode (no instrumentation; coverage-blind) |
| `-d` | Disable deterministic mutations (faster for large inputs) |
| `-D` | Enable deterministic mutations (slower, thorough) |
| `-M name` | Main fuzzer instance (for multi-instance) |
| `-S name` | Secondary fuzzer instance |
| `-c prog` | Use cmplog binary (record comparisons) |
| `-l N` | Cmplog level (1=headers, 2=comparisons, 3=transformations) |
| `-p schedule` | Power schedule: `fast`, `explore`, `exploit`, `rare`, etc. |

### Multi-instance parallelism

```bash
# Main instance
afl-fuzz -i corpus/ -o findings/ -M main -- ./prog @@

# Secondary instances (run as many as CPU cores - 1)
afl-fuzz -i corpus/ -o findings/ -S fuzzer1 -- ./prog @@
afl-fuzz -i corpus/ -o findings/ -S fuzzer2 -- ./prog @@
```

### Status and output

```bash
# Check status (in another terminal)
afl-whatsup findings/

# Print stats
cat findings/main/fuzzer_stats

# Show coverage
afl-showmap -i findings/main/queue -o /dev/null -- ./prog @@
```

---

## Writing good fuzz targets

### Anatomy of a libFuzzer target

```c
#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>

// Optional: one-time initialisation
__attribute__((constructor))
static void init(void) {
    // initialise logging, allocators, etc.
    // this runs once before LLVMFuzzerTestOneInput
}

int LLVMFuzzerTestOneInput(const uint8_t *data, size_t size) {
    // Reject inputs that are too small
    if (size < 4) return 0;

    // Make a null-terminated copy if API needs it
    char *buf = malloc(size + 1);
    if (!buf) return 0;
    memcpy(buf, data, size);
    buf[size] = '\0';

    // Call the target API
    my_parse_function(buf, size);

    free(buf);
    return 0;   // Always 0; never call exit() or abort()
}
```

### What NOT to do in a fuzz target

```c
// BAD: calling exit() is not a crash, it stops fuzzing
if (error) exit(1);   // wrong

// BAD: global state that persists across calls
static int count = 0;
count++;              // wrong: each call must be independent

// BAD: reading outside [data, data+size)
char c = data[size];  // undefined; may not crash but is wrong

// BAD: writing to data
((uint8_t *)data)[0] = 0;  // undefined behaviour

// GOOD: return 0 for invalid / uninteresting input
if (size < MIN_SIZE) return 0;
```

### Custom mutator (libFuzzer)

```c
// Implement to guide mutation for structured inputs
extern "C" size_t LLVMFuzzerCustomMutator(
    uint8_t *data, size_t size, size_t max_size, unsigned int seed)
{
    // Deserialise, mutate logically, re-serialise
    MyProto proto;
    if (!proto.ParseFromArray(data, size)) {
        // If invalid, generate a valid one
        proto = generate_valid_proto(seed);
    }
    mutate_field(proto, seed);
    std::string out = proto.SerializeAsString();
    if (out.size() > max_size) return 0;  // too large
    memcpy(data, out.data(), out.size());
    return out.size();
}
```

---

## Corpus management

### Seeding the corpus

Good initial seeds dramatically reduce time to coverage:

```bash
# Use existing test inputs
cp tests/inputs/* corpus/

# Use real-world samples (parsers, codecs)
cp /usr/share/common-data/*.json corpus/

# Generate minimal valid inputs manually
echo '{}' > corpus/empty_json
echo '{"key":"val"}' > corpus/basic_json
```

### Corpus minimisation (libFuzzer)

```bash
./fuzz_target -merge=1 corpus_min/ corpus_full/
# corpus_min/ will contain only the coverage-unique inputs
```

### Corpus deduplication (AFL++)

```bash
afl-cmin -i findings/main/queue -o corpus_min/ -- ./prog @@
```

### Measure coverage of corpus

```bash
# libFuzzer: run corpus with -runs=0 to measure coverage
./fuzz_target corpus/ -runs=0 -print_coverage=1

# With llvm-cov:
# Compile with -fprofile-instr-generate -fcoverage-mapping
# Run corpus
LLVM_PROFILE_FILE="fuzz_%p.profraw" ./fuzz_target corpus/ -runs=0
llvm-profdata merge -o fuzz.profdata fuzz_*.profraw
llvm-cov report ./fuzz_target -instr-profile=fuzz.profdata
```

---

## Dictionary format

Dictionaries guide the fuzzer with interesting tokens for the target format:

```c
# parser.dict — one entry per line
# String tokens (double-quoted)
kw1="<"
kw2=">"
kw3="</"
kw4="<!--"
kw5="-->"
kw6="<![CDATA["

# Binary tokens (hex-escaped)
null_byte="\x00"
utf8_bom="\xef\xbb\xbf"
max_uint32="\xff\xff\xff\xff"

# Integer values (for integer comparisons)
magic1="\x89PNG"
magic2="%PDF"
magic3="PK\x03\x04"   # ZIP magic
```

libFuzzer: `./fuzz_target corpus/ -dict=parser.dict`
AFL++: `afl-fuzz -i corpus/ -o out/ -x parser.dict -- ./prog @@`

---

## Sanitizer combinations for fuzzing

| Combination | Build flags | Good for |
|-------------|-------------|---------|
| ASan + UBSan (recommended) | `-fsanitize=address,undefined` | Memory bugs + UB |
| ASan only | `-fsanitize=address` | Memory bugs (fastest) |
| MSan | `-fsanitize=memory` | Uninit reads (Clang only, slow) |
| Coverage only (no san) | `-fsanitize=fuzzer` | Maximum speed, fewer bug catches |

```bash
# Recommended build for libFuzzer
clang -fsanitize=fuzzer,address,undefined \
      -fno-omit-frame-pointer -g -O1 \
      fuzz_target.c mylib.c -o fuzz_target
```

Do not combine TSan with ASan or MSan.

---

## CI integration patterns

### Short regression run (every PR)

```yaml
- name: Build fuzz target
  run: |
    clang -fsanitize=fuzzer,address,undefined -g -O1 \
      fuzz_parser.c mylib.c -o fuzz_parser

- name: Fuzz regression (60 seconds)
  run: |
    ./fuzz_parser corpus/ \
      -max_total_time=60 \
      -error_exitcode=1 \
      -artifact_prefix=artifacts/

- name: Reproduce known crashes
  run: |
    for f in known_crashes/*; do
      ./fuzz_parser "$f" || exit 1
    done
```

### Long-running fuzzing (scheduled / nightly)

```yaml
- name: Extended fuzzing (1 hour)
  run: |
    ./fuzz_parser corpus/ \
      -max_total_time=3600 \
      -jobs=$(nproc) \
      -workers=$(nproc) \
      -artifact_prefix=findings/ \
      -error_exitcode=1

- name: Upload new corpus to cache
  uses: actions/cache@v3
  with:
    path: corpus/
    key: fuzzcorpus-${{ github.run_id }}
    restore-keys: fuzzcorpus-
```

---

## OSS-Fuzz integration

OSS-Fuzz runs fuzzing at scale for open-source projects.

Minimal project layout:

```text
oss-fuzz-project/
├── project.yaml       # project metadata
├── Dockerfile         # build environment
├── build.sh           # build fuzz targets
└── fuzz_target.c      # fuzz entry point
```

`build.sh` example:

```bash
#!/bin/bash -eu
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -- fuzz_parser
cp build/fuzz_parser $OUT/
cp corpus.zip $OUT/fuzz_parser_seed_corpus.zip
cp parser.dict $OUT/fuzz_parser.dict
```

See: <https://google.github.io/oss-fuzz/getting-started/new-project-guide/>
