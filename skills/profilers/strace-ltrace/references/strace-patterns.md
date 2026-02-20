# strace/ltrace Patterns Reference

## strace Output Format

```text
syscall_name(arg1, arg2, ...) = return_value [error]
```

Examples:

```text
openat(AT_FDCWD, "/etc/passwd", O_RDONLY) = 3
read(3, "root:x:0:0:root:/root:/bin/bash\n"..., 4096) = 1234
write(1, "hello\n", 6) = 6
close(3) = 0
mmap(NULL, 4096, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS, -1, 0) = 0x7f1234567000
clone(child_stack=0, flags=CLONE_VM|CLONE_FS|...) = 12346
openat(AT_FDCWD, "/missing", O_RDONLY) = -1 ENOENT (No such file or directory)
```

## Diagnosing Common Issues

### Binary won't start

```bash
# Check dynamic linker issues
strace -e trace=openat ./myapp 2>&1 | grep -E "\.so|ENOENT"
# Look for missing shared libraries

# Check execve itself
strace -e execve ./myapp
# execve("/path/to/myapp", ["./myapp"], ...) = -1 ENOEXEC → wrong binary format

# Check interpreter line (#!)
strace -e execve ./myscript 2>&1 | head -5
```

### File not found issues

```bash
# Comprehensive file access trace
strace -e trace=openat,open,stat,access,faccessat ./myapp 2>&1 | \
    grep -v "= [0-9]$" | \
    grep -E "ENOENT|EACCES"

# Show all paths the app searches
strace -e trace=openat ./myapp 2>&1 | \
    awk '/openat/ { match($0, /"([^"]+)"/, arr); print arr[1] }'
```

### Network issues

```bash
# See all connections attempted
strace -e trace=connect -s 256 ./myapp 2>&1 | grep connect

# DNS resolution (usually getaddrinfo → /etc/resolv.conf + UDP)
strace -f -e trace=openat,connect,sendto,recvfrom ./myapp 2>&1 | \
    grep -E "resolv|dns|53"

# Show full socket addresses
strace -e trace=network -s 256 ./myapp 2>&1

# TLS handshake debugging
strace -e trace=network -s 4096 ./myapp 2>&1 | grep -A5 connect
```

### Permission issues

```bash
# Capability check
strace -e trace=prctl,capget,capset ./myapp 2>&1

# Setuid / setgid issues
strace -e trace=setuid,setgid,setresuid ./myapp

# SELinux/seccomp kills
strace -e trace=all ./myapp 2>&1 | tail -20
# SIGSYS = seccomp killed; SIGKILL could be OOM or policy
```

### Memory issues (strace side)

```bash
# Large mmap calls (potential memory exhaustion)
strace -e trace=mmap,munmap,brk ./myapp 2>&1 | grep "ENOMEM\|failed"

# Stack issues
strace -e trace=mmap,getrlimit,setrlimit ./myapp 2>&1 | head -30
```

## strace -c Output Analysis

```text
% time     seconds  usecs/call     calls    errors syscall
------ ----------- ----------- --------- --------- ----------------
 62.34    0.012456         124       100        12 read
 18.91    0.003782          37       102         0 write
 11.23    0.002246        1123         2         0 futex
  3.45    0.000690         690         1         0 nanosleep
  2.01    0.000402           4       100         0 close
  1.12    0.000224           2       112        10 openat
  0.94    0.000188           2        84         0 stat
```

Key columns:

- `% time` → where the process spends time in kernel
- `usecs/call` → average time per call (high = blocking call)
- `errors` → failed calls count (non-zero = something wrong)

## ltrace Filter Patterns

```bash
# Trace memory allocation functions
ltrace -e "malloc,calloc,realloc,free" ./myapp

# Trace string functions
ltrace -e "strcmp,strcpy,strncpy,strcat,strlen,strdup" ./myapp

# Trace file functions (C stdlib layer)
ltrace -e "fopen,fclose,fread,fwrite,fgets,fputs,fprintf,fscanf" ./myapp

# Trace format functions (find format string bugs)
ltrace -e "printf,fprintf,sprintf,snprintf,vprintf" ./myapp -s 256

# Trace pthread functions
ltrace -e "pthread_*" ./myapp

# Trace dynamic linking
ltrace -e "dlopen,dlsym,dlclose" ./myapp
```

## Combining strace + gdb

```bash
# Find the exact code location causing an error:
# 1. Identify failing syscall with strace
strace -e trace=openat ./myapp 2>&1 | grep ENOENT

# 2. Set a syscall catchpoint in GDB
gdb ./myapp
(gdb) catch syscall openat
(gdb) condition 1 $rax == -2  # -ENOENT
(gdb) run
# Stops at the exact code location that triggered ENOENT
(gdb) bt
(gdb) info locals
```

## strace on Docker / Containers

```bash
# Docker: requires --cap-add=SYS_PTRACE
docker run --cap-add=SYS_PTRACE myimage strace ./myapp

# Or in Kubernetes: add securityContext
# securityContext:
#   capabilities:
#     add: ["SYS_PTRACE"]

# Check if strace works in container
strace echo test 2>&1 | head -3
```
