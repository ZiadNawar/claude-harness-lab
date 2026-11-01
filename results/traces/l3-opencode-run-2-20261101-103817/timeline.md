# Timeline: l3-opencode-run-2-20261101-103817

Every step in order. Long outputs are clipped here; `steps.jsonl` holds them in full.

## 1. Reasoning

I'm going to begin by looking through the codebase to get oriented.



## 2. Said

I'll start by exploring the repo.

## 3. shell (exit 0)

```text
git log --oneline | head; git status --short; Get-ChildItem -Recurse -File -Exclude node_modules | ? { $_.FullName -notmatch 'node_modules|\.git\\' } | % { "$($_.Length)`t$($_.FullName.Substring(34))" }
```

```text
head : The term 'head' is not recognized as the name of a cmdlet, function, script file, or operable program. Check 
the spelling of the name, or if a path was included, verify that the path is correct and try again.
At line:1 char:21
+ git log --oneline | head; git status --short; Get-ChildItem -Recurse  ...
+                     ~~~~
    + CategoryInfo          : ObjectNotFound: (head:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException
 
4301	\docs\api.md
2799	\docs\architecture.md
1106	\docs\compaction.md
3469	\docs\crash-testing.md
3019	\docs\guarantees.md
1287	\docs\leases-and-retries.md
1946	\docs\operations.md
4080	\docs\rfc-007-exactly-once-completion.md
2039	\docs\wal-format.md
953	\scripts\stress-handlers.mjs
10664	\scripts\stress.mjs
1031	\src\worker\child.mjs
3545	\src\worker\pool.mjs
633	\src\worker\protocol.mjs
1601	\src\worker\registry.mjs
3133	\src\worker\runner.mjs
839	\src\backoff.mjs
2783	\src\cli.mjs
785	\src\clock.mjs
1499	\src\compactor.mjs
1461	\src\config.mjs
483	\src\crc32.mjs
1285	\src\errors.mjs
2900	\src\failpoints.mjs
3707	\src\frame.mjs
4331	\src\fsops.mjs
529	\src\idempotency.mjs
562	\src\index.mjs
1592	\src\inspect.mjs
1017	\src\lease.mjs
1305	\src\lock.mjs
897	\src\logger.mjs
1269	\src\metrics.mjs
9647	\src\queue.mjs
1242	\src\records.mjs
294	\src\retention.mjs
1499	\src\snapshot.mjs
2447	\src\state.mjs
4364	\src\store.mjs
2071	\src\wal.mjs
290	\test\helper
... [372 more characters in steps.jsonl]
```

## 4. Said

Small codebase; I'll read everything.

## 5. shell (exit 0)

```text
cd docs; foreach($f in 'guarantees','api','architecture','compaction','crash-testing','leases-and-retries','operations','rfc-007-exactly-once-completion','wal-format'){ "##### $f"; Get-Content "$f.md" -Raw }; cd ..; Get-Content package.json,README.md,CHANGELOG.md -Raw
```

```text
##### guarantees
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

**G7. A live worker keeps its job.** A worker that keeps heartbeating does not lose its job to lease expiry, whichever process runs the 
... [26738 more characters in steps.jsonl]
```

## 6. shell (BLOCKED by os-denied, exit 0)

```text
cd src; foreach($f in 'frame','crc32','wal','fsops','lock','store','state','records','snapshot','retention','compactor'){ "##### $f"; Get-Content "$f.mjs" -Raw }
```

```text
##### frame
// On-disk encoding of the log. The layout is specified in docs/wal-format.md and
// is a compatibility contract: logs already in production must stay readable.

import { crc32 } from './crc32.mjs';
import { CorruptLogError } from './errors.mjs';

export const FORMAT_VERSION = 1;
export const HEADER_SIZE = 20;
export const FRAME_OVERHEAD = 10;

const FILE_MAGIC = Buffer.from('WALQ', 'latin1');
const FRAME_MAGIC = 0xfbad;
const MAX_PAYLOAD = 64 * 1024 * 1024;

export function encodeHeader(generation) {
  const header = Buffer.alloc(HEADER_SIZE);
  FILE_MAGIC.copy(header, 0);
  header.writeUInt16LE(FORMAT_VERSION, 4);
  header.writeUInt32LE(generation, 8);
  header.writeUInt32LE(crc32(header.subarray(0, 16)), 16);
  return header;
}

export function decodeHeader(bytes, file = 'log') {
  if (bytes.length < HEADER_SIZE) {
    throw new CorruptLogError(`${file}: header is missing or short (${bytes.length} bytes)`, { offset: 0 });
  }
  if (!bytes.subarray(0, 4).equals(FILE_MAGIC)) {
    throw new CorruptLogError(`${file}: not a walq log`, { offset: 0 });
  }
  if (bytes.readUInt32LE(16) !== crc32(bytes.subarray(0, 16))) {
    throw new CorruptLogError(`${file}: header checksum mismatch`, { offset: 0 });
  }
  const version = bytes.readUInt16LE(4);
  if (version !== FORMAT_VERSION) {
    throw new CorruptLogError(`${file}: unsupported format version ${version}`, { offset: 0 });
  }
  return { version, generation: bytes.readUInt32LE(8) };
}

export function encodeFrame(
... [21914 more characters in steps.jsonl]
```

## 7. Reasoning

I've already spotted several bugs, but I'll read through the rest of the code before I write up the list.



## 8. shell (exit 0)

```text
cd src; foreach($f in 'queue','lease','backoff','idempotency','config','errors','failpoints','clock','index','inspect','cli','metrics'){ "##### $f"; Get-Content "$f.mjs" -Raw }
```

```text
##### queue
// The public queue API. All calls are synchronous: each one takes the queue lock,
// catches up with the log, decides, appends, and returns once the record is on disk.

import { computeBackoff } from './backoff.mjs';
import { resolveOptions } from './config.mjs';
import { InvalidTransitionError, StaleLeaseError, UnknownJobError } from './errors.mjs';
import { hit } from './failpoints.mjs';
import { lookupKey } from './idempotency.mjs';
import { expiredLeases, pickNextReady } from './lease.mjs';
import { computeMetrics } from './metrics.mjs';
import {
  cancelRecord,
  claimRecord,
  completeRecord,
  deadRecord,
  enqueueRecord,
  expireRecord,
  failRecord,
  requeueRecord,
} from './records.mjs';
import { Store } from './store.mjs';

function errorText(error) {
  if (error instanceof Error) return error.message;
  return error === undefined ? 'unknown error' : String(error);
}

export class Queue {
  constructor(dir, options = {}) {
    this.dir = dir;
    this.config = resolveOptions(options);
    this.clock = this.config.clock;
    this.store = new Store(dir, this.config);
  }

  open() {
    this.store.open();
    return this;
  }

  close() {
    this.store.close();
  }

  #require(id) {
    const job = this.store.state.jobs.get(id);
    if (!job) throw new UnknownJobError(id);
    return job;
  }

  #requireLease(job, token) {
    if (job.status !== 'leased') {
      throw new StaleLeaseError(job.id, token, job.fence);
    }
  }

  #newEnqueue(type, paylo
... [23363 more characters in steps.jsonl]
```

## 9. shell (exit 0)

```text
cd src\worker; foreach($f in 'pool','child','protocol','registry','runner'){ "##### $f"; Get-Content "$f.mjs" -Raw }
```

```text
##### pool
// WorkerPool: starts worker processes, replaces the ones that die, and returns
// jobs to the queue when their lease runs out.

import { fork } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { sleep } from '../clock.mjs';
import { createLogger } from '../logger.mjs';
import { openQueue } from '../queue.mjs';
import { STOP } from './protocol.mjs';

const CHILD_PATH = fileURLToPath(new URL('./child.mjs', import.meta.url));
const STOP_GRACE_MS = 2_000;

const log = createLogger('pool');

export class WorkerPool extends EventEmitter {
  constructor({
    dir,
    handlers,
    size = 2,
    leaseMs = 30_000,
    heartbeatMs,
    pollMs = 20,
    reapMs,
    types = null,
    env = {},
    queue = {},
    maxRespawns = 100,
  }) {
    super();
    this.options = { dir, handlers, leaseMs, heartbeatMs, pollMs, types, queue };
    this.size = size;
    this.reapMs = reapMs ?? Math.max(20, Math.floor(leaseMs / 2));
    this.env = env;
    this.maxRespawns = maxRespawns;
    this.children = new Map();
    this.incarnation = 0;
    this.respawns = 0;
    this.stopping = false;
    this.reaper = null;
    this.queue = null;
  }

  start() {
    this.queue = openQueue(this.options.dir, this.options.queue);
    for (let i = 0; i < this.size; i += 1) this.#spawn();
    this.reaper = setInterval(() => this.#reap(), this.reapMs);
    return this;
  }

  #reap() {
    try {
      this.queue.reapExpired();
   
... [8521 more characters in steps.jsonl]
```

## 10. shell (exit 0)

```text
cd test; foreach($f in 'helpers\append-then-die','helpers\handlers','helpers\tmp','compaction','recovery','failpoints','leases','queue-basics','worker-pool','backoff-schedule','frame-format'){ "##### $f"; Get-Content "$f.mjs" -Raw }; cd ..\scripts; Get-Content stress.mjs,stress-handlers.mjs -Raw
```

```text
##### helpers\append-then-die
// Opens the queue in argv[2] and enqueues one job. Run with a kill failpoint armed
// so that the process dies during the append.

import { openQueue } from '../../src/index.mjs';

const queue = openQueue(process.argv[2]);
queue.enqueue('from-child', { pid: process.pid });
queue.close();

##### helpers\handlers
// Job handlers used by the worker tests. Each run is recorded in the file named
// by WALQ_TEST_LEDGER, so a test can see what actually ran.

import fs from 'node:fs';

function record(entry) {
  fs.appendFileSync(process.env.WALQ_TEST_LEDGER, `${JSON.stringify(entry)}\n`);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default {
  async quick(payload, ctx) {
    record({ id: ctx.id, attempt: ctx.attempt, worker: ctx.workerId, event: 'start' });
    return { echoed: payload };
  },

  async slow(payload, ctx) {
    record({ id: ctx.id, attempt: ctx.attempt, worker: ctx.workerId, event: 'start' });
    await wait(payload.ms);
    return 'finished';
  },

  async flaky(payload, ctx) {
    record({ id: ctx.id, attempt: ctx.attempt, worker: ctx.workerId, event: 'start' });
    if (ctx.attempt < payload.succeedOn) throw new Error(`attempt ${ctx.attempt} failed`);
    return ctx.attempt;
  },
};

##### helpers\tmp
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const cleanups = new WeakMap();

/** Runs at the end of the test, newest first, so children stop before their
... [33255 more characters in steps.jsonl]
```

## 11. Reasoning

I'm listing out the bugs now and will design fixes once the catalog is complete. The first one is torn-tail handling: catchUp scans the log but never truncates the partial tail, so new appends land after those torn bytes, leaving garbage mid-file that makes a later reopen fail with CorruptLogError. That looks like what caused the Tuesday incident.

I'm checking the fix for the torn tail: appending at the last good offset and truncating the partial bytes under the lock, since no other writer can be mid-write while the lock is held. The open question is whether a bad checksum on the final record should count as a torn write or as real corruption, given the existing test that expects the log to still open.

I'm checking whether the existing test that expects a log with a bad-checksum last record to still open actually passes, since the scanner appears to throw on any bad checksum. Distinguishing a torn final frame from real damage to an acknowledged record is the hard part, and I'll run the tests to see what the repo currently does.

I'm weighing whether a zero-filled tail, which a power loss can leave when the file length is extended but the data never reached disk, should count as torn rather than corrupt. The open question is whether that treatment would cover the case where the final frame's checksum fails and the frame reaches EOF.

I'm seeing that catchUp only reads the first 1 MiB chunk and never loops to the end of the file, so any frame bigger than that looks like a torn tail, and a truncation step would wipe out a real record. The fix needs to keep reading until EOF and be able to grow the read window for frames that span a chunk boundary.

I'm planning to make catchUp keep reading until it reaches EOF, growing the read window when a frame crosses a chunk boundary, so that large frames aren't mistaken for a torn tail.

I'm working out how catchUp should detect that the log has been compacted, and noticing that comparing file sizes misses the case where the new log is larger than the old offset, so I need to compare generations instead.

I'm checking that a generation change, rather than a size comparison, is what should trigger the reset in catchUp, since a larger replacement log would slip past a size check. I also need to note that compaction currently drops the idempotency keys of pruned jobs, so the snapshot has to carry `idem` forward to avoid duplicates after a nightly compaction.

I'm noting that the snapshot serializer drops attempts, fence, and priority, so compaction would reset retry counts and could let fencing tokens be reissued. The idempotency entries also need to be carried through the snapshot, including the status and result of pruned jobs, with expired entries dropped by TTL. Available

I'm noting that the fail and expire paths compute the retry due time from the apply-time clock rather than the recorded timestamp, so a replay pushes retries further out. The fix is to base availableAt on the record's own time plus its delay. I'm also checking that the idempotency lookup in loadSnapshot should prefer the latest job for a reused key rather than the first one it meets.

I'm checking how the idempotency lookup behaves during enqueue, since the key is read outside the lock and could race with another process. Rechecking the key inside the lock looks like the right fix, and I need the snapshot to keep each pruned job's status and result so that repeated keys still return the original outcome.

I'm checking how the idempotency entries should be carried through compaction: for each key still within its TTL, the snapshot keeps the job id and time, and if that job has already been pruned it also keeps the status and result. Entries whose job is still live just need the key, id and time, and entries that were already pruned keep the status and result they had before.

I'm now looking at the heartbeat path: the lease extension only changes the in-memory state, so other processes, including the pool's reaper, never see it and can reclaim a job that's still running. I'm considering routing the heartbeat through the lock, checking the lease, and appending a logged heartbeat record, probably with a sync write, since the cost of one fsync per lease interval seems acceptable.

I'm weighing whether to sync heartbeat appends. Skipping the fsync would be cheaper, but a power loss could then shorten a lease, and the guarantee I'm aiming for is that an acknowledged call survives a crash, so I'm leaning toward syncing them even though it costs more.

I'm checking the heartbeat path next: the requireLease check never compares the token, so a stale worker holding an old token could still complete, fail, or heartbeat a job someone else now owns.

I'm checking the reaper path next: it computes expired jobs outside the lock from a refresh, then acts on them inside the lock, so a job that was heartbeated or completed in the meantime could still get expired. Re-validating the lease and fence inside the lock before expiring should close that gap.

I'm checking the claim path next: the next job is picked outside the lock and only claimed inside it without a recheck, so two processes could both lease the same job and end up with the same fence token. Picking the job inside the lock looks like the fix.

I'm checking the claim path's pick-then-claim pattern: the job is chosen outside the lock, so the fix is to pick it inside the lock too. The claim hook can still fire before taking the lock, and each poll already goes through the lock during refresh, so this adds no extra cost.

I'm settling on the claim path: picking the job inside the lock, with a pre-check outside it that keeps the existing hit point, so two processes can't lease the same job under the same fence token.

I'm checking requeue next: it resets the fence to zero, so an old token could be issued again for the same job, and a stale worker holding it could act on the new claim. The fix is to leave the fence alone on requeue and only reset attempts. I'm also going through the cancel path, which is where I stopped.

I'm weighing whether to add cancelled jobs to the terminal set for retention: they have a completion time and are finished, so leaving them unpruned would let the log grow, though it changes how long cancelled jobs stay around.

I'm looking at whether cancelled jobs should be pruned by compaction too. They have a completion time, but I'm leaning toward leaving them as they are, since changing their retention is an observable change and the request only asked for unobservable compaction.

I'm going through the remaining sections of the write path: since completions are on the hot path, I'm noting that they're written without a sync, which breaks the rule that an acknowledged call survives a crash, so they should be synced too. I'm also checking the fail path, which handles retries and dead letters, and confirming that the retry time is computed from the record's own timestamp so replays come out the same.

I'm now going through compaction: the temp file is created exclusively, so a leftover from a crashed run would block every later compaction, and I'm planning to clear any stale temp file under the lock before creating it. I also see that the temp file isn't synced before the rename, so a power loss could leave an empty log, and it needs an fsync before the rename.

I'm settling where the sync goes in compaction: the temp file should be fsynced after its bytes are written and before the rename, so a crash can't leave an empty log behind.

I'm checking whether a backup tool or antivirus holding wal.log open on Windows would make the rename over it fail with EPERM, EBUSY or EACCES, even though Node's own read handle probably shares delete access.

I'm now considering the rename itself: on Windows, a backup tool or antivirus holding wal.log without delete sharing could make the replace fail with a transient permission error, so I'm weighing a short bounded retry on that specific error, with temp cleanup if it still fails.

I'm checking whether `tail` holding the log open could make the rename over wal.log fail on Windows, given libuv's sharing flags and how MoveFileEx handles replacing an open target.

I'm checking whether replacing wal.log while another process has it open actually fails on Windows, and I'll test it directly with a handle held open before the rename to see what error comes back.

I'm now considering the temp-file rename under the lock: if the replace fails with a transient permission error, a bounded retry seems reasonable, and removing the temp file on any failure keeps the next compaction from tripping over it. I'm also planning to change `tail` so it opens and closes the log on each tick instead of holding a handle, which would let it follow generation changes and avoid blocking the replace; the docs on that point will need updating too.

I'm checking the create path next: the staging file is written but not synced before the rename, so a power loss right after the rename could leave an empty log that fails to open. Syncing the staging file before the rename looks like the fix, and I'm still working out how `open()` handles the case where the log doesn't exist yet.

I'm checking the create path: the staging file gets written but isn't synced before the rename, so a power loss right after the rename could leave an empty wal.log that fails to open. I'm also weighing whether a 0-byte log from before this fix should be reported as corruption, and I'm leaning toward treating it that way since the old contents are already gone.

I'm checking the compaction path's snapshot size next: `maybeCompact` returns early whenever the log is under the threshold, so I need to see whether a snapshot that is itself larger than `compactAfterBytes` would keep triggering compaction on every write.

I'm working out the threshold for automatic compaction so that a snapshot larger than the limit doesn't trigger a full rewrite on every write, probably by compacting only once the log has grown past a bound tied to the snapshot size.

I'm working out the compaction threshold so that automatic compaction only fires once the log has grown by at least as much as the snapshot itself, which keeps the amortized cost per write small even when live state is large. The snapshot size is already tracked from the snapshot frame during catch-up, so the check can use it directly.

I'm considering whether a compaction failure after the rename, such as the post-rename sync throwing, leaves the store in an inconsistent state, and I think the generation check in catchUp already covers that case by forcing a rescan.

I'm checking whether `snapshot.jobs` shares `payload` and `lease` objects with live state, since a shallow copy in `loadSnapshot` could let later mutations leak across. I'm also weighing whether `compact()` should rebuild in-memory state by rescanning the new file rather than applying the snapshot record directly, so that it matches what a fresh process would load.

I'm checking whether the snapshot should be round-tripped through JSON before compaction applies it in memory, since fields like undefined values could otherwise differ from what a freshly reopened process would load.

I'm settling on a compaction threshold that compacts only once the log has grown by at least the snapshot's size, so a large live state doesn't trigger a full rewrite on every write. For the final verification I'll decode the snapshot frame we just wrote, so that in-memory state matches what a freshly reopened process would load.

I'm checking whether apply should ignore a complete, heartbeat, or fail record whose fence doesn't match the job's current lease, since old logs written before the token check was added could contain stale completions. I'm weighing whether to guard that at replay, which would change how existing logs load, against leaving replay as it is.

I'm weighing whether `applyRecord` should ignore complete, fail, expire, or release records whose fence doesn't match a currently leased job, since old logs from before the token check could carry stale ones. Guarding on status and fence at replay would keep such records from changing a job that already finished, though it would also alter how existing logs load.

I'm weighing whether a guard that ignores records with a mismatched fence would hide acknowledged data, since an older log could have been written under the buggy requeue that reset fences.

I'm deciding how far to take the replay guards: I'll add a fence-and-status check for complete, fail, expire and release records, since a stale record should have no effect on a job it doesn't name.

I'm checking how catchUp should handle the tail: since it may be mid-file or at the end, I want to truncate any torn bytes before the next append lands, so the new record doesn't end up behind garbage. That means catchUp has to run its truncation under the lock, and I need to confirm that it also works when open() and withLock() call it.

I'm settling the truncation question: catchUp should scan the whole file first, throwing on real corruption before touching anything, and only then cut off the torn bytes under the lock. For the final frame, a bad checksum that ends exactly at EOF counts as torn, which is what the existing test expects.

I'm settling the classification of a bad-checksum final frame: if it ends exactly at EOF it counts as a torn write and gets truncated, but if any bytes follow it, it's mid-log damage and should throw CorruptLogError. I'm still weighing whether that rule sits safely with the no-silent-loss guarantee, since a corrupted last acknowledged record would be dropped the same way a cut-off write is.

I'm checking whether the existing test for a bad-checksum final record currently passes, since the scanner looks like it throws on any bad checksum, and I'll run the suite to confirm. I'm also considering a torn final frame whose first bytes are intact but whose remainder is cut off, which would need separate handling from a bad checksum.

I'm weighing a guard for the torn-tail rule: a bad-checksum frame counts as torn only when it ends exactly at EOF, so any bytes after it mean real damage. I still need to check how the write offset interacts with that truncation so nothing written afterward ends up behind leftover garbage.

I'm checking the power-loss test model's handling of truncate and unlink, and whether the read-only paths in inspect and tail can stay on direct filesystem access while only the log's writes go through the file ops layer.

I'm going through the lock path now: the acquire code treats EPERM and EACCES as busy, which seems reasonable for exclusive opens on Windows, and a persistent permission problem would just end in a lock timeout. I'll also keep the release logic and the timeout check as they are.

I'm checking the lock acquisition path next: with two queues in one process, the second one would just get EBUSY and wait out the timeout. Then I'm turning to `Store.append`, where a failed write could leave partial bytes in the file while the in-memory offset stays put, so the next catch-up has to deal with them.

I'm settling on a fix for the append path: if the write fails partway, I'll truncate the file back to the last good offset under the lock on a best-effort basis and then rethrow the original error. That way a failed or unsynced write can't leave bytes behind that a later catch-up would apply.

I'm now going through the worker's report path: if the completion write fails, say with a lock timeout, the result gets dropped and the lease later expires, so the handler reruns. I'm planning to have the worker retry the completion with backoff until it's recorded or it's fenced off, rather than moving on to another job.

I'm deciding how the worker should retry its completion report: it will keep heartbeating and retrying until the outcome is recorded or the lease is fenced off, not just on lock timeouts but on other transient errors, while treating a fenced-off lease as the end of retries.

I'm deciding how the worker should handle a failed completion report: I'll retry on lock timeouts and other system-level errors while keeping heartbeats going, but treat errors like corruption or a closed queue as non-retryable and surface them, leaving the job to expire and rerun. I'm not sure yet whether a test that injects arbitrary errors at the completion failpoint expects those to be retried until the completion lands.

I'm adding retry logic for the completion and failure reports so the worker keeps trying through transient errors, while still heartbeating so the lease isn't reaped in the meantime. Once a fenced lease is detected the retries stop, and the job's result is discarded.

I'm checking the worker's run loop: if `claim` throws a non-Walq error like an EIO from the filesystem, that exception escapes `run()` and kills the child process, which the pool then respawns and the job gets reclaimed. I'm leaving that as it is for now.

I'm checking how worker IDs are formed, since they currently look like `w1`, `w2` and would collide across pools sharing one queue directory. A reclaim after a worker dies must only touch that worker, so I'm considering a pool-unique prefix such as the pid plus a random suffix, and I still need to see whether any test depends on the old format.

I'm thinking about the worker ID format, since bare names like `w1` would collide across pools sharing one queue directory and a reclaim could then touch the wrong worker. I'm leaning toward adding a random nonce to the prefix, so that even a reused pid from an earlier pool can't match a live one.

I'm checking the reclaim path on pool exit: the reclaim should still run even when the pool is stopping, since the exit handler is registered before the stop waits resolve. If reclaiming fails with a lock timeout, I can't just drop it, so I'm weighing whether to retry it or leave the job to the lease reaper.

I'm working out how the pool should reclaim a dead worker's jobs: the reclaim has to run before any replacement is spawned so the new worker can pick them up. Since a reclaim can fail on a lock timeout, I'm planning to keep dead workers in a pending set and retry them on the next reaper tick, so the reclaim isn't lost and the lease reaper remains as a fallback.

I'm checking the remaining pool details: the reclaim has to run even while the pool is stopping, and after `maxRespawns` is exceeded it still has to reclaim. I'm also making sure the fork doesn't pass along options that can't be serialized, and that an unset `heartbeatMs` is harmless.

I'm checking the enqueue path: the duplicate-key lookup should run under the lock so a concurrent process can't slip in the same key, though I'm still weighing whether a fast pre-check outside the lock is safe given the TTL expiry.

I'm re-checking the enqueue duplicate-key path: the fast pre-check outside the lock can stay, but the lookup has to run again inside the lock before appending. I'm also confirming that job ids come from the snapshot's sequence counter, so they stay unique after compaction.

I'm checking the frame scanner's edge cases: a short tail under the minimum frame size is treated as partial, but a longer tail with bad magic made of zero bytes needs separate handling.

I'm settling on a torn-tail rule that counts only partial frames and a bad checksum on the final frame as torn, and I'm leaving out zero-fill tolerance because zeros at the end could just as easily be damage to acknowledged records. I still need to check whether a bad-checksum final frame that ends exactly at EOF is the only case that reaches the truncation path.

I'm checking whether the existing bad-checksum test actually passes, since the scanner looks like it throws on any bad checksum. I'm also keeping the tail rule narrow: a bad-checksum frame counts as torn only when it ends exactly at EOF, and anything after it means real damage.

I'm checking the frame decoding next: the CRC table and checksum arithmetic look right against the known check value, and the header's version check and generation field look fine, so the scanner's basic encoding doesn't need changes.

I'm checking how oversized records are handled: encodeFrame doesn't enforce the payload limit, so a record over 64 MiB would be written as an unreadable frame and then fail on the next read as corrupt. Since encoding happens before the lock-guarded write, I can reject it there with a clear error instead of writing anything.

I'm checking the size limit next: encoding rejects payloads over 64 MiB before anything gets written, and a snapshot that large would hit the same wall during compaction, so I'll have it fail safely rather than write an unreadable frame.

I'm going back over the unknown-record handling and the idempotency state rebuilt from older snapshots. If a snapshot predates the `idem` field, I'll need to rebuild the keys from the jobs themselves, letting the most recent job win when a key appears more than once.

I'm checking how old logs replay the completion counter: each complete record bumps `completionSeq`, so I need to decide whether completes that predate the snapshot should be counted again on replay.

I'm checking how completion numbering behaves for jobs finished in old logs: the snapshot's completion counter starts at zero for older files, so I need to confirm whether those jobs should be listed or left out.

I'm checking how completion numbers carry across replay and compaction: the counter lives in the snapshot, so pruned jobs still hold their numbers, and numbering stays consistent for every process that replays the same log.

I'm checking how completions are listed: I'll walk the done jobs in completion order, keeping only those past the `after` cursor, and stop at the limit. Each entry carries the commit's sequence number, job id, fence token, result and completion time.

I'm checking whether a finished job past retention should disappear right away or only at compaction, and I'm settling on compaction, since that keeps what callers can see stable across timing. For the completion receipt, a repeated commit with a matching fence returns the stored receipt, and a pruned job gets an UnknownJobError, which means the snapshot has to keep the fence on done jobs.

I'm settling the receipt for a committed completion: it will carry the job id, the fence token, the stored result, the completion time and the completion sequence number. A repeated commit with a matching fence returns that same receipt. I still need to decide whether to keep the old `status: 'done'` field alongside it or drop it, since the new receipt shape is meant to replace the previous return value.

I'm checking how a completion's result gets stored: the committing process keeps the in-memory value, while replay sees the JSON-decoded one, so an undefined field or a Date could make the two disagree. Normalizing the result through a JSON round-trip before the record is appended should keep them identical across restarts and other processes.

I'm weighing whether to JSON-roundtrip each record inside Store.append, so the committing process applies exactly what replay will see, or to normalize only the completion result before it is written.

I'm settling on a JSON round-trip for records in Store.append, so the committing process applies exactly what replay will decode and shared payload objects can't leak changes into state. I'll leave the claim path's returned payload as it is for now.

I'm working out how reclaimWorker should release a dead worker's leased jobs: under the lock, after catching up, each job held by that worker gets a release record carrying the fence and the reason, or a dead record if it has already hit its attempt limit. The release applies as a requeue that is runnable right away, with the reason stored as its last error, and the default reason is "worker reclaimed".

I'm now deciding which replayed records should be ignored: complete, fail, expire and release records will only apply when their fence matches the job's current lease, so a stale write from the old reaper can't flip a finished job back to ready. I'm leaving dead records unguarded, since they already come from a leased job.

I'm now checking the backoff math: the delay uses the job's attempt count at the time of the failure, and the overflow case is capped by the maximum delay. I'm also noting that the jitter hash iterates over code points, which is fine here.

I'm looking at the CLI's `tail` command, which holds the log file open and so won't see a compaction properly. My plan is to reopen the file on each tick and check the generation in its header, resetting the read offset when it changes.

I'm checking how `tail` should follow compaction: instead of holding the log open, it will reopen the file each tick, compare the generation in the header, and reset its read offset when the generation changes. I also want to confirm on Windows that the replace isn't blocked while `tail` is running, and that a transient busy error just gets retried on the next tick rather than swallowed.

I'm checking the `stats()` counts next, and I still need to add the maybe-compact call to the `fail` dead-letter path.

I'm turning to the heartbeat path again: a heartbeat will take the lock, check the token, and log a record with the new lease deadline, so the reaper sees it after catching up. I still need to check how the reaper's clock compares to the one that wrote the heartbeat.

I'm checking the expiry logic in the reaper: it reads the clock inside the lock and compares against each lease's deadline, so a heartbeat written under the lock will be visible to it. I'm also keeping the heartbeat period well under the lock timeout so a slow write can't let a lease lapse by accident.

I'm checking how maybeCompact's swallowed errors interact with the generation check: if a rename already went through before a sync failed, the next catch-up should notice the new generation and rescan, so the stale in-memory state won't stick. I'm also weighing whether to keep the size-shrink reset in catchUp alongside the generation check, in case the log is truncated by hand.

I'm weighing whether a size drop under the same generation should count as corruption, since only torn tails past each process's own end get truncated. The open question is whether another process could cut a tail that our offset already covers, and if so, whether that should throw or just rescan.

I'm weighing whether a size drop under the same generation should count as corruption, since a process only ever truncates bytes past its own end. If the file shrinks below our offset without a generation change, that would mean acknowledged data was lost, so throwing CorruptLogError seems safer than silently rescanning.

I'm deciding that a shrink under the same generation should throw CorruptLogError instead of silently rescanning, since bytes we already applied would have disappeared. I'm also weighing whether a long-lived instance could hit this legitimately if another process cut a torn tail that our offset already covers.

I'm weighing whether a read that starts with a full frame, and then sees the writer's failed append truncated away, should count as a shrink under the same generation. If the file ends up shorter than my offset, that's the case where I'd throw CorruptLogError rather than quietly rescan.

I'm checking the enqueue and pick paths against the lock, and confirming that the pick ordering (priority first, then availability time) still holds once the job is chosen under the lock.

I'm checking the rest of the replay-side details: the default maxAttempts comes from config when an enqueue doesn't set it, and the ready-job ordering still holds for retried jobs that come back with a later availability time. I'm also confirming that the duplicate-key lookup expires entries by TTL, and that the snapshot only drops idempotency entries once they're past it.

I'm settling the replay rule for idempotency entries: if a job is still live I keep just the key, id and time, and only pruned jobs need their status and result carried along. I'm going to check the pool's leftover reclaim handling next.

I'm checking the pool's stop path next, including how `child.mjs` exits when the parent disconnects mid-job and whether a load failure just causes respawns up to the limit.

I'm checking the worker's report path next: the completion and failure reports should keep heartbeating while they retry, and if a heartbeat comes back stale I'll mark the lease as lost so the retries stop and the result gets discarded.

I'm settling the reaper's handling of stale completions and the retry behavior for failed reports, with the worker still heartbeating while it retries. Stale or pruned leases will end the retries, and a report that gets fenced off is simply discarded.

I'm reviewing the retry timing: replayed failures recompute availability from the current clock rather than the recorded time, so restarts stretch backoff. The attempt counter also resets after compaction, which would shorten later backoffs, and released jobs need the same timestamp handling.

I'm now looking at how catchUp reads the log: the SCAN_CHUNK read has no loop, so a large log or snapshot never gets fully scanned, and a partial frame at a chunk boundary could be mistaken for a torn tail. That would make truncation destroy real records, so the scan has to read to EOF before anything is cut.

I'm checking the replay path next: the timestamp of a fail record is the writer's own clock, so the retry time can be `rec.at` plus the recorded delay instead of recomputing from the clock at replay. I still need to confirm that older records without that timestamp fall back correctly.

I'm making sure a job's fields all carry over unchanged when compaction rebuilds the snapshot, so I'm planning to copy each job object whole rather than listing its fields one by one.

I'm about to run the existing test suite to get a baseline before making any changes, and I'll stress-test afterward since that takes around 90 seconds.



## 12. shell (exit 1)

```text
git log --oneline -5 2>&1; git status --short 2>&1; node --version; npm test 2>&1 | Select-Object -Last 40
```

```text
ba86350 Initial commit
v24.7.0
  }

test at test\worker-pool.mjs:43:1
✖ four workers sharing a queue run each job once (1156.7286ms)
  AssertionError [ERR_ASSERTION]: job j29 ran 2 times
  
  2 !== 1
  
      at TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/worker-pool.mjs:52:43)
      at async Test.run (node:internal/test_runner/test:1113:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:788:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 2,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at test\worker-pool.mjs:55:1
✖ a job longer than its lease is not run twice while its worker is alive (4219.6581ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  2 !== 1
  
      at TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/worker-pool.mjs:60:10)
      at async Test.run (node:internal/test_runner/test:1113:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:788:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 2,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }
node.exe : npm notice
At line:1 char:1
+ & "C:\Program Files\nodejs/node.exe" "C:\Program Files\nodejs/node_mo ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (npm notice:String) [], RemoteE
... [286 more characters in steps.jsonl]
```

## 13. shell (exit 1)

```text
npm test 2>&1 | Select-String -Pattern '^(✔|✖|ℹ)'
```

```text
(no output)
Exited with code 1
```

## 14. shell (exit 1)

```text
node --test test/*.mjs 2>&1 | Select-String -Pattern '^\s*(✔|✖|ℹ (pass|fail))'
```

```text
(no output)
Exited with code 1
```

## 15. shell (exit 1)

```text
node --test --test-reporter=tap test/*.mjs 2>&1 | Select-String -Pattern '^\s*(ok|not ok)|^# (pass|fail)'
```

```text
ok 1 - the delay doubles with each attempt
ok 2 - the delay stops growing at the cap
ok 3 - jitter only shortens the delay, and every process gets the same number
ok 4 - compaction shrinks the log and keeps the jobs
ok 5 - a compacted log reopens to the same state
ok 6 - records appended after a compaction are kept
ok 7 - terminal jobs are dropped once past retention
ok 8 - the log compacts itself once it passes the threshold
ok 9 - hit does nothing when nothing is armed
ok 10 - an in-process callback sees the point and its context
ok 11 - the queue passes through its documented points on a claim
ok 12 - crc32 matches the published check value
ok 13 - crc32 can be continued across chunks
ok 14 - a header round-trips and records its generation
ok 15 - a damaged header is refused
ok 16 - frames round-trip through a scan
ok 17 - a frame cut short is reported as an incomplete tail
ok 18 - a lease that runs out returns the job to the queue with a backoff
ok 19 - a heartbeat keeps a lease alive
ok 20 - a worker that lost its lease cannot heartbeat or fail the job
ok 21 - expired leases count against max attempts
ok 22 - a job goes from enqueue to claim to complete
ok 23 - jobs come out oldest first
ok 24 - a delayed job waits for its time
ok 25 - claim can filter by job type
ok 26 - state survives closing and reopening
ok 27 - failing a job schedules a retry with backoff
ok 28 - a job goes dead when its attempts run out
ok 29 - an idempotency key returns
... [829 more characters in steps.jsonl]
```

## 16. Reasoning

I'm checking that test 35 expects the last frame to tolerate a bad checksum, and that it currently fails. Next I want to run an experiment on renaming over an open handle on Windows.



## 17. Said

Baseline confirmed: two existing tests fail (bad-checksum tail, long job rerun). Before designing the compaction fix, I'll check how Windows behaves when renaming over a file that's open.

## 18. shell (BLOCKED by os-denied, exit 0)

```text
$d="C:\invoice-home\c13dbd4c\Temp\opencode\rn"; New-Item -ItemType Directory -Force $d | Out-Null; Set-Location $d
@'
import fs from 'node:fs';
fs.writeFileSync('a.log','old'); fs.writeFileSync('a.tmp','new');
const fd = fs.openSync('a.log','r');
try { fs.renameSync('a.tmp','a.log'); console.log('rename over open (node r) OK'); } catch(e){ console.log('node r handle:', e.code); }
fs.closeSync(fd);
fs.writeFileSync('a.tmp','new');
// exclusive handle (like a backup tool without share-delete)
const O_EXLOCK=0x10000000;
const fd2 = fs.openSync('a.log', fs.constants.O_RDONLY|O_EXLOCK);
try { fs.renameSync('a.tmp','a.log'); console.log('rename over exlock OK'); } catch(e){ console.log('exlock handle:', e.code); }
fs.closeSync(fd2);
'@ | Set-Content t.mjs; node t.mjs
```

```text
node r handle: EPERM
exlock handle: EPERM
```

## 19. Reasoning

Even `walq tail` holds a read handle on the node, so the rename gets EPERM. I need to stop tail from holding the file open, and treat backup-related failures as transient with a bounded retry. If the rename stays blocked, compaction should fail safely and clean up its temp file. Unlinking before the rename doesn't solve it either. The handles that matter are the other worker processes reading the log, since our own ones open and close per operation.

Next I'm going to retry the rename a bounded number of times on EPERM, EBUSY, or EACCES, rather than changing RealFileOps itself, since the other worker processes only hold the file briefly.

I'm weighing whether a bad-checksum frame at the end of a chunk is really the file's tail or just a frame that hasn't fully arrived yet. If it isn't the last chunk, I'd mark it as partial and re-read from that point with the next chunk, so I don't throw on a frame that's still incomplete.

I'm adding a `final` flag to `scanFrames` so a bad-checksum frame only counts as a torn tail when it actually sits at end of file, and reads a chunk short of EOF as partial instead. The chunked `scanFrom` loop will compute `final` from file size on each read.

I'm working out how to chunk the scan so a frame cut at a chunk boundary isn't mistaken for a torn tail. The plan is to pass a `final` flag into `scanFrames` and only treat a bad checksum as a tail when it sits at true end of file. If a read stops short of EOF, the partial frame gets re-read with a larger chunk so the scan still makes progress.

Now I'm working out the chunked scan loop, so a frame that's cut at a chunk boundary is treated as partial instead of as a torn tail. I'll have the scan apply each chunk's frames as it goes and record the offset per chunk, so a later error doesn't leave the offset out of step with the state.

I'm carrying on with the write-ahead log: `tornTailsDropped` gets incremented after a torn tail is truncated. Truncation is done through the handle we already own, and since catchUp only runs under the lock, it can't race another writer in our process. The truncate call syncs as part of `ops.truncate`.

Next, `Wal.append` should take the known end offset as `at`, with a fallback to the file size when it's missing.

I'm adding a `RecordTooLargeError` to the error types so an oversized record gets rejected cleanly when it's encoded, and I'll export it alongside the existing errors.

I'm deciding whether to add a `RecordTooLargeError` class, since an additive export would let oversized records get rejected cleanly at encode time.



## 20. Said

Findings so far: even a plain read-only handle (`walq tail`) makes the compaction rename fail with EPERM on this Windows host. I'll rewrite the core now, starting with the frame and WAL layers.

## 21. shell (exit 1)

```text
cd src
node -e "
const fs=require('fs');
let s=fs.readFileSync('frame.mjs','utf8');
s=s.replace(\"import { CorruptLogError } from './errors.mjs';\",\"import { CorruptLogError, RecordTooLargeError } from './errors.mjs';\");
s=s.replace(\"const MAX_PAYLOAD = 64 * 1024 * 1024;\",\"export const MAX_PAYLOAD = 64 * 1024 * 1024;\");
s=s.replace(\"  const payload = Buffer.from(JSON.stringify(record), 'utf8');\n\",\"  const payload = Buffer.from(JSON.stringify(record), 'utf8');\n  if (payload.length > MAX_PAYLOAD) throw new RecordTooLargeError(record.t, payload.length, MAX_PAYLOAD);\n\");
fs.writeFileSync('frame.mjs',s);
"
```

```text
At line:5 char:91
+ ... LogError } from './errors.mjs';\",\"import { CorruptLogError, RecordT ...
+                                                                 ~
Missing argument in parameter list.
At line:7 char:222
+ ... length > MAX_PAYLOAD) throw new RecordTooLargeError(record.t, payload ...
+                                                                 ~
Missing argument in parameter list.
    + CategoryInfo          : ParserError: (:) [], ParentContainsErrorRecordException
    + FullyQualifiedErrorId : MissingArgument
 

Exited with code 1
```

## 22. Said

I'll use the edit tool instead of shell quoting.

## 23. edit

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\src\\frame.mjs",
  "oldString": "import { CorruptLogError } from './errors.mjs';",
  "newString": "import { CorruptLogError, RecordTooLargeError } from './errors.mjs';"
}
```

```text
Edited src/frame.mjs (1 replacement)
```

## 24. edit

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\src\\frame.mjs",
  "oldString": "const MAX_PAYLOAD = 64 * 1024 * 1024;",
  "newString": "export const MAX_PAYLOAD = 64 * 1024 * 1024;"
}
```

```text
Edited src/frame.mjs (1 replacement)
```

## 25. edit

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\src\\frame.mjs",
  "oldString": "  const payload = Buffer.from(JSON.stringify(record), 'utf8');\n  const frame",
  "newString": "  const payload = Buffer.from(JSON.stringify(record), 'utf8');\n  if (payload.length > MAX_PAYLOAD) throw new RecordTooLargeError(record.t, payload.length, MAX_PAYLOAD);\n  const frame"
}
```

```text
Edited src/frame.mjs (1 replacement)
```

## 26. edit

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\src\\errors.mjs",
  "oldString": "export class ConfigError extends WalqError {}",
  "newString": "/** A record would not fit in a frame (docs/wal-format.md), so nothing was written. */\nexport class RecordTooLargeError extends WalqError {\n  constructor(type, size, limit) {\n    super(`a ${type} record of ${size} bytes exceeds the ${limit} byte limit`, { type, size, limit });\n  }\n}\n\nexport class ConfigError extends WalqError {}"
}
```

```text
Edited src/errors.mjs (1 replacement)
```

## 27. edit

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\src\\index.mjs",
  "oldString": "  QueueClosedError,\n  StaleLeaseError,",
  "newString": "  QueueClosedError,\n  RecordTooLargeError,\n  StaleLeaseError,"
}
```

```text
Edited src/index.mjs (1 replacement)
```

## 28. Reasoning

I'm reworking the decodeFrameAt and scanFrames functions now.



## 29. shell (exit 0)

```text
cd src; $c = Get-Content frame.mjs -Raw; $i = $c.IndexOf('function decodeFrameAt'); $c.Substring(0,$i) | Set-Content frame.mjs -NoNewline; "ok"
```

```text
ok
```

## 30. shell (exit 0)

```text
cd src; @'
function decodeFrameAt(bytes, pos) {
  const remaining = bytes.length - pos;
  if (remaining < FRAME_OVERHEAD) return { ok: false, reason: 'partial', needed: FRAME_OVERHEAD };
  if (bytes.readUInt16LE(pos) !== FRAME_MAGIC) return { ok: false, reason: 'bad-magic' };
  const length = bytes.readUInt32LE(pos + 2);
  if (length > MAX_PAYLOAD) return { ok: false, reason: 'bad-length' };
  if (remaining < FRAME_OVERHEAD + length) {
    return { ok: false, reason: 'partial', needed: FRAME_OVERHEAD + length };
  }
  const start = pos + FRAME_OVERHEAD;
  const payload = bytes.subarray(start, start + length);
  const expected = bytes.readUInt32LE(pos + 6);
  if (expected !== crc32(payload, crc32(bytes.subarray(pos + 2, pos + 6)))) {
    return { ok: false, reason: 'bad-checksum', next: start + length };
  }
  try {
    return { ok: true, record: JSON.parse(payload.toString('utf8')), next: start + length };
  } catch {
    return { ok: false, reason: 'bad-payload' };
  }
}

/**
 * Walks frames starting at the beginning of `bytes`, which sit at `baseOffset`
 * in the file. Returns the decoded frames, the file offset just after the last
 * good one, and `tail` when the bytes after that are not a complete frame.
 *
 * `final` says that `bytes` reaches the end of the file. Only then can the last
 * frame be judged a cut-off write: a frame that is all there but fails its
 * checksum, with nothing after it, is a write that did not finish reaching the
 * disk. The same frame with anything after it is damage and raises. When
 * `final` is false the frame might simply be followed by more of the file, so
 * it is reported as `partial` and the caller reads on.
 *
 * `tail.needed` is the number of bytes the unfinished frame would occupy, when
 * that is known.
 */
export function scanFrames(bytes, baseOffset = 0, { final = true } = {}) {
  const frames = [];
  let pos = 0;
  let tail = null;
  while (pos < bytes.length) {
    const decoded = decodeFrameAt(bytes, pos);
    if (!d
... [823 more characters in steps.jsonl]
```

```text
(no output)
```

## 31. Reasoning

I'm looking at a bad-checksum frame that ends right at the chunk boundary, so it gets treated as partial. If the next read starts at that frame's offset with the same chunk size, it just returns the same bytes and loops forever, so the chunk has to grow to at least the frame size plus one.

I'm reasoning that the next read has to grow the chunk past the frame size: `max(chunk, needed + 1)`, since a bad-checksum frame at the boundary needs exactly its own length and anything smaller loops forever. I'm also checking the cases where progress stalls, and whether EOF makes the chunk final.



## 32. write

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\src\\wal.mjs",
  "content": "// The log file itself: a header, then checksummed frames, written only by the\n// process holding the queue lock.\n\nimport path from 'node:path';\nimport { decodeHeader, encodeFrame, encodeHeader, HEADER_SIZE, scanFrames } from './frame.mjs';\nimport { hit, isArmed } from './failpoints.mjs';\n\n// Bounds memory when a process has fallen far behind: the log is read and applied\n// this much at a time. A frame bigger than this is read in one piece.\nconst SCAN_CHUNK = 1024 * 1024;\n\nexport class Wal {\n  constructor(file, ops) {\n    this.file = file;\n    this.ops = ops;\n  }\n\n  exists() {\n    return this.ops.exists(this.file);\n  }\n\n  /**\n   * Creates an empty log. The header is made durable under a temporary name\n   * first, so the log appears atomically, complete, or not at all.\n   */\n  create(generation = 1) {\n    const staging = `${this.file}.init`;\n    this.ops.create(staging);\n    this.ops.writeAt(staging, encodeHeader(generation), 0);\n    this.ops.sync(staging);\n    this.ops.rename(staging, this.file);\n    hit('wal.after-create', {});\n    this.ops.syncDir(path.dirname(this.file));\n  }\n\n  readHeader() {\n    return decodeHeader(this.ops.read(this.file, 0, HEADER_SIZE), this.file);\n  }\n\n  /**\n   * Decodes everything from `offset` to the end of the file, a chunk at a time.\n   * `visit(frames, end)` gets each batch of good frames and the offset after\n   * them. Returns `{ end, tail }`, where `tail` describes an unfinished write\n   * at the very end of the file, if there is one. Damage anywhere else throws\n   * CorruptLogError and leaves the file alone.\n   */\n  scanFrom(offset, visit) {\n    let pos = offset;\n    let chunk = SCAN_CHUNK;\n    for (;;) {\n      const size = this.ops.size(this.file);\n      if (pos >= size) return { end: pos, tail: null };\n      const bytes = this.ops.read(this.file, pos, chunk);\n      const final = pos + bytes.length >
... [1612 more characters in steps.jsonl]
```

```text
Wrote file successfully: src/wal.mjs
```

## 33. Reasoning

I'm checking whether truncating in the catch block is still safe when a failpoint callback throws, since the tests use that to simulate failures. I also want to look at the create path: the `wal.after-create` hit expects the log to have its final name, and with the data already durable, the directory sync that follows the rename matters for that ordering.

Next I'm going through state.mjs, snapshot.mjs, the records code, and retention.



## 34. shell (exit 0)

```text
cd src
@'
// How long finished jobs stay in the log.

const TERMINAL = new Set(['done', 'dead']);

export function isTerminal(job) {
  return TERMINAL.has(job.status);
}

export function isPastRetention(job, now, config) {
  return isTerminal(job) && now - job.completedAt >= config.retainCompletedMs;
}
'@ | Set-Content retention.mjs
@'
// A compacted log starts with one snapshot record holding the state it replaces.

import { isPastRetention } from './retention.mjs';

function serializeJob(job) {
  return { ...job };
}

/**
 * The idempotency keys a snapshot has to carry. A key outlives its job, so a key
 * whose job is being dropped keeps the job's outcome with it, and only keys past
 * their time to live are let go.
 */
function keepKeys(state, kept, now, config) {
  const keys = [];
  for (const [key, entry] of state.idem) {
    if (now - entry.at >= config.idempotencyTtlMs) continue;
    const item = { key, id: entry.id, at: entry.at };
    if (!kept.has(entry.id)) {
      const job = state.jobs.get(entry.id);
      item.status = job?.status ?? entry.status ?? 'done';
      item.result = job ? job.result ?? null : entry.result ?? null;
    }
    keys.push(item);
  }
  return keys;
}

/** Builds the snapshot record, dropping terminal jobs past their retention. */
export function buildSnapshot(state, now, config) {
  const kept = new Map();
  for (const job of state.jobs.values()) {
    if (!isPastRetention(job, now, config)) kept.set(job.id, job);
  }

  return {
    t: 'snapshot',
    at: now,
    seq: state.seq,
    completionSeq: state.completionSeq,
    jobs: [...kept.values()].map(serializeJob),
    idem: keepKeys(state, kept, now, config),
  };
}

export function loadSnapshot(state, rec) {
  state.seq = rec.seq;
  state.completionSeq = rec.completionSeq ?? 0;
  state.jobs = new Map();
  state.idem = new Map();
  for (const job of rec.jobs) {
    state.jobs.set(job.id, {
      ...job,
      priority: job.priority ?? 0,
      attempts: job.attempts ?? 0,
    
... [1906 more characters in steps.jsonl]
```

```text
(no output)
```

## 35. Reasoning

I'm checking the keepKeys cases: kept jobs shouldn't carry a status, and a snapshot status for a pruned job is harmless since the job is gone. Then I'm looking at idem entries, where a later enqueue with the same key overrides the pruned one, which is fine. I still need to check keys entries for jobs that are never pruned but are still in state.

I'm checking whether the idem lookup for a job that still exists returns its current state, and it does. Next I'm going through state.mjs, where fail and expire set availableAt to the record time plus the delay, and I'm looking at the guards and at release and requeue, which no longer reset the fence. I'm also weighing a guard that requires the job to be leased and its fence to match, while leaving dead jobs unguarded.

I'm settling on the fence for complete: keeping rec.fence as-is rather than taking a max, since a max would make old-log complete records fail the guard. Post-upgrade claims will then count up from there, and the old workers are gone anyway, so I'll write the state now and set completionSeq.



## 36. shell (exit 0)

```text
cd src
@'
// The queue's state is a pure fold over the log. Replaying the same records must
// give the same state in every process, at any time, so nothing in here may read
// a clock: every time comes from the record.

import { loadSnapshot } from './snapshot.mjs';

export function createState() {
  return { jobs: new Map(), idem: new Map(), seq: 0, completionSeq: 0 };
}

function requeue(job, availableAt, error) {
  job.status = 'ready';
  job.availableAt = availableAt;
  job.lease = null;
  job.lastError = error ?? job.lastError;
}

/** A record about an attempt only counts while that attempt is the live one. */
function holdsLease(job, rec) {
  return job.status === 'leased' && job.fence === rec.fence;
}

export function applyRecord(state, rec) {
  if (rec.t === 'snapshot') {
    loadSnapshot(state, rec);
    return;
  }
  if (rec.t === 'enqueue') {
    state.seq += 1;
    state.jobs.set(rec.id, {
      id: rec.id,
      type: rec.type,
      payload: rec.payload,
      key: rec.key ?? null,
      priority: rec.priority ?? 0,
      status: 'ready',
      attempts: 0,
      fence: 0,
      maxAttempts: rec.maxAttempts,
      availableAt: rec.availableAt,
      lease: null,
      result: null,
      lastError: null,
      enqueuedAt: rec.at,
      completedAt: null,
      completionSeq: null,
      seq: state.seq,
    });
    if (rec.key) state.idem.set(rec.key, { id: rec.id, at: rec.at });
    return;
  }

  const job = state.jobs.get(rec.id);
  if (!job) return;

  switch (rec.t) {
    case 'claim':
      job.status = 'leased';
      job.attempts += 1;
      job.fence = rec.fence;
      job.lease = { worker: rec.worker, fence: rec.fence, until: rec.leaseUntil };
      break;
    case 'heartbeat':
      if (holdsLease(job, rec)) job.lease.until = rec.leaseUntil;
      break;
    case 'complete':
      if (!holdsLease(job, rec)) break;
      state.completionSeq += 1;
      job.status = 'done';
      job.lease = null;
      job.result = rec.result ?? null;
      j
... [843 more characters in steps.jsonl]
```

```text
(no output)
```

## 37. Reasoning

I'm checking whether `dead` and `cancel` should be allowed at all, since they currently apply no matter the job's status. A stale `dead` from the reaper could flip a finished job to dead, so I'm planning a status guard: `dead` only from leased, and `cancel` only from ready or leased.

I'm deciding that the guard for `dead` and `cancel` should key off the job's status, so terminal jobs (done, dead, cancelled) are simply ignored for both. I'm also weighing whether `requeue` needs a guard too, but since it's already checked under the lock when applied to dead jobs, I'll leave it alone.



## 38. edit

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\src\\state.mjs",
  "oldString": "    case 'cancel':\n      job.status",
  "newString": "    case 'cancel':\n      if (job.status !== 'ready' && job.status !== 'leased') break;\n      job.status"
}
```

```text
Edited src/state.mjs (1 replacement)
```

## 39. Reasoning

Checking the dead-record handling first: it only applies when the status is ready or leased, and that looks right. Now moving to store.mjs, where catchUp is reading the WAL header and deciding whether to reset or throw on a size mismatch, then scanning from the saved offset.

Still writing the catch-up logic in store.mjs: a generation change resets state before scanning, but if a corruption error is thrown mid-scan the partial state could be reused on the next call. So I'm planning to clear the generation on any failure during the scan, so the next call starts over and throws again.

Now I'm working through how maybeCompact decides when to run: it fires once the log has grown past the threshold and the growth since the last snapshot is at least the snapshot's size. The retry concern is what comes next: if automatic compaction keeps failing, every write would retry it and sleep, so I'm looking at adding a backoff before the next attempt.

I'm weighing whether to throttle automatic compaction retries after a failure, since retrying on every write could add latency. A throttle might hide the case where the blocker is removed and the very next write should succeed, so I'm leaning toward retrying each write but keeping the retry budget small.

Trimming the retry budget for compaction to about 60ms, since a blocked backup tool would otherwise add latency to every write. Next I'm moving on to the rest of the store module, wrapping up `compact()` and adding a `refresh()` method.



## 40. shell (exit 0)

```text
cd src; $c = Get-Content store.mjs -Raw
$a = $c.IndexOf('  catchUp() {'); $b = $c.IndexOf('  /**', $a)
$new = @'
  catchUp() {
    const header = this.wal.readHeader();
    const size = this.ops.size(this.wal.file);
    // A different generation means another process compacted: that file is a
    // new history, whatever its size, and has to be read from its start.
    if (this.generation === null || header.generation !== this.generation) {
      this.state = createState();
      this.offset = HEADER_SIZE;
      this.snapshotBytes = 0;
      this.generation = header.generation;
    } else if (size < this.offset) {
      this.generation = null;
      throw new CorruptLogError(`${this.wal.file}: log is ${size} bytes, shorter than the ${this.offset} already read`, {
        offset: size,
        reason: 'shrunk',
      });
    }

    let tail;
    try {
      ({ tail } = this.wal.scanFrom(this.offset, (frames, end) => {
        for (const frame of frames) {
          applyRecord(this.state, frame.record);
          if (frame.record.t === 'snapshot') this.snapshotBytes = frame.size;
        }
        this.offset = end;
      }));
    } catch (err) {
      // The state is only part of the log now. Start again next time, and fail
      // the same way again, rather than carry on from a partial picture.
      this.generation = null;
      throw err;
    }

    if (tail) {
      // We hold the lock, so nobody is writing: this is the remains of a write
      // that never finished. Nothing was acknowledged from it. Cut it off so
      // that it cannot sit in front of what is written next.
      this.wal.truncate(this.offset);
      this.tornTailsDropped += 1;
      log.warn('removed incomplete tail', { offset: this.offset, reason: tail.reason, bytes: tail.bytes });
    }
  }

  /** Must be called inside withLock(). */
  append(records, options) {
    this.offset = this.wal.append(records, { ...options, at: this.offset });
    // Apply what a reader of the log will see, not 
... [1812 more characters in steps.jsonl]
```

```text
(no output)
```

## 41. Reasoning

I'm treating the in-memory snapshot as the roundtrip point and putting that check in the compactor. Next I'm looking at the case where compact() in Store throws after the rename already succeeded, and I've noted that as covered. I also need to confirm that compactLog takes the generation, which it does. If the temp file gets written but the rename fails, I'll clean up the temp. Then I'm moving on to the compactor and retrying the rename with backoff.

I'm now setting the retry to a bounded budget for EPERM, EBUSY, and EACCES errors, using sleepSync from the clock to wait between attempts.



## 42. write

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\src\\compactor.mjs",
  "content": "// Replaces the log with a one-record log holding the current state. Runs under\n// the queue lock. docs/compaction.md describes the protocol.\n\nimport path from 'node:path';\nimport { sleepSync } from './clock.mjs';\nimport { encodeFrame, encodeHeader, scanFrames } from './frame.mjs';\nimport { hit } from './failpoints.mjs';\nimport { buildSnapshot } from './snapshot.mjs';\n\n// Windows refuses to replace a file that anyone has open, however briefly: an\n// operator's tool, a backup, a virus scanner. Those holds are normally short, so\n// the rename is tried a few times. If the file stays held the compaction fails,\n// and the next one starts clean.\nconst HELD = new Set(['EPERM', 'EBUSY', 'EACCES']);\nconst RENAME_TRIES = 8;\nconst RENAME_WAIT_MS = 4;\n\nexport function compactionTempPath(walFile) {\n  return `${walFile}.compact`;\n}\n\nfunction renameWhenFree(ops, from, to) {\n  for (let tries = 1; ; tries += 1) {\n    try {\n      ops.rename(from, to);\n      return;\n    } catch (err) {\n      if (!HELD.has(err.code) || tries >= RENAME_TRIES) throw err;\n      sleepSync(RENAME_WAIT_MS * tries);\n    }\n  }\n}\n\n/**\n * Writes and installs the next generation of the log. Returns the snapshot and\n * the size of the new file. If this throws, the old log is still in place.\n */\nexport function compactLog({ wal, ops, state, generation, now, config }) {\n  const nextGeneration = generation + 1;\n  const built = buildSnapshot(state, now, config);\n  const frame = encodeFrame(built);\n  const bytes = Buffer.concat([encodeHeader(nextGeneration), frame]);\n  const tempPath = compactionTempPath(wal.file);\n\n  try {\n    // We hold the queue lock, so any temp file already here was left by a\n    // compaction that died. It is not ours to keep.\n    ops.unlink(tempPath);\n    ops.create(tempPath);\n    ops.writeAt(tempPath, bytes, 0);\n    // Durable before it takes the log's name: a
... [849 more characters in steps.jsonl]
```

```text
Wrote file successfully: src/compactor.mjs
```

## 43. Reasoning

I'm checking the error path around the rename: the temp file cleanup is harmless even if it doesn't exist, but if syncing the directory fails after the rename, the throw happens even though the log was already replaced, which I'm treating as acceptable since the generation counter lets state recover. I also removed the sync on the WAL file after the rename, since nothing is pending there.

Now I'm moving on to the queue module. The enqueue path will do a quick lookup first, then take the lock and recheck before appending. Claim will refresh the store and pick a ready job, then re-pick under the lock to assign the next fence value. Heartbeat is next.

Next I'm looking at the complete path: take the lock, check the job is still leased to this fence token, append the sync'd record, and build the receipt before compaction runs, since a just-completed job could be pruned right away if retention is zero. The stale-lease check will be a shared helper that reports the job's current fence on mismatch, and fail follows the same pattern with a dead-letter branch that triggers compaction.

I'm now going through the reap, reclaim, cancel and result paths: reap keeps its pre-check outside the lock and recomputes inside it, reclaimWorker collects a worker's leased jobs under the lock and returns their ids and statuses, and getResult finishes out of the stream I'm working on, with what it returns still being checked.

I'm wrapping up the completions query: it will filter done jobs with a completion sequence past the cursor, sort them ascending, and cap the count with the limit. Each entry carries its seq, id, token, result and completion time, with the result copied out. Older snapshot jobs without a sequence number will simply be left out. Last, I'm checking whether heartbeat should also return after compaction.

Next I'm going through the enqueue, claim and heartbeat paths in queue.mjs, and I'm settling on calling maybeCompact after every append so compaction stays consistent. The other handlers stay as they are, and I'm writing the file out in full.



## 44. shell (exit 0)

```text
cd src; $c = Get-Content queue.mjs -Raw
$a = $c.IndexOf('  #requireLease(job, token) {'); $b = $c.IndexOf('  #newEnqueue')
$c = $c.Substring(0,$a) + @'
  #requireLease(job, token) {
    if (job.status !== 'leased' || job.fence !== token) {
      throw new StaleLeaseError(job.id, token, job.fence);
    }
  }

  #receipt(job, outcome) {
    return {
      id: job.id,
      outcome,
      token: job.fence,
      result: structuredClone(job.result),
      completedAt: job.completedAt,
      completionSeq: job.completionSeq,
    };
  }

'@ + $c.Substring($b)
# enqueue
$a = $c.IndexOf('  enqueue(type, payload, options = {}) {'); $b = $c.IndexOf('  /**', $a)
$c = $c.Substring(0,$a) + @'
  enqueue(type, payload, options = {}) {
    const key = options.key ?? null;
    if (key) {
      this.store.refresh();
      const seen = lookupKey(this.store.state, key, this.clock.now(), this.config.idempotencyTtlMs);
      if (seen) return { ...seen, deduped: true };
    }
    hit('enqueue.before-lock', { key });
    return this.store.withLock(() => {
      const now = this.clock.now();
      // Another process may have used the key since the check above.
      const seen = key ? lookupKey(this.store.state, key, now, this.config.idempotencyTtlMs) : null;
      if (seen) return { ...seen, deduped: true };
      const record = this.#newEnqueue(type, payload, options, now);
      this.store.append([record]);
      this.store.maybeCompact();
      return { id: record.id, status: 'ready', deduped: false };
    });
  }

'@ + $c.Substring($b)
# claim .. reapExpired
$a = $c.IndexOf('  claim(worker'); $b = $c.IndexOf('  /** Stops a job that has not finished')
$c = $c.Substring(0,$a) + @'
  claim(worker, { leaseMs = this.config.leaseMs, types = null } = {}) {
    this.store.refresh();
    if (!pickNextReady(this.store.state, this.clock.now(), types)) return null;
    hit('claim.before-lock', { worker });
    return this.store.withLock(() => {
      const now = this.clock.now();
      // Choose a
... [6641 more characters in steps.jsonl]
```

```text
queue.mjs:19:  heartbeatRecord,
queue.mjs:20:  releaseRecord,
queue.mjs:170:      this.store.append([heartbeatRecord({ id, fence: token, leaseUntil, at: now })]);
```

## 45. Reasoning

I'm checking whether the file uses CRLF line endings before trusting the `$c.Replace` with the backtick-n, and I want to look at the import block order too. I also need to see whether `Set-Content -NoNewline` is adding line-ending noise, which I'll confirm later with `git diff --stat`. On the claim side, `attempt: job.attempts + 1` is computed before the append, so it matches the attempts count after the change.



## 46. shell (exit 0)

```text
git diff --stat; Select-String -Path src\queue.mjs -Pattern "^import|^  [a-zA-Z]+Record,$" | % { $_.Line }; (Get-Content src\queue.mjs -Raw).Contains("`r`n")
```

```text
src/compactor.mjs |  47 +++++++++++++++---
 src/errors.mjs    |   7 +++
 src/frame.mjs     |  38 +++++++++++----
 src/index.mjs     |   1 +
 src/queue.mjs     | 141 +++++++++++++++++++++++++++++++++++++++++++-----------
 src/records.mjs   |   6 ++-
 src/retention.mjs |   2 +-
 src/snapshot.mjs  |  55 ++++++++++++---------
 src/state.mjs     |  22 ++++++---
 src/store.mjs     |  52 +++++++++++++++-----
 src/wal.mjs       |  74 ++++++++++++++++++++--------
 11 files changed, 336 insertions(+), 109 deletions(-)
import { computeBackoff } from './backoff.mjs';
import { resolveOptions } from './config.mjs';
import { InvalidTransitionError, StaleLeaseError, UnknownJobError } from './errors.mjs';
import { hit } from './failpoints.mjs';
import { lookupKey } from './idempotency.mjs';
import { expiredLeases, pickNextReady } from './lease.mjs';
import { computeMetrics } from './metrics.mjs';
import {
  cancelRecord,
  claimRecord,
  completeRecord,
  deadRecord,
  enqueueRecord,
  expireRecord,
  failRecord,
  heartbeatRecord,
  releaseRecord,
  requeueRecord,
import { Store } from './store.mjs';
False
```

## 47. Reasoning

I'm checking the line endings in the retention file, where the two-line diff is most likely just a trailing newline, and confirming that Set-Content adds one, so that's fine. Next I'm going through the inspect and describeRecord additions and the PowerLossFileOps create and unlink calls, with the unlink on the temp path still being looked at.

Next I'm moving on to the worker runner and the pool.



## 48. shell (exit 0)

```text
cd src\worker
@'
// JobRunner: the loop a worker process runs. Claim a job, run its handler with a
// heartbeat going, then record the outcome.

import { sleep } from '../clock.mjs';
import { CorruptLogError, LockTimeoutError, StaleLeaseError, UnknownJobError, WalqError } from '../errors.mjs';
import { hit } from '../failpoints.mjs';
import { JOB_COMPLETED, JOB_FAILED, JOB_FENCED, JOB_STARTED, WORKER_ERROR } from './protocol.mjs';
import { runWithTimeout } from './registry.mjs';

const RECORD_RETRY_MIN_MS = 10;
const RECORD_RETRY_MAX_MS = 500;

// A problem with the call itself, which trying again cannot cure. Anything else
// (a busy lock, a disk that hiccuped) is worth another try.
function cannotRetry(err) {
  return err instanceof WalqError && !(err instanceof LockTimeoutError) && !(err instanceof CorruptLogError);
}

export class JobRunner {
  constructor({ queue, workerId, handlers, leaseMs, heartbeatMs, pollMs = 20, types = null, emit = () => {} }) {
    this.queue = queue;
    this.workerId = workerId;
    this.handlers = handlers;
    this.leaseMs = leaseMs ?? queue.config.leaseMs;
    this.heartbeatMs = heartbeatMs ?? Math.max(10, Math.floor(this.leaseMs / 3));
    this.pollMs = pollMs;
    this.types = types;
    this.emit = emit;
    this.stopping = false;
  }

  stop() {
    this.stopping = true;
  }

  async run() {
    while (!this.stopping) {
      const job = this.#claimNext();
      if (job) await this.execute(job);
      else await sleep(this.pollMs);
    }
  }

  #claimNext() {
    try {
      return this.queue.claim(this.workerId, { leaseMs: this.leaseMs, types: this.types });
    } catch (err) {
      if (!(err instanceof WalqError)) throw err;
      this.emit({ kind: WORKER_ERROR, error: err.message });
      return null;
    }
  }

  async execute(job) {
    const { id, token } = job;
    hit('job.before-handler', { id });
    this.emit({ kind: JOB_STARTED, id, attempt: job.attempt, token });

    const abort = new AbortController();
    cons
... [2414 more characters in steps.jsonl]
```

```text
(no output)
```

## 49. Reasoning

I'm checking the worker's error path, and I'm noting that a WORKER_ERROR gets emitted on every retry, which is acceptable. A result that is too large to store throws RecordTooLargeError, which isn't retryable. That sends the job to cannotRetry, where it only emits an error and returns, so the lease expires and the job reruns until its attempts run out. I'm thinking it would be better to treat an oversized result as a failure of the job.

I'm weighing a fix for the too-large case: when `complete` throws RecordTooLargeError, the job should go through the fail path rather than being left to expire and rerun. Wrapping the complete call so it can divert to `fail` looks workable, though it would emit the wrong event kind unless the recording step can take an override.

I'm planning to have the record step hand back a RecordTooLargeError from cannotRetry, so execute can then route the attempt through the fail path. I also want to guard against results that can't be JSON-serialized, since that TypeError would currently retry forever, so I'd check serialization in the runner before committing.

I'm going to make the runner check that the result can be JSON-serialized before committing it, so a circular or BigInt result fails the attempt instead of retrying forever.



## 50. shell (exit 0)

```text
cd src\worker
$c = Get-Content runner.mjs -Raw
$c = $c.Replace("import { CorruptLogError, LockTimeoutError, StaleLeaseError, UnknownJobError, WalqError } from '../errors.mjs';","import {`n  CorruptLogError,`n  LockTimeoutError,`n  RecordTooLargeError,`n  StaleLeaseError,`n  UnknownJobError,`n  WalqError,`n} from '../errors.mjs';")
$c = $c.Replace(@'
          abort,
        );
      } catch (err) {
'@, @'
          abort,
        );
        // A result that cannot be written down fails the attempt now, rather
        // than being retried for ever below.
        JSON.stringify(result ?? null);
      } catch (err) {
'@)
$c = $c.Replace(@'
      await this.#record(id, () => this.queue.complete(id, token, result), JOB_COMPLETED);
      hit
'@, @'
      const refused = await this.#record(id, () => this.queue.complete(id, token, result), JOB_COMPLETED);
      if (refused instanceof RecordTooLargeError) {
        await this.#record(id, () => this.queue.fail(id, token, refused), JOB_FAILED, refused);
      }
      hit
'@)
$c = $c.Replace("        if (cannotRetry(err)) return;","        if (cannotRetry(err)) return err;")
$c = $c.Replace("        this.emit({ kind, id, error: cause?.message, outcome: receipt?.outcome });`n        return;","        this.emit({ kind, id, error: cause?.message, outcome: receipt?.outcome });`n        return null;")
$c = $c.Replace("          this.emit({ kind: JOB_FENCED, id });`n          return;","          this.emit({ kind: JOB_FENCED, id });`n          return null;")
$c | Set-Content runner.mjs -NoNewline
Select-String runner.mjs -Pattern 'return' | % Line
```

```text
return err instanceof WalqError && !(err instanceof LockTimeoutError) && !(err instanceof CorruptLogError);
      return this.queue.claim(this.workerId, { leaseMs: this.leaseMs, types: this.types });
      return null;
        return;
        return null;
          return null;
        if (cannotRetry(err)) return err;
```

## 51. Reasoning

I'm checking the execute path's failure handling, including the early return after recording the failure, and it looks fine. I've also confirmed the fenced-worker case discards its result as intended. Next I'm turning to the pool, covering unique worker IDs, reclaiming work when a worker exits, and retrying pending jobs.



## 52. shell (exit 0)

```text
cd src\worker
$c = Get-Content pool.mjs -Raw
$c = $c.Replace("import { fork } from 'node:child_process';","import { fork } from 'node:child_process';`nimport { randomBytes } from 'node:crypto';")
$c = $c.Replace("    this.incarnation = 0;`n","    this.incarnation = 0;`n    // Worker ids are shared by everything using the queue directory, and a reclaim\n    // acts on an id, so ids must never collide with another pool's.`n    this.poolId = `${process.pid}-${randomBytes(3).toString('hex')}`;`n    this.unreclaimed = new Set();`n")
$c = $c.Replace("const workerId = `w`${this.incarnation}`;","const workerId = `w`${this.poolId}-`${this.incarnation}`;")
$c = $c.Replace(@'
  #reap() {
    try {
      this.queue.reapExpired();
    } catch (err) {
      this.emit('error-event', err);
    }
  }
'@, @'
  #reap() {
    try {
      this.queue.reapExpired();
    } catch (err) {
      this.emit('error-event', err);
    }
    for (const workerId of [...this.unreclaimed]) this.#reclaim(workerId);
  }

  /**
   * A worker that has exited holds nothing any more, so its jobs go back at once
   * instead of waiting for their leases. If the queue is busy the reaper tries
   * again; the lease expiring is the backstop.
   */
  #reclaim(workerId, reason = 'worker exited') {
    try {
      this.queue.reclaimWorker(workerId, { reason });
      this.unreclaimed.delete(workerId);
    } catch (err) {
      this.unreclaimed.add(workerId);
      this.emit('error-event', err);
    }
  }
'@)
$c = $c.Replace(@'
    log.info('worker exited', { workerId, code, signal, stopping: this.stopping });
    if (this.stopping) return;
'@, @'
    log.info('worker exited', { workerId, code, signal, stopping: this.stopping });
    this.#reclaim(workerId, `worker exited (${signal ?? `code ${code}`})`);
    if (this.stopping) return;
'@)
$c | Set-Content pool.mjs -NoNewline
Select-String pool.mjs -Pattern 'poolId|workerId = ' | % Line
```

```text
this.poolId = ${process.pid}-;
    const workerId = `w${this.incarnation}`;
```

## 53. Reasoning

The PowerShell escaping broke my replacements, so I'll fix those edits by hand with the edit tool instead.



## 54. shell (exit 0)

```text
cd src\worker; Select-String pool.mjs -Pattern 'poolId|workerId = |unreclaimed' -Context 1,1 | % { $_.Line }; Get-Content pool.mjs | Select -Skip 30 -First 22
```

```text
this.poolId = ${process.pid}-;
    this.unreclaimed = new Set();
    for (const workerId of [...this.unreclaimed]) this.#reclaim(workerId);
      this.unreclaimed.delete(workerId);
      this.unreclaimed.add(workerId);
    const workerId = `w${this.incarnation}`;
  }) {
    super();
    this.options = { dir, handlers, leaseMs, heartbeatMs, pollMs, types, queue };
    this.size = size;
    this.reapMs = reapMs ?? Math.max(20, Math.floor(leaseMs / 2));
    this.env = env;
    this.maxRespawns = maxRespawns;
    this.children = new Map();
    this.incarnation = 0;
    // Worker ids are shared by everything using the queue directory, and a reclaim\n    // acts on an id, so ids must never collide with another pool's.
    this.poolId = ${process.pid}-;
    this.unreclaimed = new Set();
    this.respawns = 0;
    this.stopping = false;
    this.reaper = null;
    this.queue = null;
  }

  start() {
    this.queue = openQueue(this.options.dir, this.options.queue);
    for (let i = 0; i < this.size; i += 1) this.#spawn();
    this.reaper = setInterval(() => this.#reap(), this.reapMs);
```

## 55. edit

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\src\\worker\\pool.mjs",
  "oldString": "    // Worker ids are shared by everything using the queue directory, and a reclaim\\n    // acts on an id, so ids must never collide with another pool's.\n    this.poolId = ${process.pid}-;",
  "newString": "    // Worker ids are shared by everything using the queue directory, and a reclaim\n    // acts on an id, so ids must never collide with another pool's.\n    this.poolId = `${process.pid}-${randomBytes(3).toString('hex')}`;"
}
```

```text
Edited src/worker/pool.mjs (1 replacement)
```

## 56. edit

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\src\\worker\\pool.mjs",
  "oldString": "    const workerId = `w${this.incarnation}`;",
  "newString": "    const workerId = `w${this.poolId}-${this.incarnation}`;"
}
```

```text
Edited src/worker/pool.mjs (1 replacement)
```

## 57. shell (exit 0)

```text
cd src\worker; Get-Content pool.mjs | Select -Skip 50 -First 70
```

```text
this.queue = openQueue(this.options.dir, this.options.queue);
    for (let i = 0; i < this.size; i += 1) this.#spawn();
    this.reaper = setInterval(() => this.#reap(), this.reapMs);
    return this;
  }

  #reap() {
    try {
      this.queue.reapExpired();
    } catch (err) {
      this.emit('error-event', err);
    }
    for (const workerId of [...this.unreclaimed]) this.#reclaim(workerId);
  }

  /**
   * A worker that has exited holds nothing any more, so its jobs go back at once
   * instead of waiting for their leases. If the queue is busy the reaper tries
   * again; the lease expiring is the backstop.
   */
  #reclaim(workerId, reason = 'worker exited') {
    try {
      this.queue.reclaimWorker(workerId, { reason });
      this.unreclaimed.delete(workerId);
    } catch (err) {
      this.unreclaimed.add(workerId);
      this.emit('error-event', err);
    }
  }

  #spawn() {
    this.incarnation += 1;
    const workerId = `w${this.poolId}-${this.incarnation}`;
    const child = fork(CHILD_PATH, [JSON.stringify({ ...this.options, workerId })], {
      env: { ...process.env, ...this.env },
      silent: true,
      windowsHide: true,
    });
    child.stdout.resume();
    child.stderr.on('data', (chunk) => this.emit('stderr', chunk.toString()));
    child.on('message', (message) => this.emit('message', message));
    child.on('error', (err) => this.emit('error-event', err));
    child.on('exit', (code, signal) => this.#onExit(
... [980 more characters in steps.jsonl]
```

## 58. Reasoning

Checking the stop sequence: the queue closes only after all exits finish, so the reaper's reclaim calls should not hit a closed queue in practice. I'm also noting that emitting 'error-event' with no listener is harmless, since only the 'error' event throws when unhandled.

I'm checking the remaining edge cases: whether a null queue could matter, whether an exit while stopping is harmless, and whether drain's stats check holds. The reaper's retry on unreclaimed jobs looks fine, and the worker ids should be unique, so the next step is the CLI tail and inspect describeRecord.



## 59. shell (exit 0)

```text
cd src
$c = Get-Content cli.mjs -Raw
$a = $c.IndexOf('// Keeps a read handle'); $b = $c.IndexOf('const [command, dir, id]')
$new = @'
// Follows the log without keeping it open between looks. Windows will not let
// compaction replace a file that anyone has open, so a follower that held a handle
// would stop the log from ever being compacted. Each look opens, reads and closes,
// and starts again from the top when the generation changes.
function tail(dir) {
  const file = path.join(dir, WAL_FILE);
  let generation = null;
  let offset = HEADER_SIZE;
  const look = () => {
    let bytes;
    try {
      const fd = fs.openSync(file, 'r');
      try {
        const head = Buffer.alloc(HEADER_SIZE);
        fs.readSync(fd, head, 0, HEADER_SIZE, 0);
        const header = decodeHeader(head, file);
        if (generation !== null && header.generation !== generation) {
          console.log(`-- compacted: generation ${header.generation}`);
          offset = HEADER_SIZE;
        }
        generation = header.generation;
        const size = fs.fstatSync(fd).size;
        if (size <= offset) return;
        bytes = Buffer.alloc(size - offset);
        fs.readSync(fd, bytes, 0, bytes.length, offset);
      } finally {
        fs.closeSync(fd);
      }
      const { frames, end } = scanFrames(bytes, offset, { final: false });
      for (const frame of frames) console.log(describeRecord(frame.record));
      offset = end;
    } catch (err) {
      console.error(`tail: ${err.message}`);
      process.exitCode = 1;
      clearInterval(timer);
    }
  };
  const timer = setInterval(look, 200);
  process.on('SIGINT', () => clearInterval(timer));
}

'@
$c = $c.Substring(0,$a) + $new + $c.Substring($b)
$c = $c.Replace("import { HEADER_SIZE, scanFrames } from './frame.mjs';","import { decodeHeader, HEADER_SIZE, scanFrames } from './frame.mjs';")
$c = $c.Replace("//   node src/cli.mjs tail <dir>           follow the log, keeping it open","//   node src/cli.mjs tail <dir>           f
... [346 more characters in steps.jsonl]
```

```text
inspect.mjs:32:    case 'release':
```

## 60. Reasoning

I'm checking the release line's escaping, then looking at the snapshot describe output, which is fine. In `look` with `final:false`, a bad checksum at the tail counts as a partial tail rather than an error, while mid-file corruption throws and stops the tail loop, so that's okay. On a compacted log, the tail just reprints the snapshot record, also fine.



## 61. shell (exit 0)

```text
cd src; Get-Content inspect.mjs | Select -Skip 28 -First 10
```

```text
return `${record.t} ${record.id} fence=${record.fence} delayMs=${record.delayMs}`;
    case 'cancel':
      return `cancel ${record.id} fence=${record.fence}`;
    case 'release':
      return 
elease ${record.id} fence=${record.fence} reason=${record.error};
    case 'dead':
      return `dead ${record.id} fence=${record.fence} error=${record.error}`;
    case 'snapshot':
      return `snapshot jobs=${record.jobs.length} seq=${record.seq}`;
```

## 62. shell (exit 0)

```text
cd src; $c = Get-Content inspect.mjs -Raw
$c = $c -replace "      return \r?\n\release [^\n]*\n", "      return ``release `${record.id} fence=`${record.fence} reason=`${record.error}``;`n"
$c | Set-Content inspect.mjs -NoNewline; Get-Content inspect.mjs | Select -Skip 30 -First 4; node --check inspect.mjs; node --check cli.mjs; node --check queue.mjs; node --check worker/runner.mjs; node --check worker/pool.mjs
```

```text
return `cancel ${record.id} fence=${record.fence}`;
    case 'release':
      return 
elease ${record.id} fence=${record.fence} reason=${record.error};
C:\invoice-work\c13dbd4c\workspace\src\inspect.mjs:34
elease ${record.id} fence=${record.fence} reason=${record.error};
       ^

SyntaxError: Unexpected identifier '$'
    at checkSyntax (node:internal/main/check_syntax:72:5)

Node.js v24.7.0
```

## 63. Said

Shell escaping is fighting me; I'll use the edit tool.

## 64. read

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\src\\inspect.mjs",
  "offset": 30,
  "limit": 6
}
```

```text
Read file C:\invoice-work\c13dbd4c\workspace\src\inspect.mjs, lines 30-35
30:     case 'cancel':
31:       return `cancel ${record.id} fence=${record.fence}`;
32:     case 'release':
33:       return elease ${record.id} fence=${record.fence} reason=${record.error};
34:     case 'dead':
35:       return `dead ${record.id} fence=${record.fence} error=${record.error}`;
[Output truncated. Continue reading with offset: 36]
```

## 65. edit (error)

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\src\\inspect.mjs",
  "oldString": "      return elease ${record.id} fence=${record.fence} reason=${record.error};",
  "newString": "      return `release ${record.id} fence=${record.fence} reason=${record.error}`;"
}
```

```text
{"type":"tool.execution","message":"Could not find oldString in C:\\invoice-work\\c13dbd4c\\workspace\\src\\inspect.mjs. It must match exactly, including whitespace and indentation."}
```

## 66. shell (exit 1)

```text
cd src; foreach($f in Get-ChildItem -Recurse -Filter *.mjs){ node --check $f.FullName }; cd ..; node --test --test-reporter=tap test/*.mjs 2>&1 | Select-String -Pattern '^\s*not ok|^# (pass|fail)'
```

```text
C:\invoice-work\c13dbd4c\workspace\src\inspect.mjs:34
elease ${record.id} fence=${record.fence} reason=${record.error};
       ^

SyntaxError: Unexpected identifier '$'
    at checkSyntax (node:internal/main/check_syntax:72:5)

Node.js v24.7.0

not ok 1 - test\\backoff-schedule.mjs
not ok 2 - test\\compaction.mjs
not ok 3 - test\\failpoints.mjs
not ok 5 - test\\leases.mjs
not ok 6 - test\\queue-basics.mjs
not ok 7 - test\\recovery.mjs
not ok 8 - test\\worker-pool.mjs
# pass 6
# fail 7



Exited with code 1
```

## 67. Reasoning

I suspect the file has a stray carriage return character, probably from a `\r` in my replacement regex being read literally. I'll rewrite the entire line with a Node script to get rid of it.



## 68. shell (exit 0)

```text
cd src; @'
const fs = require('fs');
const lines = fs.readFileSync('inspect.mjs', 'utf8').split('\n');
const i = lines.findIndex((l) => l.includes("case 'release':"));
lines.splice(i + 1, 2, '      return `release ${record.id} fence=${record.fence} reason=${record.error}`;');
fs.writeFileSync('inspect.mjs', lines.join('\n'));
'@ | node -; Get-Content inspect.mjs | Select -Skip 30 -First 5; foreach($f in Get-ChildItem -Recurse -Filter *.mjs){ node --check $f.FullName }
```

```text
return `cancel ${record.id} fence=${record.fence}`;
    case 'release':
      return `release ${record.id} fence=${record.fence} reason=${record.error}`;
      return `dead ${record.id} fence=${record.fence} error=${record.error}`;
    case 'snapshot':
```

## 69. Said

Off by one — I removed the `case 'dead':` line. Restoring it.

## 70. edit

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\src\\inspect.mjs",
  "oldString": "reason=${record.error}`;\n      return `dead",
  "newString": "reason=${record.error}`;\n    case 'dead':\n      return `dead"
}
```

```text
Edited src/inspect.mjs (1 replacement)
```

## 71. shell (exit 0)

```text
cd src; foreach($f in Get-ChildItem -Recurse -Filter *.mjs){ node --check $f.FullName }; cd ..; node --test --test-reporter=tap test/*.mjs 2>&1 | Select-String -Pattern '^\s*not ok|^# (pass|fail)'; git diff src/worker/pool.mjs src/cli.mjs | Select-String '^\+.*\$\{' | Select -First 3
```

```text
# pass 42
# fail 0
+          console.log(`-- compacted: generation ${header.generation}`);
+      console.error(`tail: ${err.message}`);
+    this.poolId = `${process.pid}-${randomBytes(3).toString('hex')}`;
```

## 72. Reasoning

All 42 tests pass now, including the two that were failing before. Next I want to confirm that the other PowerShell writes didn't corrupt anything, and that the `Replace` edits in the runner actually went in with the multiline imports.



## 73. shell (exit 0)

```text
cd src\worker; Get-Content runner.mjs | Select -First 20; Select-String runner.mjs -Pattern 'refused|JSON.stringify|return null' | % Line
```

```text
// JobRunner: the loop a worker process runs. Claim a job, run its handler with a
// heartbeat going, then record the outcome.

import { sleep } from '../clock.mjs';
import {
  CorruptLogError,
  LockTimeoutError,
  RecordTooLargeError,
  StaleLeaseError,
  UnknownJobError,
  WalqError,
} from '../errors.mjs';
import { hit } from '../failpoints.mjs';
import { JOB_COMPLETED, JOB_FAILED, JOB_FENCED, JOB_STARTED, WORKER_ERROR } from './protocol.mjs';
import { runWithTimeout } from './registry.mjs';

const RECORD_RETRY_MIN_MS = 10;
const RECORD_RETRY_MAX_MS = 500;

// A problem with the call itself, which trying again cannot cure. Anything else
      return null;
        JSON.stringify(result ?? null);
      const refused = await this.#record(id, () => this.queue.complete(id, token, result), JOB_COMPLETED);
      if (refused instanceof RecordTooLargeError) {
        await this.#record(id, () => this.queue.fail(id, token, refused), JOB_FAILED, refused);
        return null;
          return null;
```

## 74. Reasoning

Next I'm going through the remaining concerns one by one, starting with the torn-tail truncation and the append position, which look fine. The power-loss model's read path also seems to handle writes past the real file size. Then I'm checking the lock timeout in the worker, which is also fine, and moving on to the last item.

Next I'm checking the remaining edge cases: a missing WAL with leftover compaction files, the rename step during compaction, and the crash point after the WAL is created. Then I'm looking at heartbeat growth and per-write cost, and finally whether an expired lease can still be completed or claimed by another process.

Now I'm going through the last few checks on the queue: whether an expired lease can still be committed, and whether it gets reaped or claimed by someone else. A lease past its deadline can still complete as long as nobody has acted on it yet.

I'm checking the append path's error handling, specifically whether a failure from a failpoint callback could be mistaken for a write that's already synced, and I see the fsync hook sits outside the try block, so that's fine. I'm also confirming the real file truncation and the config, which both look fine, and then I'll check how a corrupt read inside the store lock bubbles up to every caller.

Next I'm checking the lock module, which only supports Windows and macOS and releases its handle after the callback. I'm also considering whether the ID counter stays consistent with the sequence number after a snapshot prunes jobs, and it does, since the snapshot carries the state's seq.

Now I'm weighing the generation-counter edge case: whether two processes could end up with the same generation number over different log files. Concurrent compaction is ruled out by the lock, so I'm turning to how Store.compact() handles the generation it writes.

Next I'm writing the torn-tail test: a partial record gets truncated, then more writes go in, and the store is reopened to confirm the tail was dropped.

Next I'm writing the torn-tail test: a partial record gets truncated, the store is reopened, and a new enqueue should still leave both jobs intact. I'm also covering the bad-checksum tail case, the mid-log corruption check that confirms the file is left unchanged, and a large-log catch-up across two instances in the same process, including a record over 1 MiB and the oversized-payload error.

Now I'm writing the multi-instance tests, starting with a claim race: one instance claims inside the other's lock gap through a failpoint, and the first should come back empty. Then I'm checking that a heartbeat from one instance keeps the lease alive when the other instance reaps, and I'm setting up a stale reap where the holder acts during the reaper's gap.

I'm writing the multi-instance tests now, covering a claim race, a heartbeat keeping a lease alive against another instance's reaper, and a stale reap where the holder acts mid-gap. I'm also planning a case where a second instance's duplicate enqueue gets deduplicated, and a stale token that gets rejected on complete and heartbeat.

I'm working out the test cases for multi-instance behavior, including the case where a snapshot grows past the old log size, so that the other instance has to reset rather than trust its old offset. I'm also planning checks that retry delays survive reopening with the clock advanced, and that compaction keeps attempts, fences, priority, and max attempts intact, plus idempotency keys after pruning.

I'm moving on to the compaction-failure tests now: a leftover temp file from an earlier run, a child process killed at each compaction step under the power-loss model to confirm reopen still works, and a case where the WAL is held open so the rename fails and I can confirm the queue recovers once the handle is closed.

Next I'm writing the completion tests for the receipt behavior: committed, already-committed after compaction and reopen, stale tokens, and unknown jobs after pruning. I'm also covering reclaimWorker, where a released lease goes to dead if attempts are exhausted, and an expired lease can still be committed.

I'm planning the pool crash tests: killing a worker mid-job should let the job rerun right away instead of waiting out the lease, with variations for where the kill lands around the handler, completion, and fsync. I also want to confirm two pools sharing a directory get distinct worker IDs, so a reclaim only touches the dead worker. Then I'll write a runner test where completion throws a lock timeout.

I'm wrapping the runner test around a fake queue whose complete call throws a lock timeout a few times before delegating to the real one, and checking that the result still gets recorded without claiming the next job in between. I'm also covering the fenced case, where a stale completion emits job-fenced. Then I'll look at whether the stress script needs the new RFC checks or just more runs.



## 75. Said

Core tests pass again (42/42, including the two that were failing). I'll start a stress run in the background while I write crash tests.

## 76. shell (exit 0)

```text
New-Item -ItemType Directory -Force C:\invoice-home\c13dbd4c\Temp\opencode\out | Out-Null; node scripts/stress.mjs --seed 1 > C:\invoice-home\c13dbd4c\Temp\opencode\out\s1.txt 2>&1; Get-Content C:\invoice-home\c13dbd4c\Temp\opencode\out\s1.txt | Select-String -Pattern 'PROBLEM|^round|rounds,' | Select -First 40
```

```text
Command moved to the background (shell ID: sh_19681c69e001UNzAKvZaa2Ierk).
Output is streaming to: C:\invoice-home\c13dbd4c\.local\share\opencode\shell\ba863508fa6d62c78e9bf61c0c80057330730e59\sh_19681c69e001UNzAKvZaa2Ierk.out
You will be notified automatically when the command finishes. The notification will include the command's output. Unless the user explicitly asks otherwise, DO NOT poll for completion, even if you need the final result to continue. Repeatedly sleeping and reading or searching the output file is polling, not useful work. You may read the current output if it lets you do useful work now, but do not repeatedly check it while waiting for the command to finish. Keep working on anything that does not depend on the result. If you have nothing else to do, end your response; you will be resumed automatically when the command finishes.
```

## 77. Reasoning

I'm writing tests now, starting with a helper child script for the crash tests that runs a named scenario against a directory. I'm planning it as a generic `crash-child.mjs` taking a directory and an operation, with the parameters passed as JSON.

I'm listing the operations the child helper needs to support, which covers padding jobs, compacting, and a claim-then-complete flow. I'm also planning the failpoints to be set through environment variables and a `runChild` helper that returns the exit info, with the power-loss simulation flag turned on.



## 78. shell (exit 0)

```text
cd test; 
@'
// Runs one queue operation in a process that a failpoint is expected to kill.
//   node crash-child.mjs <dir> <op> [json args]
// Ops: enqueue {n, padding}, compact, claim, complete (claims and completes one job),
//      open (just opens the queue, creating it if need be).

import { openQueue } from '../../src/index.mjs';

const [dir, op, raw] = process.argv.slice(2);
const args = raw ? JSON.parse(raw) : {};
const queue = openQueue(dir, args.options ?? {});

if (op === 'enqueue') {
  for (let i = 0; i < (args.n ?? 1); i += 1) queue.enqueue('x', { i, pad: 'p'.repeat(args.padding ?? 0) }, args.jobOptions);
} else if (op === 'compact') {
  queue.compact();
} else if (op === 'claim') {
  queue.claim('crash-child');
} else if (op === 'complete') {
  const job = queue.claim('crash-child');
  queue.complete(job.id, job.token, { done: true });
}
queue.close();
'@ | Set-Content helpers\crash-child.mjs
@'

/** Runs helpers/crash-child.mjs and resolves with how it ended. */
export function crashChild(t, dir, op, { env = {}, args } = {}) {
  const markers = tempDir(t, 'walq-markers-');
  const child = fork(CHILD, [dir, op, JSON.stringify(args ?? {})], {
    env: { ...process.env, WALQ_FAILPOINT_DIR: markers, ...env },
    silent: true,
  });
  defer(t, () => child.kill());
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  return new Promise((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal, markers, stderr }));
  });
}
'@ | Add-Content helpers\tmp.mjs
$c = Get-Content helpers\tmp.mjs -Raw
$c = $c.Replace("import fs from 'node:fs';`n","import { fork } from 'node:child_process';`nimport fs from 'node:fs';`n")
$c = $c.Replace("import path from 'node:path';`n","import path from 'node:path';`nimport { fileURLToPath } from 'node:url';`n`nconst CHILD = fileURLToPath(new URL('./crash-child.mjs', import.meta.url));`n")
$c | Set-Content helpers\tmp.mjs -NoNewline
node --check helpers\tmp.mjs; Get-Content helpers\tmp
... [23 more characters in steps.jsonl]
```

```text
import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHILD = fileURLToPath(new URL('./crash-child.mjs', import.meta.url));

const cleanups = new WeakMap();
```

## 79. Reasoning

The test command only picks up files directly in test/, so the helpers in the subdirectory won't run, which is fine. Next I'll write the first test, covering recovery and durability, in test/durability.mjs.



## 80. write

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\test\\durability.mjs",
  "file": "C:\\invoice-work\\c13dbd4c\\workspace\\test\\durability.mjs",
  "content": "import assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport { test } from 'node:test';\nimport { CorruptLogError, ManualClock, openQueue, RecordTooLargeError } from '../src/index.mjs';\nimport { encodeFrame } from '../src/frame.mjs';\nimport { crashChild, tempDir } from './helpers/tmp.mjs';\n\nconst POWER_LOSS = { WALQ_SIMULATE_POWER_LOSS: '1' };\n\nfunction seed(t, count = 3) {\n  const dir = tempDir(t);\n  const clock = new ManualClock(1_000);\n  const queue = openQueue(dir, { clock });\n  for (let i = 0; i < count; i += 1) queue.enqueue('x', `job ${i}`);\n  queue.close();\n  return { dir, clock, log: path.join(dir, 'wal.log') };\n}\n\nconst payloads = (queue) => queue.listJobs().map((j) => j.payload);\n\ntest('writes after a cut-off write are not lost behind it (G3)', (t) => {\n  const { dir, clock, log } = seed(t);\n  fs.truncateSync(log, fs.statSync(log).size - 5);\n\n  const first = openQueue(dir, { clock });\n  assert.deepEqual(payloads(first), ['job 0', 'job 1']);\n  first.enqueue('x', 'after');\n  first.close();\n\n  // The old code left the stub in the middle of the log and refused to open here.\n  const second = openQueue(dir, { clock });\n  assert.deepEqual(payloads(second), ['job 0', 'job 1', 'after']);\n});\n\ntest('a tail that fails its checksum is also removed before the next write', (t) => {\n  const { dir, clock, log } = seed(t);\n  const bytes = fs.readFileSync(log);\n  bytes[bytes.length - 2] ^= 0xff;\n  fs.writeFileSync(log, bytes);\n\n  const first = openQueue(dir, { clock });\n  assert.equal(first.stats().tornTailsDropped, 1);\n  first.enqueue('x', 'after');\n  first.close();\n  assert.deepEqual(payloads(openQueue(dir, { clock })), ['job 0', 'job 1', 'after']);\n});\n\ntest('a second process sees the stub removed and carries on (several w
... [6222 more characters in steps.jsonl]
```

```text
Created file successfully: test/durability.mjs
```

## 81. Reasoning

I'm noticing that a stray `appendFileSync` line with an empty string is leftover and should be removed later. Running the tests now would overlap with the background stress run, which has tight 90-second budgets, so contention could cause spurious failures. I'll hold off on running them and write more tests in the meantime.



## 82. write

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\test\\shared-queue.mjs",
  "content": "// Several processes on one queue directory, simulated with several Queue objects\n// in this process and failpoint callbacks that run another queue's call at the\n// exact moment a gap opens between one call's check and its lock.\n\nimport assert from 'node:assert/strict';\nimport { test } from 'node:test';\nimport { clearFailpoints, ManualClock, onFailpoint, openQueue, StaleLeaseError } from '../src/index.mjs';\nimport { tempDir } from './helpers/tmp.mjs';\n\nconst OPTIONS = { backoff: { baseMs: 100, factor: 2, maxMs: 10_000 } };\n\nfunction setup(t, extra = {}) {\n  const clock = new ManualClock(1_000);\n  const dir = tempDir(t);\n  t.after(clearFailpoints);\n  const open = () => openQueue(dir, { clock, ...OPTIONS, ...extra });\n  return { clock, dir, open, a: open(), b: open() };\n}\n\ntest('two processes claiming at once never get the same attempt (G6)', (t) => {\n  const { a, b } = setup(t);\n  const { id } = a.enqueue('x', null);\n  let stolen;\n  onFailpoint('claim.before-lock', () => {\n    clearFailpoints();\n    stolen = b.claim('b');\n  });\n  const mine = a.claim('a');\n  assert.equal(stolen.id, id);\n  assert.equal(mine, null, 'a must not be given a job that b already holds');\n  assert.equal(a.getJob(id).lease.worker, 'b');\n  assert.equal(a.getJob(id).attempts, 1);\n});\n\ntest('a heartbeat from one process keeps the lease alive for another one\\'s reaper (G7)', (t) => {\n  const { a, b, clock } = setup(t);\n  a.enqueue('x', null);\n  const job = a.claim('w', { leaseMs: 500 });\n  clock.advance(400);\n  a.heartbeat(job.id, job.token, { leaseMs: 500 });\n  clock.advance(400);\n  assert.deepEqual(b.reapExpired(), []);\n  assert.equal(b.getJob(job.id).status, 'leased');\n  clock.advance(100);\n  assert.equal(b.reapExpired().length, 1);\n});\n\ntest('a reaper that looked just before a heartbeat does not expire the job (G7)', (t) => {\n  const { a, b, clock } = setu
... [7511 more characters in steps.jsonl]
```

```text
Created file successfully: test/shared-queue.mjs
```

## 83. Reasoning

I'm rechecking the retry key test: the default `week` TTL is 7 days, and with the clock advanced by 2000 plus a week, the elapsed time clears the TTL. Next I'm walking through the "token never issued twice" test with maxAttempts set to 1, where a failure sends the job to dead and a requeue resets attempts and bumps the fence, which checks out at 3 after compaction. Now I'm turning to the compaction tests.

Now I'm checking the retry due time: a failure at 1000 with a 100ms base gives 1100, and the availableAt value reads back correctly after reopening the queue. Next is the attempts-carry test, where the 5th attempt hits the maxAttempts limit and the job goes dead, with the clock jumped forward each round so the job is due.

Next I'm moving on to the completion and RFC tests, and I'm deciding whether to wait for the stress run before writing the file.



## 84. write

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\test\\completion.mjs",
  "content": "// RFC 007: exactly-once completion.\n\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport { test } from 'node:test';\nimport { fileURLToPath } from 'node:url';\nimport {\n  clearFailpoints,\n  JobRunner,\n  ManualClock,\n  LockTimeoutError,\n  openQueue,\n  StaleLeaseError,\n  UnknownJobError,\n  WorkerPool,\n} from '../src/index.mjs';\nimport { encodeFrame, encodeHeader } from '../src/frame.mjs';\nimport { defer, readLedger, tempDir } from './helpers/tmp.mjs';\n\nconst HANDLERS = fileURLToPath(new URL('./helpers/handlers.mjs', import.meta.url));\nconst OPTIONS = { backoff: { baseMs: 100, factor: 2, maxMs: 1_000 } };\n\nfunction setup(t, extra = {}) {\n  const clock = new ManualClock(1_000);\n  const dir = tempDir(t);\n  t.after(clearFailpoints);\n  const open = () => openQueue(dir, { clock, ...OPTIONS, ...extra });\n  return { clock, dir, open, queue: open() };\n}\n\nfunction claimed(queue, worker = 'w') {\n  queue.enqueue('x', null);\n  return queue.claim(worker);\n}\n\ntest('complete returns a receipt, and a repeat returns the same one without writing', (t) => {\n  const { queue, dir, open, clock } = setup(t);\n  const job = claimed(queue);\n  clock.advance(5);\n  const first = queue.complete(job.id, job.token, { a: 1 });\n  assert.deepEqual(first, {\n    id: job.id,\n    outcome: 'committed',\n    token: job.token,\n    result: { a: 1 },\n    completedAt: 1_005,\n    completionSeq: 1,\n  });\n  const size = fs.statSync(path.join(dir, 'wal.log')).size;\n\n  clock.advance(5);\n  const again = queue.complete(job.id, job.token, { a: 'ignored' });\n  assert.deepEqual(again, { ...first, outcome: 'already-committed' });\n  assert.equal(fs.statSync(path.join(dir, 'wal.log')).size, size, 'nothing is written');\n\n  queue.compact();\n  assert.deepEqual(queue.complete(job.id, job.token, 'x'), { ...first, outcome: 'already-committ
... [15490 more characters in steps.jsonl]
```

```text
Created file successfully: test/completion.mjs
```

## 85. Said

Stress is clean on seed 1. Now the new tests.

## 86. shell (exit 1)

```text
node --test --test-reporter=tap test/durability.mjs test/shared-queue.mjs test/completion.mjs 2>&1 | Select-String -Pattern '^\s*not ok|^# (pass|fail)|error:|expected|actual|message' | Select -First 60
```

```text
not ok 4 - getResult says what is known about a job
  error: "Cannot read properties of null (reading 'status')"
not ok 15 - worker killed at job.before-handler=kill: the job runs again at once
  error: |-
  expected: true
  actual: false
not ok 16 - worker killed at job.before-handler=kill with power loss: the job runs again at once
  error: |-
  expected: true
  actual: false
not ok 17 - worker killed at job.after-handler=kill: the job runs again at once
  error: |-
  expected: true
  actual: false
not ok 18 - worker killed at job.after-handler=kill with power loss: the job runs again at once
  error: |-
  expected: true
  actual: false
not ok 19 - worker killed at wal.mid-append\#complete=kill: the job runs again at once
  error: |-
  expected: true
  actual: false
not ok 20 - worker killed at wal.mid-append\#complete=kill with power loss: the job runs again at once
  error: |-
  expected: true
  actual: false
not ok 21 - worker killed at wal.before-append\#complete=kill: the job runs again at once
  error: |-
  expected: true
  actual: false
not ok 22 - worker killed at wal.before-append\#complete=kill with power loss: the job runs again at once
  error: |-
  expected: true
  actual: false
not ok 23 - worker killed at wal.after-write\#complete=kill: the job runs again at once
  error: |-
  expected: true
  actual: false
not ok 24 - worker killed at wal.after-write\#complete=kill with power loss: the job runs again at once
  error: |-
... [743 more characters in steps.jsonl]
```

## 87. Reasoning

I'm checking whether the marker filename matches the key: the rule key turns "wal.mid-append#complete" into "wal.mid-append.complete.hit", and my test's name transform should produce the same thing, though the job.before-handler case is failing. The "expected true, actual false" result makes me suspect either the existence check on the marker file or a SIGKILL, and I'm wondering whether Windows is part of it.

I'm wondering whether the signal reported on exit is what's off, since the child might report SIGKILL differently on Windows. My durability tests already assert a SIGKILL, and the recovery test expects the markers to exist, so I need to check what the pool's child actually exits with.



## 88. shell (exit 0)

```text
node --test test/completion.mjs --test-name-pattern="job.before-handler=kill: the job" 2>&1 | Select-String -Pattern 'assert|expected|actual|completion.mjs:\d+' | Select -First 12; Get-Content test/completion.mjs | Select -Skip 395 -First 3
```

```text
test at test\completion.mjs:86:1
      at TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/completion.mjs:101:40)
test at test\completion.mjs:339:5
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
    assert.ok(exits.some((e) => e.signal === 'SIGKILL'))
      at TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/completion.mjs:352:14)
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
test at test\completion.mjs:339:5
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
    assert.ok(exits.some((e) => e.signal === 'SIGKILL'))

  const { id: slow } = queue.enqueue('slow', { ms: 1_500 });
  steady.start();
```

## 89. Reasoning

I'm finding that the signal reported under fork is probably null with exit code 1, so my assumption about SIGKILL was wrong and I'll drop that assertion and use a marker instead. I'll also loosen the reason regex to match just `worker exited (`, and then fix the getResult test, since queue.claim picks the first ready job, which is still the waiting one.

I'm dropping the last line, since getResult(waiting) comes after waiting has already been claimed and pruned, so it would return null.



## 90. shell (exit 1)

```text
@'
const fs = require('fs');
let s = fs.readFileSync('test/completion.mjs', 'utf8');
s = s.replace("      assert.ok(exits.some((e) => e.signal === 'SIGKILL'));\n", "      assert.ok(exits.some((e) => e.signal === 'SIGKILL' || e.code !== 0), 'a worker died');\n");
s = s.replace(/  assert\.equal\(queue\.getResult\(waiting\)\.status, 'leased'.*\n/, '');
s = s.replace('"error":"worker exited \\\\(SIGKILL\\\\)"/', '"error":"worker exited \\\\([^"]*\\\\)"/');
s = s.replace("  const lastErrors = [];\n  pool.on('exit', () => {\n    queue.refresh?.();\n  });\n", '');
s = s.replace("  assert.deepEqual(lastErrors, []);\n", '');
fs.writeFileSync('test/completion.mjs', s);
let d = fs.readFileSync('test/durability.mjs', 'utf8');
d = d.replace("  fs.appendFileSync(log, ''); // keep mtime semantics simple\n", '');
fs.writeFileSync('test/durability.mjs', d);
'@ | node -; Select-String test/completion.mjs -Pattern 'worker exited' | % Line; node --test --test-reporter=tap test/completion.mjs 2>&1 | Select-String -Pattern '^\s*not ok|^# (pass|fail)|AssertionError|completion.mjs:\d+' | Select -First 30
```

```text
assert.match(log, /"t":"release","id":"j1","fence":1,"error":"worker exited \(SIGKILL\)"/);

not ok 15 - worker killed at job.before-handler=kill: the job runs again at once
  location: 'C:\\invoice-work\\c13dbd4c\\workspace\\test\\completion.mjs:338:5'
  name: 'AssertionError'
    TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/completion.mjs:355:14)
not ok 16 - worker killed at job.before-handler=kill with power loss: the job runs again at once
  location: 'C:\\invoice-work\\c13dbd4c\\workspace\\test\\completion.mjs:338:5'
  name: 'AssertionError'
    TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/completion.mjs:355:14)
not ok 23 - worker killed at wal.after-write\#complete=kill: the job runs again at once
  location: 'C:\\invoice-work\\c13dbd4c\\workspace\\test\\completion.mjs:338:5'
  name: 'AssertionError'
    TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/completion.mjs:354:14)
not ok 25 - worker killed at wal.after-fsync\#complete=kill: the job does not run again
  location: 'C:\\invoice-work\\c13dbd4c\\workspace\\test\\completion.mjs:338:5'
  name: 'AssertionError'
    TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/completion.mjs:351:14)
not ok 26 - worker killed at wal.after-fsync\#complete=kill with power loss: the job does not run again
  location: 'C:\\invoice-work\\c13dbd4c\\workspace\\test\\completion.mjs:338:5'
  name: 'AssertionError'
   
... [902 more characters in steps.jsonl]
```

## 91. shell (exit 0)

```text
node --test test/completion.mjs --test-name-pattern="after-fsync.complete=kill: the job" 2>&1 | Select-String -Pattern 'Error|expected|actual|\+|\-  ' | Select -First 14; Get-Content test/completion.mjs | Select -Skip 349 -First 7
```

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    actual: 1,
    expected: 2,
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    actual: 1,
    expected: 2,
  AssertionError [ERR_ASSERTION]: a worker died
    actual: false,
    expected: true,
  AssertionError [ERR_ASSERTION]: a worker died
    actual: false,
    expected: true,
  AssertionError [ERR_ASSERTION]: a worker died
    actual: false,
      assert.ok(fs.existsSync(path.join(markers, `${name}.hit`)), 'the failpoint fired');
      assert.ok(exits.some((e) => e.signal === 'SIGKILL' || e.code !== 0), 'a worker died');
      const job = queue.getJob(id);
      assert.equal(job.status, 'done');
      assert.equal(job.attempts, reruns ? 2 : 1);
      assert.equal(startsOf(ledger, id), reruns ? 2 : 1);
      assert.ok(Date.now() - started < 15_000, 'did not wait for the 60 s lease');
```

## 92. Reasoning

I'm checking whether the worker exit code and signal can be null, and I want to see what values the exit event actually produces. There's also a 'startsOf' mismatch around line 351 in some cases, so I'll add debug printing for the exits.



## 93. shell (exit 0)

```text
@'
import { WorkerPool, openQueue } from './src/index.mjs';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const dir = fs.mkdtempSync(path.join(os.tmpdir(),'dbg-')); const mk = fs.mkdtempSync(path.join(os.tmpdir(),'dbgm-'));
const q = openQueue(dir); q.enqueue('quick',{});
const pool = new WorkerPool({dir, handlers: path.resolve('test/helpers/handlers.mjs'), size:1, leaseMs:60000, pollMs:5, env:{WALQ_TEST_LEDGER: path.join(dir,'l'), WALQ_FAILPOINT_DIR: mk, WALQ_FAILPOINTS:'wal.after-fsync#complete=kill'}});
pool.on('exit', e=>console.log('exit',e)); pool.on('message', m=>console.log(m.kind,m.id)); pool.on('error-event', e=>console.log('err',e.message));
pool.start(); await pool.drain({timeoutMs:15000}); console.log(q.getJob('j1')); await pool.stop();
'@ | Set-Content dbg.mjs; node dbg.mjs; fs=1; Remove-Item dbg.mjs
```

```text
ready undefined
job-started j1
exit { workerId: 'w55868-45f840-1', code: 1, signal: null }
{
  id: 'j1',
  type: 'quick',
  payload: {},
  key: null,
  priority: 0,
  status: 'done',
  attempts: 1,
  fence: 1,
  maxAttempts: 5,
  availableAt: 1793526602392,
  lease: null,
  result: { echoed: {} },
  lastError: null,
  enqueuedAt: 1793526602392,
  completedAt: 1793526602488,
  completionSeq: 1,
  seq: 1
}
ready undefined
exit { workerId: 'w55868-45f840-2', code: 0, signal: null }
fs=1 : The term 'fs=1' is not recognized as the name of a cmdlet, function, script file, or operable program. Check 
the spelling of the name, or if a path was included, verify that the path is correct and try again.
At line:9 char:41
+ '@ | Set-Content dbg.mjs; node dbg.mjs; fs=1; Remove-Item dbg.mjs
+                                         ~~~~
    + CategoryInfo          : ObjectNotFound: (fs=1:String) [], CommandNotFoundException
    + FullyQualifiedErrorId : CommandNotFoundException
```

## 94. Reasoning

The tests are passing on the first attempt, so the remaining failures look like timing flakiness. The drain call returns once the queue is empty, but the worker's exit event hasn't been delivered yet, so my assertions run too early. I need to wait for the exit event before checking the results, and then look at the rerun cases that are still failing.

The remaining failures seem to be about the rerun cases rather than the first attempt. For the before-handler case, the worker is killed before the handler ever runs, so the ledger should show one start while attempts is 2, which means my expectation is wrong there. The after-write case depends on whether power loss happens, so I'll make the expected reruns follow the powerLoss flag. I also need to update the test to wait for the exit event and set the before-handler start count to 1.



## 95. shell (exit 1)

```text
@'
const fs = require('fs');
let s = fs.readFileSync('test/completion.mjs', 'utf8');
s = s.replace("import { defer, readLedger, tempDir } from", "import { defer, readLedger, tempDir, waitUntil } from");
s = s.replace("  ['job.before-handler=kill', true],\n  ['job.after-handler=kill', true],", "  ['job.before-handler=kill', true, 1],\n  ['job.after-handler=kill', true],");
s = s.replace("  ['wal.after-write#complete=kill', true],", "  // written but not synced: only a power cut takes it back\n  ['wal.after-write#complete=kill', 'power'],");
s = s.replace("for (const [point, reruns] of [", "for (const [point, rerunsSpec, handlerRuns] of [");
s = s.replace("  for (const powerLoss of [false, true]) {\n", "  for (const powerLoss of [false, true]) {\n    const reruns = rerunsSpec === 'power' ? powerLoss : rerunsSpec;\n");
s = s.replace("${reruns ? 'the job runs again at once' : 'the job does not run again'}`", "${reruns ? 'the job runs again at once' : 'the job does not run again'}`");
s = s.replace("      assert.ok(exits.some((e) => e.signal === 'SIGKILL' || e.code !== 0), 'a worker died');", "      await waitUntil(() => exits.length > 0);\n      assert.ok(exits.some((e) => e.signal === 'SIGKILL' || e.code !== 0), 'a worker died');");
s = s.replace("assert.equal(startsOf(ledger, id), reruns ? 2 : 1);", "assert.equal(startsOf(ledger, id), handlerRuns ?? (reruns ? 2 : 1));");
fs.writeFileSync('test/completion.mjs', s);
'@ | node -; node --test --test-reporter=tap test/completion.mjs 2>&1 | Select-String -Pattern '^\s*not ok|^# (pass|fail)|AssertionError|completion.mjs:\d+|actual|expected' | Select -First 30
```

```text
not ok 29 - a worker killed during its job gives the job back with the reason, and the attempt counted
  location: 'C:\\invoice-work\\c13dbd4c\\workspace\\test\\completion.mjs:366:1'
  name: 'AssertionError'
  expected:
  actual: `WALQ\x01\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00\b\x1FDB­û\x8E\x00\x00\x004×'J{"t":"enqueue","id":"j1
","type":"quick","payload":null,"key":null,"priority":0,"maxAttempts":5,"availableAt":1793526620437,"at":1793526620437}
­ûj\x00\x00\x00\x18¡Ã\x18{"t":"claim","id":"j1","worker":"w46480-4a0fe6-1","fence":1,"leaseUntil":1793526680525,"at
":1793526620525}­ûW\x00\x00\x00áÕ¯>{"t":"release","id":"j1","fence":1,"error":"worker exited (code 1)","at":179352
6620541}­ûj\x00\x00\x00ôÃêá{"t":"claim","id":"j1","worker":"w46480-4a0fe6-2","fence":2,"leaseUntil":1793526680631
,"at":1793526620631}­ûP\x00\x00\x00þ_¡å{"t":"complete","id":"j1","fence":2,"result":{"echoed":null},"at":179352662
0638}`
    TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/completion.mjs:373:10)
# pass 29
# fail 1



Exited with code 1
```

## 96. Reasoning

The regex didn't pick up the `(SIGKILL)` change because my JS replace failed, so I'm going to fix it to match `worker exited (` directly. The behaviour itself looks right.



## 97. edit

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\test\\completion.mjs",
  "oldString": "worker exited \\(SIGKILL\\)\"/",
  "newString": "worker exited \\((SIGKILL|code 1)\\)\"/"
}
```

```text
Edited test/completion.mjs (1 replacement)
```

## 98. Reasoning

Next I'm writing the compaction-failure tests in test/compaction-failure.mjs. They cover a leftover temp file, being killed at each compact point (including power loss), a rename that is held open on win32, and a 0-byte scenario.



## 99. write

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\test\\compaction-failure.mjs",
  "file": "C:\\invoice-work\\c13dbd4c\\workspace\\test\\compaction-failure.mjs",
  "content": "import assert from 'node:assert/strict';\nimport { spawn } from 'node:child_process';\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport { test } from 'node:test';\nimport { ManualClock, openQueue } from '../src/index.mjs';\nimport { crashChild, defer, tempDir } from './helpers/tmp.mjs';\n\nfunction seed(t, options = {}) {\n  const dir = tempDir(t);\n  const queue = openQueue(dir, options);\n  for (let i = 0; i < 5; i += 1) queue.enqueue('x', `job ${i}`);\n  const job = queue.claim('w');\n  queue.complete(job.id, job.token, 'r');\n  queue.close();\n  return { dir, log: path.join(dir, 'wal.log'), temp: path.join(dir, 'wal.log.compact') };\n}\n\nconst summary = (queue) => queue.listJobs().map((j) => `${j.id}:${j.status}`).join(',');\n\ntest('a temp file left by a dead compaction does not stop the next one (G12)', (t) => {\n  const { dir, temp } = seed(t);\n  fs.writeFileSync(temp, 'half a log from a compaction that died');\n  const queue = openQueue(dir);\n  const before = summary(queue);\n  queue.compact();\n  assert.equal(summary(queue), before);\n  assert.equal(fs.existsSync(temp), false);\n  assert.equal(summary(openQueue(dir)), before);\n});\n\nfor (const point of ['compact.after-tmp-write', 'compact.before-rename', 'compact.after-rename']) {\n  for (const powerLoss of [false, true]) {\n    test(`a compaction killed at ${point}${powerLoss ? ' with power loss' : ''} loses nothing and the next one works (G12)`, async (t) => {\n      const { dir } = seed(t);\n      const expected = summary(openQueue(dir));\n      const run = await crashChild(t, dir, 'compact', {\n        env: { WALQ_FAILPOINTS: `${point}=kill`, ...(powerLoss ? { WALQ_SIMULATE_POWER_LOSS: '1' } : {}) },\n      });\n      assert.equal(run.signal, 'SIGKILL', run.stderr);\n      const queue = openQueue(dir);\n    
... [4479 more characters in steps.jsonl]
```

```text
Created file successfully: test/compaction-failure.mjs
```

## 100. Reasoning

I'm checking whether the "brief hold" test is deterministic: the holder releases after 15ms, and my retry waits total about 112ms, so the timing margin looks fine. This is testing the specified bounded wait rather than retrying until green, so I'll keep it. I also need to confirm the enqueue case, where j11 follows the seeded 5 j items.

I'm finishing the enqueue check: after compaction the tail should show jobs j6 through j11, six enqueues on top of the seeded five, so j11 lands as expected. Next I'll run that test along with the full suite.



## 101. shell (exit 1)

```text
node --test --test-reporter=tap test/*.mjs 2>&1 | Select-String -Pattern '^\s*not ok|^# (pass|fail)|AssertionError|\.mjs:\d+:\d+\)|actual:|expected:' | Select -First 30
```

```text
not ok 5 - a compaction killed at compact.after-tmp-write loses nothing and the next one works (G12)
  name: 'AssertionError'
  expected: 'SIGKILL'
  actual: ~
    TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/compaction-failure.mjs:40:14)
not ok 6 - a compaction killed at compact.after-tmp-write with power loss loses nothing and the next one works (G12)
  name: 'AssertionError'
  expected: 'SIGKILL'
  actual: ~
    TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/compaction-failure.mjs:40:14)
not ok 7 - a compaction killed at compact.before-rename loses nothing and the next one works (G12)
  name: 'AssertionError'
  expected: 'SIGKILL'
  actual: ~
    TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/compaction-failure.mjs:40:14)
not ok 8 - a compaction killed at compact.before-rename with power loss loses nothing and the next one works (G12)
  name: 'AssertionError'
  expected: 'SIGKILL'
  actual: ~
    TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/compaction-failure.mjs:40:14)
not ok 9 - a compaction killed at compact.after-rename loses nothing and the next one works (G12)
  name: 'AssertionError'
  expected: 'SIGKILL'
  actual: ~
    TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/compaction-failure.mjs:40:14)
not ok 10 - a compaction killed at compact.after-rename with power loss loses nothing and the next one works (G12)
... [194 more characters in steps.jsonl]
```

## 102. Reasoning

I'm checking why the child process didn't die as expected, since the exit status came back as code 1 with no signal, which conflicts with earlier durability tests that asserted SIGKILL.

The earlier durability tests saw SIGKILL, but here the signal is null with exit code 1, so I'll print stderr to see what happened.



## 103. shell (exit 0)

```text
node --test test/compaction-failure.mjs --test-name-pattern="killed at compact.before-rename loses" 2>&1 | Select-String -Pattern 'message|Error|stderr' | Select -First 8; mkdir C:\invoice-home\c13dbd4c\Temp\opencode\cc -Force | Out-Null; $env:WALQ_FAILPOINTS='compact.before-rename=kill'; $env:WALQ_FAILPOINT_DIR='C:\invoice-home\c13dbd4c\Temp\opencode\cc'; node test/helpers/crash-child.mjs C:\invoice-home\c13dbd4c\Temp\opencode\cc\q compact; "exit $LASTEXITCODE"; Remove-Item Env:WALQ_FAILPOINTS
```

```text
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    generatedMessage: true,
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    generatedMessage: true,
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    generatedMessage: true,
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    generatedMessage: true,
exit 1
```

## 104. Reasoning

I'm checking why the process exits with code 1 and no output, and wondering whether SIGKILL on Windows via process.kill gives exit code 1 with a null signal when the process isn't a fork child. I also recall the earlier durability tests passed with SIGKILL, including the crashChild runs, so I'm trying to square that with what I'm seeing now.

I'm wondering whether the earlier durability tests passed with a SIGKILL signal because their kill happened differently, since the same failpoint helper ran in both. I'll run crashChild directly and print its result to see what the exit looks like.



## 105. shell (exit 0)

```text
cd C:\invoice-work\c13dbd4c\workspace; Remove-Item -Recurse -Force C:\invoice-home\c13dbd4c\Temp\opencode\cc; mkdir C:\invoice-home\c13dbd4c\Temp\opencode\cc | Out-Null; $env:WALQ_FAILPOINT_DIR='C:\invoice-home\c13dbd4c\Temp\opencode\cc'; foreach($p in 'compact.before-rename','wal.mid-append'){ $env:WALQ_FAILPOINTS="$p=kill"; node test/helpers/crash-child.mjs C:\invoice-home\c13dbd4c\Temp\opencode\cc\q$p enqueue '{"n":1}'; "$p exit $LASTEXITCODE"; Get-ChildItem $env:WALQ_FAILPOINT_DIR | % Name}; Remove-Item Env:WALQ_FAILPOINTS
```

```text
<anonymous_script>:1
{n:1}
 ^

SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)
    at JSON.parse (<anonymous>)
    at file:///C:/invoice-work/c13dbd4c/workspace/test/helpers/crash-child.mjs:9:25
    at ModuleJob.run (node:internal/modules/esm/module_job:371:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:683:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)

Node.js v24.7.0
compact.before-rename exit 1
<anonymous_script>:1
{n:1}
 ^

SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)
    at JSON.parse (<anonymous>)
    at file:///C:/invoice-work/c13dbd4c/workspace/test/helpers/crash-child.mjs:9:25
    at ModuleJob.run (node:internal/modules/esm/module_job:371:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:683:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)

Node.js v24.7.0
wal.mid-append exit 1
```

## 106. Reasoning

I'm dropping the shell-quoting detour and going back to the compaction test. The child opens a seeded queue and runs compaction, and the failpoint at compact.before-rename should kill it. The assertion reported "expected SIGKILL, actual null," so I need to check whether an earlier exception happened, and I'll pull the full stderr output to see.



## 107. shell (exit 1)

```text
node --test test/compaction-failure.mjs --test-name-pattern="killed at compact.before-rename loses" 2>&1 | Select-String -Context 0,12 'AssertionError' | Select -First 1
```

```text
>   AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    
    null !== 'SIGKILL'
    
        at TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/compaction-failure.mjs:40:14)
        at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
        at async Test.run (node:internal/test_runner/test:1113:7)
        at async Test.processPendingSubtests (node:internal/test_runner/test:788:7) {
      generatedMessage: true,
      code: 'ERR_ASSERTION',
      actual: null,
      expected: 'SIGKILL',
      operator: 'strictEqual',



Exited with code 1
```

## 108. Reasoning

Stderr came back empty, so the error message is just the generic one. The exit code is probably 1, which would match a self-kill on Windows. That doesn't square with the durability tests passing on `signal === 'SIGKILL'`, so I'm going to print the actual result in a quick node script to check.



## 109. shell (exit 0)

```text
@'
import { crashChild, tempDir } from './test/helpers/tmp.mjs';
import { openQueue } from './src/index.mjs';
const t = { after(){} };
import os from 'node:os'; import fs from 'node:fs'; import path from 'node:path';
for (const [op,fp] of [['enqueue','wal.mid-append=kill'],['compact','compact.before-rename=kill']]) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'cc-'));
  openQueue(dir).close();
  const r = await crashChild({after(){}}, dir, op, {env:{WALQ_FAILPOINTS:fp}});
  console.log(op, r.code, r.signal, JSON.stringify(r.stderr), fs.readdirSync(r.markers));
}
'@ | Set-Content dbg.mjs; node dbg.mjs; Remove-Item dbg.mjs
```

```text
enqueue 1 null "" [ 'wal.mid-append.hit' ]
compact 1 null "" [ 'compact.before-rename.hit' ]
```

## 110. Reasoning

I'm checking whether the kill result, code 1 with a null signal in both runs, matches what the durability tests did earlier. The first run seemed to show failures only for completion.mjs, and I'm wondering whether the test numbering or a `Select-String` filter hid the durability results in the later run.

I'm going to stop relying on the kill signal and instead check whether a `.hit` marker file exists, adding a `killed` field to the crashChild result that reflects that.



## 111. shell (exit 1)

```text
@'
const fs = require('fs');
let h = fs.readFileSync('test/helpers/tmp.mjs', 'utf8');
h = h.replace("child.on('exit', (code, signal) => resolve({ code, signal, markers, stderr }));", "child.on('exit', (code, signal) => {\n      // Windows reports a self-inflicted SIGKILL as exit code 1, so the marker a\n      // kill failpoint writes first is the evidence that it fired.\n      const killed = fs.readdirSync(markers).some((name) => name.endsWith('.hit'));\n      resolve({ code, signal, killed, markers, stderr });\n    });");
fs.writeFileSync('test/helpers/tmp.mjs', h);
for (const f of ['test/durability.mjs', 'test/compaction-failure.mjs']) {
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(/assert\.equal\(run\.signal, 'SIGKILL'(, run\.stderr)?\);/g, 'assert.ok(run.killed, run.stderr || \'the failpoint should have fired\');');
  fs.writeFileSync(f, s);
}
'@ | node -; node --test --test-reporter=tap test/*.mjs 2>&1 | Select-String -Pattern '^\s*not ok|^# (pass|fail)|AssertionError|\.mjs:\d+:\d+\)|actual:|expected:' | Select -First 30
```

```text
not ok 105 - compaction changes nothing observable about a job (G11)
    TestContext.<anonymous> (file:///C:/invoice-work/c13dbd4c/workspace/test/shared-queue.mjs:190:15)
# pass 113
# fail 1



Exited with code 1
```

## 112. shell (exit 1)

```text
node --test test/shared-queue.mjs --test-name-pattern="changes nothing observable" 2>&1 | Select-String -Context 0,25 'AssertionError' | Select -First 1
```

```text
(no output)
Exited with code 1
```

## 113. shell (exit 1)

```text
node --test test/shared-queue.mjs --test-name-pattern="changes nothing observable" 2>&1 | Select -First 50
```

```text
✔ two processes claiming at once never get the same attempt (G6) (32.5827ms)
✔ a heartbeat from one process keeps the lease alive for another one's reaper (G7) (36.7793ms)
✔ a reaper that looked just before a heartbeat does not expire the job (G7) (31.5316ms)
✔ a reaper that looked just before a commit does not undo it (29.6611ms)
✔ a token from an old attempt has no power (G8) (43.5832ms)
✔ a token is never issued twice for a job, even through requeueDead (G6) (73.2084ms)
✔ a key used by another process during the gap is found under the lock (G10) (19.5301ms)
✔ a key is remembered after its job was pruned by compaction, through restarts (G10) (61.1318ms)
✔ a retry keeps its due time through restart and compaction (G9) (45.4475ms)
✔ attempts, backoff growth and maxAttempts carry through compaction (G9, G11) (123.0889ms)
✖ compaction changes nothing observable about a job (G11) (34.3163ms)
✔ another process follows a compaction whose new log is bigger than the old one (G13) (43.2888ms)
✔ another process follows a compaction that left a smaller log, and many of them (269.1811ms)
✔ automatic compaction does not rewrite a big state on every write (G14) (401.4954ms)
✔ a cancelled job loses its lease (27.0728ms)
ℹ tests 15
ℹ suites 0
ℹ pass 14
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1380.0843

✖ failing tests:

test at test\shared-queue.mjs:182:1
✖ compaction changes nothing observable about a job (G11) (34.3163ms)
  TypeError [Error]: 
... [576 more characters in steps.jsonl]
```

## 114. Reasoning

The test is failing because of my own setup: the first job carries a 300ms delay, so the second worker claims first and the expected 'w2' claim comes back null. I need to move the clock forward by 300ms before making the second claim.



## 115. edit

```text
{
  "path": "C:\\invoice-work\\c13dbd4c\\workspace\\test\\shared-queue.mjs",
  "oldString": "  clock.advance(10);\n  const done",
  "newString": "  clock.advance(300);\n  const done"
}
```

```text
Edited test/shared-queue.mjs (1 replacement)
```

## 116. Reasoning

I'll check whether the new tests actually catch the bugs by running them against the original source with `git stash push -- src`. Many will probably fail trivially since they use new APIs, so that result tells me less than I'd like. I'm skipping the full run for now and will be upfront about that. I also want to add power-loss cases to the crash rounds in stress.mjs and some RFC checks, keeping that change modest.

I'm also weighing a modest change to the crash rounds in stress.mjs: occasionally turning on power-loss simulation, including in the compaction round, and maybe checking that completions stay consistent. I'll make that edit to the environment setup for the crash rounds.



## 117. shell (exit 0)

```text
@'
const fs = require('fs');
let s = fs.readFileSync('scripts/stress.mjs', 'utf8');
s = s.replace("  round.say(`armed: ${rules}`);\n  await runPool(round, {\n    size: 3,\n    leaseMs: 900,\n    env: { WALQ_FAILPOINTS: rules },",
"  const power = random() < 0.5 ? { WALQ_SIMULATE_POWER_LOSS: '1' } : {};\n  round.say(`armed: ${rules} ${power.WALQ_SIMULATE_POWER_LOSS ? '(power loss model)' : ''}`);\n  await runPool(round, {\n    size: 3,\n    leaseMs: 900,\n    env: { WALQ_FAILPOINTS: rules, ...power },");
s = s.replace("  round.say(`armed: ${rules}`);\n\n  const running = runPool(round, { size: 3, leaseMs: 900, env: { WALQ_FAILPOINTS: rules }, queue: options });",
"  const power = random() < 0.5 ? { WALQ_SIMULATE_POWER_LOSS: '1' } : {};\n  round.say(`armed: ${rules} ${power.WALQ_SIMULATE_POWER_LOSS ? '(power loss model)' : ''}`);\n\n  const running = runPool(round, { size: 3, leaseMs: 900, env: { WALQ_FAILPOINTS: rules, ...power }, queue: options });");
// commit checks in crash round
s = s.replace("    else if (job.status !== 'done') round.problem(`job ${id} ended as ${job.status}`);\n  }\n  queue.close();",
"    else if (job.status !== 'done') round.problem(`job ${id} ended as ${job.status}`);\n  }\n  const seqs = queue.completions().map((c) => c.seq);\n  if (seqs.some((seq, i) => seq !== i + 1)) round.problem(`completion numbers are not 1..n: ${seqs}`);\n  if (seqs.length !== total) round.problem(`${seqs.length} completions for ${total} jobs`);\n  queue.close();");
fs.writeFileSync('scripts/stress.mjs', s);
'@ | node -; git diff --stat scripts; for ($i=2; $i -le 3; $i++) { node scripts/stress.mjs --seed $i --seconds 90 > C:\invoice-home\c13dbd4c\Temp\opencode\out\s$i.txt 2>&1; "seed $i exit $LASTEXITCODE"; Select-String C:\invoice-home\c13dbd4c\Temp\opencode\out\s$i.txt -Pattern 'PROBLEM|rounds,' | % Line }
```

```text
scripts/stress.mjs | 13 +++++++++----
 1 file changed, 9 insertions(+), 4 deletions(-)
seed 2 exit 0
[round 1 contention] finished in 1796ms with 0 problem(s)
[round 2 crash] finished in 1181ms with 0 problem(s)
[round 3 compaction] finished in 1305ms with 0 problem(s)
[round 4 lease] finished in 4434ms with 0 problem(s)
[round 5 contention] finished in 1638ms with 0 problem(s)
[round 6 crash] finished in 995ms with 0 problem(s)
[round 7 compaction] finished in 1028ms with 0 problem(s)
[round 8 lease] finished in 4298ms with 0 problem(s)
[round 9 contention] finished in 1539ms with 0 problem(s)
[round 10 crash] finished in 1307ms with 0 problem(s)
[round 11 compaction] finished in 1103ms with 0 problem(s)
[round 12 lease] finished in 4417ms with 0 problem(s)
[round 13 contention] finished in 1490ms with 0 problem(s)
[round 14 crash] finished in 1200ms with 0 problem(s)
[round 15 compaction] finished in 1066ms with 0 problem(s)
[round 16 lease] finished in 4351ms with 0 problem(s)
[round 17 contention] finished in 1667ms with 0 problem(s)
[round 18 crash] finished in 1150ms with 0 problem(s)
[round 19 compaction] finished in 1303ms with 0 problem(s)
[round 20 lease] finished in 4709ms with 0 problem(s)
[round 21 contention] finished in 1413ms with 0 problem(s)
[round 22 crash] finished in 1229ms with 0 problem(s)
[round 23 compaction] finished in 1130ms with 0 problem(s)
[round 24 lease] finished in 4387ms with 0 problem(s)
[round 25 contention] finish
... [7247 more characters in steps.jsonl]
```

## 118. Reasoning

Seeds 2 and 3 came back clean, including the power-loss runs. Next is the documentation: updating the API reference for the new receipt, result and reclaim behavior, and the WAL format doc for the release record and the new snapshot fields, then the changelog and a full test run.

Next I'm updating the remaining docs: the WAL format and compaction protocol, the architecture and crash-testing notes, operations, leases and retries, marking the RFC as implemented, and the README, changelog, and version bump to 0.5.0. I plan to make the edits through a node script with replacements in a JS file.



## 119. shell (exit 0)

```text
@'
const fs = require('fs');
function edit(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(file + ': missing ' + a.slice(0, 50));
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(file, s);
}
edit('docs/api.md', [
['**`heartbeat(id, token, { leaseMs })`** returns `{ leaseUntil }`. Throws `StaleLeaseError` if the lease is no longer yours.',
 '**`heartbeat(id, token, { leaseMs })`** returns `{ leaseUntil }`. Throws `StaleLeaseError` if the lease is no longer yours. The extension is written to the log, so every process sees it, including whichever one runs the reaper.'],
['**`complete(id, token, result)`** records the result. Throws `StaleLeaseError` if the lease is no longer yours. RFC 007 changes what this returns.',
 '**`complete(id, token, result)`** commits the result and returns a receipt `{ id, outcome, token, result, completedAt, completionSeq }`. `outcome` is `committed` the first time and `already-committed` for a repeat with the same token (nothing is written, and the stored result is returned). Any other token throws `StaleLeaseError`; a pruned job throws `UnknownJobError`. The call returns once the record is on disk. See [RFC 007](rfc-007-exactly-once-completion.md).\n\n**`getResult(id)`** returns `{ id, status: \'done\', result, token, attempts, completedAt, completionSeq }` for a finished job, `{ id, status }` for any other, and `null` for an unknown or pruned one.\n\n**`completions({ after, limit })`** returns the retained commits in commit order, `[{ seq, id, token, result, completedAt }]`, with `seq > after`. Numbers start at 1 and never repeat or go back, across restarts and compaction.\n\n**`reclaimWorker(workerId, { reason })`** gives up every lease held by a worker known to be dead, at once and with no backoff, and returns `[{ id, status }]` (`ready`, or `dead` when attempts have run out). The attempt counts, `reason` becomes `lastError`, and the old tokens are sta
... [10321 more characters in steps.jsonl]
```

```text
[stdin]:5
    if (!s.includes(a)) throw new Error(file + ': missing ' + a.slice(0, 50));
                        ^

Error: docs/operations.md: missing `inspect` takes no lock and changes nothing, so it
    at edit ([stdin]:5:31)
    at [stdin]:38:1
    at runScriptInThisContext (node:internal/vm:219:10)
    at node:internal/process/execution:451:12
    at [stdin]-wrapper:6:24
    at runScriptInContext (node:internal/process/execution:449:60)
    at evalFunction (node:internal/process/execution:283:30)
    at evalTypeScript (node:internal/process/execution:295:3)
    at node:internal/main/eval_stdin:51:5
    at Socket.<anonymous> (node:internal/process/execution:205:5)

Node.js v24.7.0
 src/worker/runner.mjs | 102 +++++++++++++++++++++++++-----------
 test/helpers/tmp.mjs  |  24 +++++++++
 20 files changed, 537 insertions(+), 173 deletions(-)

# pass 114
# fail 0
```

## 120. Reasoning

I'm updating the docs: the wal-format and compaction pages are already done. The operations edit failed because the Tools paragraph has an apostrophe I need to match exactly, so I'm fixing that and then working through the remaining pages.

Checking whether the remaining docs need the same apostrophe fix, and whether line endings in the docs could be what's breaking the match.



## 121. shell (exit 0)

```text
@'
const fs = require('fs');
function edit(file, pairs) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(file + ': missing ' + a.slice(0, 50));
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(file, s);
}
edit('docs/operations.md', [
["`inspect` takes no lock and changes nothing, so it's safe at any time. `tail` keeps the log open for as long as it runs.",
 "`inspect` takes no lock and changes nothing, so it's safe at any time. `tail` opens the log only while it reads, and follows across compactions. Don't point other tools at `wal.log` and leave them holding it open: on Windows a compaction cannot replace a file that is open. Brief holds are waited out; a long one fails the compaction (`lastCompactionError`), and the queue carries on."],
['Temp files named `wal.log.*` can appear during compaction.', 'Temp files named `wal.log.*` can appear during compaction or log creation; a leftover from a crash is replaced automatically.'],
['The log format is stable.', "The log format is stable; 0.5 adds the `release` record and more fields in snapshots, which older readers skip. Don't run old and new versions on one queue at the same time."],
]);
edit('docs/leases-and-retries.md', [
['A worker running a long job calls `heartbeat()`. `JobRunner` does this on a timer, every `leaseMs / 3` by default.',
 "A worker running a long job calls `heartbeat()`. `JobRunner` does this on a timer, every `leaseMs / 3` by default, and keeps doing it while it waits to record the outcome. Heartbeats are written to the log, which is how the reaper in another process sees them.\n\nA lease that has passed its deadline is still the job's lease until a reaper, a reclaim, a new claim or a cancel acts on it; until then its holder can still heartbeat or commit."],
['Anyone can call `reapExpired()`.', 'When a pool sees a worker exit it calls `reclaimWorker()`, which releases that worker\'s leases at once with no backoff (the attempt s
... [3552 more characters in steps.jsonl]
```

```text
M CHANGELOG.md
 M README.md
 M docs/api.md
 M docs/architecture.md
 M docs/compaction.md
 M docs/crash-testing.md
 M docs/leases-and-retries.md
 M docs/operations.md
 M docs/rfc-007-exactly-once-completion.md
 M docs/wal-format.md
 M package.json
 M scripts/stress.mjs
 M src/cli.mjs
 M src/compactor.mjs
 M src/errors.mjs
 M src/frame.mjs
 M src/index.mjs
 M src/inspect.mjs
 M src/queue.mjs
 M src/records.mjs
 M src/retention.mjs
 M src/snapshot.mjs
 M src/state.mjs
 M src/store.mjs
 M src/wal.mjs
 M src/worker/pool.mjs
 M src/worker/runner.mjs
 M test/helpers/tmp.mjs
?? test/compaction-failure.mjs
?? test/completion.mjs
?? test/durability.mjs
?? test/helpers/crash-child.mjs
?? test/shared-queue.mjs
```

## 122. Reasoning

I'm going to check upgrade compatibility by exporting the old HEAD code into a temp directory, writing a queue log with claims, fails, and completions, compacting it, and then opening it with the new code. After that I'll run the full test suite twice and maybe one more stress seed concurrently.



## 123. Said

Last check: logs written by the old code must open under the new code.

## 124. shell (exit 0)

```text
$o="C:\invoice-home\c13dbd4c\Temp\opencode\old"; Remove-Item -Recurse -Force $o -ErrorAction SilentlyContinue; New-Item -ItemType Directory $o | Out-Null; git archive HEAD src package.json | tar -x -C $o
@'
import { openQueue, ManualClock } from './old/src/index.mjs';
import fs from 'node:fs';
const dir = 'old/q'; fs.rmSync(dir,{recursive:true,force:true});
const clock = new ManualClock(1000);
const q = openQueue(dir,{clock, backoff:{baseMs:100}});
for (let i=0;i<6;i++) q.enqueue('x',{i},{key:'k'+i});
let j=q.claim('w'); q.complete(j.id,j.token,'r');
j=q.claim('w'); q.fail(j.id,j.token,'e');
q.compact();
j=q.claim('w'); q.heartbeat(j.id,j.token); q.complete(j.id,j.token,'r2');
j=q.claim('w'); q.fail(j.id,j.token,'e2');
q.close();
'@ | Set-Content "$o\mk.mjs"
Copy-Item "$o\mk.mjs" "$o\..\mk-old.mjs" -Force; Set-Location C:\invoice-home\c13dbd4c\Temp\opencode; node mk-old.mjs
Set-Location C:\invoice-work\c13dbd4c\workspace
@'
import { openQueue, ManualClock } from './src/index.mjs';
const q = openQueue('C:/invoice-home/c13dbd4c/Temp/opencode/old/q',{clock:new ManualClock(1000)});
console.log(q.stats()); console.log(q.completions().map(c=>c.id+'#'+c.seq), q.getJob('j2').availableAt, q.enqueue('x',1,{key:'k0'}));
q.compact(); console.log(q.stats().total);
'@ | Set-Content dbg.mjs; node dbg.mjs; Remove-Item dbg.mjs; node --test --test-reporter=tap test/*.mjs 2>&1 | Select-String -Pattern '^\s*not ok|^# (pass|fail)'
```

```text
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar archive (bad header checksum)
tar.exe: Retrying...
tar.exe: Damaged tar
... [12098 more characters in steps.jsonl]
```

## 125. Said

`tar` failed on Windows (and the queue dir was created empty by my second script), so that check was invalid. I'll redo it using `git show` for each old file.

## 126. shell (exit 0)

```text
$o="C:\invoice-home\c13dbd4c\Temp\opencode\old"; Remove-Item -Recurse -Force $o -ErrorAction SilentlyContinue; foreach($f in (git ls-tree -r --name-only HEAD src)){ $d = Join-Path $o (Split-Path $f); New-Item -ItemType Directory -Force $d | Out-Null; git show "HEAD:$f" | Set-Content -Encoding utf8 (Join-Path $o $f) }
Copy-Item (git show HEAD:package.json | Out-String | Set-Content "$o\package.json" -PassThru | Out-Null) -ErrorAction SilentlyContinue
@'
import { openQueue, ManualClock } from './src/index.mjs';
import fs from 'node:fs';
const dir = 'q'; fs.rmSync(dir,{recursive:true,force:true});
const clock = new ManualClock(1000);
const q = openQueue(dir,{clock, backoff:{baseMs:100}});
for (let i=0;i<6;i++) q.enqueue('x',{i},{key:'k'+i});
let j=q.claim('w'); q.complete(j.id,j.token,'r');
j=q.claim('w'); q.fail(j.id,j.token,'e');
q.compact();
j=q.claim('w'); q.heartbeat(j.id,j.token); q.complete(j.id,j.token,'r2');
j=q.claim('w'); q.fail(j.id,j.token,'e2');
q.close(); console.log('old log written');
'@ | Set-Content "$o\mk.mjs"
'{"type":"module"}' | Set-Content "$o\package.json"
Set-Location $o; node mk.mjs; Set-Location C:\invoice-work\c13dbd4c\workspace
@'
import { openQueue, ManualClock } from './src/index.mjs';
const q = openQueue('C:/invoice-home/c13dbd4c/Temp/opencode/old/q',{clock:new ManualClock(1000)});
const s = q.stats(); console.log(s.total, s.done, s.ready, s.tornTailsDropped);
console.log(q.completions().map(c=>c.id+'#'+c.seq), q.enqueue('x',1,{key:'k0'}).deduped);
q.compact(); console.log(q.stats().total);
'@ | Set-Content dbg.mjs; node dbg.mjs; Remove-Item dbg.mjs
```

```text
Copy-Item : Cannot bind argument to parameter 'Path' because it is null.
At line:2 char:11
+ Copy-Item (git show HEAD:package.json | Out-String | Set-Content "$o\ ...
+           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : InvalidData: (:) [Copy-Item], ParameterBindingValidationException
    + FullyQualifiedErrorId : ParameterArgumentValidationErrorNullNotAllowed,Microsoft.PowerShell.Commands.CopyItemCom 
   mand
 
old log written
6 2 4 0
[ 'j1#1', 'j3#2' ] true
6
```

## 127. Said

Old-format logs (written by the original code, including a compacted one with a trailing heartbeat-era state) open under the new code, keys are still honoured, and compaction works on them.

I've fixed the incident and the other problems we found, and implemented RFC 007. `npm test` is 114/114. `npm run stress` was clean on seeds 1, 2 and 3 (44 rounds each). I haven't proved the stress rounds catch every regression: before my changes there were two failing tests and the stress run was not clean. I did not run the old code against the stress script or the new tests, so I can't say they would have caught each bug.

## Causes I found and fixed

**Tuesday's incident (G2, G3, G4)**
- The torn tail was never removed, and appends went after it. The next restart then found garbage mid-log and refused to open. The tail is now cut off under the lock before anything is appended, and appends go to the end of the good data. Damage anywhere else still raises `CorruptLogError` with the offset and leaves the file untouched.
- A failed read no longer lets the process carry on with half the state.
- A new log's header and a compaction's temp file were renamed into place before they were synced. A power cut right after could leave an empty `wal.log`. That also explains the 0-byte report. Both are now synced before the rename.

**Largest queue lost jobs (G5)**
- Catch-up only read the first 1 MiB of the log and treated the rest as a torn tail. It now reads the whole log in chunks and handles records larger than a chunk. Records over the 64 MiB limit are refused before anything is written.

**Double runs (G6–G8)**
- Heartbeats were only in memory, so the pool's reaper never saw them.
- Claim and reap chose their job before taking the lock and did not look again under it.
- Lease tokens were not actually compared.
- `requeueDead` reset the token counter, so old tokens became valid again.

**Retries (G9)**
- The retry due time was computed at replay time, so every restart moved it.
- Snapshots dropped attempts, tokens and priority, so `maxAttempts` reset on each compaction. That is the job retrying for days.

**Idempotency key resent (G10)**
- Snapshots dropped the keys of pruned jobs.
- The key check was also racy across processes.

**Compaction (G11–G14)**
- A leftover temp file made every later compaction fail with `EEXIST`. It is now replaced.
- On this host even a plain read handle, such as `walq tail`, makes the rename fail with `EPERM`. `tail` no longer keeps the log open between reads. A brief hold by a backup is waited out for about 100 ms; a longer hold fails the compaction safely and cleans up its temp file.
- Other processes only noticed a compaction if the new log was smaller. They now compare the generation in the header.
- Automatic compaction no longer rewrites a large state on every write.

**`complete` durability (G1)**
- `complete` returned before its record was synced. It now syncs before it returns.

## RFC 007
- `complete` returns the receipt described in the RFC. `getResult`, `completions` and `reclaimWorker` are added, along with the `release` record.
- The pool reclaims a dead worker's jobs as soon as it sees the worker exit. Worker ids are now unique per pool, so a reclaim can't touch another pool's worker.
- Workers keep retrying to record a finished job, keep heartbeating while they do, and take no other job meanwhile. A result that can't be serialised fails the attempt instead of retrying forever.

Format compatibility: the only changes are the new `release` record and extra fields in snapshots. I checked that a log written by the original code opens, honours its keys, and compacts. Public API and failpoint names are unchanged. I added `RecordTooLargeError` and bumped the version to 0.5.0.

## Testing
- There are 72 new tests in `durability`, `shared-queue`, `compaction-failure` and `completion`. They cover:
  - kills at every wal, compact and job failpoint, with and without the power-loss model;
  - several processes simulated with failpoint callbacks;
  - logs over 5 MB and a 3 MB record;
  - an open file blocking compaction;
  - real worker pools being killed.
- `scripts/stress.mjs` now randomly enables the power-loss model and checks completion numbering. I didn't weaken or delete any existing test.
- I updated the docs, README and CHANGELOG to match.

## Uncertain or not done
- **Last-record rule (G4):** a last record that fails its checksum with nothing after it is treated as a cut-off write and dropped. An existing test requires this. An acknowledged final record damaged in place can't be told apart from a torn write.
- **Not changed:** cancelled jobs are never pruned by compaction, which I left as it was.
- **State over 64 MiB:** compaction can't write a snapshot larger than the frame limit. It fails safely but can't make progress, and the format has no way to split a snapshot.
- **Compaction retry cost:** while a long hold persists, each write that triggers automatic compaction pays about 100 ms before the failure is swallowed and reported in `lastCompactionError`.
- **Worker kills on Windows:** a self-kill shows up as exit code 1 with no signal, so my tests detect a kill from the failpoint's marker file.
- **Real-disk power loss:** only the simulated model is covered. Partial-sector or garbage tails from real hardware are not.
- **Heartbeat cost:** each heartbeat now costs an fsync, which makes heartbeats more expensive than before.
- **Mixed versions:** old and new versions shouldn't run on one queue at the same time. `docs/operations.md` says so.
- **Large-queue reproduction:** I never reproduced the large-queue loss from production. I found the 1 MiB read limit by reading the code and covered it with tests on logs over 5 MB.
