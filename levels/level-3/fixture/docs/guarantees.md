# Guarantees

This is what walq promises to the services built on it. A behaviour that breaks one of these is a bug, whatever the code comments say. "Crash" here means a process being killed at any instant. "Power loss" means the machine stopping, with anything not yet synced to disk gone.

## Durability

**G1. An acknowledged call survives.** Once a call that changes the queue has returned, its effect survives any crash or power loss.

**G2. A queue always reopens after a crash.** No crash or power loss, at any point in any operation, leaves a queue that needs manual repair.

**G3. Unacknowledged work leaves no trace of damage.** A write that was cut off is not a reason to refuse the log, and it must not affect anything written afterwards.

**G4. Damage to acknowledged data is reported, never repaired away.** If bytes that held acknowledged records are damaged, walq raises `CorruptLogError` with the offset, and leaves the file as it found it. It must not drop acknowledged records to keep going.

**G5. Size is not a risk.** Logs and records of any size within the format's limits work the same way.

## Jobs

**G6. One owner at a time.** A job has at most one valid lease at any moment, across all processes on the host. Each attempt has its own token, and a token is never issued twice for a job, for as long as the job exists.

**G7. A live worker keeps its job.** A worker that keeps heartbeating does not lose its job to lease expiry, whichever process runs the reaper.

**G8. Old leases have no power.** A worker holding a token that is no longer current cannot change the job.

**G9. Retries keep their schedule.** A retry's due time is fixed when the failure happens. Restarts and compaction do not move it, and every process sees the same time. Attempt counts carry through too, so backoff keeps growing and `maxAttempts` holds.

**G10. Keys are remembered for their whole time to live.** Within `idempotencyTtlMs`, a repeated key returns the original job and its outcome, even if the job itself has since been pruned, however many compactions and restarts have happened, and whichever processes race on it.

## Compaction

**G11. Compaction changes nothing you can observe,** apart from finished jobs past `retainCompletedMs` going away. All other job fields come through unchanged.

**G12. Compaction can fail safely at any moment.** If it's killed or blocked at any step, the queue keeps working and a later compaction can succeed. Other processes on the host, including operators' tools with the log open, are a normal part of life on Windows hosts and must not cause lasting failure.

**G13. Every process follows.** After any process compacts, every other process continues correctly, with no restart, whatever the sizes of the old and new logs.

**G14. Automatic compaction keeps the log bounded without dominating the work.** Its cost per write stays small even when the live state is larger than `compactAfterBytes`.

## Workers

**G15.** See RFC 007 for what happens when workers die.
