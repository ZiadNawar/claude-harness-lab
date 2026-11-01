# API

Everything is exported from `src/index.mjs`. The names and shapes on this page are a contract with the services that use walq.

## openQueue(dir, options)

| Option | Default | Meaning |
|---|---|---|
| `leaseMs` | 30 000 | Default lease length |
| `lockTimeoutMs` | 10 000 | How long a call waits for the lock before `LockTimeoutError` |
| `compactAfterBytes` | 4 MiB | Compact automatically past this size. `0` turns it off |
| `retainCompletedMs` | 24 h | How long finished jobs stay in the log after they finish |
| `idempotencyTtlMs` | 7 d | How long a key is remembered, from when the job was enqueued |
| `maxAttempts` | 5 | Default attempts per job |
| `backoff` | `{ baseMs: 1000, factor: 2, maxMs: 60000, jitter: 0 }` | Retry schedule |
| `clock` | system clock | Anything with `now()`. Tests use `ManualClock` |

## Queue

**`enqueue(type, payload, { key, delayMs, maxAttempts, priority })`** returns `{ id, status, deduped }`. With a remembered `key` it also returns the existing job's `result` and `deduped: true`, and creates nothing.

**`enqueueMany([{ type, payload, options }])`** adds a batch under one lock and one sync. A crash can leave a prefix of the batch behind.

**`claim(worker, { leaseMs, types })`** returns `{ id, type, payload, attempt, token, leaseUntil }` or `null`. Among due jobs, higher `priority` goes first, then the job due longest, then the oldest. `token` identifies this attempt.

**`heartbeat(id, token, { leaseMs })`** returns `{ leaseUntil }`. Throws `StaleLeaseError` if the lease is no longer yours.

**`complete(id, token, result)`** records the result. Throws `StaleLeaseError` if the lease is no longer yours. RFC 007 changes what this returns.

**`fail(id, token, error)`** returns `{ id, status, retryAt }`. The job goes back to `ready` with a backoff, or to `dead` when attempts run out.

**`reapExpired()`** returns jobs whose lease had run out to the queue, and returns `[{ id, status, retryAt }]`.

**`cancel(id, { reason })`** stops a job that is `ready` or `leased`. Returns `{ id, status, changed }`. A worker holding the job loses its lease.

**`requeueDead(id)`** gives a dead job a new set of attempts, runnable now. Returns `{ id, status }`. Throws `InvalidTransitionError` if the job is not dead.

**`getJob(id)`** returns a copy of the job or `null`. **`listJobs()`** returns copies of all jobs in the log. **`stats()`** returns counts by status, plus `total`, `generation`, `logBytes`, `tornTailsDropped` and `lastCompactionError`. **`metrics()`** is described in [operations.md](operations.md).

**`compact()`** rewrites the log now and returns `{ generation, bytesBefore, bytesAfter, jobs }`. If it throws, the queue is still usable and nothing is lost.

**`close()`** marks this instance closed.

## Job fields

`id`, `type`, `payload`, `key`, `priority`, `status` (`ready`, `leased`, `done`, `dead`, `cancelled`), `attempts`, `fence` (the current token), `maxAttempts`, `availableAt`, `lease` (`{ worker, fence, until }` or null), `result`, `lastError`, `enqueuedAt`, `completedAt`, `seq`.

## WorkerPool

```js
new WorkerPool({ dir, handlers, size, leaseMs, heartbeatMs, pollMs, reapMs, types, env, queue, maxRespawns })
```

`handlers` is the path of a handlers module. `queue` is the options object for `openQueue` in the workers and the pool, so it must be JSON-serialisable. `env` adds environment variables for the workers. `types` limits which job types the pool's workers take.

- `start()` starts the workers.
- `drain({ timeoutMs })` resolves when no job is `ready` or `leased`, and rejects when that takes too long.
- `stop()` stops the workers and waits for them to go.

The pool is an `EventEmitter`. `message` carries worker events (`kind` is one of `ready`, `job-started`, `job-completed`, `job-failed`, `job-fenced`, `worker-error`), `exit` fires when a worker exits, and `stderr` and `error-event` report problems.

## Errors

`WalqError` is the base class. `CorruptLogError` has an `offset`. Also `StaleLeaseError`, `UnknownJobError`, `LockTimeoutError`, `InvalidTransitionError`, `ConfigError`, `QueueClosedError`.

## Other exports

`computeBackoff(attempts, policy, salt)`, `ManualClock`, `SystemClock`, `JobRunner`, `inspectLog(dir)`, `describeRecord(record)`, `onFailpoint`, `clearFailpoints`, `hit`.
