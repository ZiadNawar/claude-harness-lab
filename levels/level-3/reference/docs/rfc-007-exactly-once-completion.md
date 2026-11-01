# RFC 007: Exactly-once completion

**Status:** implemented in 0.5.0.

## Problem

Execution is at-least-once, and that's fine: a job's handler can run more than once. Completion is the part consumers rely on. Today a consumer can't tell a first completion from a repeat, can't look up a result by job id in any stable way, and a worker's death is only noticed when its lease runs out, which can be minutes.

## What we want

**A job commits at most once. A worker killed before the commit leads to the job running again. A commit that has been recorded never leads to the job running again,** whatever happens afterwards, in any process.

The commit point is the moment the `complete` record is durable. There's no state in between.

## API

### complete(id, token, result)

Returns a receipt:

```js
{ id, outcome, token, result, completedAt, completionSeq }
```

- First commit with the current token: `outcome: 'committed'`.
- Repeat with the token that committed, including after a restart or a compaction: `outcome: 'already-committed'`. The receipt carries the stored `result`, `completedAt` and `completionSeq`. The result passed in is ignored, and nothing is written to the log.
- Any other token: `StaleLeaseError`, and nothing changes.
- A job that has been pruned: `UnknownJobError`.

A lease past its deadline can still commit, as long as nobody has acted on it. Its token is still current until a reaper, a reclaim or a cancel says otherwise.

### getResult(id)

- A finished job: `{ id, status: 'done', result, token, attempts, completedAt, completionSeq }`.
- Any other job: `{ id, status }`.
- Not known (never existed, or pruned): `null`.

Results survive restarts and compaction until `retainCompletedMs` has passed.

### completions({ after = 0, limit })

The retained commits in commit order: `[{ seq, id, token, result, completedAt }]`, with `seq > after`. Numbers start at 1, go up by one with each commit, and carry on across restarts and compaction, including when older entries have been pruned. Readers keep their own position.

### reclaimWorker(workerId, { reason })

Gives up every lease held by a worker that's known to be dead, at once, without waiting for expiry. Returns `[{ id, status }]`.

- The job is runnable straight away, with no backoff: `status: 'ready'`. The new record type is `release`, with fields `id, fence, error, at`. `error` is the reason, and it becomes the job's `lastError`.
- The attempt counts. If attempts have run out, the job goes `dead` with a `dead` record.
- Jobs the worker already committed aren't touched and produce no record.
- The old token is stale from this moment.

## Workers and pools

**`WorkerPool` reclaims a dead worker's leases** as soon as it sees the worker exit, and starts a replacement. A job shouldn't have to wait for its lease when the pool already knows its worker is gone. A reclaim must only ever affect the worker that died.

**A worker doesn't give up on a finished job.** Once a handler has returned, its outcome is worth more than anything else the worker could be doing. If recording it fails because the queue is busy or the disk hiccups, the worker keeps trying until the outcome is recorded or it learns it has been fenced. It reports `job-fenced` in that case. It shouldn't start another job in the meantime.

A worker that's been fenced stops there. Its result is discarded.

## Crash table

| The worker dies... | What happens |
|---|---|
| Before the handler runs | Job runs again |
| During the handler | Job runs again |
| After the handler, before `complete` | Job runs again |
| Part way through writing `complete` | Job runs again |
| After the `complete` record is durable, before `complete` returns | Job does not run again |
| After `complete` returns | Job does not run again |

The same table holds if the machine loses power instead, and if a compaction was running.

## Compatibility

No format change except the new record type. Older logs have no `completionSeq` on finished jobs. Those jobs aren't listed by `completions()`, and numbering starts after them.
