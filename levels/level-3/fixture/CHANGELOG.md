# Changelog

## 0.4.2

- Throughput work for busy queues: less log growth and fewer syncs in the common paths.
- Lower memory use when a process catches up.

## 0.4.1

- `cancel()` and `requeueDead()`.
- Job priorities.
- `metrics()` and the `metrics` command.

## 0.4.0

- Smaller snapshots.
- Worker pools replace dead workers automatically.
- Failpoints for crash testing.

## 0.3.0

- Idempotency keys.
- Automatic compaction past `compactAfterBytes`.

## 0.2.0

- Multi-process access through a shared lock. Workers became child processes.

## 0.1.0

- First version: one process, one log.
