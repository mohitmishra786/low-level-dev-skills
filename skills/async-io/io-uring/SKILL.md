---
name: io-uring
description: io_uring skill for Linux async I/O. Use when building high-performance servers with liburing, multi-shot operations, provided buffers, fixed files, zero-copy send, or tokio-uring. Activates on queries about io_uring, SQE/CQE, liburing, IORING_OP_PROVIDE_BUFFERS, or io_uring vs epoll.
---

# io_uring

## Purpose

Guide agents through Linux io_uring: the submission/completion queue model (SQE/CQE), liburing API, multi-shot accept/recv, provided buffer rings, fixed files and registered buffers, zero-copy send, Rust integration with tokio-uring, performance comparison with epoll, and security considerations.

## When to Use

- Building a high-throughput network or disk server on Linux 5.1+
- Replacing epoll + thread pool with fewer syscalls
- Implementing multi-shot accept/recv for connection-heavy services
- Using zero-copy networking with `IORING_OP_SEND_ZC`
- Integrating async I/O in Rust via `tokio-uring`
- Evaluating io_uring vs epoll for your workload

## Workflow

### 1. SQ/CQ model

```
Application                    Kernel
    │                            │
    ├── mmap SQ ring ───────────►│ submission queue (SQE)
    ├── mmap CQ ring ◄──────────│ completion queue (CQE)
    ├── io_uring_submit() ──────►│ processes SQEs
    └── io_uring_wait_cqe() ◄──│ posts CQEs
```

Each SQE describes one operation; each CQE reports result and user_data cookie.

### 2. Minimal liburing example

```c
#include <liburing.h>
#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>

int main(void) {
    struct io_uring ring;
    io_uring_queue_init(32, &ring, 0);

    int fd = open("test.txt", O_RDONLY);
    char buf[4096];

    struct io_uring_sqe *sqe = io_uring_get_sqe(&ring);
    io_uring_prep_read(sqe, fd, buf, sizeof(buf), 0);
    io_uring_sqe_set_data(sqe, (void *)1);

    io_uring_submit(&ring);

    struct io_uring_cqe *cqe;
    io_uring_wait_cqe(&ring, &cqe);
    if (cqe->res >= 0)
        printf("read %d bytes\n", cqe->res);
    else
        perror("read");

    io_uring_cqe_seen(&ring, cqe);
    io_uring_queue_exit(&ring);
    close(fd);
    return 0;
}
```

```bash
gcc -o uring_read uring_read.c -luring
./uring_read
```

### 3. Common prep operations

| Function | Operation |
|----------|-----------|
| `io_uring_prep_read` | File read |
| `io_uring_prep_write` | File write |
| `io_uring_prep_recv` | Socket recv |
| `io_uring_prep_send` | Socket send |
| `io_uring_prep_accept` | Accept connection |
| `io_uring_prep_connect` | Outbound connect |
| `io_uring_prep_poll_add` | Poll fd |
| `io_uring_prep_timeout` | Timeout/link timeout |

```c
// Batch multiple SQEs before single submit
for (int i = 0; i < n; i++) {
    sqe = io_uring_get_sqe(&ring);
    io_uring_prep_read(sqe, fds[i], bufs[i], sizes[i], 0);
    io_uring_sqe_set_data(sqe, (void *)(intptr_t)i);
}
io_uring_submit(&ring);
```

### 4. Multi-shot operations

```c
// Multi-shot accept — one SQE handles many connections
sqe = io_uring_get_sqe(&ring);
io_uring_prep_multishot_accept(sqe, listen_fd, NULL, NULL, 0);
io_uring_sqe_set_data(sqe, (void *)ACCEPT_COOKIE);

// Loop on CQEs until CQE_FLAG_MORE is clear
while (1) {
    io_uring_wait_cqe(&ring, &cqe);
    if (cqe->user_data == ACCEPT_COOKIE) {
        int client_fd = cqe->res;
        if (client_fd >= 0)
            handle_client(client_fd);
        if (!(cqe->flags & IORING_CQE_F_MORE))
            break;  // re-arm accept SQE
    }
    io_uring_cqe_seen(&ring, cqe);
}
```

### 5. Provided buffer rings

