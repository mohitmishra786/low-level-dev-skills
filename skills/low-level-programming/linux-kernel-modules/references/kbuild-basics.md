# Kbuild System Reference

Source: https://docs.kernel.org/kbuild/modules.html

## Table of Contents

1. [Makefile Patterns](#makefile-patterns)
2. [Multi-file Modules](#multi-file-modules)
3. [Out-of-tree vs In-tree](#out-of-tree-vs-in-tree)
4. [Kbuild Variables](#kbuild-variables)

## Makefile Patterns

```makefile
# Single-file module
obj-m := hello.o

# Multi-file module (module name = mydriver)
obj-m := mydriver.o
mydriver-objs := core.o ops.o irq.o

# Multiple modules from one Makefile
obj-m := module_a.o module_b.o

# Module with subdirectory
obj-m := mydriver/

# Kbuild invocation
KDIR := /lib/modules/$(shell uname -r)/build
PWD  := $(shell pwd)

all:
	$(MAKE) -C $(KDIR) M=$(PWD) modules

clean:
	$(MAKE) -C $(KDIR) M=$(PWD) clean

install:
	$(MAKE) -C $(KDIR) M=$(PWD) modules_install
	depmod -a
```

## Multi-file Modules

```makefile
# Kbuild (or Makefile when called by Kbuild)
obj-m := mydriver.o
mydriver-objs := \
    src/core.o    \
    src/pci.o     \
    src/irq.o     \
    src/dma.o
```

```c
// Each .c file is a separate translation unit
// All share the same module (MODULE_LICENSE etc. in ONE file only)
// Other files just include linux/module.h for EXPORT_SYMBOL
```

## Out-of-tree vs In-tree

| | Out-of-tree | In-tree |
|-|------------|---------|
| Location | Separate directory | Under `drivers/` in kernel source |
| Build | `make -C KDIR M=PWD` | `make modules` with kernel |
| Kconfig | Not integrated | Requires Kconfig entry |
| Signed | Requires manual signing | Signed by kernel build |
| Tainting | Taints kernel (if not GPL) | Does not taint |

## Kbuild Variables

| Variable | Description |
|----------|-------------|
| `obj-m` | Module objects to build |
| `obj-y` | Objects compiled into the kernel (in-tree) |
| `ccflags-y` | Extra compiler flags for this directory |
| `ldflags-y` | Extra linker flags |
| `subdir-y` | Subdirectories to descend into |
| `EXTRA_CFLAGS` | Legacy; use `ccflags-y` instead |
| `KBUILD_MODNAME` | Module name (auto-set) |
| `KBUILD_EXTMOD` | Path of external module (set by M=) |

```makefile
# Extra flags for a module
ccflags-y := -DDEBUG -I$(src)/include
ldflags-y := -T$(src)/mymodule.ld
```

## Useful Kernel APIs

```c
/* Logging */
printk(KERN_ERR "error: %d\n", err);    // KERN_EMERG/ALERT/CRIT/ERR/WARNING/NOTICE/INFO/DEBUG
pr_err("error: %d\n", err);             // shorthand macros
dev_err(dev, "error: %d\n", err);       // device-specific logging

/* Memory */
void *kmalloc(size_t size, gfp_t flags);  // GFP_KERNEL (sleepable), GFP_ATOMIC (interrupt)
void kfree(void *ptr);
void *kzalloc(size_t size, gfp_t flags);  // zeroed kmalloc
void *vmalloc(size_t size);               // virtually contiguous (not physically)

/* Synchronization */
DEFINE_MUTEX(my_mutex);
mutex_lock(&my_mutex);
mutex_unlock(&my_mutex);

DEFINE_SPINLOCK(my_lock);
spin_lock_irqsave(&my_lock, flags);
spin_unlock_irqrestore(&my_lock, flags);

/* Userspace data access */
copy_to_user(user_ptr, kernel_ptr, size);    // returns bytes NOT copied
copy_from_user(kernel_ptr, user_ptr, size);  // returns bytes NOT copied
```
