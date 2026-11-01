# Crash testing

A queue that's only tested when nothing goes wrong tells you little. walq has two tools for testing the other case. Both are part of the project, and other teams' test suites depend on them, so keep the names and meanings on this page stable.

## Failpoints

A failpoint is a named place in the code. Arm one with environment variables, and a process dies or stops there:

```
WALQ_FAILPOINTS="wal.mid-append#complete=kill@2,claim.before-lock=pause"
WALQ_FAILPOINT_DIR=C:\some\folder
```

A rule is `name[#type]=action[@nth]`.

- `kill` terminates the process with no cleanup, on the `nth` time the point is reached (default the first). It first writes `<name>.hit` to the marker folder and doesn't fire again while that file exists, so a restarted worker doesn't die at the same place forever.
- `pause` writes `<name>.paused` and blocks until `<name>.release` appears. A `#` in the name becomes `.` in the file names.
- `#type` limits the rule to one record type, for the `wal.*` points.

Within one process, `onFailpoint(name, callback)` runs a callback at the point instead, so that a test can run something else at exactly that moment. `clearFailpoints()` removes all callbacks.

### The points

| Point | When it's reached | Lock held? |
|---|---|---|
| `enqueue.before-lock` | `enqueue()` is about to take the lock to add the job | No |
| `claim.before-lock` | `claim()` is about to take the lock to lease a job | No |
| `reap.before-lock` | `reapExpired()` is about to take the lock to return jobs | No |
| `complete.before-lock` | `complete()` is about to take the lock | No |
| `wal.before-append` | Records are encoded and nothing is written yet | Yes |
| `wal.mid-append` | Half of the bytes have been written | Yes |
| `wal.after-write` | All bytes are written, not yet synced | Yes |
| `wal.after-fsync` | The records are durable, and the call has not returned | Yes |
| `wal.after-create` | A brand new log has just got its final name | Yes |
| `compact.after-tmp-write` | The next log's bytes have been written to its temp file | Yes |
| `compact.before-rename` | The temp file is about to replace the log | Yes |
| `compact.after-rename` | The temp file has replaced the log | Yes |
| `job.before-handler` | A worker holds a lease and has not called the handler | No |
| `job.after-handler` | The handler has returned, and nothing is recorded yet | No |
| `job.after-complete` | `complete()` has returned | No |

## The power-loss model

Killing a process doesn't lose anything the operating system has already accepted, so a kill on its own can't show what happens when the power goes. Set `WALQ_SIMULATE_POWER_LOSS=1` and `fsops.mjs` models the page cache: written bytes stay in the process until that file is synced, and only then reach the disk. Metadata operations (create, rename, truncate) take effect at once, on whatever is on disk at that moment. So a `kill` failpoint under this model behaves like pulling the plug at that instant.

All file access for the log has to go through `fsops.mjs`, or the model can't see it.

The model is for one process at a time: other processes can't see bytes that haven't been synced.

## Stress

`npm run stress` runs real workers through rounds of contention, kills and compaction, and checks the results. It takes about 90 seconds and prints every run and every record, so send it to a file if you only want the summary. Failures are often intermittent. Use `--seed` for a different mix.