```c
#include <liburing.h>

#define BUF_GROUP 0
#define BUF_SIZE  4096
#define BUF_COUNT 64

struct io_uring_buf_ring *buf_ring;
char bufs[BUF_COUNT][BUF_SIZE];

// Setup buffer ring
buf_ring = io_uring_setup_buf_ring(&ring, BUF_COUNT, BUF_GROUP, 0, &ret);
for (int i = 0; i < BUF_COUNT; i++)
    io_uring_buf_ring_add(buf_ring, bufs[i], BUF_SIZE, i, BUF_COUNT - 1 - i, 0);
io_uring_buf_ring_advance(buf_ring, BUF_COUNT);

// Recv with provided buffers
sqe = io_uring_get_sqe(&ring);
io_uring_prep_recv_multishot(sqe, sock_fd, NULL, 0, 0);
sqe->buf_group = BUF_GROUP;
```

Kernel selects buffer from ring — eliminates per-recv buffer allocation.

### 6. Fixed files and registered buffers

```c
// Register files — avoids per-op fd table lookup
int fds[64];
io_uring_register_files(&ring, fds, 64);
io_uring_prep_read(sqe, 0, buf, size, offset);  // index 0, not fd

// Registered buffers — pinned, DMA-friendly
struct iovec iov = { .iov_base = buf, .iov_len = size };
io_uring_register_buffers(&ring, &iov, 1);
io_uring_prep_read_fixed(sqe, fd, buf, size, offset, 0);
```

### 7. Zero-copy send

```c
sqe = io_uring_get_sqe(&ring);
io_uring_prep_send_zc(sqe, sock_fd, data, len, 0, 0);
// May complete with IORING_CQE_F_MORE — wait for notification CQE
```

Requires kernel 6.0+, NIC/driver support. Falls back to copy mode if unavailable.

### 8. tokio-uring (Rust)

```rust
use tokio_uring::fs::File;

#[tokio_uring::main]
async fn main() -> std::io::Result<()> {
    let file = File::open("test.txt").await?;
    let buf = vec![0u8; 4096];
    let (res, buf) = file.read_at(buf, 0).await;
    println!("read {} bytes", res?);
    Ok(())
}
```

```bash
cargo add tokio-uring
```

### 9. io_uring vs epoll

| Aspect | epoll | io_uring |
|--------|-------|----------|
| Syscalls | epoll_wait + read/write per op | Batch SQEs, single submit |
| Buffer mgmt | App allocates | Provided buffers |
| Zero-copy | sendfile, manual | SEND_ZC built-in |
| Complexity | Lower | Higher |
| Kernel version | 2.6+ | 5.1+ (features vary) |

```
Choose io_uring when
├── Syscall overhead is measurable bottleneck
├── High connection count with multi-shot
└── Kernel 6.x+ with needed op support

Stay on epoll when
├── Simple app, portability matters
└── Team familiarity outweighs gains
```

### 10. Security considerations

```bash
# Restrict unprivileged io_uring (some distros disable by default)
sysctl kernel.io_uring_disabled   # 0=enabled, 1=disabled, 2=allow registered
sysctl kernel.io_uring_group      # gid allowed when disabled=2
```

io_uring has been an attack surface — keep kernels patched; sandbox untrusted code.

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `-EINVAL` on prep | Op not supported on kernel | Check `io_uring_get_probe()` |
| Hang on wait_cqe | Missing submit | Call `io_uring_submit` after SQEs |
| Buffer not returned | Provided buffer not re-added | `buf_ring_add` after consuming |
| SEND_ZC incomplete | Need second CQE | Wait for `IORING_CQE_F_MORE` clear |
| Slower than epoll | Small batch size | Batch more SQEs; use SQPOLL |
| Permission denied | io_uring disabled | sysctl or run with capability |

## Related Skills

- `skills/async-io/dpdk` — kernel bypass alternative for networking
- `skills/async-io/af-xdp` — XDP socket path for packet I/O
- `skills/observability/ebpf` — trace io_uring events
- `skills/rust/rust-async-internals` — async model behind tokio-uring
- `skills/profilers/strace-ltrace` — syscall comparison vs epoll
- `skills/kernel/kernel-internals` — kernel I/O subsystem context