# Architecture

```
          enqueue, stats, ...                    claim, heartbeat, complete, ...
your process ───────────┐                    ┌───────── worker process (child.mjs)
                        ▼                    ▼
                     ┌──────────────────────────┐
                     │  Queue (queue.mjs)       │  one instance per process
                     │  Store (store.mjs)       │  replayed state + lock rules
                     │  Wal   (wal.mjs)         │  the file
                     └────────────┬─────────────┘
                                  ▼
                     data/queue/wal.log        the log
                     data/queue/queue.lock     the cross-process lock
```

## Shared log, no server

Every process that opens a queue directory holds its own copy of the state, built by replaying the log. Nobody is in charge. A process that wants to do something:

1. takes the lock (`lock.mjs`);
2. reads whatever other processes appended since last time, and applies it (`Store.catchUp`);
3. decides, appends, and syncs;
4. releases the lock.

Time spent holding the lock is short, because job handlers run outside it.

## Modules

| Module | Responsibility |
|---|---|
| `queue.mjs` | The public API. Turns calls into records |
| `store.mjs` | Lock + catch-up + append. Owns the in-memory state and its log offset |
| `state.mjs` | The reducer: `applyRecord(state, record)` |
| `snapshot.mjs`, `retention.mjs` | What a compacted log keeps |
| `compactor.mjs` | Rewrites the log |
| `wal.mjs`, `frame.mjs`, `crc32.mjs` | The file and its encoding |
| `fsops.mjs` | File operations, real or power-loss model |
| `lock.mjs` | The cross-process mutex |
| `lease.mjs`, `backoff.mjs`, `idempotency.mjs` | Pure rules |
| `failpoints.mjs` | Named crash and pause points |
| `metrics.mjs`, `logger.mjs`, `inspect.mjs`, `cli.mjs` | Operations |
| `worker/pool.mjs` | Starts and replaces worker processes, runs the reaper |
| `worker/child.mjs` | Entry point of a worker process |
| `worker/runner.mjs` | The claim, run, report loop |
| `worker/registry.mjs` | Loads handlers, enforces handler timeouts |
| `worker/protocol.mjs` | Messages between pool and workers |

## Synchronous on purpose

All queue calls are synchronous. A call never interleaves with another call in the same process, which keeps reasoning about one process simple. The hard part is the other processes.

## Who runs the reaper

`WorkerPool` calls `reapExpired()` on a timer, in the parent process. Anyone may call it; it is safe to have several. Pools can share a queue directory, and so can processes that only enqueue.
