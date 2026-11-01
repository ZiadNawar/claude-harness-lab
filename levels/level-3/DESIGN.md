# Level 3 design notes

For the experimenter only. Nothing here goes into a workspace.

Run `node check.mjs` from this folder to re-prove everything below. It takes about 25 minutes.

## The task

`fixture/` is **walq**, a small durable job queue in plain Node: a write-ahead log on disk, workers as separate child processes that share the log through a cross-process lock, leases with fencing tokens, retries with backoff, idempotency keys, compaction, priorities, cancel, dead-letter requeue, metrics and a CLI. It has no dependencies and no real company or client details.

The ticket (`prompt.txt`) is a maintainer's write-up after a power cut. It asks for two things: fix the root causes behind a list of symptoms, plus anything else that breaks `docs/guarantees.md`, and implement RFC 007, exactly-once completion.

Level 2's first version was far too easy (75/75 in 2.6 minutes for $0.48). So this level is built differently on purpose:

- **Defects interact.** Fixing one in the obvious way can turn another from harmless into data loss.
- **The project costs something to read:** 31 source files (29 in `src/`, 2 in `scripts/`), 11 test files and about 2,800 lines of code, plus 11 Markdown documents, with modules that hold no defects. That's a little over the brief's 15-25 files, because small modules cost an agent more reads.
- **Reading isn't enough for some defects.** They only show up under a kill, a power-loss simulation or a second process.
- **The docs state promises, not fixes.** `guarantees.md` says what must hold. `compaction.md` describes the broken order as if it were normal. Comments in the broken code give plausible reasons for it, and the changelog only says "throughput work".

## Defects

There are 23. All are present in the fixture at once. Each is exercised on its own by check step 5, which undoes that single fix in the reference. The exact text of each is in `mutants/defects.mjs`.

| ID | File | Root cause | Hidden tests named as catchers | The tempting shallow fix |
|---|---|---|---|---|
| D1 | `frame.mjs` | Any bad frame except a short one is fatal, so a bad checksum at the tail stops the queue from opening | flipping any byte of the last record; zero bytes; random garbage | Treat every bad frame as end of log (loses D4 damage detection) |
| D2 | `store.mjs` | A torn tail is skipped in memory and left on disk. The next append lands behind it | a record appended after a torn tail; a torn tail is removed | Stop scanning at garbage on reopen, which drops every later committed record |
| D3 | `compactor.mjs` | Renames the new log into place before syncing it | power loss right after the compaction rename | None without the power-loss model. A real kill passes |
| D4 | `compactor.mjs` | Temp file opened exclusively and not removed on failure, so one crash or `EPERM` blocks compaction for good | a temp file left by a killed compaction; a compaction blocked for too long | Swallow the error, so the log grows forever |
| D5 | `compactor.mjs` | One rename attempt, so a Windows sharing violation fails the compaction | compaction waits out a reader | Catch and ignore. The compaction silently doesn't happen |
| D6 | `queue.mjs` | `claim` picks its job before taking the lock (lost update) | two claims racing; four processes claiming | Sleep, then check who owns the job. Narrows the race |
| D7 | `queue.mjs` | Heartbeats only update memory in the worker process | a heartbeat from another process; a heartbeat is visible after a reopen | Reap less often, or a longer lease |
| D8 | `queue.mjs` | The reaper decides what expired before taking the lock. Can re-queue a job that has since committed | a heartbeat while the reaper waits; a completion while the reaper waits | None, it's only visible with two processes |
| D9 | `queue.mjs` | The lease check looks at status, not the token | a zombie cannot complete; a zombie cannot fail or heartbeat | None |
| D10 | `snapshot.mjs` | Keys are rebuilt from retained jobs, so a pruned job loses its key, and a reused key can bind to the older job | a key outlives its pruned job; a key still returns the result | Keep jobs longer, which only moves the failure |
| D11 | `state.mjs` | Replay computes the due time from the current clock rather than the record | a retry keeps its due time; a retry due during downtime | None |
| D12 | `snapshot.mjs` | The snapshot drops `attempts` and `fence`. Backoff restarts, limits stop working, tokens repeat | attempt counts survive; max attempts; tokens never repeat | Raise limits |
| D13 | `store.mjs` | A compaction by another process is detected by the log shrinking, not by its generation | another process follows when the new log has outgrown its old offset | Reopen on any error, which masks it until the log is misread |
| D14 | `queue.mjs` | `complete` doesn't sync | power loss right after complete returns | None |
| D15 | `queue.mjs` | `enqueue` checks the key before taking the lock | two enqueues racing; four processes enqueuing | Sleep |
| D16 | `wal.mjs` | A new log is renamed before it is synced | a queue created just before power loss | None |
| D17 | `store.mjs` | Automatic compaction ignores snapshot size, so it rewrites the log on every write once the state outgrows the threshold | automatic compaction does not run on every write | Raise the threshold |
| D18 | `runner.mjs` | One attempt to record a finished job's outcome. A busy lock loses it | a worker keeps trying to commit | Longer lock timeout |
| D19 | `wal.mjs` | Catch-up reads a bounded chunk, so the end of the chunk looks like a torn record | a log larger than any read buffer; a single record larger than any read buffer | None |
| D20 | `state.mjs` | Requeuing a dead job resets its fencing token | tokens never repeat after a requeue | None |
| D21 | `pool.mjs` | Worker ids are only unique within one pool | a worker dying in one pool does not disturb another | None |
| D22 | `retention.mjs` | Cancelled jobs are never pruned | a cancelled job is pruned | None |
| D23 | `snapshot.mjs` | The snapshot drops `priority` | priorities survive compaction | None |

