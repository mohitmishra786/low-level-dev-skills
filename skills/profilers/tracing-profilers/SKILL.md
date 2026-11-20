---
name: tracing-profilers
description: Instrumentation tracing skill for Perfetto and Tracy. Use when adding trace events or zones to C/C++ code, recording a timeline of frames, requests or tasks, querying traces with SQL in Perfetto's trace processor, capturing Tracy profiles headlessly in CI, or choosing between tracing and sampling profilers. Activates on queries about Perfetto, Perfetto SDK, TRACE_EVENT, trace_processor_shell, pftrace, ui.perfetto.dev, Tracy, ZoneScoped, FrameMark, tracy-capture, or timeline tracing.
---

# Tracing Profilers: Perfetto and Tracy

## Purpose

Guide agents through instrumentation-based timeline tracing (checked with Perfetto v59.1 and Tracy 0.15.0): adding events to code, recording traces, analysing them with SQL or CSV, and choosing between tracing and sampling.

## Triggers

- "Why does one frame/request take longer than the others?"
- "How do I add Perfetto trace events to my C++ program?"
- "How do I query a Perfetto trace with SQL?"
- "How do I instrument a game loop with Tracy?"
- "Can I capture a Tracy profile without the GUI?"
- "Should I use a tracing or a sampling profiler?"

## Workflow

### 1. Tracing vs sampling

| Question | Tool |
|----------|------|
| Where does CPU time go on average? | Sampling: `perf`, flame graphs (`skills/profilers/linux-perf`) |
| Why was *this* frame or request slow? Ordering, waits, overlaps | Tracing: Perfetto, Tracy |
| Long-running services, low overhead, many processes | Perfetto (SDK + system tracing, SQL analysis) |
| Games, real-time loops, interactive live view | Tracy (live GUI, frame marks, very low per-zone cost) |

Instrumentation only records what you mark, so start with coarse spans (frame, request, job)
and refine where the timeline shows gaps.

### 2. Perfetto SDK: track events

The SDK ships as two amalgamated files (`perfetto-cpp-sdk-src.zip`: `perfetto.h`, `perfetto.cc`).

```cpp
// app.cc — Perfetto SDK track events: in-process tracing to a file
#include <perfetto.h>

#include <chrono>
#include <fstream>
#include <thread>
#include <vector>

PERFETTO_DEFINE_CATEGORIES(
    perfetto::Category("render").SetDescription("Frame rendering"),
    perfetto::Category("io").SetDescription("File and network I/O"));
PERFETTO_TRACK_EVENT_STATIC_STORAGE();

static void LoadAsset(int id) {
  TRACE_EVENT("io", "LoadAsset", "id", id);                  // slice with an argument
  std::this_thread::sleep_for(std::chrono::milliseconds(2));
}

static void DrawFrame(int frame) {
  TRACE_EVENT("render", "DrawFrame", "frame", frame);        // scoped slice
  if (frame % 10 == 0) LoadAsset(frame / 10);                 // nested slice
  std::this_thread::sleep_for(std::chrono::milliseconds(1));
  TRACE_COUNTER("render", "queue_depth", frame % 4);         // counter track
}

int main() {
  perfetto::TracingInitArgs args;
  args.backends = perfetto::kInProcessBackend;                // no traced daemon needed
  perfetto::Tracing::Initialize(args);
  perfetto::TrackEvent::Register();

  perfetto::TraceConfig cfg;
  cfg.add_buffers()->set_size_kb(4096);
  cfg.add_data_sources()->mutable_config()->set_name("track_event");

  auto session = perfetto::Tracing::NewTrace();
  session->Setup(cfg);
  session->StartBlocking();

  for (int f = 0; f < 50; f++) DrawFrame(f);

  perfetto::TrackEvent::Flush();
  session->StopBlocking();
  std::vector<char> trace = session->ReadTraceBlocking();
  std::ofstream("app.pftrace", std::ios::binary).write(trace.data(), trace.size());
  return 0;
}
```

```bash
# perfetto.cc is large (about 40 s at -O2); in a real build, compile it once as a static library
g++ -std=c++17 -O2 -I sdk -o app app.cc sdk/perfetto.cc -lpthread
./app            # writes app.pftrace; open it at https://ui.perfetto.dev
```

`kSystemBackend` instead of `kInProcessBackend` sends events to the `traced` daemon, so they
appear in system-wide traces next to kernel scheduling data.

### 3. Perfetto trace processor: SQL over traces

```sql
-- q.sql: slice statistics
SELECT name, COUNT(*) AS n, ROUND(AVG(dur) / 1e6, 2) AS avg_ms, MAX(depth) AS max_depth
FROM slice GROUP BY name ORDER BY n DESC;
```

