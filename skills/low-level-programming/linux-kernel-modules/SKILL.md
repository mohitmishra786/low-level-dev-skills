---
name: linux-kernel-modules
description: Linux kernel module skill for writing and debugging loadable kernel modules. Use when writing LKMs with Kbuild, adding module parameters, creating /proc and sysfs entries, implementing character devices, debugging with KGDB or ftrace, or handling module signing for Secure Boot. Activates on queries about Linux kernel modules, loadable modules, Kbuild, module parameters, /proc filesystem, sysfs, character devices, KGDB, or module signing.
---

# Linux Kernel Modules

## Purpose

Guide agents through writing loadable Linux kernel modules (LKMs): the Kbuild build system, module parameters, /proc and sysfs interfaces, character device implementation, kernel debugging with KGDB and `ftrace`, and module signing for Secure Boot.

## Triggers

- "How do I write a Linux kernel module?"
- "How do I add parameters to my kernel module?"
- "How do I create a /proc or sysfs entry?"
- "How do I implement a character device driver?"
- "How do I debug a kernel module with KGDB?"
- "How do I sign a kernel module for Secure Boot?"

## Workflow

### 1. Minimal kernel module

```c
// hello.c — minimal loadable kernel module
#include <linux/module.h>
#include <linux/kernel.h>
#include <linux/init.h>

MODULE_LICENSE("GPL");
MODULE_AUTHOR("Your Name");
MODULE_DESCRIPTION("Minimal hello world module");
MODULE_VERSION("1.0");

static int __init hello_init(void)
{
    printk(KERN_INFO "hello: module loaded\n");
    return 0;   // non-zero = load failure
}

static void __exit hello_exit(void)
{
    printk(KERN_INFO "hello: module unloaded\n");
}

module_init(hello_init);
module_exit(hello_exit);
```

```makefile
# Makefile — must be exactly this structure for Kbuild
obj-m := hello.o

KDIR := /lib/modules/$(shell uname -r)/build

all:
	$(MAKE) -C $(KDIR) M=$(PWD) modules

clean:
	$(MAKE) -C $(KDIR) M=$(PWD) clean
```

```bash
# Build
make

# Load
sudo insmod hello.ko

# Check it loaded
lsmod | grep hello
dmesg | tail -5       # see printk output

# Unload
sudo rmmod hello

# Show module info
modinfo hello.ko
```

### 2. Module parameters

```c
#include <linux/moduleparam.h>

static int count = 1;
static char *name = "world";

// module_param(variable, type, permissions)
// permissions: 0 = no sysfs entry, S_IRUGO = readable, S_IWUSR = writable
module_param(count, int, S_IRUGO | S_IWUSR);
MODULE_PARM_DESC(count, "Number of times to print (default: 1)");

module_param(name, charp, S_IRUGO);
MODULE_PARM_DESC(name, "Name to greet (default: world)");

static int __init hello_init(void)
{
    int i;
    for (i = 0; i < count; i++)
        printk(KERN_INFO "hello: Hello, %s!\n", name);
    return 0;
}
```

```bash
# Pass parameters at load time
sudo insmod hello.ko count=3 name="kernel"

# Modify at runtime (if S_IWUSR set)
echo 5 > /sys/module/hello/parameters/count
```

### 3. /proc filesystem interface

```c
#include <linux/proc_fs.h>
#include <linux/seq_file.h>

static struct proc_dir_entry *proc_entry;

static int mymod_show(struct seq_file *m, void *v)
{
    seq_printf(m, "Counter: %d\n", my_counter);
    seq_printf(m, "Status: %s\n", my_status ? "active" : "idle");
    return 0;
}

static int mymod_open(struct inode *inode, struct file *file)
{
    return single_open(file, mymod_show, NULL);
}

static const struct proc_ops mymod_fops = {
    .proc_open    = mymod_open,
    .proc_read    = seq_read,
    .proc_lseek   = seq_lseek,
    .proc_release = single_release,
};

static int __init mymod_init(void)
{
    proc_entry = proc_create("mymod", 0444, NULL, &mymod_fops);
    if (!proc_entry)
        return -ENOMEM;
    return 0;
}

static void __exit mymod_exit(void)
{
    proc_remove(proc_entry);
}
```

```bash
cat /proc/mymod
```

### 4. sysfs interface