### Where they interact

- **D19 is masked by D2.** In the fixture a chunk ending mid-record is harmless, because nothing truncates, and the next catch-up carries on. Fix D2 by truncating at the tail and leave D19, and opening a log over 1 MiB destroys committed records. This is the trap in the ticket's "big log" symptom. Observed on a 3.6 MB log of 40 jobs: the fixture keeps the file and shows 22, then 33, then 40 jobs over three calls. Reference with only D19 put back cuts the file to 0.99 MB and keeps 11 jobs for good.
- **D13 is masked by D1.** Today a misread after compaction shows up as a fatal `CorruptLogError`, and the file is unharmed. Fix D1 and D2 and leave D13, and the misreading process takes committed records for a torn tail and cuts them off. Observed: the log went from 1,450 to 775 bytes, that process still reported 5 jobs, and a reopen found 0.
- **D1 and D2 pull against G4.** The easy fix for both, "treat anything bad as the end and cut it", destroys acknowledged records after mid-log damage. A correct fix has to tell a tail from damage.
- **D7 masks D8.** With heartbeats in memory the reaper is wrong anyway. D8 only becomes visible once D7 is fixed.
- **D4 chains from D5.** A failed rename (D5) leaves the temp file, which then blocks every later compaction (D4). That's the ticket's EEXIST symptom. Observed on the fixture: the first compaction gets `EPERM` while a reader holds the log, and the next gets `EEXIST` after the reader has gone.
- **D10 and D12 are masked by retention and short tests.** Compaction looks fine until a job has been pruned or has already retried.
- **D21 is harmless until the feature exists.** Ids collide today with no effect. Implement `reclaimWorker` as the RFC asks, and one pool's dead worker releases a live job in another pool.
- **The commit receipt** can be lost if it's built after a compaction that prunes the job. This is a trap in the feature rather than a fixture defect, and one test covers it.

### The feature

RFC 007 (`fixture/docs/rfc-007-exactly-once-completion.md`) crosses the log, the reducer, compaction, the queue API, the worker and the pool:

- `complete` returns a receipt and is idempotent for the committing token.
- `getResult` and `completions`, with numbering that survives compaction.
- `reclaimWorker`, with a new `release` record.
- `WorkerPool` reclaims on worker exit.
- Workers don't abandon finished jobs.

## The tempting wrong fix

`shallow/` is three small changes: treat any undecodable frame as end of log, reap at 8x the lease, and sleep and check ownership after a claim. `npm test` goes green, reliably: 3/3 in check step 3, and 8/8 when I measured it by hand. The hidden score is in the results below.

## Grading

