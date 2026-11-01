# Log format

The format is a compatibility contract. Logs already on production hosts must stay readable, so changes must be additive.

## File

`wal.log` is a header followed by frames. All integers are little-endian.

### Header (20 bytes)

| Offset | Size | Field |
|---|---|---|
| 0 | 4 | Magic, ASCII `WALQ` |
| 4 | 2 | Format version, currently 1 |
| 6 | 2 | Flags, zero |
| 8 | 4 | Generation |
| 12 | 4 | Reserved, zero |
| 16 | 4 | CRC-32 of bytes 0 to 15 |

A new log starts at generation 1. Each compaction adds one.

### Frame (10 bytes + payload)

| Offset | Size | Field |
|---|---|---|
| 0 | 2 | Magic, bytes `AD FB` |
| 2 | 4 | Payload length |
| 6 | 4 | CRC-32 over the length field and then the payload |
| 10 | n | Payload: one record, as UTF-8 JSON |

The payload limit is 64 MiB. Valid UTF-8 cannot contain the byte `FB`.

## Records

Every record has `t`, its type, and `at`, the writer's clock when it was written (a snapshot's `at` is when it was built).

| `t` | Fields | Effect |
|---|---|---|
| `enqueue` | `id, type, payload, key, priority, maxAttempts, availableAt, at` | A new job, `ready` |
| `claim` | `id, worker, fence, leaseUntil, at` | Job `leased`, attempts + 1, token = `fence` |
| `heartbeat` | `id, fence, leaseUntil, at` | Lease deadline moves |
| `complete` | `id, fence, result, at` | Job `done` |
| `fail` | `id, fence, error, delayMs, at` | Job `ready` again, after a delay |
| `expire` | `id, fence, error, delayMs, at` | Same, because the lease ran out |
| `dead` | `id, fence, error, at` | Job `dead` |
| `cancel` | `id, fence, error, at` | Job `cancelled` |
| `requeue` | `id, at` | Dead job `ready` again, attempts back to 0 |
| `snapshot` | `at, seq, jobs, ...` | Replaces all state. Always the first record of a compacted log |

A reader ignores record types it doesn't know. Older logs may lack newer fields: `priority` counts as 0, and an older snapshot may lack `attempts`, `fence` and `idem`.

Job ids are `j<n>`, where `n` is the count of jobs ever enqueued, and are never reused.