```c
#include <linux/kobject.h>
#include <linux/sysfs.h>

static struct kobject *mymod_kobj;
static int mymod_value = 42;

static ssize_t value_show(struct kobject *kobj,
                          struct kobj_attribute *attr, char *buf)
{
    return sprintf(buf, "%d\n", mymod_value);
}

static ssize_t value_store(struct kobject *kobj,
                           struct kobj_attribute *attr,
                           const char *buf, size_t count)
{
    sscanf(buf, "%d", &mymod_value);
    return count;
}

static struct kobj_attribute value_attr =
    __ATTR(value, 0664, value_show, value_store);

static int __init mymod_init(void)
{
    mymod_kobj = kobject_create_and_add("mymod", kernel_kobj);
    if (!mymod_kobj) return -ENOMEM;
    return sysfs_create_file(mymod_kobj, &value_attr.attr);
}

static void __exit mymod_exit(void)
{
    sysfs_remove_file(mymod_kobj, &value_attr.attr);
    kobject_put(mymod_kobj);
}
```

```bash
cat /sys/kernel/mymod/value
echo 100 > /sys/kernel/mymod/value
```

### 5. Character device

```c
#include <linux/cdev.h>
#include <linux/fs.h>
#include <linux/uaccess.h>

#define DEVICE_NAME "mydev"
#define BUF_SIZE 1024

static int major;
static struct cdev my_cdev;
static char kernel_buf[BUF_SIZE];

static int mydev_open(struct inode *inode, struct file *file) { return 0; }
static int mydev_release(struct inode *inode, struct file *file) { return 0; }

static ssize_t mydev_read(struct file *f, char __user *buf, size_t len, loff_t *off)
{
    size_t to_copy = min(len, (size_t)BUF_SIZE);
    if (copy_to_user(buf, kernel_buf, to_copy)) return -EFAULT;
    return to_copy;
}

static ssize_t mydev_write(struct file *f, const char __user *buf, size_t len, loff_t *off)
{
    size_t to_copy = min(len, (size_t)(BUF_SIZE - 1));
    if (copy_from_user(kernel_buf, buf, to_copy)) return -EFAULT;
    kernel_buf[to_copy] = '\0';
    return to_copy;
}

static const struct file_operations mydev_fops = {
    .owner   = THIS_MODULE,
    .open    = mydev_open,
    .release = mydev_release,
    .read    = mydev_read,
    .write   = mydev_write,
};

static int __init mydev_init(void)
{
    major = register_chrdev(0, DEVICE_NAME, &mydev_fops);
    if (major < 0) return major;
    printk(KERN_INFO "mydev: registered with major %d\n", major);
    return 0;
}
```

```bash
# Create device node (after loading module)
sudo mknod /dev/mydev c $(cat /proc/devices | grep mydev | awk '{print $1}') 0
echo "test" > /dev/mydev
cat /dev/mydev
```

### 6. Debugging with KGDB and ftrace

```bash
# KGDB — kernel GDB via serial/network
# Boot with: kgdboc=ttyS0,115200 kgdbwait
# Or over network: kgdboe=@192.168.1.10/,@192.168.1.11/

# On debug host:
gdb vmlinux
(gdb) target remote /dev/ttyS0
(gdb) set architecture i386:x86-64:intel
(gdb) info registers

# ftrace — kernel function tracer
echo function > /sys/kernel/debug/tracing/current_tracer
echo mymod_write > /sys/kernel/debug/tracing/set_ftrace_filter
echo 1 > /sys/kernel/debug/tracing/tracing_on
cat /sys/kernel/debug/tracing/trace

# Dynamic debug — enable pr_debug() output
echo "module hello +p" > /sys/kernel/debug/dynamic_debug/control
```

### 7. Module signing (Secure Boot)

```bash
# Generate signing key
openssl req -new -x509 -newkey rsa:2048 \
    -keyout signing_key.pem -out signing_cert.pem \
    -days 365 -subj "/CN=Module Signing Key/" -nodes

# Sign the module
/usr/src/linux-headers-$(uname -r)/scripts/sign-file \
    sha256 signing_key.pem signing_cert.pem hello.ko

# Import certificate to MOK database
sudo mokutil --import signing_cert.pem
# (requires reboot and MOK enrollment at UEFI)
```

For Kbuild system details, see [references/kbuild-basics.md](references/kbuild-basics.md).

## Related skills

- Use `skills/observability/ebpf` for userspace kernel tracing without modules
- Use `skills/debuggers/gdb` for GDB session management with KGDB
- Use `skills/binaries/elf-inspection` for inspecting module ELF structure
