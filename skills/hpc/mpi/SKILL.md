---
name: mpi
description: MPI skill for distributed-memory parallel programming. Use when writing MPI_Send/Recv programs, collective operations, non-blocking communication, MPI+OpenMP hybrid, or debugging with mpirun. Activates on queries about MPI_Init, MPI_Allreduce, MPI_Isend, mpirun, MPI-IO, or MPI performance.
---

# MPI

## Purpose

Guide agents through MPI (Message Passing Interface) programming: point-to-point and collective communication, non-blocking operations, subcommunicators, MPI+OpenMP hybrid patterns, process launching with `mpirun`, debugging techniques, MPI-IO, and common performance issues.

## When to Use

- Parallelizing across multiple nodes or sockets
- Implementing distributed algorithms (matrix decompose, FFT)
- Combining MPI process parallelism with OpenMP thread parallelism
- Running HPC jobs with Slurm/PBS + `mpirun`
- Debugging deadlocks and message mismatches
- Parallel file I/O with MPI-IO

## Workflow

### 1. Minimal MPI program

```c
#include <mpi.h>
#include <stdio.h>

int main(int argc, char **argv) {
    MPI_Init(&argc, &argv);

    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);

    printf("Hello from rank %d of %d\n", rank, size);

    MPI_Finalize();
    return 0;
}
```

```bash
mpicc -o hello hello.c
mpirun -np 4 ./hello
# or
mpiexec -n 4 ./hello
```

### 2. Point-to-point

```c
if (rank == 0) {
    int data = 42;
    MPI_Send(&data, 1, MPI_INT, 1, 0, MPI_COMM_WORLD);
} else if (rank == 1) {
    int recv;
    MPI_Recv(&recv, 1, MPI_INT, 0, 0, MPI_COMM_WORLD, MPI_STATUS_IGNORE);
    printf("rank 1 got %d\n", recv);
}
```

Tagged messages: match tag and source for `MPI_Recv`.

### 3. Collectives

```c
int local = rank + 1;
int global_sum;

MPI_Allreduce(&local, &global_sum, 1, MPI_INT, MPI_SUM, MPI_COMM_WORLD);

// Broadcast
if (rank == 0) data = 100;
MPI_Bcast(&data, 1, MPI_INT, 0, MPI_COMM_WORLD);

// Scatter/Gather
MPI_Scatter(sendbuf, sendcount, MPI_INT, recvbuf, recvcount, MPI_INT, 0, MPI_COMM_WORLD);
MPI_Gather(sendbuf, sendcount, MPI_INT, recvbuf, recvcount, MPI_INT, 0, MPI_COMM_WORLD);
```

| Collective | Purpose |
|------------|---------|
| `MPI_Bcast` | One-to-all |
| `MPI_Scatter` | Distribute chunks |
| `MPI_Gather` | Collect chunks |
| `MPI_Allreduce` | Reduce + broadcast result |
| `MPI_Barrier` | Synchronization |
| `MPI_Alltoall` | All-to-all exchange |

### 4. Non-blocking communication

```c
MPI_Request req;
MPI_Isend(buf, count, MPI_INT, dest, tag, MPI_COMM_WORLD, &req);
// overlap computation here
do_local_work();
MPI_Wait(&req, MPI_STATUS_IGNORE);

// Multiple requests
MPI_Request reqs[2];
MPI_Irecv(buf0, n, MPI_INT, 0, 0, comm, &reqs[0]);
MPI_Irecv(buf1, n, MPI_INT, 1, 0, comm, &reqs[1]);
MPI_Waitall(2, reqs, MPI_STATUSES_IGNORE);
```

Overlap communication with computation to hide latency.

### 5. Subcommunicators

```c
int color = rank / 4;  // groups of 4
MPI_Comm subcomm;
MPI_Comm_split(MPI_COMM_WORLD, color, rank, &subcomm);

int subrank, subsize;
MPI_Comm_rank(subcomm, &subrank);
MPI_Comm_size(subcomm, &subsize);

MPI_Comm_free(&subcomm);
```

### 6. MPI + OpenMP hybrid

```c
#pragma omp parallel
{
    int tid = omp_get_thread_num();
    // thread-local work on rank's data partition
}
MPI_Barrier(MPI_COMM_WORLD);
MPI_Allreduce(...);
```

```bash
export OMP_NUM_THREADS=4
mpirun -np 8 --bind-to core ./hybrid_app
# 8 ranks × 4 threads = 32 cores
```

Bind ranks to sockets with `--map-by ppr:2:socket`.

### 7. Launching with hostfile

```bash
# hostfile:
# node0 slots=4
# node1 slots=4

mpirun -np 8 --hostfile hosts.txt ./app

# Slurm integration
srun -n 64 ./app
# or
mpirun -np $SLURM_NTASKS ./app
```

```bash
# Debug: tag output by rank
mpirun -np 4 --tag-output ./app

# Sequential debug (one rank at a time)
mpirun -np 4 -gdb ./app
```

### 8. MPI-IO

```c
#include <mpi.h>

MPI_File fh;
MPI_File_open(MPI_COMM_WORLD, "output.dat",
    MPI_MODE_CREATE | MPI_MODE_WRONLY, MPI_INFO_NULL, &fh);

MPI_Offset offset = rank * chunk_size;
MPI_File_write_at(fh, offset, buf, count, MPI_DOUBLE, MPI_STATUS_IGNORE);

MPI_File_close(&fh);
```

Collective I/O for better performance:

```c
MPI_File_write_at_all(fh, offset, buf, count, MPI_DOUBLE, MPI_STATUS_IGNORE);
```

### 9. Performance issues

```
Common bottlenecks
├── Load imbalance → dynamic scheduling (OpenMP) or redistribute MPI chunks
├── Serialization at rank 0 → tree-based reduce, parallel I/O
├── Excessive sync → replace Barrier with point-to-point where possible
├── Small messages → aggregate; use MPI_Pack or larger blocks
└── Alltoall on large process counts → consider MPI neighborhood collectives
```

```bash
# MPI profiling
mpiP  # lightweight profiler
# or IPM, TAU MPI wrappers
```

## Common Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Hang at MPI_Recv | Tag/source mismatch | Check Send/Recv pairing; use `MPI_ANY_TAG` debug |
| Deadlock | Circular wait | Reorder comm pattern; use non-blocking |
| Wrong result in Allreduce | Wrong datatype/count | Verify MPI_INT vs MPI_DOUBLE |
| Poor scaling | Rank 0 bottleneck | Distribute I/O and aggregation |
| `MPI_ERR_TRUNCATE` | Receive buffer too small | Match send/recv counts |
| Hybrid oversubscription | Too many threads×ranks | `OMP_NUM_THREADS = cores/ranks` |

## Related Skills

- `skills/hpc/openmp` — thread-level parallelism within MPI ranks
- `skills/hpc/rdma-verbs` — low-latency interconnect under MPI
- `skills/allocators/numa-programming` — bind ranks to NUMA nodes
- `skills/profilers/linux-perf` — profile MPI rank hotspots
- `skills/debuggers/gdb` — debug individual MPI processes
- `skills/compilers/gcc` — MPI compiler wrapper flags