```bash
trace_processor_shell -q q.sql app.pftrace
# "name","n","avg_ms","max_depth"
# "DrawFrame",50,2.720000,0
# "LoadAsset",5,3.380000,1
```

```sql
-- counters
SELECT t.name AS counter, COUNT(*) AS samples, MAX(c.value) AS max_value
FROM counter c JOIN counter_track t ON c.track_id = t.id GROUP BY t.name;
```

| Table | Contents |
|-------|----------|
| `slice` | Every span: `ts`, `dur` (ns), `name`, `depth`, `track_id`, `arg_set_id` |
| `counter` / `counter_track` | Counter samples and their tracks |
| `thread`, `process`, `thread_track` | Who emitted what |
| `args` | Arguments attached to slices (`EXTRACT_ARG(arg_set_id, 'debug.frame')`) |

```bash
# Convert for chrome://tracing or other tools
traceconv json app.pftrace app.json

# Interactive SQL shell
trace_processor_shell app.pftrace
```

Running queries in CI turns traces into regression checks (for example, fail if the p99 of
`DrawFrame` grows).

### 4. Tracy: instrumentation

```cpp
// game.cpp — Tracy instrumentation: zones, frame marks, plots, messages
#include <tracy/Tracy.hpp>

#include <chrono>
#include <thread>

static void Physics() {
    ZoneScoped;                                    // zone named after the function
    std::this_thread::sleep_for(std::chrono::milliseconds(2));
}

static void Render(int frame) {
    ZoneScopedN("Render");                         // explicitly named zone
    ZoneValue(frame);                              // attach a number to this zone
    std::this_thread::sleep_for(std::chrono::milliseconds(3));
}

int main() {
    for (int frame = 0; frame < 100; frame++) {
        Physics();
        Render(frame);
        TracyPlot("frame_mod_7", (int64_t)(frame % 7));   // plot track
        if (frame % 50 == 0) TracyMessageL("checkpoint"); // log message
        FrameMark;                                 // end of frame
    }
    return 0;
}
```

```bash
# Profiling build: define TRACY_ENABLE and compile the client once
g++ -std=c++17 -O2 -DTRACY_ENABLE -I tracy/public -o game game.cpp tracy/public/TracyClient.cpp -lpthread -ldl

# Release build: without TRACY_ENABLE every macro compiles to nothing (no Tracy symbols at all)
g++ -std=c++17 -O2 -I tracy/public -o game game.cpp
```

Client and viewer/capture versions must match; use the same Tracy release for both.

### 5. Tracy: capture without the GUI

```bash
# Build the command-line tools from the Tracy source tree
cmake -S capture -B build-capture -DCMAKE_BUILD_TYPE=Release && cmake --build build-capture
cmake -S csvexport -B build-csv -DCMAKE_BUILD_TYPE=Release && cmake --build build-csv

# Start the capture, then the program; TRACY_NO_EXIT keeps a short program alive until data is sent
./build-capture/tracy-capture -o game.tracy -f -s 10 &
TRACY_NO_EXIT=1 ./game
wait                                   # "Zones: 200 ... Saving trace... done!"

./build-csv/tracy-csvexport game.tracy
# name,src_file,src_line,total_ns,total_perc,counts,mean_ns,min_ns,max_ns,std_ns
# Physics,game.cpp,8,368305213,40.1,100,3683052,...
# Render,game.cpp,13,527249965,57.4,100,5272499,...
```

Open `.tracy` files, or connect live, with the `tracy-profiler` GUI (`cmake -S profiler`).

### 6. Common problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| Perfetto trace is empty | Session stopped before events were flushed | `TrackEvent::Flush()` before `StopBlocking()` |
| Events from a category missing | Category not in `PERFETTO_DEFINE_CATEGORIES`, or not enabled in the config | Define it; set `track_event_config` enabled categories |
| `trace_processor_shell: Permission denied` | Release zip lost the executable bit | `chmod +x` the tools |
| Tracy capture records nothing | Program exited before the capture connected | `TRACY_NO_EXIT=1`, or start `tracy-capture` first |
| Tracy viewer refuses the connection | Client and viewer from different Tracy versions | Rebuild both from one release |
| Overhead too high | Zones in tight inner loops | Instrument per item batch, not per element |

## Related skills

- Use `skills/profilers/linux-perf` for sampling profiles and hardware counters
- Use `skills/profilers/flamegraphs` for aggregated CPU time views
- Use `skills/debuggers/concurrency-debugging` when the timeline shows lock contention
- Use `skills/gpu/cuda-profiling` for GPU timelines with Nsight Systems