- **Score:** hidden tests passed / **106**. Use this fixed total. A solution that breaks a test file's imports loses that file's tests, and the reported total shrinks (`hidden/index.js` replaces them with one failing `suite <name> loads` test).
- **Also record** the visible suite state (`npm test`) as a separate number. 42 tests.
- **Start score:** the untouched fixture scores 22 or 23 of 106 (about 21%). It was 22 in one full check and 23 in the next, because the fixture still has the claim race, so "four processes claiming from one queue never share a job" passes on some runs and fails on others. Treat any baseline here as 23 at most.
- **Shallow score:** 25/106 (23.6%), with the visible suite fully green.
- **All 23 defects fixed, no RFC 007:** 78/106 (73.6%), measured by building the tree that way. So the feature is worth 28 tests, about a quarter of the score.
- **Run:** copy all of `hidden/` to `test-hidden/` in the workspace, then run `node --test test-hidden/`.

### Node 24 and the test command

On Node 24.7, `node --test some-folder/` treats the folder as a module to run, and fails on a plain folder. `hidden/index.js` and `hidden/package.json` make that exact command work, and both must be copied. All suites then load into one process.

`node --test "test-hidden/*.mjs"` also works and gives each suite its own process, so a hang costs only that suite. The test names are the same.

### Time limit

The hidden suite takes about 32 seconds on the reference and about 137 seconds on the fixture, because waits for workers that never finish time out. Enforce your own 5-minute limit from outside, with a tree kill (`taskkill /T /F`). A synchronous infinite loop in a solution can't be interrupted from inside node:test. Tests that never reported count as failed, which the fixed total handles.

### Partial credit

Partial credit means something, but tests aren't evenly spread across defects. On its own, a defect fails anywhere from 1 test (D3, D5, D14, D15 and D16 to D23) to 12 (D12), so fixing a 1-test defect moves the score little however hard it was to find. D3, D14 and D16 are the hardest to see and are worth one test each. Two agents with equal scores may have fixed different things, so read per-test results alongside the score. About a fifth of the suite passes on the untouched fixture, as regression guards.

Rough bands: 22-23 is doing nothing, 25 is the shallow fix, 78 is every defect with no feature, and 106 is everything.

## Windows-specific considerations

All measured on this machine (Windows 11, Node 24.7) before building on them:

- **The lock** is an open with libuv's exclusive-share flag (`0x10000000`). A second open gets `EBUSY`, and the OS frees the lock when the holder dies, including on `TerminateProcess`. So there's no stale-lock logic, and no defect planted in it.
- **Rename over an open file** fails with `EPERM`, even with a plain read handle held by another process. D5 and its tests use this real behaviour, with no mock.
- **Directory fsync** fails with `EPERM`. `syncDir` tolerates it, so the directory part of the ordering can't be tested here. The file-sync ordering can.
- **Self-kill:** `process.kill(process.pid, 'SIGKILL')` works and shows up as exit code 1 with no signal.
- **A kill doesn't lose page-cache data,** so real kills can't test fsync ordering. See below.
- **`WALQ_FAILPOINTS` kills are real process deaths.** Only the power-loss mode is simulated.

### Power loss is simulated, not real

D3, D14 and D16 can't be observed with a real kill on Windows. Rather than fake a test or drop them, the fixture includes a documented model (`WALQ_SIMULATE_POWER_LOSS=1`, in `fsops.mjs`): written bytes stay in the process until that file is synced, and metadata operations apply at once. A kill failpoint under this model acts like pulling the plug.

This grades *ordering against the model*. It doesn't prove behaviour on real hardware. A solution that does its file I/O outside `fsops.mjs` would escape the model, so it could look better here than it is. The docs tell agents to keep all I/O going through it.

### Codex and `spawn EPERM`

Under Codex's unelevated Windows sandbox, `node --test` was seen failing with `spawn EPERM` when starting a child process. **This task depends on child processes:** `npm test` (workers, crash tests), `npm run stress`, and any crash test an agent writes. As the coordinator asked, I did not design around it. If that harness can't start children, its agent can't run the visible suite or the stress script, and it would be working blind, so a low Codex score here might say more about the sandbox than the agent. Record whether `spawn EPERM` appears in the transcript. Grading itself runs outside the agent's sandbox, so the score is still valid as a measure of the final code.

## Determinism

