# walq

A small durable job queue for Node, with no runtime dependencies. Jobs live in a write-ahead log on disk, and workers are separate child processes that share that log.

walq is for a single host. There is no server to run: every process that opens the queue directory is a full participant.

```js
import { openQueue, WorkerPool } from './src/index.mjs';

const queue = openQueue('./data/queue');
const { id } = queue.enqueue('send-report', { month: '2026-09' }, { key: 'report-2026-09' });

const pool = new WorkerPool({
  dir: './data/queue',
  handlers: new URL('./handlers.mjs', import.meta.url).pathname,
  size: 4,
  leaseMs: 30_000,
});
pool.start();
await pool.drain();
await pool.stop();

console.log(queue.getJob(id).status); // 'done'
```

A handlers module exports one function per job type:

```js
export default {
  async 'send-report'(payload, ctx) {
    // ctx: { id, attempt, token, workerId, signal }
    return { sent: true };
  },
};
```

An export can also be `{ run, timeoutMs }`. A handler that outlasts its timeout counts as a failed attempt, and `ctx.signal` tells it to stop.

## Features

- **Durable:** an acknowledged call has reached the disk.
- **Leases:** a claimed job belongs to one worker until its lease ends. Workers extend leases with heartbeats while they run.
- **Retries:** failed attempts retry with exponential backoff, then go dead. `requeueDead()` brings a dead job back.
- **Idempotency keys:** enqueuing twice with the same key returns the first job.
- **Priorities and delays:** higher priority runs first, and a delayed job waits for its time.
- **Compaction:** the log rewrites itself as a snapshot when it grows.
- **Failpoints:** named points where a process can be killed or paused, for crash testing.

## Platform

walq takes its cross-process lock with an exclusive-share open, which Windows and macOS provide. Windows is the platform we run in production. Node 24 or later.

## Commands

```
npm test          the test suite (a few seconds)
npm run stress    real workers, real kills, about 90 seconds and a lot of output
```

`src/cli.mjs` has `inspect`, `stats`, `compact`, `tail`, `metrics`, `requeue` and `cancel` for operators.

## Documentation

| Document | What's in it |
|---|---|
| [docs/architecture.md](docs/architecture.md) | How the pieces fit together |
| [docs/api.md](docs/api.md) | The public API |
| [docs/guarantees.md](docs/guarantees.md) | What walq promises, whatever else is going on |
| [docs/wal-format.md](docs/wal-format.md) | The bytes on disk (a compatibility contract) |
| [docs/compaction.md](docs/compaction.md) | How the log is rewritten |
| [docs/leases-and-retries.md](docs/leases-and-retries.md) | Leases, heartbeats, backoff |
| [docs/crash-testing.md](docs/crash-testing.md) | Failpoints and the power-loss model |
| [docs/operations.md](docs/operations.md) | Running walq: metrics, tools, what to do when |
| [docs/rfc-007-exactly-once-completion.md](docs/rfc-007-exactly-once-completion.md) | Accepted design for completion semantics |
