# Compaction

The log only grows, so from time to time it's replaced by a shorter one that says the same thing: a new header with the next generation, and one `snapshot` record.

## When

- `compact()` runs it on request.
- After any write, automatically, when the log has passed `compactAfterBytes`.

A failed automatic compaction doesn't fail the call that triggered it, because that call has already committed. `stats().lastCompactionError` shows the last failure.

## How

Compaction runs under the queue lock, after catching up, so the state it writes is complete.

1. Build the snapshot from the current state, dropping finished jobs past `retainCompletedMs`.
2. Write the header and snapshot to `wal.log.compact`.
3. Rename it over `wal.log`.
4. Sync, and rebuild this process's state from the snapshot.

## What the snapshot holds

The jobs that are kept, and the counters the log needs to carry on. See [guarantees.md](guarantees.md), G10 and G11.

## Other processes

A process that was reading the old log finds a different file next time it catches up, and has to start again from the new one.