- Races are tested by forcing the interleaving with an in-process failpoint callback, so these tests have no wall-clock dependence. Real multi-process contention tests (four processes, fixed seeds) check invariants that always hold on a correct solution. On a broken one they catch the race only some of the time: the claim test failed 4 of 6 runs on the fixture when measured, and with D15 alone the enqueue test didn't fail in the check run. That's why they're never the only catcher relied on: D6 and D15 each have a forced-interleaving test too. It also means **a score can differ by a test or two between runs on a solution that still has one of these races.** On a correct solution the verdict doesn't vary.
- Time uses `ManualClock` wherever one process is enough.
- Wall-clock dependence remains in a few pool tests: "a long job with a live worker" allows a stall of over a second, with a 1.5 s lease, a 100 ms heartbeat and a 3.2 s job. An extreme stall on a loaded machine could fail it on a correct solution. That's the known flakiness risk. An intermittent failure in an earlier version turned out to be a test-cleanup bug (hook order), which is fixed.
- Cleanup: every child is tracked, cleanup runs last-in-first-out and can't fail a test, children exit when their IPC channel closes, and pause failpoints give up after 60 s. Check step 9 looks for leftover processes.

## Results

Final `node check.mjs` output, verbatim:

```
PASS  1. untouched fixture fails most hidden tests (137.3s)
      23 of 106 pass, 83 fail, in 137.3s
PASS  2. fixture + reference passes every visible and hidden test (37.7s)
      visible 42/42, hidden 106/106, hidden suite took 32.3s
PASS  3. fixture + shallow turns the visible suite green but still fails hidden tests (214.9s)
      visible: 42/42, 42/42, 42/42; hidden 25/106
PASS  4. fixture + reference gives identical hidden results across 5 repeats (158.4s)
      106/106, 106/106, 106/106, 106/106, 106/106; slowest 31.8s
PASS  5. each of the 23 defects is graded: reference minus that one fix fails a named test (755.3s)
      caught D1 Bad checksum at the log tail is treated as fatal: 5 of 106 fail, 3/3 named catchers fail, 30s
      caught D2 A torn tail is skipped but left on disk, so the next append lands behind garbage: 7 of 106 fail, 2/2 named catchers fail, 42s
      caught D3 Compaction renames the new log into place before syncing it: 1 of 106 fail, 1/1 named catchers fail, 32s
      caught D4 A temp file left by a crashed or failed compaction blocks every later compaction: 3 of 106 fail, 2/2 named catchers fail, 32s
      caught D5 The compaction rename gives up on the first Windows sharing violation: 1 of 106 fail, 1/1 named catchers fail, 27s
      caught D6 Claim picks its job before taking the lock (lost update between two workers): 5 of 106 fail, 2/2 named catchers fail, 32s
      caught D7 Heartbeats only extend the lease in the worker process, so other processes see it expire: 5 of 106 fail, 2/2 named catchers fail, 38s
      caught D8 The reaper decides what expired before taking the lock: 3 of 106 fail, 2/2 named catchers fail, 32s
      caught D9 Lease checks look at the job status but not the token, so a zombie can act on a newer lease: 6 of 106 fail, 2/2 named catchers fail, 32s
      caught D10 The snapshot rebuilds idempotency keys from retained jobs, losing keys of pruned jobs: 6 of 106 fail, 2/2 named catchers fail, 32s
      caught D11 Replay computes a retry time from the current clock, not from when the failure happened: 6 of 106 fail, 2/2 named catchers fail, 32s
      caught D12 The snapshot forgets attempts and the fencing token: 12 of 106 fail, 3/3 named catchers fail, 32s
      caught D13 Other processes detect a compaction by the log shrinking, not by its generation: 2 of 106 fail, 1/1 named catchers fail, 32s
      caught D14 A completion is acknowledged before it is synced: 1 of 106 fail, 1/1 named catchers fail, 31s
      caught D15 Enqueue checks the idempotency key before taking the lock: 1 of 106 fail, 1/2 named catchers fail, 32s
      caught D16 A brand new log is renamed into place before it is synced: 1 of 106 fail, 1/1 named catchers fail, 32s
      caught D17 Auto-compaction ignores the size of the snapshot and rewrites the log on every write: 1 of 106 fail, 1/1 named catchers fail, 33s
      caught D18 A worker abandons the outcome of a finished job on a transient error: 1 of 106 fail, 1/1 named catchers fail, 39s
      caught D19 Catch-up reads a bounded chunk, so the end of the chunk looks like a torn record: 3 of 106 fail, 2/2 named catchers fail, 32s
      caught D20 Requeuing a dead job restarts its fencing token: 1 of 106 fail, 1/1 named catchers fail, 32s
      caught D21 Worker ids are only unique within one pool, so one pool can release the leases of another: 1 of 106 fail, 1/1 named catchers fail, 34s
      caught D22 Cancelled jobs never leave the log: 1 of 106 fail, 1/1 named catchers fail, 32s
      caught D23 The snapshot forgets job priorities: 1 of 106 fail, 1/1 named catchers fail, 32s
PASS  6. fixture + alternative, a differently built solution, passes everything (70.3s)
      visible 42/42, hidden 106/106 and 106/106
PASS  7. npm run stress: reference is clean, in 60-120 seconds, with plenty of output (93.9s)
      exit 0, 94s, 11457 lines, 683 KiB
PASS  8. nothing given to the agent gives the game away (0.0s)
      fixture and prompt are clean
PASS  9. no child process was left behind (0.7s)

Hidden total: 106. Start score: 23/106. Shallow score: 25/106.
All checks passed.
```

