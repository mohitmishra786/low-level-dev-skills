---
name: kernel-testing
description: Linux kernel testing skill for KUnit, kselftest, syzkaller, and LTP. Use when writing KUnit tests, running kselftest harness, configuring syzkaller fuzzing, or integrating KernelCI. Activates on queries about kunit_test_suite, kunit.py, kselftest, syzkaller, kcov, or Linux Test Project.
---

# Kernel Testing

## Purpose

Guide agents through testing the Linux kernel: KUnit in-kernel unit tests, the kselftest harness, syzkaller fuzzing with kcov coverage, Linux Test Project (LTP) syscall regression, and KernelCI integration for continuous testing.

## When to Use

- Writing unit tests for kernel library code or driver helpers
- Adding regression tests to `tools/testing/selftests/`
- Fuzzing syscalls and ioctl interfaces with syzkaller
- Measuring kernel code coverage with kcov
- Running LTP for syscall compatibility validation
- Setting up CI for kernel patches

## Workflow

### 1. KUnit — in-kernel unit tests

```c
// test_example.c
#include <kunit/test.h>

static void example_test(struct kunit *test)
{
    KUNIT_EXPECT_EQ(test, 1 + 1, 2);
    KUNIT_ASSERT_NOT_ERR_OR_NULL(test, kmalloc(16, GFP_KERNEL));
}

static struct kunit_case example_test_cases[] = {
    KUNIT_CASE(example_test),
    {}
};

static struct kunit_suite example_suite = {
    .name = "example",
    .test_cases = example_test_cases,
};
kunit_test_suite(example_suite);

MODULE_LICENSE("GPL");
```

```makefile
# Makefile
obj-$(CONFIG_KUNIT) += test_example.o
```

```bash
# Run KUnit (in-tree)
./tools/testing/kunit/kunit.py run

# Run specific test
./tools/testing/kunit/kunit.py run --filter example

# With cross-compilation
./tools/testing/kunit/kunit.py run --cross_compile aarch64-linux-gnu- \
    --arch arm64
```

KUnit runs in kernel context (UMH or dedicated kunit kernel). Use `kunit_kmalloc` for test allocations.

### 2. kselftest harness

```bash
# Build all selftests
cd tools/testing/selftests
make -j$(nproc)

# Run all
make run_tests

# Run specific test
./memfd/memfd_test
./mount/run_unprivileged_remount.sh
```

Adding a new selftest:

```
tools/testing/selftests/mytest/
├── Makefile
├── mytest.c
└── config        # optional kconfig requirements
```

```makefile
# tools/testing/selftests/mytest/Makefile
CFLAGS += -Wall
TEST_GEN_FILES := mytest
TEST_PROGS := mytest

include ../lib.mk
```

```bash
# Run from top-level
make -C tools/testing/selftests/mytest run_tests
```

### 3. syzkaller fuzzing

```bash
# Install syzkaller
git clone https://github.com/google/syzkaller
cd syzkaller && make

# Manager config (manager.cfg)
{
    "target": "linux/amd64",
    "http": "127.0.0.1:56741",
    "workdir": "/tmp/syzkaller",
    "kernel_obj": "/path/to/kernel/build",
    "syzkaller": "/path/to/syzkaller",
    "procs": 8,
    "type": "qemu",
    "vm": {
        "count": 4,
        "kernel": "/path/to/bzImage",
        "cpu": 2,
        "mem": 2048
    }
}
```

```bash
# Start manager
./bin/syz-manager -config manager.cfg

# Reproduce a crash
./bin/syz-repro -config manager.cfg crash-report.txt
```

Kernel requirements: `CONFIG_KCOV`, `CONFIG_DEBUG_FS`, `CONFIG_KASAN` (recommended).

### 4. kcov — kernel coverage

```bash
# Enable kcov on instrumented kernel
# CONFIG_KCOV=y in kernel config

# syzkaller uses kcov automatically
# Manual coverage via debugfs
ls /sys/kernel/debug/kcov/
```

Coverage guides syzkaller toward unexplored kernel paths.

### 5. Linux Test Project (LTP)

```bash
# Build LTP
git clone https://github.com/linux-test-project/ltp
cd ltp
make autotools
./configure
make -j$(nproc)
make install

# Run syscall tests
cd /opt/ltp
./runltp -f syscalls

# Run specific test
./runltp -f syscalls -s pipe01
```

LTP categories: syscalls, FS, network, IPC, controllers, security.

### 6. KernelCI

```bash
# Local kernel build test (simplified workflow)
# KernelCI tests patches against multiple defconfigs

# Submit build to KernelCI (project-specific tokens)
# See https://kernelci.org/docs/

# Check boot and kselftest results in KernelCI dashboard
```

Typical CI pipeline:

```
Patch → build (allmodconfig) → boot test (QEMU) → kselftest → LTP subset
```

### 7. Testing decision tree

```
What to test?
├── Pure kernel function logic → KUnit
├── Userspace-visible behavior (syscall, ioctl) → kselftest
├── Security/crash finding → syzkaller + KASAN
├── Regression across distros → LTP
└── Upstream patch CI → KernelCI
```

### 8. Debug-friendly test kernel config

```
CONFIG_KUNIT=y
CONFIG_KCOV=y
CONFIG_KASAN=y
CONFIG_DEBUG_INFO_DWARF5=y
CONFIG_FRAME_POINTER=y
CONFIG_FTRACE=y
```

```bash
make kvm_guest.config   # reasonable test config base
scripts/config --enable KUNIT KCOV KASAN
make olddefconfig
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| KUnit tests not found | CONFIG_KUNIT disabled | Enable in .config; rebuild |
| kselftest SKIP | Missing kernel feature | Check `config` file requirements |
| syzkaller no crashes | Wrong VM config | Verify QEMU boots; check kernel cmdline |
| kcov zero coverage | CONFIG_KCOV off | Rebuild kernel with kcov |
| LTP massive failures | Wrong environment | Run as root; check prerequisites in README |
| kunit.py hangs | UML vs hardware mismatch | Specify `--arch` and cross-compile |

## Related Skills

- `skills/low-level-programming/linux-kernel-modules` — modules under test
- `skills/kernel/device-drivers` — driver logic to unit test
- `skills/kernel/kernel-debugging` — debug failures found by tests
- `skills/runtimes/fuzzing` — userspace fuzzing concepts (libFuzzer)
- `skills/runtimes/sanitizers` — KASAN/KMSAN for kernel
- `skills/virtualization/qemu-kvm` — QEMU for kernel boot testing