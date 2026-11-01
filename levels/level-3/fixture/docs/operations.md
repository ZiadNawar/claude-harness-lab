# Operations

## Files

A queue directory holds `wal.log` and `queue.lock`. Temp files named `wal.log.*` can appear during compaction. Don't edit any of these by hand while the queue is in use.

## Logging

Silent by default. Set `WALQ_LOG=info` (or `debug`, `warn`, `error`) for JSON lines on stderr.

## metrics()

| Field | Meaning |
|---|---|
| `byType` | Job counts by type and status |
| `dueNow` | Ready jobs whose time has come |
| `delayed` | Ready jobs waiting for their time |
| `retriedJobs` | Jobs on their second attempt or later |
| `oldestReadyAgeMs` | How long the longest-waiting due job has waited |
| `nextLeaseExpiryMs` | Time until the next lease deadline, or null |
| `activeWorkers` | Distinct workers holding leases |
| `idempotencyKeys` | Keys currently remembered |
| `jobsEverEnqueued` | Total since the queue was created |
| `generation`, `logBytes` | The log |
| `tornTailsDropped` | Incomplete tails this process has dealt with |
| `lastCompactionError` | Why the last automatic compaction failed, or null |

## Tools

```
node src/cli.mjs inspect <dir>        every record in the log
node src/cli.mjs stats <dir>          job counts
node src/cli.mjs metrics <dir>        the table above
node src/cli.mjs compact <dir>        compact now
node src/cli.mjs tail <dir>           follow the log as it grows
node src/cli.mjs requeue <dir> <id>   give a dead job new attempts
node src/cli.mjs cancel <dir> <id>    stop a job
```

`inspect` takes no lock and changes nothing, so it's safe at any time. `tail` keeps the log open for as long as it runs.

## Sizing

Each write takes the lock and syncs, so throughput follows the disk's sync latency. The lock is shared by all processes on a queue, so a handful of workers per queue is the expected size. Run more queues rather than more workers.

## Upgrades

The log format is stable. Stop the workers, deploy, and start them again. Older logs open without any conversion.