Also measured by hand: the shallow fix kept the visible suite green in 8 of 8 runs, and with all 23 defects fixed and no RFC 007 the hidden score is 78/106 (measured before the last small edit to the hidden helpers, which only adds a time limit to scripted children).

File and line counts for `fixture/`: 29 files and 1,832 lines in `src/`, 2 files and 332 lines in `scripts/`, 11 files and 633 lines in `test/`, for 2,797 lines of code. There are 11 Markdown files, 555 lines. `hidden/` is 13 files and 2,211 lines. `alternative/` is 11 files and 1,072 lines.

## What was not validated

- **Nobody has run a real agent on this.** Its real difficulty is unknown. I built it to be much harder than Level 2 and I expect a strong model to score somewhere well above the start score, but that's a guess, and Level 2 shows how wrong such guesses can be. Pilot it once before spending on a full run.
- **Fairness is untested.** The docs were written not to give the answers away. The opposite risk is that a test is unfair to a correct solution I didn't think of. `alternative/` reduces that risk: it passes everything with a different design (see below). It's still written by the same author who wrote the tests.
- **Only tested on this one Windows machine,** with a fast disk (fsync about 2 ms). On a much slower disk, the time-boxed stress run does fewer rounds, and lock waits are longer. The lock is Windows and macOS only, and macOS has not been run.
- **Real power loss isn't tested,** only the model.
- **A hang inside a synchronous call** can't be contained from inside the suite (see the time limit).
- **The repeat check shows 5 clean runs,** which is evidence of low flakiness, not proof of none.
- **Stress on the fixture is intermittent by design.** It isn't asserted as failing in `check.mjs`.

## alternative/

A second correct solution, overlaid on the fixture, to show that the hidden tests grade behaviour. It differs from the reference where the design has a real choice:

| | Reference | Alternative |
|---|---|---|
| Fencing tokens | Per job, in the snapshot | One queue-wide counter |
| Queue operations | Each method locks and decides | Transactions: a plan returns `{ records, reply }` |
| Results | On the job | A separate `outcomes` table, joined when read |
| Idempotency outcome | Copied when a job is pruned | Written to the key's entry at commit |
| Bad-frame classification | Forward scan for a later valid frame | Backward search from the end |
| Reading the log | Reads to end of file at once | Chunked loop to end of file |
| Temp files | One fixed name, overwritten | Named by generation, swept by listing the folder |
| Auto-compaction rule | Offset vs twice the snapshot size | Growth since the snapshot vs its size |
| Worker ids | Pool tag + counter | Random UUID |
| Pool reclaim | One attempt on exit | A list of owed reclaims, retried on a timer |
| Outcome retry | Heartbeat stops, then retry | Heartbeat continues during retries |

## Layout

| Path | What |
|---|---|
| `fixture/` | The starting project |
| `prompt.txt` | The ticket |
| `hidden/` | Grader tests, including `index.js` and `package.json`, which must be copied too |
| `reference/` | Corrected source and docs (overlay) |
| `shallow/` | The tempting wrong fix (overlay) |
| `alternative/` | A second correct solution (overlay) |
| `mutants/defects.mjs` | Each defect as exact-text hunks against the reference |
| `mutants/json-reporter.mjs` | The test reporter check.mjs uses |
| `check.mjs` | Proves all of the above |
