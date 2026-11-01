# Timeline: l3-claude-pilot-1-20261031-160903

Every step in order. Long outputs are clipped here; `steps.jsonl` holds them in full.

## 1. Said

I'll start by looking at the repo layout and docs.

## 2. Bash (BLOCKED by harness-permission, error)

```text
git ls-files | xargs wc -l && cat package.json
```

```text
This Bash command contains multiple operations. The following part requires approval: xargs wc -l && cat package.json
```

## 3. Glob

```text
{
  "pattern": "**/*",
  "path": "C:\\invoice-work\\14db8721\\workspace"
}
```

```text
.gitignore
CHANGELOG.md
docs\api.md
docs\architecture.md
docs\compaction.md
docs\crash-testing.md
docs\guarantees.md
docs\leases-and-retries.md
docs\operations.md
docs\rfc-007-exactly-once-completion.md
docs\wal-format.md
package.json
README.md
scripts\stress-handlers.mjs
scripts\stress.mjs
src\backoff.mjs
src\cli.mjs
src\clock.mjs
src\compactor.mjs
src\config.mjs
src\crc32.mjs
src\errors.mjs
src\failpoints.mjs
src\frame.mjs
src\fsops.mjs
src\idempotency.mjs
src\index.mjs
src\inspect.mjs
src\lease.mjs
src\lock.mjs
src\logger.mjs
src\metrics.mjs
src\queue.mjs
src\records.mjs
src\retention.mjs
src\snapshot.mjs
src\state.mjs
src\store.mjs
src\wal.mjs
src\worker\child.mjs
src\worker\pool.mjs
src\worker\protocol.mjs
src\worker\registry.mjs
src\worker\runner.mjs
test\backoff-schedule.mjs
test\compaction.mjs
test\failpoints.mjs
test\frame-format.mjs
test\helpers\append-then-die.mjs
test\helpers\handlers.mjs
test\helpers\tmp.mjs
test\leases.mjs
test\queue-basics.mjs
test\recovery.mjs
test\worker-pool.mjs
.git\description
.git\hooks\applypatch-msg.sample
.git\hooks\commit-msg.sample
.git\hooks\fsmonitor-watchman.sample
.git\hooks\post-update.sample
.git\hooks\pre-applypatch.sample
.git\hooks\pre-commit.sample
.git\hooks\pre-merge-commit.sample
.git\hooks\pre-push.sample
.git\hooks\pre-rebase.sample
.git\hooks\pre-receive.sample
.git\hooks\prepare-commit-msg.sample
.git\hooks\push-to-checkout.sample
.git\hooks\sendemail-validate.sample
.git\hooks\update.sample
.git\info\exclude
.git\HE
... [1647 more characters in steps.jsonl]
```

## 4. Said

Lots to read. I'll read the docs first.

## 5. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\docs\\guarantees.md"
}
```

```text
1	# Guarantees
2	
3	This is what walq promises to the services built on it. A behaviour that breaks one of these is a bug, whatever the code comments say. "Crash" here means a process being killed at any instant. "Power loss" means the machine stopping, with anything not yet synced to disk gone.
4	
5	## Durability
6	
7	**G1. An acknowledged call survives.** Once a call that changes the queue has returned, its effect survives any crash or power loss.
8	
9	**G2. A queue always reopens after a crash.** No crash or power loss, at any point in any operation, leaves a queue that needs manual repair.
10	
11	**G3. Unacknowledged work leaves no trace of damage.** A write that was cut off is not a reason to refuse the log, and it must not affect anything written afterwards.
12	
13	**G4. Damage to acknowledged data is reported, never repaired away.** If bytes that held acknowledged records are damaged, walq raises `CorruptLogError` with the offset, and leaves the file as it found it. It must not drop acknowledged records to keep going.
14	
15	**G5. Size is not a risk.** Logs and records of any size within the format's limits work the same way.
16	
17	## Jobs
18	
19	**G6. One owner at a time.** A job has at most one valid lease at any moment, across all processes on the host. Each attempt has its own token, and a token is never issued twice for a job, for as long as the job exists.
20	
21	**G7. A live worker keeps its job.** A worker that keeps heartbeating does not lose its job to lease
... [1635 more characters in steps.jsonl]
```

## 6. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\docs\\crash-testing.md"
}
```

```text
1	# Crash testing
2	
3	A queue that's only tested when nothing goes wrong tells you little. walq has two tools for testing the other case. Both are part of the project, and other teams' test suites depend on them, so keep the names and meanings on this page stable.
4	
5	## Failpoints
6	
7	A failpoint is a named place in the code. Arm one with environment variables, and a process dies or stops there:
8	
9	'''
10	WALQ_FAILPOINTS="wal.mid-append#complete=kill@2,claim.before-lock=pause"
11	WALQ_FAILPOINT_DIR=C:\some\folder
12	'''
13	
14	A rule is `name[#type]=action[@nth]`.
15	
16	- `kill` terminates the process with no cleanup, on the `nth` time the point is reached (default the first). It first writes `<name>.hit` to the marker folder and doesn't fire again while that file exists, so a restarted worker doesn't die at the same place forever.
17	- `pause` writes `<name>.paused` and blocks until `<name>.release` appears. A `#` in the name becomes `.` in the file names.
18	- `#type` limits the rule to one record type, for the `wal.*` points.
19	
20	Within one process, `onFailpoint(name, callback)` runs a callback at the point instead, so that a test can run something else at exactly that moment. `clearFailpoints()` removes all callbacks.
21	
22	### The points
23	
24	| Point | When it's reached | Lock held? |
25	|---|---|---|
26	| `enqueue.before-lock` | `enqueue()` is about to take the lock to add the job | No |
27	| `claim.before-lock` | `claim()` is about to take the lock to leas
... [2118 more characters in steps.jsonl]
```

## 7. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\docs\\rfc-007-exactly-once-completion.md"
}
```

```text
1	# RFC 007: Exactly-once completion
2	
3	**Status:** accepted, not implemented.
4	
5	## Problem
6	
7	Execution is at-least-once, and that's fine: a job's handler can run more than once. Completion is the part consumers rely on. Today a consumer can't tell a first completion from a repeat, can't look up a result by job id in any stable way, and a worker's death is only noticed when its lease runs out, which can be minutes.
8	
9	## What we want
10	
11	**A job commits at most once. A worker killed before the commit leads to the job running again. A commit that has been recorded never leads to the job running again,** whatever happens afterwards, in any process.
12	
13	The commit point is the moment the `complete` record is durable. There's no state in between.
14	
15	## API
16	
17	### complete(id, token, result)
18	
19	Returns a receipt:
20	
21	'''js
22	{ id, outcome, token, result, completedAt, completionSeq }
23	'''
24	
25	- First commit with the current token: `outcome: 'committed'`.
26	- Repeat with the token that committed, including after a restart or a compaction: `outcome: 'already-committed'`. The receipt carries the stored `result`, `completedAt` and `completionSeq`. The result passed in is ignored, and nothing is written to the log.
27	- Any other token: `StaleLeaseError`, and nothing changes.
28	- A job that has been pruned: `UnknownJobError`.
29	
30	A lease past its deadline can still commit, as long as nobody has acted on it. Its token is still current until a rea
... [2801 more characters in steps.jsonl]
```

## 8. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\docs\\wal-format.md"
}
```

```text
1	# Log format
2	
3	The format is a compatibility contract. Logs already on production hosts must stay readable, so changes must be additive.
4	
5	## File
6	
7	`wal.log` is a header followed by frames. All integers are little-endian.
8	
9	### Header (20 bytes)
10	
11	| Offset | Size | Field |
12	|---|---|---|
13	| 0 | 4 | Magic, ASCII `WALQ` |
14	| 4 | 2 | Format version, currently 1 |
15	| 6 | 2 | Flags, zero |
16	| 8 | 4 | Generation |
17	| 12 | 4 | Reserved, zero |
18	| 16 | 4 | CRC-32 of bytes 0 to 15 |
19	
20	A new log starts at generation 1. Each compaction adds one.
21	
22	### Frame (10 bytes + payload)
23	
24	| Offset | Size | Field |
25	|---|---|---|
26	| 0 | 2 | Magic, bytes `AD FB` |
27	| 2 | 4 | Payload length |
28	| 6 | 4 | CRC-32 over the length field and then the payload |
29	| 10 | n | Payload: one record, as UTF-8 JSON |
30	
31	The payload limit is 64 MiB. Valid UTF-8 cannot contain the byte `FB`.
32	
33	## Records
34	
35	Every record has `t`, its type, and `at`, the writer's clock when it was written (a snapshot's `at` is when it was built).
36	
37	| `t` | Fields | Effect |
38	|---|---|---|
39	| `enqueue` | `id, type, payload, key, priority, maxAttempts, availableAt, at` | A new job, `ready` |
40	| `claim` | `id, worker, fence, leaseUntil, at` | Job `leased`, attempts + 1, token = `fence` |
41	| `heartbeat` | `id, fence, leaseUntil, at` | Lease deadline moves |
42	| `complete` | `id, fence, result, at` | Job `done` |
43	| `fail` | `id, fence, error, delayMs,
... [688 more characters in steps.jsonl]
```

## 9. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\docs\\architecture.md"
}
```

```text
1	# Architecture
2	
3	'''
4	          enqueue, stats, ...                    claim, heartbeat, complete, ...
5	your process ───────────┐                    ┌───────── worker process (child.mjs)
6	                        ▼                    ▼
7	                     ┌──────────────────────────┐
8	                     │  Queue (queue.mjs)       │  one instance per process
9	                     │  Store (store.mjs)       │  replayed state + lock rules
10	                     │  Wal   (wal.mjs)         │  the file
11	                     └────────────┬─────────────┘
12	                                  ▼
13	                     data/queue/wal.log        the log
14	                     data/queue/queue.lock     the cross-process lock
15	'''
16	
17	## Shared log, no server
18	
19	Every process that opens a queue directory holds its own copy of the state, built by replaying the log. Nobody is in charge. A process that wants to do something:
20	
21	1. takes the lock (`lock.mjs`);
22	2. reads whatever other processes appended since last time, and applies it (`Store.catchUp`);
23	3. decides, appends, and syncs;
24	4. releases the lock.
25	
26	Time spent holding the lock is short, because job handlers run outside it.
27	
28	## Modules
29	
30	| Module | Responsibility |
31	|---|---|
32	| `queue.mjs` | The public API. Turns calls into records |
33	| `store.mjs` | Lock + catch-up + append. Owns the in-memory state and its log offset |
34	| `state.mjs` | The reducer: `applyRecord(state, re
... [1283 more characters in steps.jsonl]
```

## 10. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\docs\\api.md"
}
```

```text
1	# API
2	
3	Everything is exported from `src/index.mjs`. The names and shapes on this page are a contract with the services that use walq.
4	
5	## openQueue(dir, options)
6	
7	| Option | Default | Meaning |
8	|---|---|---|
9	| `leaseMs` | 30 000 | Default lease length |
10	| `lockTimeoutMs` | 10 000 | How long a call waits for the lock before `LockTimeoutError` |
11	| `compactAfterBytes` | 4 MiB | Compact automatically past this size. `0` turns it off |
12	| `retainCompletedMs` | 24 h | How long finished jobs stay in the log after they finish |
13	| `idempotencyTtlMs` | 7 d | How long a key is remembered, from when the job was enqueued |
14	| `maxAttempts` | 5 | Default attempts per job |
15	| `backoff` | `{ baseMs: 1000, factor: 2, maxMs: 60000, jitter: 0 }` | Retry schedule |
16	| `clock` | system clock | Anything with `now()`. Tests use `ManualClock` |
17	
18	## Queue
19	
20	**`enqueue(type, payload, { key, delayMs, maxAttempts, priority })`** returns `{ id, status, deduped }`. With a remembered `key` it also returns the existing job's `result` and `deduped: true`, and creates nothing.
21	
22	**`enqueueMany([{ type, payload, options }])`** adds a batch under one lock and one sync. A crash can leave a prefix of the batch behind.
23	
24	**`claim(worker, { leaseMs, types })`** returns `{ id, type, payload, attempt, token, leaseUntil }` or `null`. Among due jobs, higher `priority` goes first, then the job due longest, then the oldest. `token` identifies this attempt.
25	
26	*
... [2998 more characters in steps.jsonl]
```

## 11. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\docs\\compaction.md"
}
```

```text
1	# Compaction
2	
3	The log only grows, so from time to time it's replaced by a shorter one that says the same thing: a new header with the next generation, and one `snapshot` record.
4	
5	## When
6	
7	- `compact()` runs it on request.
8	- After any write, automatically, when the log has passed `compactAfterBytes`.
9	
10	A failed automatic compaction doesn't fail the call that triggered it, because that call has already committed. `stats().lastCompactionError` shows the last failure.
11	
12	## How
13	
14	Compaction runs under the queue lock, after catching up, so the state it writes is complete.
15	
16	1. Build the snapshot from the current state, dropping finished jobs past `retainCompletedMs`.
17	2. Write the header and snapshot to `wal.log.compact`.
18	3. Rename it over `wal.log`.
19	4. Sync, and rebuild this process's state from the snapshot.
20	
21	## What the snapshot holds
22	
23	The jobs that are kept, and the counters the log needs to carry on. See [guarantees.md](guarantees.md), G10 and G11.
24	
25	## Other processes
26	
27	A process that was reading the old log finds a different file next time it catches up, and has to start again from the new one.
28
```

## 12. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\docs\\leases-and-retries.md"
}
```

```text
1	# Leases and retries
2	
3	## Leases
4	
5	`claim()` gives a job to a worker until `leaseUntil`, and hands back a `token`. The token goes on every later call about that attempt. A lease has expired once the clock reaches its deadline.
6	
7	A worker running a long job calls `heartbeat()`. `JobRunner` does this on a timer, every `leaseMs / 3` by default.
8	
9	Anyone can call `reapExpired()`. It returns expired jobs to the queue with a backoff, or sends them to `dead` when attempts have run out. An expired lease counts as a used attempt.
10	
11	## Tokens
12	
13	The token is the job's `fence`, which goes up by one with each claim. A call with a token that isn't current throws `StaleLeaseError`.
14	
15	## Backoff
16	
17	After an attempt fails, the job is due again after:
18	
19	'''
20	delay = min(maxMs, baseMs * factor ^ (attempts - 1))
21	'''
22	
23	With `jitter` above zero, the delay is reduced by up to that fraction. The reduction is derived from the job id and the attempt number, so that it's reproducible.
24	
25	## Attempts
26	
27	`attempts` counts claims. When an attempt ends in failure or expiry with `attempts >= maxAttempts`, the job goes `dead`. `requeueDead()` sets attempts back to zero and makes the job due now.
28	
29	## Clocks
30	
31	All processes are on one host and read the same system clock, so clock skew between processes isn't handled.
32
```

## 13. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\docs\\operations.md"
}
```

```text
1	# Operations
2	
3	## Files
4	
5	A queue directory holds `wal.log` and `queue.lock`. Temp files named `wal.log.*` can appear during compaction. Don't edit any of these by hand while the queue is in use.
6	
7	## Logging
8	
9	Silent by default. Set `WALQ_LOG=info` (or `debug`, `warn`, `error`) for JSON lines on stderr.
10	
11	## metrics()
12	
13	| Field | Meaning |
14	|---|---|
15	| `byType` | Job counts by type and status |
16	| `dueNow` | Ready jobs whose time has come |
17	| `delayed` | Ready jobs waiting for their time |
18	| `retriedJobs` | Jobs on their second attempt or later |
19	| `oldestReadyAgeMs` | How long the longest-waiting due job has waited |
20	| `nextLeaseExpiryMs` | Time until the next lease deadline, or null |
21	| `activeWorkers` | Distinct workers holding leases |
22	| `idempotencyKeys` | Keys currently remembered |
23	| `jobsEverEnqueued` | Total since the queue was created |
24	| `generation`, `logBytes` | The log |
25	| `tornTailsDropped` | Incomplete tails this process has dealt with |
26	| `lastCompactionError` | Why the last automatic compaction failed, or null |
27	
28	## Tools
29	
30	'''
31	node src/cli.mjs inspect <dir>        every record in the log
32	node src/cli.mjs stats <dir>          job counts
33	node src/cli.mjs metrics <dir>        the table above
34	node src/cli.mjs compact <dir>        compact now
35	node src/cli.mjs tail <dir>           follow the log as it grows
36	node src/cli.mjs requeue <dir> <id>   give a dead job new attempts

... [583 more characters in steps.jsonl]
```

## 14. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\package.json"
}
```

```text
1	{
2	  "name": "walq",
3	  "version": "0.4.2",
4	  "description": "A small durable job queue backed by a write-ahead log. No runtime dependencies.",
5	  "private": true,
6	  "type": "module",
7	  "main": "src/index.mjs",
8	  "engines": {
9	    "node": ">=24"
10	  },
11	  "scripts": {
12	    "test": "node --test test/*.mjs",
13	    "stress": "node scripts/stress.mjs"
14	  }
15	}
16
```

## 15. Said

Now the core source.

## 16. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\frame.mjs"
}
```

```text
1	// On-disk encoding of the log. The layout is specified in docs/wal-format.md and
2	// is a compatibility contract: logs already in production must stay readable.
3	
4	import { crc32 } from './crc32.mjs';
5	import { CorruptLogError } from './errors.mjs';
6	
7	export const FORMAT_VERSION = 1;
8	export const HEADER_SIZE = 20;
9	export const FRAME_OVERHEAD = 10;
10	
11	const FILE_MAGIC = Buffer.from('WALQ', 'latin1');
12	const FRAME_MAGIC = 0xfbad;
13	const MAX_PAYLOAD = 64 * 1024 * 1024;
14	
15	export function encodeHeader(generation) {
16	  const header = Buffer.alloc(HEADER_SIZE);
17	  FILE_MAGIC.copy(header, 0);
18	  header.writeUInt16LE(FORMAT_VERSION, 4);
19	  header.writeUInt32LE(generation, 8);
20	  header.writeUInt32LE(crc32(header.subarray(0, 16)), 16);
21	  return header;
22	}
23	
24	export function decodeHeader(bytes, file = 'log') {
25	  if (bytes.length < HEADER_SIZE) {
26	    throw new CorruptLogError(`${file}: header is missing or short (${bytes.length} bytes)`, { offset: 0 });
27	  }
28	  if (!bytes.subarray(0, 4).equals(FILE_MAGIC)) {
29	    throw new CorruptLogError(`${file}: not a walq log`, { offset: 0 });
30	  }
31	  if (bytes.readUInt32LE(16) !== crc32(bytes.subarray(0, 16))) {
32	    throw new CorruptLogError(`${file}: header checksum mismatch`, { offset: 0 });
33	  }
34	  const version = bytes.readUInt16LE(4);
35	  if (version !== FORMAT_VERSION) {
36	    throw new CorruptLogError(`${file}: unsupported format version ${version}`, { offset: 0 });
37	  }
... [2488 more characters in steps.jsonl]
```

## 17. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\wal.mjs"
}
```

```text
1	// The log file itself: a header, then checksummed frames, written only by the
2	// process holding the queue lock.
3	
4	import path from 'node:path';
5	import { decodeHeader, encodeFrame, encodeHeader, HEADER_SIZE, scanFrames } from './frame.mjs';
6	import { hit, isArmed } from './failpoints.mjs';
7	
8	// Bounds memory when a process has fallen far behind. The next catch-up reads on
9	// from wherever this one stopped.
10	const SCAN_CHUNK = 1024 * 1024;
11	
12	export class Wal {
13	  constructor(file, ops) {
14	    this.file = file;
15	    this.ops = ops;
16	  }
17	
18	  exists() {
19	    return this.ops.exists(this.file);
20	  }
21	
22	  /** Creates an empty log. The header appears atomically or not at all. */
23	  create(generation = 1) {
24	    const staging = `${this.file}.init`;
25	    this.ops.create(staging);
26	    this.ops.writeAt(staging, encodeHeader(generation), 0);
27	    this.ops.rename(staging, this.file);
28	    hit('wal.after-create', {});
29	    this.ops.sync(this.file);
30	    this.ops.syncDir(path.dirname(this.file));
31	  }
32	
33	  readHeader() {
34	    return decodeHeader(this.ops.read(this.file, 0, HEADER_SIZE), this.file);
35	  }
36	
37	  /** Decodes everything from `offset` to the end of the file. */
38	  scanFrom(offset) {
39	    return scanFrames(this.ops.read(this.file, offset, SCAN_CHUNK), offset);
40	  }
41	
42	  truncate(length) {
43	    this.ops.truncate(this.file, length);
44	  }
45	
46	  /** Writes records at the end of the file. Returns 
... [759 more characters in steps.jsonl]
```

## 18. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\fsops.mjs"
}
```

```text
1	// All file access for the log goes through a FileOps object so that it can be
2	// swapped for the power-loss model described in docs/crash-testing.md.
3	//
4	// Operations are path based, so no handle stays open between calls.
5	
6	import fs from 'node:fs';
7	import path from 'node:path';
8	
9	const NO_DIR_SYNC = new Set(['EPERM', 'EISDIR', 'EINVAL', 'EBADF', 'EACCES']);
10	
11	class RealFileOps {
12	  exists(file) {
13	    return fs.existsSync(file);
14	  }
15	
16	  size(file) {
17	    return fs.statSync(file).size;
18	  }
19	
20	  /** Reads from `offset` to `offset + length`, or to end of file. */
21	  read(file, offset = 0, length = Infinity) {
22	    const fd = fs.openSync(file, 'r');
23	    try {
24	      const available = Math.max(0, fs.fstatSync(fd).size - offset);
25	      const buffer = Buffer.allocUnsafe(Math.min(available, length));
26	      let filled = 0;
27	      while (filled < buffer.length) {
28	        const n = fs.readSync(fd, buffer, filled, buffer.length - filled, offset + filled);
29	        if (n === 0) break;
30	        filled += n;
31	      }
32	      return buffer.subarray(0, filled);
33	    } finally {
34	      fs.closeSync(fd);
35	    }
36	  }
37	
38	  create(file, { exclusive = false } = {}) {
39	    fs.closeSync(fs.openSync(file, exclusive ? 'wx' : 'w'));
40	  }
41	
42	  writeAt(file, bytes, position) {
43	    const fd = fs.openSync(file, 'r+');
44	    try {
45	      let written = 0;
46	      while (written < bytes.length) {
47	        writte
... [3382 more characters in steps.jsonl]
```

## 19. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\store.mjs"
}
```

```text
1	// Store: the replayed state plus the rules for reading and writing the log.
2	// Every read of shared state and every write happens inside withLock(), which
3	// first brings this process up to date with whatever other processes wrote.
4	
5	import path from 'node:path';
6	import { compactLog } from './compactor.mjs';
7	import { QueueClosedError } from './errors.mjs';
8	import { FORMAT_VERSION, HEADER_SIZE } from './frame.mjs';
9	import { createFileOps, ensureDir } from './fsops.mjs';
10	import { acquireLock } from './lock.mjs';
11	import { createLogger } from './logger.mjs';
12	import { applyRecord, createState } from './state.mjs';
13	import { Wal } from './wal.mjs';
14	
15	export const WAL_FILE = 'wal.log';
16	export const LOCK_FILE = 'queue.lock';
17	
18	const log = createLogger('store');
19	
20	export class Store {
21	  constructor(dir, config) {
22	    this.dir = dir;
23	    this.config = config;
24	    this.clock = config.clock;
25	    this.ops = createFileOps();
26	    this.wal = new Wal(path.join(dir, WAL_FILE), this.ops);
27	    this.lockPath = path.join(dir, LOCK_FILE);
28	    this.state = createState();
29	    this.generation = null;
30	    this.offset = HEADER_SIZE;
31	    this.snapshotBytes = 0;
32	    this.tornTailsDropped = 0;
33	    this.lastCompactionError = null;
34	    this.closed = false;
35	    this.holdingLock = false;
36	  }
37	
38	  open() {
39	    ensureDir(this.dir);
40	    this.#locked(() => {
41	      if (!this.wal.exists()) this.wal.create();
4
... [3351 more characters in steps.jsonl]
```

## 20. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\crc32.mjs"
}
```

```text
1	// CRC-32 (IEEE 802.3), table driven.
2	
3	const TABLE = new Int32Array(256);
4	for (let n = 0; n < 256; n += 1) {
5	  let c = n;
6	  for (let k = 0; k < 8; k += 1) {
7	    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
8	  }
9	  TABLE[n] = c;
10	}
11	
12	/** Pass the previous result as `seed` to continue a running checksum. */
13	export function crc32(bytes, seed = 0) {
14	  let c = ~seed;
15	  for (let i = 0; i < bytes.length; i += 1) {
16	    c = TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
17	  }
18	  return ~c >>> 0;
19	}
20
```

## 21. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\compactor.mjs"
}
```

```text
1	// Replaces the log with a one-record log holding the current state. Runs under
2	// the queue lock. docs/compaction.md describes the protocol.
3	
4	import path from 'node:path';
5	import { encodeFrame, encodeHeader } from './frame.mjs';
6	import { hit } from './failpoints.mjs';
7	import { buildSnapshot } from './snapshot.mjs';
8	
9	export function compactionTempPath(walFile) {
10	  return `${walFile}.compact`;
11	}
12	
13	/**
14	 * Writes and installs the next generation of the log. Returns the snapshot and
15	 * the size of the new file. If this throws, the old log is still in place.
16	 */
17	export function compactLog({ wal, ops, state, generation, now, config }) {
18	  const nextGeneration = generation + 1;
19	  const snapshot = buildSnapshot(state, now, config);
20	  const bytes = Buffer.concat([encodeHeader(nextGeneration), encodeFrame(snapshot)]);
21	  const tempPath = compactionTempPath(wal.file);
22	
23	  try {
24	    // Exclusive, so two compactors can never write the same temp file.
25	    ops.create(tempPath, { exclusive: true });
26	    ops.writeAt(tempPath, bytes, 0);
27	    hit('compact.after-tmp-write', { generation: nextGeneration });
28	    hit('compact.before-rename', { generation: nextGeneration });
29	    ops.rename(tempPath, wal.file);
30	    hit('compact.after-rename', { generation: nextGeneration });
31	    ops.sync(wal.file);
32	    ops.syncDir(path.dirname(wal.file));
33	  } catch (err) {
34	    err.message = `compaction failed: ${err.message}`;
3
... [109 more characters in steps.jsonl]
```

## 22. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\snapshot.mjs"
}
```

```text
1	// A compacted log starts with one snapshot record holding the state it replaces.
2	
3	import { isPastRetention } from './retention.mjs';
4	
5	function serializeJob(job) {
6	  return {
7	    id: job.id,
8	    type: job.type,
9	    payload: job.payload,
10	    key: job.key,
11	    status: job.status,
12	    maxAttempts: job.maxAttempts,
13	    availableAt: job.availableAt,
14	    lease: job.lease,
15	    result: job.result,
16	    lastError: job.lastError,
17	    enqueuedAt: job.enqueuedAt,
18	    completedAt: job.completedAt,
19	    completionSeq: job.completionSeq,
20	    seq: job.seq,
21	  };
22	}
23	
24	/** Builds the snapshot record, dropping terminal jobs past their retention. */
25	export function buildSnapshot(state, now, config) {
26	  const kept = [];
27	  for (const job of state.jobs.values()) {
28	    if (!isPastRetention(job, now, config)) kept.push(job);
29	  }
30	
31	  return {
32	    t: 'snapshot',
33	    at: now,
34	    seq: state.seq,
35	    completionSeq: state.completionSeq,
36	    jobs: kept.map(serializeJob),
37	  };
38	}
39	
40	export function loadSnapshot(state, rec) {
41	  state.seq = rec.seq;
42	  state.completionSeq = rec.completionSeq ?? 0;
43	  state.jobs = new Map();
44	  state.idem = new Map();
45	  for (const job of rec.jobs) {
46	    state.jobs.set(job.id, {
47	      ...job,
48	      priority: job.priority ?? 0,
49	      attempts: job.attempts ?? 0,
50	      fence: job.fence ?? job.lease?.fence ?? 0,
51	      completionSeq: job.completionSeq 
... [163 more characters in steps.jsonl]
```

## 23. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\retention.mjs"
}
```

```text
1	// How long finished jobs stay in the log.
2	
3	const TERMINAL = new Set(['done', 'dead']);
4	
5	export function isTerminal(job) {
6	  return TERMINAL.has(job.status);
7	}
8	
9	export function isPastRetention(job, now, config) {
10	  return isTerminal(job) && now - job.completedAt >= config.retainCompletedMs;
11	}
12
```

## 24. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\state.mjs"
}
```

```text
1	// The queue's state is a pure fold over the log. Replaying the same records must
2	// give the same state in every process, at any time.
3	
4	import { loadSnapshot } from './snapshot.mjs';
5	
6	export function createState() {
7	  return { jobs: new Map(), idem: new Map(), seq: 0, completionSeq: 0 };
8	}
9	
10	function requeue(job, availableAt, error) {
11	  job.status = 'ready';
12	  job.availableAt = availableAt;
13	  job.lease = null;
14	  job.lastError = error ?? job.lastError;
15	}
16	
17	export function applyRecord(state, rec, clock) {
18	  if (rec.t === 'snapshot') {
19	    loadSnapshot(state, rec);
20	    return;
21	  }
22	  if (rec.t === 'enqueue') {
23	    state.seq += 1;
24	    state.jobs.set(rec.id, {
25	      id: rec.id,
26	      type: rec.type,
27	      payload: rec.payload,
28	      key: rec.key ?? null,
29	      priority: rec.priority ?? 0,
30	      status: 'ready',
31	      attempts: 0,
32	      fence: 0,
33	      maxAttempts: rec.maxAttempts,
34	      availableAt: rec.availableAt,
35	      lease: null,
36	      result: null,
37	      lastError: null,
38	      enqueuedAt: rec.at,
39	      completedAt: null,
40	      completionSeq: null,
41	      seq: state.seq,
42	    });
43	    if (rec.key) state.idem.set(rec.key, { id: rec.id, at: rec.at });
44	    return;
45	  }
46	
47	  const job = state.jobs.get(rec.id);
48	  if (!job) return;
49	
50	  switch (rec.t) {
51	    case 'claim':
52	      job.status = 'leased';
53	      job.attempts += 1;
54	      job.fence =
... [1210 more characters in steps.jsonl]
```

## 25. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\queue.mjs"
}
```

```text
1	// The public queue API. All calls are synchronous: each one takes the queue lock,
2	// catches up with the log, decides, appends, and returns once the record is on disk.
3	
4	import { computeBackoff } from './backoff.mjs';
5	import { resolveOptions } from './config.mjs';
6	import { InvalidTransitionError, StaleLeaseError, UnknownJobError } from './errors.mjs';
7	import { hit } from './failpoints.mjs';
8	import { lookupKey } from './idempotency.mjs';
9	import { expiredLeases, pickNextReady } from './lease.mjs';
10	import { computeMetrics } from './metrics.mjs';
11	import {
12	  cancelRecord,
13	  claimRecord,
14	  completeRecord,
15	  deadRecord,
16	  enqueueRecord,
17	  expireRecord,
18	  failRecord,
19	  requeueRecord,
20	} from './records.mjs';
21	import { Store } from './store.mjs';
22	
23	function errorText(error) {
24	  if (error instanceof Error) return error.message;
25	  return error === undefined ? 'unknown error' : String(error);
26	}
27	
28	export class Queue {
29	  constructor(dir, options = {}) {
30	    this.dir = dir;
31	    this.config = resolveOptions(options);
32	    this.clock = this.config.clock;
33	    this.store = new Store(dir, this.config);
34	  }
35	
36	  open() {
37	    this.store.open();
38	    return this;
39	  }
40	
41	  close() {
42	    this.store.close();
43	  }
44	
45	  #require(id) {
46	    const job = this.store.state.jobs.get(id);
47	    if (!job) throw new UnknownJobError(id);
48	    return job;
49	  }
50	
51	  #requireLease(job, token) {
... [9162 more characters in steps.jsonl]
```

## 26. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\lock.mjs"
}
```

```text
1	// Cross-process mutex. The lock is an exclusive-share handle on queue.lock, so
2	// the operating system drops it the moment the holder dies, however it dies.
3	// There is no stale-lock cleanup to get wrong.
4	
5	import fs from 'node:fs';
6	import { sleepSync } from './clock.mjs';
7	import { LockTimeoutError } from './errors.mjs';
8	
9	// libuv's UV_FS_O_EXLOCK: open with no sharing on Windows, O_EXLOCK on macOS.
10	const O_EXLOCK = 0x10000000;
11	const OPEN_FLAGS = fs.constants.O_CREAT | fs.constants.O_RDWR | O_EXLOCK;
12	const BUSY = new Set(['EBUSY', 'EPERM', 'EACCES', 'EAGAIN', 'EWOULDBLOCK']);
13	
14	if (process.platform !== 'win32' && process.platform !== 'darwin') {
15	  throw new Error('walq needs exclusive-open locks, which this platform does not provide');
16	}
17	
18	/** Blocks until the lock is held and returns the function that releases it. */
19	export function acquireLock(lockPath, { timeoutMs }) {
20	  const deadline = performance.now() + timeoutMs;
21	  let wait = 0.5;
22	  for (;;) {
23	    try {
24	      const fd = fs.openSync(lockPath, OPEN_FLAGS);
25	      return () => fs.closeSync(fd);
26	    } catch (err) {
27	      if (!BUSY.has(err.code)) throw err;
28	    }
29	    if (performance.now() >= deadline) throw new LockTimeoutError(lockPath, timeoutMs);
30	    sleepSync(wait + Math.random() * wait);
31	    wait = Math.min(wait * 1.5, 6);
32	  }
33	}
34
```

## 27. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\records.mjs"
}
```

```text
1	// Constructors for the records stored in the log. docs/wal-format.md lists them.
2	
3	export function enqueueRecord({ id, type, payload, key, priority, maxAttempts, availableAt, at }) {
4	  return { t: 'enqueue', id, type, payload, key: key ?? null, priority: priority ?? 0, maxAttempts, availableAt, at };
5	}
6	
7	export function claimRecord({ id, worker, fence, leaseUntil, at }) {
8	  return { t: 'claim', id, worker, fence, leaseUntil, at };
9	}
10	
11	export function heartbeatRecord({ id, fence, leaseUntil, at }) {
12	  return { t: 'heartbeat', id, fence, leaseUntil, at };
13	}
14	
15	export function completeRecord({ id, fence, result, at }) {
16	  return { t: 'complete', id, fence, result: result ?? null, at };
17	}
18	
19	export function failRecord({ id, fence, error, delayMs, at }) {
20	  return { t: 'fail', id, fence, error, delayMs, at };
21	}
22	
23	export function expireRecord({ id, fence, delayMs, at }) {
24	  return { t: 'expire', id, fence, error: 'lease expired', delayMs, at };
25	}
26	
27	export function deadRecord({ id, fence, error, at }) {
28	  return { t: 'dead', id, fence, error, at };
29	}
30	
31	export function cancelRecord({ id, fence, error, at }) {
32	  return { t: 'cancel', id, fence, error, at };
33	}
34	
35	export function requeueRecord({ id, at }) {
36	  return { t: 'requeue', id, at };
37	}
38
```

## 28. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\lease.mjs"
}
```

```text
1	// Lease rules, as pure functions over the replayed state.
2	
3	/** A lease has expired once the clock reaches its deadline. */
4	export function isLeaseExpired(job, now) {
5	  return job.status === 'leased' && now >= job.lease.until;
6	}
7	
8	export function expiredLeases(state, now) {
9	  const expired = [];
10	  for (const job of state.jobs.values()) {
11	    if (isLeaseExpired(job, now)) expired.push(job);
12	  }
13	  return expired;
14	}
15	
16	function runsBefore(a, b) {
17	  if (a.priority !== b.priority) return a.priority > b.priority;
18	  if (a.availableAt !== b.availableAt) return a.availableAt < b.availableAt;
19	  return a.seq < b.seq;
20	}
21	
22	/** The highest-priority due job; among equals, the one due longest, then the oldest. */
23	export function pickNextReady(state, now, types = null) {
24	  let best = null;
25	  for (const job of state.jobs.values()) {
26	    if (job.status !== 'ready' || job.availableAt > now) continue;
27	    if (types && !types.includes(job.type)) continue;
28	    if (!best || runsBefore(job, best)) best = job;
29	  }
30	  return best;
31	}
32
```

## 29. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\idempotency.mjs"
}
```

```text
1	// Idempotency keys map a caller-chosen key to the job it created.
2	
3	/** Returns what a repeat enqueue with `key` should see, or null if the key is free. */
4	export function lookupKey(state, key, now, ttlMs) {
5	  const entry = state.idem.get(key);
6	  if (!entry) return null;
7	  if (now - entry.at >= ttlMs) return null;
8	  const job = state.jobs.get(entry.id);
9	  if (job) return { id: job.id, status: job.status, result: job.result ?? null };
10	  return { id: entry.id, status: entry.status ?? 'done', result: entry.result ?? null };
11	}
12
```

## 30. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\backoff.mjs"
}
```

```text
1	// Retry delay schedule.
2	
3	function fractionFor(salt, attempt) {
4	  let hash = 2166136261;
5	  for (const ch of `${salt}:${attempt}`) {
6	    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
7	  }
8	  return (hash >>> 0) / 2 ** 32;
9	}
10	
11	/**
12	 * Delay before a job may run again, given how many attempts it has used.
13	 * delay = min(maxMs, baseMs * factor^(attempts - 1)), then reduced by up to
14	 * `jitter` of itself. The reduction is derived from `salt` and the attempt so
15	 * that every process computes the same number.
16	 */
17	export function computeBackoff(attempts, policy, salt = '') {
18	  const exponent = Math.max(0, attempts - 1);
19	  const raw = Math.min(policy.maxMs, policy.baseMs * policy.factor ** exponent);
20	  const reduction = policy.jitter > 0 ? raw * policy.jitter * fractionFor(salt, attempts) : 0;
21	  return Math.round(raw - reduction);
22	}
23
```

## 31. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\config.mjs"
}
```

```text
1	// Option defaults and validation for openQueue().
2	
3	import { ConfigError } from './errors.mjs';
4	import { SystemClock } from './clock.mjs';
5	
6	const HOUR = 60 * 60 * 1000;
7	
8	const DEFAULTS = {
9	  leaseMs: 30_000,
10	  lockTimeoutMs: 10_000,
11	  compactAfterBytes: 4 * 1024 * 1024,
12	  retainCompletedMs: 24 * HOUR,
13	  idempotencyTtlMs: 7 * 24 * HOUR,
14	  maxAttempts: 5,
15	};
16	
17	const DEFAULT_BACKOFF = { baseMs: 1_000, factor: 2, maxMs: 60_000, jitter: 0 };
18	
19	function requireNonNegative(name, value) {
20	  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
21	    throw new ConfigError(`${name} must be a non-negative number, got ${value}`);
22	  }
23	}
24	
25	export function resolveOptions(options = {}) {
26	  const config = { ...DEFAULTS, ...options };
27	  config.clock = options.clock ?? new SystemClock();
28	  config.backoff = { ...DEFAULT_BACKOFF, ...(options.backoff ?? {}) };
29	
30	  for (const key of Object.keys(DEFAULTS)) requireNonNegative(key, config[key]);
31	  for (const key of ['baseMs', 'maxMs', 'jitter']) {
32	    requireNonNegative(`backoff.${key}`, config.backoff[key]);
33	  }
34	  if (config.backoff.factor < 1) throw new ConfigError('backoff.factor must be at least 1');
35	  if (config.backoff.jitter > 1) throw new ConfigError('backoff.jitter must be at most 1');
36	  if (config.maxAttempts < 1) throw new ConfigError('maxAttempts must be at least 1');
37	  if (typeof config.clock.now !== 'function') throw new Con
... [71 more characters in steps.jsonl]
```

## 32. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\failpoints.mjs"
}
```

```text
1	// Named failpoints. See docs/crash-testing.md for the list and what each one
2	// means. Production code calls hit() at each point; unless a rule is armed the
3	// call does nothing.
4	//
5	// Two ways to arm a point:
6	//
7	//   WALQ_FAILPOINTS="wal.mid-append#complete=kill@2,claim.before-lock=pause"
8	//   WALQ_FAILPOINT_DIR=<folder for marker files>
9	//
10	//   onFailpoint('claim.before-lock', (ctx) => { ... })   // same process
11	//
12	// A rule is name[#type]=action[@nth]. Actions are `kill` (terminate this
13	// process without running any cleanup) and `pause` (block until a release file
14	// appears). `kill` writes <name>.hit first and will not fire again while that
15	// file exists, so a restarted worker does not die at the same point forever.
16	
17	import fs from 'node:fs';
18	import path from 'node:path';
19	import { sleepSync } from './clock.mjs';
20	
21	const PAUSE_LIMIT_MS = 60_000;
22	
23	const callbacks = new Map();
24	const counts = new Map();
25	const rules = parseRules(process.env.WALQ_FAILPOINTS ?? '');
26	
27	function parseRules(spec) {
28	  const parsed = [];
29	  for (const item of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
30	    const match = /^([\w.-]+)(?:#([\w-]+))?=(kill|pause)(?:@(\d+))?$/.exec(item);
31	    if (!match) throw new Error(`bad failpoint rule: ${item}`);
32	    parsed.push({
33	      key: item.split('=')[0],
34	      name: match[1],
35	      type: match[2] ?? null,
36	      action: match[3],
37	      nth: match[4] 
... [1660 more characters in steps.jsonl]
```

## 33. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\worker\\runner.mjs"
}
```

```text
1	// JobRunner: the loop a worker process runs. Claim a job, run its handler with a
2	// heartbeat going, then record the outcome.
3	
4	import { sleep } from '../clock.mjs';
5	import { StaleLeaseError, UnknownJobError, WalqError } from '../errors.mjs';
6	import { hit } from '../failpoints.mjs';
7	import { JOB_COMPLETED, JOB_FAILED, JOB_FENCED, JOB_STARTED, WORKER_ERROR } from './protocol.mjs';
8	import { runWithTimeout } from './registry.mjs';
9	
10	export class JobRunner {
11	  constructor({ queue, workerId, handlers, leaseMs, heartbeatMs, pollMs = 20, types = null, emit = () => {} }) {
12	    this.queue = queue;
13	    this.workerId = workerId;
14	    this.handlers = handlers;
15	    this.leaseMs = leaseMs ?? queue.config.leaseMs;
16	    this.heartbeatMs = heartbeatMs ?? Math.max(10, Math.floor(this.leaseMs / 3));
17	    this.pollMs = pollMs;
18	    this.types = types;
19	    this.emit = emit;
20	    this.stopping = false;
21	  }
22	
23	  stop() {
24	    this.stopping = true;
25	  }
26	
27	  async run() {
28	    while (!this.stopping) {
29	      const job = this.#claimNext();
30	      if (job) await this.execute(job);
31	      else await sleep(this.pollMs);
32	    }
33	  }
34	
35	  #claimNext() {
36	    try {
37	      return this.queue.claim(this.workerId, { leaseMs: this.leaseMs, types: this.types });
38	    } catch (err) {
39	      if (!(err instanceof WalqError)) throw err;
40	      this.emit({ kind: WORKER_ERROR, error: err.message });
41	      return null;
42	    }
43	
... [1928 more characters in steps.jsonl]
```

## 34. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\worker\\pool.mjs"
}
```

```text
1	// WorkerPool: starts worker processes, replaces the ones that die, and returns
2	// jobs to the queue when their lease runs out.
3	
4	import { fork } from 'node:child_process';
5	import { EventEmitter } from 'node:events';
6	import { fileURLToPath } from 'node:url';
7	import { sleep } from '../clock.mjs';
8	import { createLogger } from '../logger.mjs';
9	import { openQueue } from '../queue.mjs';
10	import { STOP } from './protocol.mjs';
11	
12	const CHILD_PATH = fileURLToPath(new URL('./child.mjs', import.meta.url));
13	const STOP_GRACE_MS = 2_000;
14	
15	const log = createLogger('pool');
16	
17	export class WorkerPool extends EventEmitter {
18	  constructor({
19	    dir,
20	    handlers,
21	    size = 2,
22	    leaseMs = 30_000,
23	    heartbeatMs,
24	    pollMs = 20,
25	    reapMs,
26	    types = null,
27	    env = {},
28	    queue = {},
29	    maxRespawns = 100,
30	  }) {
31	    super();
32	    this.options = { dir, handlers, leaseMs, heartbeatMs, pollMs, types, queue };
33	    this.size = size;
34	    this.reapMs = reapMs ?? Math.max(20, Math.floor(leaseMs / 2));
35	    this.env = env;
36	    this.maxRespawns = maxRespawns;
37	    this.children = new Map();
38	    this.incarnation = 0;
39	    this.respawns = 0;
40	    this.stopping = false;
41	    this.reaper = null;
42	    this.queue = null;
43	  }
44	
45	  start() {
46	    this.queue = openQueue(this.options.dir, this.options.queue);
47	    for (let i = 0; i < this.size; i += 1) this.#spawn();
48	    this.reaper = se
... [2404 more characters in steps.jsonl]
```

## 35. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\worker\\child.mjs"
}
```

```text
1	// Entry point of a worker process. Started by WorkerPool with one JSON argument.
2	
3	import { openQueue } from '../queue.mjs';
4	import { send, STOP, WORKER_READY } from './protocol.mjs';
5	import { loadHandlers } from './registry.mjs';
6	import { JobRunner } from './runner.mjs';
7	
8	const options = JSON.parse(process.argv[2]);
9	
10	// A worker never outlives its pool: the channel closing means the parent is gone.
11	process.on('disconnect', () => process.exit(0));
12	
13	const handlers = await loadHandlers(options.handlers);
14	const queue = openQueue(options.dir, options.queue);
15	
16	const runner = new JobRunner({
17	  queue,
18	  workerId: options.workerId,
19	  handlers,
20	  leaseMs: options.leaseMs,
21	  heartbeatMs: options.heartbeatMs,
22	  pollMs: options.pollMs,
23	  types: options.types,
24	  emit: (message) => send({ ...message, workerId: options.workerId }),
25	});
26	
27	process.on('message', (message) => {
28	  if (message?.kind === STOP) runner.stop();
29	});
30	
31	send({ kind: WORKER_READY, workerId: options.workerId });
32	await runner.run();
33	queue.close();
34	process.exit(0);
35
```

## 36. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\worker\\registry.mjs"
}
```

```text
1	// Loads a handlers module. Each export is either a function or an object of the
2	// form { run, timeoutMs }.
3	
4	import { pathToFileURL } from 'node:url';
5	import { ConfigError } from '../errors.mjs';
6	
7	function normalise(type, entry) {
8	  if (typeof entry === 'function') return { run: entry, timeoutMs: null };
9	  if (entry && typeof entry.run === 'function') {
10	    const timeoutMs = entry.timeoutMs ?? null;
11	    if (timeoutMs !== null && !(timeoutMs > 0)) {
12	      throw new ConfigError(`handler ${type}: timeoutMs must be positive`);
13	    }
14	    return { run: entry.run, timeoutMs };
15	  }
16	  throw new ConfigError(`handler ${type} must be a function or { run, timeoutMs }`);
17	}
18	
19	export function normaliseHandlers(raw) {
20	  const handlers = new Map();
21	  for (const [type, entry] of Object.entries(raw)) handlers.set(type, normalise(type, entry));
22	  return handlers;
23	}
24	
25	export async function loadHandlers(file) {
26	  const module = await import(pathToFileURL(file).href);
27	  return normaliseHandlers(module.default ?? module);
28	}
29	
30	/** Runs a handler, rejecting if it outlasts its timeout. The signal tells it to stop. */
31	export function runWithTimeout(handler, payload, context, abort) {
32	  const running = Promise.resolve().then(() => handler.run(payload, context));
33	  if (handler.timeoutMs === null) return running;
34	  let timer;
35	  const timeout = new Promise((_, reject) => {
36	    timer = setTimeout(() => {
37	      
... [220 more characters in steps.jsonl]
```

## 37. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\worker\\protocol.mjs"
}
```

```text
1	// Messages between a WorkerPool and its child processes, over the fork() channel.
2	
3	export const WORKER_READY = 'ready';
4	export const JOB_STARTED = 'job-started';
5	export const JOB_COMPLETED = 'job-completed';
6	export const JOB_FAILED = 'job-failed';
7	export const JOB_FENCED = 'job-fenced';
8	export const WORKER_ERROR = 'worker-error';
9	export const STOP = 'stop';
10	
11	/** Sends if the channel is still open. A dead parent is not this worker's problem. */
12	export function send(message) {
13	  if (process.connected) {
14	    try {
15	      process.send(message);
16	    } catch {
17	      // The channel closed between the check and the send.
18	    }
19	  }
20	}
21
```

## 38. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\cli.mjs"
}
```

```text
1	#!/usr/bin/env node
2	// Operator tool.
3	//
4	//   node src/cli.mjs inspect <dir>        print every record in the log
5	//   node src/cli.mjs stats <dir>          print job counts
6	//   node src/cli.mjs compact <dir>        compact now
7	//   node src/cli.mjs tail <dir>           follow the log, keeping it open
8	//   node src/cli.mjs metrics <dir>        print operational numbers
9	//   node src/cli.mjs requeue <dir> <id>   give a dead job a fresh set of attempts
10	//   node src/cli.mjs cancel <dir> <id>    stop a job that has not finished
11	
12	import fs from 'node:fs';
13	import path from 'node:path';
14	import { HEADER_SIZE, scanFrames } from './frame.mjs';
15	import { describeRecord, inspectLog } from './inspect.mjs';
16	import { openQueue } from './queue.mjs';
17	import { WAL_FILE } from './store.mjs';
18	
19	function usage() {
20	  console.error('usage: cli.mjs <inspect|stats|compact|tail|metrics|requeue|cancel> <dir> [id]');
21	  process.exitCode = 2;
22	}
23	
24	function inspect(dir) {
25	  const view = inspectLog(dir);
26	  console.log(`${view.file}: generation ${view.header.generation}, ${view.size} bytes`);
27	  for (const frame of view.frames) console.log(`${frame.offset}\t${describeRecord(frame.record)}`);
28	  if (view.tail) console.log(`${view.tail.offset}\tincomplete tail (${view.tail.reason}, ${view.tail.bytes} bytes)`);
29	}
30	
31	function stats(dir) {
32	  const queue = openQueue(dir);
33	  console.log(JSON.stringify(queue.stats(), null, 2));
34	  
... [1525 more characters in steps.jsonl]
```

## 39. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\inspect.mjs"
}
```

```text
1	// Read-only view of a log, for tools and debugging. Takes no lock and changes
2	// nothing, so a torn tail is reported here and left for the next writer.
3	
4	import fs from 'node:fs';
5	import path from 'node:path';
6	import { decodeHeader, HEADER_SIZE, scanFrames } from './frame.mjs';
7	import { WAL_FILE } from './store.mjs';
8	
9	export function inspectLog(dir) {
10	  const file = path.join(dir, WAL_FILE);
11	  const bytes = fs.readFileSync(file);
12	  const header = decodeHeader(bytes, file);
13	  const { frames, end, tail } = scanFrames(bytes.subarray(HEADER_SIZE), HEADER_SIZE);
14	  return { file, header, frames, end, tail, size: bytes.length };
15	}
16	
17	export function describeRecord(record) {
18	  switch (record.t) {
19	    case 'enqueue':
20	      return `enqueue ${record.id} type=${record.type}${record.key ? ` key=${record.key}` : ''}`;
21	    case 'claim':
22	      return `claim ${record.id} worker=${record.worker} fence=${record.fence} until=${record.leaseUntil}`;
23	    case 'heartbeat':
24	      return `heartbeat ${record.id} fence=${record.fence} until=${record.leaseUntil}`;
25	    case 'complete':
26	      return `complete ${record.id} fence=${record.fence}`;
27	    case 'fail':
28	    case 'expire':
29	      return `${record.t} ${record.id} fence=${record.fence} delayMs=${record.delayMs}`;
30	    case 'cancel':
31	      return `cancel ${record.id} fence=${record.fence}`;
32	    case 'dead':
33	      return `dead ${record.id} fence=${record.fence} error=
... [202 more characters in steps.jsonl]
```

## 40. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\metrics.mjs"
}
```

```text
1	// Numbers an operator wants on a dashboard, computed from the replayed state.
2	
3	export function computeMetrics(state, now) {
4	  const byType = {};
5	  let oldestReadyAt = null;
6	  let dueNow = 0;
7	  let delayed = 0;
8	  let nextLeaseExpiry = null;
9	  const workers = new Set();
10	  let retriedJobs = 0;
11	
12	  for (const job of state.jobs.values()) {
13	    const row = (byType[job.type] ??= { ready: 0, leased: 0, done: 0, dead: 0, cancelled: 0 });
14	    row[job.status] += 1;
15	    if (job.attempts > 1) retriedJobs += 1;
16	
17	    if (job.status === 'ready') {
18	      if (job.availableAt <= now) {
19	        dueNow += 1;
20	        if (oldestReadyAt === null || job.availableAt < oldestReadyAt) oldestReadyAt = job.availableAt;
21	      } else {
22	        delayed += 1;
23	      }
24	    }
25	    if (job.status === 'leased') {
26	      workers.add(job.lease.worker);
27	      if (nextLeaseExpiry === null || job.lease.until < nextLeaseExpiry) nextLeaseExpiry = job.lease.until;
28	    }
29	  }
30	
31	  return {
32	    byType,
33	    dueNow,
34	    delayed,
35	    retriedJobs,
36	    oldestReadyAgeMs: oldestReadyAt === null ? 0 : now - oldestReadyAt,
37	    nextLeaseExpiryMs: nextLeaseExpiry === null ? null : nextLeaseExpiry - now,
38	    activeWorkers: workers.size,
39	    idempotencyKeys: state.idem.size,
40	    jobsEverEnqueued: state.seq,
41	  };
42	}
43
```

## 41. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\index.mjs"
}
```

```text
1	export { Queue, openQueue } from './queue.mjs';
2	export { WorkerPool } from './worker/pool.mjs';
3	export { JobRunner } from './worker/runner.mjs';
4	export { computeBackoff } from './backoff.mjs';
5	export { ManualClock, SystemClock } from './clock.mjs';
6	export { inspectLog, describeRecord } from './inspect.mjs';
7	export { onFailpoint, clearFailpoints, hit } from './failpoints.mjs';
8	export {
9	  ConfigError,
10	  CorruptLogError,
11	  InvalidTransitionError,
12	  LockTimeoutError,
13	  QueueClosedError,
14	  StaleLeaseError,
15	  UnknownJobError,
16	  WalqError,
17	} from './errors.mjs';
18
```

## 42. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\errors.mjs"
}
```

```text
1	// Error types raised by the queue. Callers are expected to branch on these
2	// classes rather than on message text.
3	
4	export class WalqError extends Error {
5	  constructor(message, details = {}) {
6	    super(message);
7	    this.name = new.target.name;
8	    Object.assign(this, details);
9	  }
10	}
11	
12	/** The log holds bytes we cannot explain and must not silently discard. */
13	export class CorruptLogError extends WalqError {}
14	
15	/** The caller's lease token is no longer the job's current token. */
16	export class StaleLeaseError extends WalqError {
17	  constructor(id, token, current) {
18	    super(`lease token ${token} is stale for job ${id} (current ${current})`, { id, token, current });
19	  }
20	}
21	
22	export class UnknownJobError extends WalqError {
23	  constructor(id) {
24	    super(`unknown job ${id}`, { id });
25	  }
26	}
27	
28	export class LockTimeoutError extends WalqError {
29	  constructor(path, timeoutMs) {
30	    super(`could not take ${path} within ${timeoutMs}ms`, { path, timeoutMs });
31	  }
32	}
33	
34	export class InvalidTransitionError extends WalqError {
35	  constructor(id, from, to) {
36	    super(`job ${id} cannot go from ${from} to ${to}`, { id, from, to });
37	  }
38	}
39	
40	export class ConfigError extends WalqError {}
41	
42	export class QueueClosedError extends WalqError {
43	  constructor() {
44	    super('queue is closed');
45	  }
46	}
47
```

## 43. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\clock.mjs"
}
```

```text
1	// Time source. Every timestamp written to the log comes from a clock so that
2	// tests can drive leases and retries without sleeping.
3	
4	export class SystemClock {
5	  now() {
6	    return Date.now();
7	  }
8	}
9	
10	export class ManualClock {
11	  constructor(start = 0) {
12	    this.current = start;
13	  }
14	
15	  now() {
16	    return this.current;
17	  }
18	
19	  advance(ms) {
20	    this.current += ms;
21	    return this.current;
22	  }
23	
24	  set(value) {
25	    this.current = value;
26	    return this.current;
27	  }
28	}
29	
30	const sleepCell = new Int32Array(new SharedArrayBuffer(4));
31	
32	/** Blocks the calling thread. Only for short waits inside synchronous code. */
33	export function sleepSync(ms) {
34	  if (ms > 0) Atomics.wait(sleepCell, 0, 0, ms);
35	}
36	
37	export function sleep(ms) {
38	  return new Promise((resolve) => setTimeout(resolve, ms));
39	}
40
```

## 44. Bash (exit 0)

```text
wc -l test/*.mjs test/helpers/*.mjs scripts/*.mjs CHANGELOG.md README.md && cat test/helpers/*.mjs && cat CHANGELOG.md README.md
```

```text
24 test/backoff-schedule.mjs
   86 test/compaction.mjs
   30 test/failpoints.mjs
   49 test/frame-format.mjs
   59 test/leases.mjs
  138 test/queue-basics.mjs
   67 test/recovery.mjs
   93 test/worker-pool.mjs
    8 test/helpers/append-then-die.mjs
   29 test/helpers/handlers.mjs
   50 test/helpers/tmp.mjs
   28 scripts/stress-handlers.mjs
  304 scripts/stress.mjs
   31 CHANGELOG.md
   74 README.md
 1070 total
// Opens the queue in argv[2] and enqueues one job. Run with a kill failpoint armed
// so that the process dies during the append.

import { openQueue } from '../../src/index.mjs';

const queue = openQueue(process.argv[2]);
queue.enqueue('from-child', { pid: process.pid });
queue.close();
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
    record({ id: ctx.id, attempt: ctx.attempt, worker: ctx.workerId
... [5198 more characters in steps.jsonl]
```

## 45. Said

I've read the docs and all of `src/`. I'm now reading the existing tests and the stress script, then I'll run a baseline before editing.

## 46. Bash (exit 0)

```text
cat test/recovery.mjs test/compaction.mjs test/leases.mjs test/worker-pool.mjs test/failpoints.mjs
```

```text
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ManualClock, openQueue } from '../src/index.mjs';
import { defer, tempDir } from './helpers/tmp.mjs';

const CHILD = fileURLToPath(new URL('./helpers/append-then-die.mjs', import.meta.url));

function seed(t) {
  const dir = tempDir(t);
  const clock = new ManualClock(1_000);
  const queue = openQueue(dir, { clock });
  queue.enqueue('x', 'first');
  queue.enqueue('x', 'second');
  queue.close();
  return { dir, clock, log: path.join(dir, 'wal.log') };
}

function exitOf(child) {
  return new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));
}

test('a log cut in the middle of its last record still opens', (t) => {
  const { dir, clock, log } = seed(t);
  const size = fs.statSync(log).size;
  fs.truncateSync(log, size - 5);
  const queue = openQueue(dir, { clock });
  assert.equal(queue.stats().total, 1);
  assert.equal(queue.listJobs()[0].payload, 'first');
});

test('a log whose last record has a bad checksum still opens', (t) => {
  const { dir, clock, log } = seed(t);
  const bytes = fs.readFileSync(log);
  bytes[bytes.length - 2] ^= 0xff;
  fs.writeFileSync(log, bytes);
  const queue = openQueue(dir, { clock });
  assert.equal(queue.stats().total, 1);
  assert.equal(queue.listJobs()[0].payload, 'first');
});

test('
... [10754 more characters in steps.jsonl]
```

## 47. Bash (exit 0)

```text
cat scripts/stress.mjs scripts/stress-handlers.mjs
```

```text
#!/usr/bin/env node
// Long-running stress test: real worker processes, crash points, compaction under
// load. Runs rounds until its time budget is used, printing every run and every log
// record, then checks what happened against docs/guarantees.md.
//
//   npm run stress
//   node scripts/stress.mjs --seed 7 --seconds 90
//
// The exit code is 1 if any round broke a guarantee. Most problems here are
// intermittent, so one clean run does not prove much.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeRecord, inspectLog, openQueue, WorkerPool } from '../src/index.mjs';

const HANDLERS = fileURLToPath(new URL('./stress-handlers.mjs', import.meta.url));
const ROUND_LIMIT_MS = 18_000;

const CRASH_POINTS = [
  'wal.before-append',
  'wal.mid-append',
  'wal.after-write',
  'wal.after-fsync',
  'wal.mid-append#claim',
  'wal.mid-append#complete',
  'wal.after-fsync#complete',
  'job.before-handler',
  'job.after-handler',
  'job.after-complete',
  'compact.after-tmp-write',
  'compact.before-rename',
  'compact.after-rename',
];

function parseArgs(argv) {
  const args = { seed: 1, seconds: 90 };
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i] === '--seed') args.seed = Number(argv[i + 1]);
    if (argv[i] === '--seconds') args.seconds = Number(argv[i + 1]);
  }
  return args;
}

function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x
... [10116 more characters in steps.jsonl]
```

## 48. Bash (exit 0)

```text
npm test 2>&1 | tail -60
```

```text
ℹ todo 0
ℹ duration_ms 6978.9184

✖ failing tests:

test at test\recovery.mjs:35:1
✖ a log whose last record has a bad checksum still opens (27.4645ms)
  Error [CorruptLogError]: corrupt record at offset 153 (bad-checksum)
      at scanFrames (file:///C:/invoice-work/14db8721/workspace/src/frame.mjs:84:15)
      at Wal.scanFrom (file:///C:/invoice-work/14db8721/workspace/src/wal.mjs:39:12)
      at Store.catchUp (file:///C:/invoice-work/14db8721/workspace/src/store.mjs:83:44)
      at file:///C:/invoice-work/14db8721/workspace/src/store.mjs:42:12
      at #locked (file:///C:/invoice-work/14db8721/workspace/src/store.mjs:55:14)
      at Store.open (file:///C:/invoice-work/14db8721/workspace/src/store.mjs:40:17)
      at Queue.open (file:///C:/invoice-work/14db8721/workspace/src/queue.mjs:37:16)
      at openQueue (file:///C:/invoice-work/14db8721/workspace/src/queue.mjs:279:34)
      at TestContext.<anonymous> (file:///C:/invoice-work/14db8721/workspace/test/recovery.mjs:40:17)
      at Test.runInAsyncScope (node:async_hooks:214:14) {
    offset: 153,
    reason: 'bad-checksum'
  }

test at test\worker-pool.mjs:43:1
✖ four workers sharing a queue run each job once (1017.8798ms)
  AssertionError [ERR_ASSERTION]: job j15 ran 2 times
  
  2 !== 1
  
      at TestContext.<anonymous> (file:///C:/invoice-work/14db8721/workspace/test/worker-pool.mjs:52:43)
      at async Test.run (node:internal/test_runner/test:1113:7)
      at async Test.processPendingSubtests (node:internal/test_ru
... [971 more characters in steps.jsonl]
```

## 49. Bash (exit 0)

```text
cat src/logger.mjs test/frame-format.mjs test/queue-basics.mjs | head -250; grep -rn "isTerminal\|scanFrom\|snapshotBytes\|\.refresh()" src scripts test | grep -v "^src/store.mjs"
```

```text
// Minimal structured logging to stderr. Silent unless WALQ_LOG names a level, so
// that programs embedding the queue do not get surprise output.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold() {
  return LEVELS[process.env.WALQ_LOG] ?? Infinity;
}

function write(level, scope, message, fields) {
  if (LEVELS[level] < threshold()) return;
  const entry = { at: new Date().toISOString(), level, scope, message, pid: process.pid, ...fields };
  process.stderr.write(`${JSON.stringify(entry)}\n`);
}

export function createLogger(scope) {
  return {
    debug: (message, fields = {}) => write('debug', scope, message, fields),
    info: (message, fields = {}) => write('info', scope, message, fields),
    warn: (message, fields = {}) => write('warn', scope, message, fields),
    error: (message, fields = {}) => write('error', scope, message, fields),
  };
}
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crc32 } from '../src/crc32.mjs';
import { CorruptLogError } from '../src/errors.mjs';
import { decodeHeader, encodeFrame, encodeHeader, FRAME_OVERHEAD, HEADER_SIZE, scanFrames } from '../src/frame.mjs';

test('crc32 matches the published check value', () => {
  assert.equal(crc32(Buffer.from('123456789', 'ascii')), 0xcbf43926);
});

test('crc32 can be continued across chunks', () => {
  const whole = crc32(Buffer.from('hello world'));
  const parts = crc32(Buffer.from(' world'), crc32(Buffer.from('hello')));
  ass
... [6764 more characters in steps.jsonl]
```

## 50. Said

Baseline: three failures (`recovery` bad-checksum tail, and two double-run tests). Those fit the bugs I found in the code. I'm starting the fixes with the frame decoder and WAL layer.

## 51. Bash (BLOCKED by harness-permission, error)

```text
python3 - <<'EOF' 2>/dev/null || echo nopython
EOF
node -e "
const z=require('zlib');const {crc32}=await import('./src/crc32.mjs');" 2>&1 | head -3
cat > /tmp/crc.mjs <<'EOF'
import zlib from 'node:zlib';
import { crc32 } from 'file:///C:/invoice-work/14db8721/workspace/src/crc32.mjs';
for (const n of [0,1,100,70000,1<<20,5<<20]) { const b=Buffer.alloc(n); for(let i=0;i<n;i++) b[i]=(i*31+7)&255; console.log(n, crc32(b)===zlib.crc32(b)); }
EOF
node /tmp/crc.mjs
```

```text
Text after the heredoc start on the same line cannot be statically analyzed
```

## 52. Write (BLOCKED by harness-permission, error)

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\scratch\\crc.mjs",
  "content": "import zlib from 'node:zlib';\nimport { crc32 } from 'file:///C:/invoice-work/14db8721/workspace/src/crc32.mjs';\nfor (const n of [0, 1, 100, 70000, 1 << 20, 5 << 20]) {\n  const b = Buffer.alloc(n);\n  for (let i = 0; i < n; i++) b[i] = (i * 31 + 7) & 255;\n  console.log(n, crc32(b) === zlib.crc32(b));\n}\n"
}
```

```text
Claude requested permissions to write to C:\invoice-work\14db8721\scratch\crc.mjs, but you haven't granted it yet.
```

## 53. PowerShell (exit 0)

```text
node --input-type=module -e "import zlib from 'node:zlib'; import { crc32 } from './src/crc32.mjs'; for (const n of [0,1,100,70000,1<<20,5<<20]) { const b=Buffer.alloc(n); for(let i=0;i<n;i++) b[i]=(i*31+7)&255; console.log(n, crc32(b)===zlib.crc32(b)); }"
```

```text
0 true
1 true
100 true
70000 true
1048576 true
5242880 true
```

## 54. Said

CRC is correct at all sizes. Now `frame.mjs`: a size limit on encode, an exact tail rule, and magic checks on short tails.

## 55. Bash (exit 0)

```text
node - <<'EOF'
const fs=require('fs');
let s=fs.readFileSync('src/frame.mjs','utf8');
s=s.replace("import { CorruptLogError } from './errors.mjs';","import { CorruptLogError, WalqError } from './errors.mjs';");
s=s.replace("const MAX_PAYLOAD = 64 * 1024 * 1024;","export const MAX_PAYLOAD = 64 * 1024 * 1024;");
s=s.replace(`  const payload = Buffer.from(JSON.stringify(record), 'utf8');
  const frame`,`  const payload = Buffer.from(JSON.stringify(record), 'utf8');
  if (payload.length > MAX_PAYLOAD) {
    // Refused before anything is written, so the log never holds a frame it cannot read back.
    throw new WalqError(\`record of \${payload.length} bytes exceeds the \${MAX_PAYLOAD} byte limit\`);
  }
  const frame`);
s=s.replace(`  const remaining = bytes.length - pos;
  if (remaining < FRAME_OVERHEAD) return { ok: false, reason: 'partial' };
  if (bytes.readUInt16LE(pos) !== FRAME_MAGIC) return { ok: false, reason: 'bad-magic' };`,
`  const remaining = bytes.length - pos;
  // A cut-off frame starts like any other, so even a short remainder must match the magic.
  if (remaining >= 1 && bytes[pos] !== (FRAME_MAGIC & 0xff)) return { ok: false, reason: 'bad-magic' };
  if (remaining >= 2 && bytes[pos + 1] !== FRAME_MAGIC >> 8) return { ok: false, reason: 'bad-magic' };
  if (remaining < FRAME_OVERHEAD) return { ok: false, reason: 'partial' };`);
s=s.replace(`  const expected = bytes.readUInt32LE(pos + 6);
  if (expected !== crc32(payload, crc32(bytes.subarray(pos + 2, pos + 6)))) {
    return { ok: false, reason: 'bad-checksum' };
  }
  try {
    return { ok: true, record: JSON.parse(payload.toString('utf8')), next: start + length };
  } catch {
    return { ok: false, reason: 'bad-payload' };
  }`,
`  const expected = bytes.readUInt32LE(pos + 6);
  const end = start + length;
  if (expected !== crc32(payload, crc32(bytes.subarray(pos + 2, pos + 6)))) {
    return { ok: false, reason: 'bad-checksum', end };
  }
  try {
    return { ok: true, record: JSON.parse(payload.t
... [1606 more characters in steps.jsonl]
```

```text
src/frame.mjs | 33 ++++++++++++++++++++++++---------
 1 file changed, 24 insertions(+), 9 deletions(-)
```

## 56. Said

Now `wal.mjs`: a catch-up loop that handles any frame size, a synced header on create, and an explicit append position.

## 57. Bash (exit 0)

```text
node - <<'EOF'
const fs=require('fs');
let s=fs.readFileSync('src/wal.mjs','utf8');
s=s.replace(`// Bounds memory when a process has fallen far behind. The next catch-up reads on
// from wherever this one stopped.
const SCAN_CHUNK`,`// How much of the log is decoded at a time, so that a process far behind does not
// hold the whole file in memory. A frame larger than this is read whole.
const SCAN_CHUNK`);
s=s.replace(`    this.ops.create(staging);
    this.ops.writeAt(staging, encodeHeader(generation), 0);
    this.ops.rename(staging, this.file);`,`    this.ops.create(staging);
    this.ops.writeAt(staging, encodeHeader(generation), 0);
    // The header must be durable before the file has its real name, or a power
    // cut can leave a log that exists and is empty.
    this.ops.sync(staging);
    this.ops.rename(staging, this.file);`);
s=s.replace(`  /** Decodes everything from \`offset\` to the end of the file. */
  scanFrom(offset) {
    return scanFrames(this.ops.read(this.file, offset, SCAN_CHUNK), offset);
  }`,`  /**
   * Decodes everything from \`offset\` to the end of the file, a chunk at a time.
   * \`visit(frames)\` gets each batch in order, so the caller need not hold them all.
   * Returns where the good frames end and the incomplete \`tail\`, if any.
   */
  scanFrom(offset, visit) {
    let pos = offset;
    let want = SCAN_CHUNK;
    for (;;) {
      const bytes = this.ops.read(this.file, pos, want);
      const { frames, end, tail } = scanFrames(bytes, pos);
      if (frames.length) visit(frames);
      pos = end;
      // Fewer bytes than asked for means the end of the file was in this read.
      const reachedEnd = bytes.length < want;
      if (reachedEnd) return { end, tail };
      if (tail) want = Math.max(SCAN_CHUNK, tail.needed);
      else want = SCAN_CHUNK;
    }
  }`);
s=s.replace(`  /** Writes records at the end of the file. Returns the new end offset. */
  append(records, { sync = true } = {}) {
    const type = records[0]?.t;
    co
... [376 more characters in steps.jsonl]
```

```text
(Bash completed with no output)
```

## 58. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\wal.mjs",
  "old_string": "      if (tail) want = Math.max(SCAN_CHUNK, tail.needed);\n      else want = SCAN_CHUNK;",
  "new_string": "      // One byte more than the tail needs, so that reaching the end shows as a short read.\n      want = tail ? Math.max(SCAN_CHUNK, tail.needed + 1) : SCAN_CHUNK;"
}
```

```text
The file C:\invoice-work\14db8721\workspace\src\wal.mjs has been updated successfully. (note: the file had been modified on disk since you last read it — the edit applied cleanly, but the file contains other changes not in your context. Read it before edits that depend on surrounding content.)
```

## 59. Said

Now `store.mjs`: catch-up by generation, batch-safe offsets, torn-tail truncation, and an amortised compaction trigger.

## 60. Bash (exit 0)

```text
node - <<'EOF'
const fs=require('fs');
let s=fs.readFileSync('src/store.mjs','utf8');
const a=s.indexOf('  catchUp() {');
const b=s.indexOf('  /** Must be called inside withLock(). */\n  compact()');
s=s.slice(0,a)+`  /**
   * Brings this.state up to date with the log. Must be called with the lock held,
   * so no writer is mid-append: whatever incomplete bytes end the file belong to a
   * writer that died, and are cut off before anything new is written after them.
   */
  catchUp() {
    const header = this.wal.readHeader();
    // A different generation is a different file: another process compacted. The
    // size check also covers a log that was cut back by hand.
    if (this.generation !== header.generation || this.ops.size(this.wal.file) < this.offset) {
      this.state = createState();
      this.offset = HEADER_SIZE;
      this.snapshotBytes = 0;
      this.generation = header.generation;
    }

    // The offset moves with every batch applied, so that a failure part way through
    // (a damaged record later in the log) never leads to a record being applied twice.
    const { end, tail } = this.wal.scanFrom(this.offset, (frames) => {
      for (const frame of frames) {
        applyRecord(this.state, frame.record);
        if (frame.record.t === 'snapshot') this.snapshotBytes = frame.size;
      }
      const last = frames[frames.length - 1];
      this.offset = last.offset + last.size;
    });
    this.offset = end;

    if (tail) {
      this.tornTailsDropped += 1;
      log.warn('cut off incomplete tail', { offset: end, reason: tail.reason, bytes: tail.bytes });
      this.wal.truncate(end);
    }
  }

  /** Must be called inside withLock(). */
  append(records, options) {
    this.offset = this.wal.append(records, this.offset, options);
    for (const record of records) applyRecord(this.state, record);
  }

`+s.slice(b);
s=s.replace(`    if (this.offset < threshold) return;
`,`    if (this.offset < threshold) return;
    // A snapshot is never smalle
... [328 more characters in steps.jsonl]
```

```text
24:    this.clock = config.clock;
124:      now: this.clock.now(),
```

## 61. Said

Now the compactor: clear any stale temp file, sync before the rename, and clean up on failure.

## 62. Bash (exit 0)

```text
node - <<'EOF'
const fs=require('fs');
let s=fs.readFileSync('src/compactor.mjs','utf8');
const a=s.indexOf('  try {\n    // Exclusive');
const b=s.indexOf('  return { snapshot');
s=s.slice(0,a)+`  let installed = false;
  try {
    // Holding the queue lock means nobody else is compacting, so a temp file that
    // is already here was left by a compaction that died or failed. Clear it, or
    // every later compaction would fail on it.
    ops.unlink(tempPath);
    ops.create(tempPath, { exclusive: true });
    ops.writeAt(tempPath, bytes, 0);
    hit('compact.after-tmp-write', { generation: nextGeneration });
    // Durable before it takes the log's name. Renaming unsynced bytes into place
    // leaves an empty log if the power goes next.
    ops.sync(tempPath);
    hit('compact.before-rename', { generation: nextGeneration });
    ops.rename(tempPath, wal.file);
    installed = true;
    hit('compact.after-rename', { generation: nextGeneration });
    ops.sync(wal.file);
    ops.syncDir(path.dirname(wal.file));
  } catch (err) {
    if (!installed) {
      try {
        ops.unlink(tempPath);
      } catch {
        // The next compaction clears it again; the original failure is what matters.
      }
    }
    err.message = \`compaction failed: \${err.message}\`;
    throw err;
  }

`+s.slice(b);
fs.writeFileSync('src/compactor.mjs',s);
EOF
```

```text
(Bash completed with no output)
```

## 63. Said

Now the snapshot: carry attempts, fence, priority and the idempotency table through compaction.

## 64. Bash (exit 0)

```text
cat > src/snapshot.mjs <<'EOF'
// A compacted log starts with one snapshot record holding the state it replaces.

import { isPastRetention } from './retention.mjs';

function serializeJob(job) {
  return {
    id: job.id,
    type: job.type,
    payload: job.payload,
    key: job.key,
    priority: job.priority,
    status: job.status,
    attempts: job.attempts,
    fence: job.fence,
    maxAttempts: job.maxAttempts,
    availableAt: job.availableAt,
    lease: job.lease,
    result: job.result,
    lastError: job.lastError,
    enqueuedAt: job.enqueuedAt,
    completedAt: job.completedAt,
    completionSeq: job.completionSeq,
    seq: job.seq,
  };
}

/**
 * The idempotency keys that are still within their time to live. A key outlives
 * its job, so an entry whose job is being dropped here carries the job's outcome.
 */
function serializeIdem(state, kept, now, config) {
  const entries = [];
  for (const [key, entry] of state.idem) {
    if (now - entry.at >= config.idempotencyTtlMs) continue;
    const out = { key, id: entry.id, at: entry.at };
    if (!kept.has(entry.id)) {
      const job = state.jobs.get(entry.id);
      out.status = job ? job.status : entry.status ?? 'done';
      out.result = job ? job.result ?? null : entry.result ?? null;
    }
    entries.push(out);
  }
  return entries;
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
    idem: serializeIdem(state, kept, now, config),
  };
}

export function loadSnapshot(state, rec) {
  state.seq = rec.seq;
  state.completionSeq = rec.completionSeq ?? 0;
  state.jobs = new Map();
  state.idem = new Map();
  for (const entry of rec.id
... [608 more characters in steps.jsonl]
```

```text
(Bash completed with no output)
```

## 65. Said

Now the reducer: retry due times come from the record's own `at`, `requeue` keeps the fence, and there's a new `release` record.

## 66. Bash (exit 0)

```text
node - <<'EOF'
const fs=require('fs');
let s=fs.readFileSync('src/state.mjs','utf8');
s=s.replace("export function applyRecord(state, rec, clock) {","export function applyRecord(state, rec) {");
s=s.replace(`    case 'fail':
    case 'expire':
      requeue(job, clock.now() + rec.delayMs, rec.error);
      break;`,`    case 'fail':
    case 'expire':
      // Due time is fixed by the record, not by when it happens to be replayed.
      requeue(job, rec.at + rec.delayMs, rec.error);
      break;
    case 'release':
      // The worker is known to be gone: runnable at once, the attempt still counted.
      if (job.status === 'leased' && job.fence === rec.fence) requeue(job, rec.at, rec.error);
      break;`);
s=s.replace(`      job.attempts = 0;
      job.fence = 0;
      job.completedAt = null;`,`      // The fence keeps counting: a token is never issued twice for a job.
      job.attempts = 0;
      job.completedAt = null;`);
fs.writeFileSync('src/state.mjs',s);
let r=fs.readFileSync('src/records.mjs','utf8');
r+=`
export function releaseRecord({ id, fence, error, at }) {
  return { t: 'release', id, fence, error, at };
}
`;
fs.writeFileSync('src/records.mjs',r);
EOF
grep -n "applyRecord" src/*.mjs
```

```text
src/state.mjs:17:export function applyRecord(state, rec) {
src/store.mjs:12:import { applyRecord, createState } from './state.mjs';
src/store.mjs:95:        applyRecord(this.state, frame.record);
src/store.mjs:113:    for (const record of records) applyRecord(this.state, record);
src/store.mjs:128:    applyRecord(this.state, snapshot);
```

## 67. Said

Now the main `queue.mjs` changes, covering the claim, reaper, heartbeat, enqueue and complete paths, plus the new API.

## 68. Bash (BLOCKED by harness-permission, error)

```text
node - <<'EOF'
const fs=require('fs');
let s=fs.readFileSync('src/queue.mjs','utf8');
function rep(from,to){ if(!s.includes(from)) throw new Error('missing: '+from.slice(0,60)); s=s.replace(from,to); }

rep(`  expireRecord,
  failRecord,
  requeueRecord,
} from`,`  expireRecord,
  failRecord,
  heartbeatRecord,
  releaseRecord,
  requeueRecord,
} from`);

rep(`  #requireLease(job, token) {
    if (job.status !== 'leased') {
      throw new StaleLeaseError(job.id, token, job.fence);
    }
  }`,`  /** The token must be the job's current one, and the job must still be leased. */
  #requireLease(job, token) {
    if (job.status !== 'leased' || job.fence !== token) {
      throw new StaleLeaseError(job.id, token, job.fence);
    }
  }`);

// enqueue
rep(`    const key = options.key ?? null;
    if (key) {
      this.store.refresh();
      const seen = lookupKey(this.store.state, key, this.clock.now(), this.config.idempotencyTtlMs);
      if (seen) return { ...seen, deduped: true };
    }
    hit('enqueue.before-lock', { key });
    return this.store.withLock(() => {
      const now = this.clock.now();
      const record`,`    const key = options.key ?? null;
    hit('enqueue.before-lock', { key });
    return this.store.withLock(() => {
      const now = this.clock.now();
      // Looked up under the lock: two processes racing on one key must not both create it.
      if (key) {
        const seen = lookupKey(this.store.state, key, now, this.config.idempotencyTtlMs);
        if (seen) return { ...seen, deduped: true };
      }
      const record`);

// claim
rep(`    this.store.refresh();
    const job = pickNextReady(this.store.state, this.clock.now(), types);
    if (!job) return null;
    const fence = job.fence + 1;
    hit('claim.before-lock', { worker });
    return this.store.withLock(() => {
      const now = this.clock.now();
      const leaseUntil = now + leaseMs;
      this.store.append([claimRecord({ id: job.id, worker, fence, leaseUntil, at: now })]);
      
... [6606 more characters in steps.jsonl]
```

```text
Contains brace with quote character (expansion obfuscation)
```

## 69. Said

The shell rejected that heredoc, so I'll make the edits with the Edit tool instead.

## 70. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\queue.mjs",
  "old_string": "  expireRecord,\n  failRecord,\n  requeueRecord,\n} from",
  "new_string": "  expireRecord,\n  failRecord,\n  heartbeatRecord,\n  releaseRecord,\n  requeueRecord,\n} from"
}
```

```text
The file C:\invoice-work\14db8721\workspace\src\queue.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 71. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\queue.mjs",
  "old_string": "  #requireLease(job, token) {\n    if (job.status !== 'leased') {",
  "new_string": "  /** The token must be the job's current one, and the job must still be leased. */\n  #requireLease(job, token) {\n    if (job.status !== 'leased' || job.fence !== token) {"
}
```

```text
The file C:\invoice-work\14db8721\workspace\src\queue.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 72. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\queue.mjs",
  "old_string": "    const key = options.key ?? null;\n    if (key) {\n      this.store.refresh();\n      const seen = lookupKey(this.store.state, key, this.clock.now(), this.config.idempotencyTtlMs);\n      if (seen) return { ...seen, deduped: true };\n    }\n    hit('enqueue.before-lock', { key });\n    return this.store.withLock(() => {\n      const now = this.clock.now();\n      const record",
  "new_string": "    const key = options.key ?? null;\n    hit('enqueue.before-lock', { key });\n    return this.store.withLock(() => {\n      const now = this.clock.now();\n      // Looked up under the lock: two processes racing on one key must not both create it.\n      if (key) {\n        const seen = lookupKey(this.store.state, key, now, this.config.idempotencyTtlMs);\n        if (seen) return { ...seen, deduped: true };\n      }\n      const record"
}
```

```text
The file C:\invoice-work\14db8721\workspace\src\queue.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 73. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\queue.mjs",
  "old_string": "    this.store.refresh();\n    const job = pickNextReady(this.store.state, this.clock.now(), types);\n    if (!job) return null;\n    const fence = job.fence + 1;\n    hit('claim.before-lock', { worker });\n    return this.store.withLock(() => {\n      const now = this.clock.now();\n      const leaseUntil = now + leaseMs;\n      this.store.append([claimRecord({ id: job.id, worker, fence, leaseUntil, at: now })]);\n      this.store.maybeCompact();\n      const claimed = this.store.state.jobs.get(job.id);\n      return {\n        id: claimed.id,\n        type: claimed.type,\n        payload: claimed.payload,\n        attempt: claimed.attempts,\n        token: fence,\n        leaseUntil,\n      };\n    });",
  "new_string": "    // A cheap look first, so that an idle worker polling does not pass the failpoint.\n    this.store.refresh();\n    if (!pickNextReady(this.store.state, this.clock.now(), types)) return null;\n    hit('claim.before-lock', { worker });\n    return this.store.withLock(() => {\n      const now = this.clock.now();\n      // Chosen again under the lock: while this process waited, another may have taken it.\n      const job = pickNextReady(this.store.state, now, types);\n      if (!job) return null;\n      const fence = job.fence + 1;\n      const leaseUntil = now + leaseMs;\n      this.store.append([claimRecord({ id: job.id, worker, fence, leaseUntil, at: now })]);\n      const claimed = this.store.state.jobs.get(job.id);\n      const lease = {\n        id: claimed.id,\n        type: claimed.type,\n        payload: claimed.payload,\n        attempt: claimed.attempts,\n        token: fence,\n        leaseUntil,\n      };\n      this.store.maybeCompact();\n      return lease;\n    });"
}
```

```text
The file C:\invoice-work\14db8721\workspace\src\queue.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 74. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\queue.mjs",
  "offset": 150,
  "limit": 90
}
```

```text
150	        leaseUntil,
151	      };
152	      this.store.maybeCompact();
153	      return lease;
154	    });
155	  }
156	
157	  /** Extends a lease. Throws StaleLeaseError if the lease is no longer ours. */
158	  heartbeat(id, token, { leaseMs = this.config.leaseMs } = {}) {
159	    // Heartbeats fire several times per lease. An fsync for each one would dominate
160	    // the log, so they only extend the lease this process is holding.
161	    const job = this.#require(id);
162	    this.#requireLease(job, token);
163	    const leaseUntil = this.clock.now() + leaseMs;
164	    job.lease.until = leaseUntil;
165	    return { leaseUntil };
166	  }
167	
168	  /** Marks a job finished and stores its result. */
169	  complete(id, token, result = null) {
170	    hit('complete.before-lock', { id });
171	    return this.store.withLock(() => {
172	      const job = this.#require(id);
173	      this.#requireLease(job, token);
174	      const record = completeRecord({ id, fence: token, result, at: this.clock.now() });
175	      // Completions are the hot path. The next synced append flushes this one too.
176	      this.store.append([record], { sync: false });
177	      this.store.maybeCompact();
178	      return { id, status: 'done' };
179	    });
180	  }
181	
182	  /** Reports a failed attempt. The job retries after a backoff, or goes dead. */
183	  fail(id, token, error) {
184	    return this.store.withLock(() => {
185	      const job = this.#require(id);
186	      this.#requireLease(jo
... [2371 more characters in steps.jsonl]
```

## 75. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\queue.mjs",
  "old_string": "  /** Extends a lease. Throws StaleLeaseError if the lease is no longer ours. */\n  heartbeat(id, token, { leaseMs = this.config.leaseMs } = {}) {\n    // Heartbeats fire several times per lease. An fsync for each one would dominate\n    // the log, so they only extend the lease this process is holding.\n    const job = this.#require(id);\n    this.#requireLease(job, token);\n    const leaseUntil = this.clock.now() + leaseMs;\n    job.lease.until = leaseUntil;\n    return { leaseUntil };\n  }\n\n  /** Marks a job finished and stores its result. */\n  complete(id, token, result = null) {\n    hit('complete.before-lock', { id });\n    return this.store.withLock(() => {\n      const job = this.#require(id);\n      this.#requireLease(job, token);\n      const record = completeRecord({ id, fence: token, result, at: this.clock.now() });\n      // Completions are the hot path. The next synced append flushes this one too.\n      this.store.append([record], { sync: false });\n      this.store.maybeCompact();\n      return { id, status: 'done' };\n    });\n  }",
  "new_string": "  /**\n   * Extends a lease. Throws StaleLeaseError if the lease is no longer ours. The\n   * extension goes into the log: the reaper may run in another process, and a\n   * deadline that only this process knew about would not stop it.\n   */\n  heartbeat(id, token, { leaseMs = this.config.leaseMs } = {}) {\n    return this.store.withLock(() => {\n      const job = this.#require(id);\n      this.#requireLease(job, token);\n      const now = this.clock.now();\n      const leaseUntil = now + leaseMs;\n      this.store.append([heartbeatRecord({ id, fence: token, leaseUntil, at: now })]);\n      this.store.maybeCompact();\n      return { leaseUntil };\n    });\n  }\n\n  /**\n   * Commits a job's result. The commit is the moment the record is durable. A\n   * repeat with the token that committ
... [2969 more characters in steps.jsonl]
```

```text
The file C:\invoice-work\14db8721\workspace\src\queue.mjs has been updated successfully.
```

## 76. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\queue.mjs",
  "old_string": "function errorText(",
  "new_string": "function receipt(job, outcome) {\n  return {\n    id: job.id,\n    outcome,\n    token: job.fence,\n    result: structuredClone(job.result),\n    completedAt: job.completedAt,\n    completionSeq: job.completionSeq,\n  };\n}\n\nfunction errorText("
}
```

```text
The file C:\invoice-work\14db8721\workspace\src\queue.mjs has been updated successfully.
```

## 77. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\queue.mjs",
  "old_string": "        this.store.append([deadRecord({ id, fence: token, error: text, at: now })]);\n        return {",
  "new_string": "        this.store.append([deadRecord({ id, fence: token, error: text, at: now })]);\n        this.store.maybeCompact();\n        return {"
}
```

```text
The file C:\invoice-work\14db8721\workspace\src\queue.mjs has been updated successfully.
```

## 78. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\queue.mjs",
  "old_string": "    const expired = expiredLeases(this.store.state, this.clock.now());\n    if (expired.length === 0) return [];\n    hit('reap.before-lock');\n    return this.store.withLock(() => {\n      const now = this.clock.now();\n      const records = [];\n      const reaped = [];\n      for (const job of expired) {",
  "new_string": "    if (expiredLeases(this.store.state, this.clock.now()).length === 0) return [];\n    hit('reap.before-lock');\n    return this.store.withLock(() => {\n      const now = this.clock.now();\n      const records = [];\n      const reaped = [];\n      // Worked out again under the lock: a worker may have heartbeated or finished\n      // while this process waited, and then its job has not expired.\n      for (const job of expiredLeases(this.store.state, now)) {"
}
```

```text
The file C:\invoice-work\14db8721\workspace\src\queue.mjs has been updated successfully.
```

## 79. Said

Now the backoff NaN guard, then the runner and pool.

## 80. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\backoff.mjs",
  "old_string": "  const raw = Math.min(policy.maxMs, policy.baseMs * policy.factor ** exponent);",
  "new_string": "  // With a zero base, a huge exponent would make 0 * Infinity, which is NaN.\n  const grown = policy.baseMs === 0 ? 0 : policy.baseMs * policy.factor ** exponent;\n  const raw = Math.min(policy.maxMs, grown);"
}
```

```text
The file C:\invoice-work\14db8721\workspace\src\backoff.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 81. Bash (BLOCKED by harness-permission, error)

```text
node -e "
const fs=require('fs');
let s=fs.readFileSync('src/worker/runner.mjs','utf8');
const a=s.indexOf('  async execute(job) {');
s=s.slice(0,a)+fs.readFileSync(0,'utf8');
fs.writeFileSync('src/worker/runner.mjs',s);
" <<'EOF'
  async execute(job) {
    const { id, token } = job;
    hit('job.before-handler', { id });
    this.emit({ kind: JOB_STARTED, id, attempt: job.attempt, token });

    const abort = new AbortController();
    let fenced = false;
    // The heartbeat keeps going until the outcome is recorded: a lease that lapses
    // while the queue is busy would let the job be taken from a worker that has finished it.
    const beat = setInterval(() => {
      try {
        this.queue.heartbeat(id, token, { leaseMs: this.leaseMs });
      } catch (err) {
        if (err instanceof StaleLeaseError || err instanceof UnknownJobError) {
          fenced = true;
          clearInterval(beat);
          abort.abort();
        } else {
          this.emit({ kind: WORKER_ERROR, error: err.message });
        }
      }
    }, this.heartbeatMs);

    try {
      let result;
      let failure = null;
      try {
        const handler = this.handlers.get(job.type);
        if (!handler) throw new Error(`no handler for job type ${job.type}`);
        result = await runWithTimeout(
          handler,
          job.payload,
          { id, attempt: job.attempt, token, workerId: this.workerId, signal: abort.signal },
          abort,
        );
      } catch (err) {
        failure = err;
      }

      if (fenced) {
        // The job belongs to someone else now, and whatever this attempt produced is discarded.
        this.emit({ kind: JOB_FENCED, id });
        return;
      }

      if (!failure) {
        hit('job.after-handler', { id });
        const done = await this.#record(id, () => this.queue.complete(id, token, result));
        if (done.fenced) {
          this.emit({ kind: JOB_FENCED, id });
          hit('job.after-complete', { id });
          return;
 
... [1795 more characters in steps.jsonl]
```

```text
Contains brace with quote character (expansion obfuscation)
```

## 82. Write

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\worker\\runner.mjs",
  "content": "// JobRunner: the loop a worker process runs. Claim a job, run its handler with a\n// heartbeat going, then record the outcome.\n\nimport { sleep } from '../clock.mjs';\nimport { StaleLeaseError, UnknownJobError, WalqError } from '../errors.mjs';\nimport { hit } from '../failpoints.mjs';\nimport { JOB_COMPLETED, JOB_FAILED, JOB_FENCED, JOB_STARTED, WORKER_ERROR } from './protocol.mjs';\nimport { runWithTimeout } from './registry.mjs';\n\n// Errors that come from the outcome itself rather than from the state of the queue\n// or the disk: repeating the call cannot change them.\nfunction isPermanent(err) {\n  return err instanceof TypeError || err instanceof RangeError || err?.permanent === true;\n}\n\nexport class JobRunner {\n  constructor({ queue, workerId, handlers, leaseMs, heartbeatMs, pollMs = 20, types = null, emit = () => {} }) {\n    this.queue = queue;\n    this.workerId = workerId;\n    this.handlers = handlers;\n    this.leaseMs = leaseMs ?? queue.config.leaseMs;\n    this.heartbeatMs = heartbeatMs ?? Math.max(10, Math.floor(this.leaseMs / 3));\n    this.pollMs = pollMs;\n    this.types = types;\n    this.emit = emit;\n    this.stopping = false;\n  }\n\n  stop() {\n    this.stopping = true;\n  }\n\n  async run() {\n    while (!this.stopping) {\n      const job = this.#claimNext();\n      if (job) await this.execute(job);\n      else await sleep(this.pollMs);\n    }\n  }\n\n  #claimNext() {\n    try {\n      return this.queue.claim(this.workerId, { leaseMs: this.leaseMs, types: this.types });\n    } catch (err) {\n      if (!(err instanceof WalqError)) throw err;\n      this.emit({ kind: WORKER_ERROR, error: err.message });\n      return null;\n    }\n  }\n\n  async execute(job) {\n    const { id, token } = job;\n    hit('job.before-handler', { id });\n    this.emit({ kind: JOB_STARTED, id, attempt: job.attempt, token });\n\n    const abort = new AbortController
... [3106 more characters in steps.jsonl]
```

```text
The file C:\invoice-work\14db8721\workspace\src\worker\runner.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 83. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\frame.mjs",
  "old_string": "byte limit`);",
  "new_string": "byte limit`, { permanent: true });"
}
```

```text
The file C:\invoice-work\14db8721\workspace\src\frame.mjs has been updated successfully. (note: the file had been modified on disk since you last read it — the edit applied cleanly, but the file contains other changes not in your context. Read it before edits that depend on surrounding content.)
```

## 84. Bash (exit 0)

```text
node -e "
const fs=require('fs');
let s=fs.readFileSync('src/worker/pool.mjs','utf8');
function rep(a,b){ if(!s.includes(a)) throw new Error('missing '+a.slice(0,40)); s=s.replace(a,b); }
rep(\"import { EventEmitter } from 'node:events';\",\"import { randomBytes } from 'node:crypto';\nimport { EventEmitter } from 'node:events';\");
rep('    this.incarnation = 0;','    // Pools can share a queue directory, and a reclaim must only ever reach workers\n    // of this pool, so worker ids carry the pool they belong to.\n    this.poolId = \`p\${process.pid}-\${randomBytes(3).toString(\'hex\')}\`;\n    this.incarnation = 0;\n    this.unreclaimed = new Set();');
rep('    this.reaper = setInterval(() => this.#reap(), this.reapMs);','    this.reaper = setInterval(() => this.#reap(), this.reapMs);');
rep('  #reap() {\n    try {\n      this.queue.reapExpired();','  #reap() {\n    try {\n      for (const workerId of this.unreclaimed) this.#reclaim(workerId);\n      this.queue.reapExpired();');
rep('const workerId = \`w\${this.incarnation}\`;','const workerId = \`\${this.poolId}-w\${this.incarnation}\`;');
rep('    this.children.delete(workerId);\n    this.emit(\'exit\', { workerId, code, signal });','    this.children.delete(workerId);\n    this.#reclaim(workerId);\n    this.emit(\'exit\', { workerId, code, signal });');
rep('  #spawn() {','  /**\n   * A worker that has exited holds nothing any more, so its jobs go back to the\n   * queue now instead of when their leases run out. If the queue cannot be reached\n   * the reaper tries again on its next tick.\n   */\n  #reclaim(workerId) {\n    try {\n      this.queue.reclaimWorker(workerId, { reason: \`worker \${workerId} exited\` });\n      this.unreclaimed.delete(workerId);\n    } catch (err) {\n      this.unreclaimed.add(workerId);\n      this.emit(\'error-event\', err);\n    }\n  }\n\n  #spawn() {');
fs.writeFileSync('src/worker/pool.mjs',s);
"
git diff src/worker/pool.mjs | head -80
```

```text
diff --git a/src/worker/pool.mjs b/src/worker/pool.mjs
index 1b622e7..8c52ea0 100644
--- a/src/worker/pool.mjs
+++ b/src/worker/pool.mjs
@@ -2,6 +2,7 @@
 // jobs to the queue when their lease runs out.
 
 import { fork } from 'node:child_process';
+import { randomBytes } from 'node:crypto';
 import { EventEmitter } from 'node:events';
 import { fileURLToPath } from 'node:url';
 import { sleep } from '../clock.mjs';
@@ -35,7 +36,11 @@ export class WorkerPool extends EventEmitter {
     this.env = env;
     this.maxRespawns = maxRespawns;
     this.children = new Map();
+    // Pools can share a queue directory, and a reclaim must only ever reach workers
+    // of this pool, so worker ids carry the pool they belong to.
+    this.poolId = `p${process.pid}-${randomBytes(3).toString('hex')}`;
     this.incarnation = 0;
+    this.unreclaimed = new Set();
     this.respawns = 0;
     this.stopping = false;
     this.reaper = null;
@@ -51,15 +56,31 @@ export class WorkerPool extends EventEmitter {
 
   #reap() {
     try {
+      for (const workerId of this.unreclaimed) this.#reclaim(workerId);
       this.queue.reapExpired();
     } catch (err) {
       this.emit('error-event', err);
     }
   }
 
+  /**
+   * A worker that has exited holds nothing any more, so its jobs go back to the
+   * queue now instead of when their leases run out. If the queue cannot be reached
+   * the reaper tries again on its next tick.
+   */
+  #reclaim(workerId) {
+    try {
+      this.queue.reclaimW
... [853 more characters in steps.jsonl]
```

## 85. Said

Now `tail`: it must not hold the log open (that blocks the compaction rename on Windows), and it must follow a new generation.

## 86. Bash (BLOCKED by harness-permission, error)

```text
node -e "
const fs=require('fs');
let s=fs.readFileSync('src/cli.mjs','utf8');
const a=s.indexOf('// Keeps a read handle');
const b=s.indexOf('const [command, dir, id]');
s=s.slice(0,a)+fs.readFileSync(0,'utf8')+'\n'+s.slice(b);
s=s.replace(\"import { HEADER_SIZE, scanFrames } from './frame.mjs';\",\"import { decodeHeader, HEADER_SIZE, scanFrames } from './frame.mjs';\");
s=s.replace('//   node src/cli.mjs tail <dir>           follow the log, keeping it open','//   node src/cli.mjs tail <dir>           follow the log as it grows');
fs.writeFileSync('src/cli.mjs',s);
" <<'EOF'
// Follows the log. The file is opened for each look and closed again at once: a
// handle held for as long as tail runs would stop a compaction from replacing the
// log (Windows refuses to rename over an open file). A new generation means the
// log was compacted, so reading starts again from its beginning.
function tail(dir) {
  const file = path.join(dir, WAL_FILE);
  let generation = null;
  let offset = HEADER_SIZE;

  function look() {
    const fd = fs.openSync(file, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const header = Buffer.alloc(HEADER_SIZE);
      fs.readSync(fd, header, 0, HEADER_SIZE, 0);
      const { generation: current } = decodeHeader(header.subarray(0, Math.min(size, HEADER_SIZE)), file);
      if (current !== generation) {
        generation = current;
        offset = HEADER_SIZE;
      }
      if (size <= offset) return;
      const bytes = Buffer.alloc(size - offset);
      fs.readSync(fd, bytes, 0, bytes.length, offset);
      const { frames, end } = scanFrames(bytes, offset);
      for (const frame of frames) console.log(describeRecord(frame.record));
      offset = end;
    } finally {
      fs.closeSync(fd);
    }
  }

  const timer = setInterval(() => {
    try {
      look();
    } catch (err) {
      // A compaction can swap the file between two reads; the next look sees the new one.
      if (err.code !== 'ENOENT' && err.code !== 'EBUSY' 
... [248 more characters in steps.jsonl]
```

```text
Contains brace with quote character (expansion obfuscation)
```

## 87. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\cli.mjs",
  "offset": 58,
  "limit": 26
}
```

```text
58	  queue.close();
59	}
60	
61	// Keeps a read handle on the log so that it sees every byte as it arrives.
62	function tail(dir) {
63	  const fd = fs.openSync(path.join(dir, WAL_FILE), 'r');
64	  let offset = HEADER_SIZE;
65	  const timer = setInterval(() => {
66	    const size = fs.fstatSync(fd).size;
67	    if (size <= offset) return;
68	    const bytes = Buffer.alloc(size - offset);
69	    fs.readSync(fd, bytes, 0, bytes.length, offset);
70	    const { frames, end } = scanFrames(bytes, offset);
71	    for (const frame of frames) console.log(describeRecord(frame.record));
72	    offset = end;
73	  }, 200);
74	  process.on('SIGINT', () => {
75	    clearInterval(timer);
76	    fs.closeSync(fd);
77	  });
78	}
79	
80	const [command, dir, id] = process.argv.slice(2);
81	const commands = { inspect, stats, compact, tail, metrics, requeue, cancel };
82	if (!commands[command] || !dir) usage();
83	else commands[command](dir, id);
```

## 88. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\cli.mjs",
  "old_string": "// Keeps a read handle on the log so that it sees every byte as it arrives.\nfunction tail(dir) {\n  const fd = fs.openSync(path.join(dir, WAL_FILE), 'r');\n  let offset = HEADER_SIZE;\n  const timer = setInterval(() => {\n    const size = fs.fstatSync(fd).size;\n    if (size <= offset) return;\n    const bytes = Buffer.alloc(size - offset);\n    fs.readSync(fd, bytes, 0, bytes.length, offset);\n    const { frames, end } = scanFrames(bytes, offset);\n    for (const frame of frames) console.log(describeRecord(frame.record));\n    offset = end;\n  }, 200);\n  process.on('SIGINT', () => {\n    clearInterval(timer);\n    fs.closeSync(fd);\n  });\n}",
  "new_string": "// Follows the log. The file is opened for each look and closed again at once: a\n// handle held for as long as tail runs would stop a compaction from replacing the\n// log (Windows refuses to rename over an open file). A new generation means the\n// log was compacted, so reading starts again from its beginning.\nfunction tail(dir) {\n  const file = path.join(dir, WAL_FILE);\n  let generation = null;\n  let offset = HEADER_SIZE;\n\n  function look() {\n    const fd = fs.openSync(file, 'r');\n    try {\n      const size = fs.fstatSync(fd).size;\n      const header = Buffer.alloc(Math.min(size, HEADER_SIZE));\n      fs.readSync(fd, header, 0, header.length, 0);\n      const current = decodeHeader(header, file).generation;\n      if (current !== generation) {\n        generation = current;\n        offset = HEADER_SIZE;\n      }\n      if (size <= offset) return;\n      const bytes = Buffer.alloc(size - offset);\n      fs.readSync(fd, bytes, 0, bytes.length, offset);\n      const { frames, end } = scanFrames(bytes, offset);\n      for (const frame of frames) console.log(describeRecord(frame.record));\n      offset = end;\n    } finally {\n      fs.closeSync(fd);\n    }\n  }\n\n  const timer = setInt
... [412 more characters in steps.jsonl]
```

```text
The file C:\invoice-work\14db8721\workspace\src\cli.mjs has been updated successfully.
```

## 89. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\cli.mjs",
  "old_string": "import { HEADER_SIZE, scanFrames }",
  "new_string": "import { decodeHeader, HEADER_SIZE, scanFrames }"
}
```

```text
The file C:\invoice-work\14db8721\workspace\src\cli.mjs has been updated successfully.
```

## 90. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\cli.mjs",
  "old_string": "follow the log, keeping it open",
  "new_string": "follow the log as it grows"
}
```

```text
The file C:\invoice-work\14db8721\workspace\src\cli.mjs has been updated successfully.
```

## 91. Bash (exit 0)

```text
npm test 2>&1 | grep -E "^ℹ (pass|fail)|✖|Error" | head -30
```

```text
ℹ pass 42
ℹ fail 0
```

## 92. Said

Existing tests are green, but that proves little. I'll start a stress run in the background and write the crash and multi-process tests meanwhile.

## 93. Bash (BLOCKED by harness-permission, error)

```text
npm run stress -- --seed 3 > "$TEMP/stress3.txt" 2>&1; tail -15 "$TEMP/stress3.txt"
```

```text
A variable in this command can't be checked before it runs
```

## 94. PowerShell (BLOCKED by harness-permission, error)

```text
npm run stress -- --seed 3 *> "$env:TEMP\stress3.txt"; Get-Content "$env:TEMP\stress3.txt" -Tail 20
```

```text
Command contains expandable strings with embedded expressions
```

## 95. Bash (exit 0)

```text
npm run stress -- --seed 3 > stress3.out 2>&1; tail -15 stress3.out
```

```text
Command running in background with ID: b37ib9513. Output is being written to: C:\invoice-home\14db8721\Temp\claude\C--invoice-work-14db8721-workspace\813138d3-caf7-4c4c-a477-761f76f2ba63\tasks\b37ib9513.output. You will be notified when it completes. To check interim output, use Read on that file path.
```

## 96. Said

Now the crash tests: a child process killed at each failpoint, with and without the power-loss model.

## 97. Write

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\test\\helpers\\crash-child.mjs",
  "content": "// A child that does one thing to the queue in argv[2] and is expected to be killed\n// by a failpoint on the way. argv[3] picks what it does.\n\nimport { openQueue } from '../../src/index.mjs';\n\nconst [, , dir, action] = process.argv;\nconst queue = openQueue(dir, { backoff: { baseMs: 0 } });\n\nswitch (action) {\n  case 'complete': {\n    const job = queue.claim('child');\n    queue.complete(job.id, job.token, { by: 'child' });\n    break;\n  }\n  case 'claim':\n    queue.claim('child');\n    break;\n  case 'compact':\n    queue.compact();\n    break;\n  case 'enqueue':\n    queue.enqueue('from-child', { pid: process.pid });\n    break;\n  case 'open':\n    break;\n  default:\n    throw new Error(`unknown action ${action}`);\n}\nqueue.close();\n"
}
```

```text
File created successfully at: C:\invoice-work\14db8721\workspace\test\helpers\crash-child.mjs (file state is current in your context — no need to Read it back)
```

## 98. Write

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\test\\crash-recovery.mjs",
  "content": "// Crashes and power cuts at every step of a write, checked against\n// docs/guarantees.md. Each case runs a child that a failpoint kills, then looks at\n// what the next process finds.\n\nimport assert from 'node:assert/strict';\nimport { fork } from 'node:child_process';\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport { test } from 'node:test';\nimport { fileURLToPath } from 'node:url';\nimport { CorruptLogError, ManualClock, openQueue } from '../src/index.mjs';\nimport { defer, tempDir } from './helpers/tmp.mjs';\n\nconst CHILD = fileURLToPath(new URL('./helpers/crash-child.mjs', import.meta.url));\n\nfunction exitOf(child) {\n  return new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal })));\n}\n\n/** Runs the child with a failpoint armed. Returns whether the failpoint fired. */\nasync function crash(t, dir, action, rules, { power = false } = {}) {\n  const markers = tempDir(t);\n  const env = { ...process.env, WALQ_FAILPOINTS: rules, WALQ_FAILPOINT_DIR: markers };\n  if (power) env.WALQ_SIMULATE_POWER_LOSS = '1';\n  const child = fork(CHILD, [dir, action], { env, silent: true });\n  defer(t, () => child.kill());\n  await exitOf(child);\n  const name = rules.split('=')[0].replace('#', '.');\n  return fs.existsSync(path.join(markers, `${name}.hit`));\n}\n\nconst later = () => new ManualClock(Date.now() + 3_600_000);\n\nfor (const power of [false, true]) {\n  const model = power ? 'power loss' : 'kill';\n\n  // The crash table of RFC 007, point by point.\n  for (const point of ['wal.before-append', 'wal.mid-append', 'wal.after-write', 'wal.after-fsync']) {\n    test(`complete cut off at ${point} (${model})`, async (t) => {\n      const dir = tempDir(t);\n      const seeded = openQueue(dir);\n      const { id } = seeded.enqueue('x', 1);\n      seeded.close();\n\n      assert.ok(await crash(t, dir, 'complete', `${point}#c
... [5339 more characters in steps.jsonl]
```

```text
File created successfully at: C:\invoice-work\14db8721\workspace\test\crash-recovery.mjs (file state is current in your context — no need to Read it back)
```

## 99. Write

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\test\\consistency.mjs",
  "content": "// Properties from docs/guarantees.md that only show up with several processes on\n// one log, across restarts, or across compaction. Two Queue instances on one folder\n// behave as two processes: each has its own state and takes the same lock.\n\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport { test } from 'node:test';\nimport { clearFailpoints, ManualClock, onFailpoint, openQueue, StaleLeaseError } from '../src/index.mjs';\nimport { tempDir } from './helpers/tmp.mjs';\n\nconst BACKOFF = { baseMs: 1_000, factor: 2, maxMs: 60_000 };\n\nfunction pair(t, options = {}) {\n  const clock = new ManualClock(1_000_000);\n  const dir = tempDir(t);\n  const settings = { clock, backoff: BACKOFF, ...options };\n  t.after(clearFailpoints);\n  return { clock, dir, a: openQueue(dir, settings), b: openQueue(dir, settings), settings };\n}\n\n/** Runs `action` once, the first time `name` is reached. */\nfunction once(name, action) {\n  let fired = false;\n  onFailpoint(name, () => {\n    if (fired) return;\n    fired = true;\n    action();\n  });\n}\n\ntest('G6: two workers racing for one job cannot both get it', (t) => {\n  const { a, b } = pair(t);\n  a.enqueue('x', 1);\n  let theirs;\n  once('claim.before-lock', () => {\n    theirs = b.claim('b');\n  });\n  const mine = a.claim('a');\n  assert.ok(theirs, 'the other process took it');\n  assert.equal(mine, null, 'this one must notice and take nothing');\n});\n\ntest('G6: racing claims on two jobs get different jobs and tokens', (t) => {\n  const { a, b } = pair(t);\n  a.enqueue('x', 1);\n  a.enqueue('x', 2);\n  let theirs;\n  once('claim.before-lock', () => {\n    theirs = b.claim('b');\n  });\n  const mine = a.claim('a');\n  assert.notEqual(mine.id, theirs.id);\n});\n\ntest('G6: a token is never issued twice for a job, even across requeue and compaction', (t) => {\n  const { clo
... [9534 more characters in steps.jsonl]
```

```text
File created successfully at: C:\invoice-work\14db8721\workspace\test\consistency.mjs (file state is current in your context — no need to Read it back)
```

## 100. Edit

```text
{
  "replace_all": false,
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\test\\consistency.mjs",
  "old_string": "  assert.equal(reopened.claim('w').id, id, 'long overdue, so due now');\n\n  clock.set(retryAt - 1);\n  const early = openQueue(dir, { ...settings, clock });\n  const { id: other } = early.enqueue('x', 2, { delayMs: 0 });\n  early.getJob(other);\n});",
  "new_string": "  assert.equal(reopened.claim('w').id, id, 'long overdue, so due now');\n  reopened.close();\n\n  // Reopened while the retry is still in the future, it is still not due.\n  clock.set(retryAt - 1);\n  const early = openQueue(dir, settings);\n  assert.equal(early.getJob(id).availableAt, retryAt);\n});"
}
```

```text
The file C:\invoice-work\14db8721\workspace\test\consistency.mjs has been updated successfully. (file state is current in your context — no need to Read it back)
```

## 101. Write

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\test\\rfc-007.mjs",
  "content": "// RFC 007: exactly-once completion.\n\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\nimport path from 'node:path';\nimport { test } from 'node:test';\nimport { fileURLToPath } from 'node:url';\nimport {\n  inspectLog,\n  JobRunner,\n  LockTimeoutError,\n  ManualClock,\n  openQueue,\n  StaleLeaseError,\n  UnknownJobError,\n  WorkerPool,\n} from '../src/index.mjs';\nimport { normaliseHandlers } from '../src/worker/registry.mjs';\nimport { defer, readLedger, tempDir, waitUntil } from './helpers/tmp.mjs';\n\nconst HANDLERS = fileURLToPath(new URL('./helpers/handlers.mjs', import.meta.url));\n\nfunction setup(t, options = {}) {\n  const clock = new ManualClock(1_000_000);\n  const dir = tempDir(t);\n  const settings = { clock, backoff: { baseMs: 100, factor: 2, maxMs: 1_000 }, ...options };\n  return { clock, dir, settings, queue: openQueue(dir, settings) };\n}\n\nconst records = (dir) => inspectLog(dir).frames.map((f) => f.record);\n\ntest('complete returns a receipt, and a repeat returns the same one without writing', (t) => {\n  const { queue, dir, settings } = setup(t);\n  const { id } = queue.enqueue('x', 1);\n  const job = queue.claim('w');\n  const first = queue.complete(job.id, job.token, { ok: 1 });\n  assert.equal(first.outcome, 'committed');\n  assert.deepEqual(Object.keys(first).sort(), ['completedAt', 'completionSeq', 'id', 'outcome', 'result', 'token']);\n  assert.equal(first.completionSeq, 1);\n  assert.equal(first.token, job.token);\n  assert.deepEqual(first.result, { ok: 1 });\n\n  const size = fs.statSync(path.join(dir, 'wal.log')).size;\n  const again = queue.complete(id, job.token, { ok: 'ignored' });\n  assert.equal(again.outcome, 'already-committed');\n  assert.deepEqual({ ...again, outcome: 'committed' }, first);\n  assert.equal(fs.statSync(path.join(dir, 'wal.log')).size, size);\n\n  queue.compact();\n  queue.close();\n  const reopene
... [14945 more characters in steps.jsonl]
```

```text
File created successfully at: C:\invoice-work\14db8721\workspace\test\rfc-007.mjs (file state is current in your context — no need to Read it back)
```

## 102. Bash (BLOCKED by harness-permission, error)

```text
sed -n '/=== summary ===/,$p' stress3.out
```

```text
sed command requires approval (contains potentially dangerous operations)
```

## 103. Grep

```text
{
  "pattern": "problem\\(s\\)|PROBLEM",
  "path": "C:\\invoice-work\\14db8721\\workspace\\stress3.out",
  "output_mode": "content"
}
```

```text
439:[round 1 contention] finished in 1575ms with 0 problem(s)
695:[round 2 crash] finished in 1077ms with 0 problem(s)
944:[round 3 compaction] finished in 1320ms with 0 problem(s)
1101:[round 4 lease] finished in 4384ms with 0 problem(s)
1409:[round 5 contention] finished in 1256ms with 0 problem(s)
1660:[round 6 crash] finished in 1246ms with 0 problem(s)
1909:[round 7 compaction] finished in 1701ms with 0 problem(s)
2066:[round 8 lease] finished in 4448ms with 0 problem(s)
2367:[round 9 contention] finished in 1249ms with 0 problem(s)
2618:[round 10 crash] finished in 1267ms with 0 problem(s)
2867:[round 11 compaction] finished in 1123ms with 0 problem(s)
3022:[round 12 lease] finished in 4509ms with 0 problem(s)
3470:[round 13 contention] finished in 1832ms with 0 problem(s)
3727:[round 14 crash] finished in 1369ms with 0 problem(s)
3976:[round 15 compaction] finished in 1333ms with 0 problem(s)
4135:[round 16 lease] finished in 4664ms with 0 problem(s)
4457:[round 17 contention] finished in 1608ms with 0 problem(s)
4707:[round 18 crash] finished in 1156ms with 0 problem(s)
4956:[round 19 compaction] finished in 1622ms with 0 problem(s)
5112:[round 20 lease] finished in 4371ms with 0 problem(s)
5595:[round 21 contention] finished in 1814ms with 0 problem(s)
5852:[round 22 crash] finished in 1352ms with 0 problem(s)
6101:[round 23 compaction] finished in 1074ms with 0 problem(s)
6257:[round 24 lease] finished in 4562ms with 0 problem(s)
6705:[round 25 contention] finished 
... [3119 more characters in steps.jsonl]
```

## 104. Said

Stress seed 3 was clean: 43 rounds, 0 problems. I'm now cleaning up the messy old-log test I just wrote, then running the new test files.

## 105. Bash (exit 0)

```text
rm -f stress3.out && grep -n "old logs keep working" test/rfc-007.mjs && grep -n "^function awaitFrame" test/rfc-007.mjs && grep -n "encodeFrameSync } from\|import { encodeFrame as" test/rfc-007.mjs
```

```text
192:test('old logs keep working: unknown records are ignored and old snapshots load', (t) => {
230:function awaitFrame() {
234:import { encodeFrame as encodeFrameSync } from '../src/frame.mjs';
```

## 106. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\test\\rfc-007.mjs",
  "offset": 190,
  "limit": 48
}
```

```text
190	});
191	
192	test('old logs keep working: unknown records are ignored and old snapshots load', (t) => {
193	  const { dir, queue, settings } = setup(t);
194	  queue.enqueue('x', 1);
195	  queue.close();
196	  // A snapshot as 0.4.x wrote it: no attempts, fence, priority or idem.
197	  const old = {
198	    t: 'snapshot',
199	    at: 5,
200	    seq: 2,
201	    jobs: [
202	      { id: 'j1', type: 'x', payload: 1, key: 'k', status: 'done', maxAttempts: 5, availableAt: 0, lease: null, result: 'r', lastError: null, enqueuedAt: 1_000_000, completedAt: 1_000_001, seq: 1 },
203	      { id: 'j2', type: 'x', payload: 2, key: null, status: 'ready', maxAttempts: 5, availableAt: 0, lease: null, result: null, lastError: null, enqueuedAt: 1, completedAt: null, seq: 2 },
204	    ],
205	  };
206	  const reopened = (() => {
207	    const file = path.join(dir, 'wal.log');
208	    // Rebuild the log with the old snapshot as its only record.
209	    const queue2 = openQueue(tempDir(t), settings);
210	    const header = fs.readFileSync(path.join(queue2.dir, 'wal.log')).subarray(0, 20);
211	    return { file, header };
212	  })();
213	  void reopened;
214	  const frames = [old, { t: 'future-record', id: 'j2', x: 1 }];
215	  const { encodeFrame } = awaitFrame();
216	  const body = Buffer.concat(frames.map(encodeFrame));
217	  const header = fs.readFileSync(path.join(dir, 'wal.log')).subarray(0, 20);
218	  fs.writeFileSync(path.join(dir, 'wal.log'), Buffer.concat([header, body]));
219	  const que
... [775 more characters in steps.jsonl]
```

## 107. Said

I'll replace that block with a clean version that builds the old-format log directly.

## 108. Bash (exit 0)

```text
node -e "
const fs=require('fs');
const lines=fs.readFileSync('test/rfc-007.mjs','utf8').split('\n');
// drop lines 192..234 (1-based) and splice in the replacement
const replacement=fs.readFileSync('test/.old-log-test.txt','utf8').split('\n');
lines.splice(191,43,...replacement);
fs.writeFileSync('test/rfc-007.mjs',lines.join('\n'));
" 2>&1 | head -3
```

```text
node:fs:440
    return binding.readFileUtf8(path, stringToFlags(options.flag));
                   ^
```

## 109. Said

That failed because I hadn't written the replacement file yet. I'll write it first.

## 110. Write

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\test\\.old-log-test.txt",
  "content": "test('old logs keep working: unknown records are ignored and old snapshots load', (t) => {\n  const { dir, settings } = setup(t);\n  // A snapshot as 0.4.x wrote it (no attempts, fence, priority or idem), then a\n  // record type from some future writer.\n  const old = {\n    t: 'snapshot',\n    at: 5,\n    seq: 2,\n    jobs: [\n      { id: 'j1', type: 'x', payload: 1, key: 'k', status: 'done', maxAttempts: 5, availableAt: 0, lease: null, result: 'r', lastError: null, enqueuedAt: 1_000_000, completedAt: 1_000_001, seq: 1 },\n      { id: 'j2', type: 'x', payload: 2, key: null, status: 'ready', maxAttempts: 5, availableAt: 0, lease: null, result: null, lastError: null, enqueuedAt: 1, completedAt: null, seq: 2 },\n    ],\n  };\n  const file = path.join(dir, 'wal.log');\n  const body = Buffer.concat([old, { t: 'future-record', id: 'j2', x: 1 }].map(encodeFrame));\n  fs.writeFileSync(file, Buffer.concat([fs.readFileSync(file).subarray(0, 20), body]));\n\n  const queue = openQueue(dir, settings);\n  assert.equal(queue.getJob('j1').status, 'done');\n  assert.equal(queue.getJob('j1').completionSeq, null);\n  assert.deepEqual(queue.completions(), []);\n  assert.equal(queue.enqueue('x', 3, { key: 'k' }).deduped, true);\n  const job = queue.claim('w');\n  assert.equal(job.id, 'j2');\n  assert.equal(job.token, 1);\n  assert.equal(queue.complete(job.id, job.token, 'ok').completionSeq, 1, 'numbering starts after the old ones');\n});\n"
}
```

```text
File created successfully at: C:\invoice-work\14db8721\workspace\test\.old-log-test.txt (file state is current in your context — no need to Read it back)
```

## 111. Bash (exit 0)

```text
node -e "
const fs=require('fs');
const lines=fs.readFileSync('test/rfc-007.mjs','utf8').split('\n');
const replacement=fs.readFileSync('test/.old-log-test.txt','utf8').replace(/\n+$/,'').split('\n');
lines.splice(191,43,...replacement);
let s=lines.join('\n');
s=s.replace(\"import { normaliseHandlers }\",\"import { encodeFrame } from '../src/frame.mjs';\nimport { normaliseHandlers }\");
fs.writeFileSync('test/rfc-007.mjs',s);
" && rm test/.old-log-test.txt && node --test test/rfc-007.mjs test/consistency.mjs test/crash-recovery.mjs 2>&1 | grep -E "^ℹ (pass|fail)|✖|not ok" | head -40
```

```text
✖ G3: an incomplete tail is cut off before the next write goes after it (20.1141ms)
ℹ pass 55
ℹ fail 1
✖ failing tests:
✖ G3: an incomplete tail is cut off before the next write goes after it (20.1141ms)
```

## 112. Bash (exit 0)

```text
node --test --test-name-pattern="G3: an incomplete" test/consistency.mjs 2>&1 | grep -B2 -A14 "AssertionError\|Error \["| head -40
```

```text
test at test\consistency.mjs:288:1
✖ G3: an incomplete tail is cut off before the next write goes after it (29.7709ms)
  Error [CorruptLogError]: corrupt record at offset 153 (bad-magic)
      at scanFrames (file:///C:/invoice-work/14db8721/workspace/src/frame.mjs:98:15)
      at Wal.scanFrom (file:///C:/invoice-work/14db8721/workspace/src/wal.mjs:50:37)
      at Store.catchUp (file:///C:/invoice-work/14db8721/workspace/src/store.mjs:93:36)
      at file:///C:/invoice-work/14db8721/workspace/src/store.mjs:42:12
      at #locked (file:///C:/invoice-work/14db8721/workspace/src/store.mjs:55:14)
      at Store.open (file:///C:/invoice-work/14db8721/workspace/src/store.mjs:40:17)
      at Queue.open (file:///C:/invoice-work/14db8721/workspace/src/queue.mjs:50:16)
      at openQueue (file:///C:/invoice-work/14db8721/workspace/src/queue.mjs:372:34)
      at TestContext.<anonymous> (file:///C:/invoice-work/14db8721/workspace/test/consistency.mjs:295:17)
      at Test.runInAsyncScope (node:async_hooks:214:14) {
    offset: 153,
    reason: 'bad-magic'
  }
```

## 113. Reasoning

The test failed because it cut off the frame's last 30 bytes, which aren't a valid prefix, so the bad-magic result is correct. I'll change the test to cut off the frame's first bytes instead.



## 114. Bash (exit 0)

```text
node -e "
const fs=require('fs');
let s=fs.readFileSync('test/consistency.mjs','utf8');
s=s.replace(\"  const good = fs.readFileSync(log);\n  fs.appendFileSync(log, good.subarray(good.length - 30)); // half of a frame, as a cut-off write\",\"  // The first half of a frame, as a cut-off write leaves it.\n  const cut = encodeFrame({ t: 'enqueue', id: 'j2', type: 'x', payload: 'q'.repeat(60), maxAttempts: 5, availableAt: 0, at: 0 });\n  fs.appendFileSync(log, cut.subarray(0, cut.length >> 1));\");
s=s.replace(\"import { tempDir }\",\"import { encodeFrame } from '../src/frame.mjs';\nimport { tempDir }\");
fs.writeFileSync('test/consistency.mjs',s);
" && npm test 2>&1 | grep -E "^ℹ (pass|fail)|✖"
```

```text
ℹ pass 98
ℹ fail 0
```

## 115. Said

All 98 pass. To check the new tests really catch the bugs, I'll run them against the original `src/` by stashing my source changes.

## 116. Bash (exit 0)

```text
git stash push -q -- src && node --test test/consistency.mjs test/crash-recovery.mjs 2>&1 | grep -E "^ℹ (pass|fail)|^✖|^  ✖" | sort | uniq | head -40; git stash pop -q && git status --short
```

```text
ℹ fail 30
ℹ pass 10
✖ G10: a key is remembered after its job has been pruned and the log compacted (39.6398ms)
✖ G10: a key racing between two processes creates one job (21.517ms)
✖ G11: compaction changes no job field (84.7957ms)
✖ G13: a process whose offset lies inside a larger new log follows the compaction (34.1185ms)
✖ G14: when the live state is larger than the threshold, writes do not each compact (847.3548ms)
✖ G3: an incomplete tail is cut off before the next write goes after it (24.0191ms)
✖ G5: a log of many megabytes reopens whole, and ids are not reused (184.6065ms)
✖ G5: a record far larger than one read chunk (55.6784ms)
✖ G5: a record over the format limit is refused and harms nothing (481.8622ms)
✖ G6: a token is never issued twice for a job, even across requeue and compaction (120.0883ms)
✖ G6: racing claims on two jobs get different jobs and tokens (34.395ms)
✖ G6: two workers racing for one job cannot both get it (35.5252ms)
✖ G7: a heartbeat is seen by the process that runs the reaper (27.761ms)
✖ G7: a reaper that waited for the lock does not reap a lease renewed meanwhile (28.1479ms)
✖ G8: an old token cannot touch the job (32.8724ms)
✖ G9: a retry keeps its due time across a restart (28.6199ms)
✖ G9: attempts and backoff carry through compaction, so maxAttempts holds (36.4659ms)
✖ G9: every process sees the same due time (27.7766ms)
✖ a compaction that keeps failing does not poison the next one (15.2883ms)
✖ a failed compaction cleans up its temp file
... [1229 more characters in steps.jsonl]
```

## 117. Said

The new tests are sensitive to the bugs: 30 of the 40 in those two files fail on the old code, and my source changes are restored. Next, a test for the `tail` / compaction EPERM problem.

## 118. Write

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\test\\operators.mjs",
  "content": "// Operators' tools run next to a live queue (docs/guarantees.md, G12). On Windows an\n// open handle stops a file from being replaced, so a tool that keeps the log open\n// would make every compaction fail for as long as it runs.\n\nimport assert from 'node:assert/strict';\nimport { spawn } from 'node:child_process';\nimport path from 'node:path';\nimport { test } from 'node:test';\nimport { fileURLToPath } from 'node:url';\nimport { openQueue } from '../src/index.mjs';\nimport { defer, tempDir, waitUntil } from './helpers/tmp.mjs';\n\nconst CLI = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));\n\nfunction startTail(t, dir) {\n  const child = spawn(process.execPath, [CLI, 'tail', dir], { stdio: ['ignore', 'pipe', 'pipe'] });\n  const lines = [];\n  let pending = '';\n  child.stdout.on('data', (chunk) => {\n    pending += chunk;\n    const parts = pending.split('\\n');\n    pending = parts.pop();\n    lines.push(...parts.map((l) => l.trim()).filter(Boolean));\n  });\n  child.stderr.resume();\n  defer(t, () => child.kill());\n  return { child, lines };\n}\n\ntest('a running `walq tail` does not stop compaction, and keeps following across it', async (t) => {\n  const dir = tempDir(t);\n  const queue = openQueue(dir, { compactAfterBytes: 0 });\n  queue.enqueue('x', 'first');\n  const { lines } = startTail(t, dir);\n  await waitUntil(() => lines.some((l) => l.startsWith('enqueue j1')));\n\n  for (let round = 0; round < 6; round += 1) {\n    queue.enqueue('x', round);\n    queue.compact();\n    await new Promise((resolve) => setTimeout(resolve, 250));\n  }\n  queue.enqueue('x', 'last');\n  assert.equal(queue.stats().generation, 7);\n  await waitUntil(() => lines.some((l) => l.startsWith('enqueue j8')), { timeoutMs: 5_000 });\n  assert.ok(path.isAbsolute(dir));\n});\n"
}
```

```text
File created successfully at: C:\invoice-work\14db8721\workspace\test\operators.mjs (file state is current in your context — no need to Read it back)
```

## 119. Bash (exit 0)

```text
node -e "
const fs=require('fs');let s=fs.readFileSync('test/operators.mjs','utf8');
s=s.replace(\"  assert.ok(path.isAbsolute(dir));\n\",'').replace(\"import path from 'node:path';\n\",'');
fs.writeFileSync('test/operators.mjs',s);" && node --test test/operators.mjs 2>&1 | grep -E "^ℹ (pass|fail)|✖" ; git stash push -q -- src && node --test test/operators.mjs 2>&1 | grep -E "^ℹ (pass|fail)|✖|EPERM" | head -5; git stash pop -q
```

```text
ℹ pass 1
ℹ fail 0
✖ a running `walq tail` does not stop compaction, and keeps following across it (345.34ms)
ℹ pass 0
ℹ fail 1
✖ failing tests:
✖ a running `walq tail` does not stop compaction, and keeps following across it (345.34ms)
```

## 120. Said

Confirmed: the `tail` test passes now and fails on the old code. Now the docs.

## 121. Bash (BLOCKED by harness-permission, error)

```text
node -e "
const fs=require('fs');
function edit(file, pairs){ let s=fs.readFileSync(file,'utf8'); for(const [a,b] of pairs){ if(!s.includes(a)) throw new Error(file+' missing: '+a.slice(0,50)); s=s.replace(a,b);} fs.writeFileSync(file,s); }

edit('docs/api.md',[
['**\`heartbeat(id, token, { leaseMs })\`** returns \`{ leaseUntil }\`. Throws \`StaleLeaseError\` if the lease is no longer yours.',
 '**\`heartbeat(id, token, { leaseMs })\`** returns \`{ leaseUntil }\`. Throws \`StaleLeaseError\` if the lease is no longer yours. The new deadline is written to the log, so every process, including whichever one runs the reaper, sees it.'],
['**\`complete(id, token, result)\`** records the result. Throws \`StaleLeaseError\` if the lease is no longer yours. RFC 007 changes what this returns.',
 '**\`complete(id, token, result)\`** commits the result and returns a receipt \`{ id, outcome, token, result, completedAt, completionSeq }\`. \`outcome\` is \`\\'committed\\'\` the first time. A repeat with the token that committed, even after a restart or a compaction, returns the stored receipt with \`outcome: \\'already-committed\\'\` and writes nothing. Any other token throws \`StaleLeaseError\`; a pruned job throws \`UnknownJobError\`. A lease past its deadline can still commit until a reaper, a reclaim, a cancel or a new claim has acted on it. See [rfc-007-exactly-once-completion.md](rfc-007-exactly-once-completion.md).'],
['**\`reapExpired()\`** returns jobs whose lease had run out to the queue, and returns \`[{ id, status, retryAt }]\`.',
 '**\`reapExpired()\`** returns jobs whose lease had run out to the queue, and returns \`[{ id, status, retryAt }]\`.\n\n**\`reclaimWorker(workerId, { reason })\`** gives up every lease held by a worker that is known to be dead, at once, and returns \`[{ id, status }]\`. Jobs come back \`ready\` with no backoff, or \`dead\` if their attempts have run out; the attempt counts and \`reason\` becomes \`lastError\`. Jobs the worker already committe
... [11580 more characters in steps.jsonl]
```

```text
Parser aborted (timeout, resource limit, or over-length)
```

## 122. Said

The shell parser couldn't handle that one. I'll put the doc edits in a script file and run it.

## 123. Write

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\docs-edit.tmp.mjs",
  "content": "import fs from 'node:fs';\n\nfunction edit(file, pairs) {\n  let s = fs.readFileSync(file, 'utf8');\n  for (const [a, b] of pairs) {\n    if (!s.includes(a)) throw new Error(`${file} missing: ${a.slice(0, 60)}`);\n    s = s.replace(a, () => b);\n  }\n  fs.writeFileSync(file, s);\n}\n\nedit('docs/api.md', [\n  [\n    '**`heartbeat(id, token, { leaseMs })`** returns `{ leaseUntil }`. Throws `StaleLeaseError` if the lease is no longer yours.',\n    '**`heartbeat(id, token, { leaseMs })`** returns `{ leaseUntil }`. Throws `StaleLeaseError` if the lease is no longer yours. The new deadline is written to the log, so every process, including whichever one runs the reaper, sees it.',\n  ],\n  [\n    '**`complete(id, token, result)`** records the result. Throws `StaleLeaseError` if the lease is no longer yours. RFC 007 changes what this returns.',\n    \"**`complete(id, token, result)`** commits the result and returns a receipt `{ id, outcome, token, result, completedAt, completionSeq }`. `outcome` is `'committed'` the first time. A repeat with the token that committed, even after a restart or a compaction, returns the stored receipt with `outcome: 'already-committed'` and writes nothing. Any other token throws `StaleLeaseError`; a pruned job throws `UnknownJobError`. A lease past its deadline can still commit until a reaper, a reclaim, a cancel or a new claim has acted on it. See [rfc-007-exactly-once-completion.md](rfc-007-exactly-once-completion.md).\",\n  ],\n  [\n    '**`reapExpired()`** returns jobs whose lease had run out to the queue, and returns `[{ id, status, retryAt }]`.',\n    \"**`reapExpired()`** returns jobs whose lease had run out to the queue, and returns `[{ id, status, retryAt }]`.\\n\\n**`reclaimWorker(workerId, { reason })`** gives up every lease held by a worker that is known to be dead, at once, and returns `[{ id, status }]`. Jobs come back `ready` with no back
... [10738 more characters in steps.jsonl]
```

```text
File created successfully at: C:\invoice-work\14db8721\workspace\docs-edit.tmp.mjs (file state is current in your context — no need to Read it back)
```

## 124. Bash (exit 0)

```text
node docs-edit.tmp.mjs && rm docs-edit.tmp.mjs && git status --short
```

```text
M CHANGELOG.md
 M docs/api.md
 M docs/architecture.md
 M docs/compaction.md
 M docs/leases-and-retries.md
 M docs/operations.md
 M docs/rfc-007-exactly-once-completion.md
 M docs/wal-format.md
 M package.json
 M src/backoff.mjs
 M src/cli.mjs
 M src/compactor.mjs
 M src/frame.mjs
 M src/queue.mjs
 M src/records.mjs
 M src/snapshot.mjs
 M src/state.mjs
 M src/store.mjs
 M src/wal.mjs
 M src/worker/pool.mjs
 M src/worker/runner.mjs
?? test/consistency.mjs
?? test/crash-recovery.mjs
?? test/helpers/crash-child.mjs
?? test/operators.mjs
?? test/rfc-007.mjs
```

## 125. Said

Docs are updated. Now more stress runs with different seeds. I'm running them one after another so they don't disturb each other's timing.

## 126. Bash (BLOCKED by harness-permission, error)

```text
(npm run stress -- --seed 7 > stress7.out 2>&1; npm run stress -- --seed 19 > stress19.out 2>&1; tail -n 3 stress7.out stress19.out)
```

```text
This command can't be checked before it runs
```

## 127. Bash (exit 0)

```text
npm run stress -- --seed 7 > stress7.out 2>&1; npm run stress -- --seed 19 > stress19.out 2>&1; echo done
```

```text
Command running in background with ID: bzzlwvgza. Output is being written to: C:\invoice-home\14db8721\Temp\claude\C--invoice-work-14db8721-workspace\813138d3-caf7-4c4c-a477-761f76f2ba63\tasks\bzzlwvgza.output. You will be notified when it completes. To check interim output, use Read on that file path.
```

## 128. Said

While that runs, I'll re-read the changed core files for mistakes.

## 129. Read

```text
{
  "file_path": "C:\\invoice-work\\14db8721\\workspace\\src\\wal.mjs",
  "offset": 36,
  "limit": 50
}
```

```text
36	  readHeader() {
37	    return decodeHeader(this.ops.read(this.file, 0, HEADER_SIZE), this.file);
38	  }
39	
40	  /**
41	   * Decodes everything from `offset` to the end of the file, a chunk at a time.
42	   * `visit(frames)` gets each batch in order, so the caller need not hold them all.
43	   * Returns where the good frames end and the incomplete `tail`, if any.
44	   */
45	  scanFrom(offset, visit) {
46	    let pos = offset;
47	    let want = SCAN_CHUNK;
48	    for (;;) {
49	      const bytes = this.ops.read(this.file, pos, want);
50	      const { frames, end, tail } = scanFrames(bytes, pos);
51	      if (frames.length) visit(frames);
52	      pos = end;
53	      // Fewer bytes than asked for means the end of the file was in this read.
54	      const reachedEnd = bytes.length < want;
55	      if (reachedEnd) return { end, tail };
56	      // One byte more than the tail needs, so that reaching the end shows as a short read.
57	      want = tail ? Math.max(SCAN_CHUNK, tail.needed + 1) : SCAN_CHUNK;
58	    }
59	  }
60	
61	  truncate(length) {
62	    this.ops.truncate(this.file, length);
63	  }
64	
65	  /** Writes records at `at`, which must be the end of the good log. Returns the new end offset. */
66	  append(records, at, { sync = true } = {}) {
67	    const type = records[0]?.t;
68	    const bytes = Buffer.concat(records.map(encodeFrame));
69	    hit('wal.before-append', { type });
70	    if (isArmed('wal.mid-append')) {
71	      const half = bytes.length >> 1;
72	      
... [417 more characters in steps.jsonl]
```

## 130. Monitor (error)

```text
{
  "query": "select:Monitor",
  "max_results": "1"
}
```

```text
<tool_use_error>InputValidationError: Monitor failed due to the following issue:
The required parameter `description` is missing

This tool's schema was not sent to the API — it was not in the discovered-tool set derived from message history. Without the schema in your prompt, typed parameters (arrays, numbers, booleans) get emitted as strings and the client-side parser rejects them. Load the tool first: call ToolSearch with query "select:Monitor", then retry this call. For reference, this tool's input schema is: {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"description":{"description":"Short human-readable description of what you are monitoring (shown in notifications).","type":"string"},"timeout_ms":{"description":"Kill the monitor after this deadline. Default 300000ms. Deadlines above 600000ms are capped to 600000ms. You are notified at expiry and can re-arm.","default":300000,"type":"number","minimum":1000,"maximum":3600000},"command":{"description":"Shell command or script. Each stdout line is an event; exit ends the watch.","type":"string"},"ws":{"description":"WebSocket to open. Each text frame is an event; binary frames are reported as a placeholder line. Socket close ends the watch. Cannot be combined with command.","type":"object","properties":{"url":{"type":"string"},"protocols":{"type":"array","items":{"type":"string","pattern":"^[!#$%&'*+.^_`|~0-9A-Za-z-]+$"}}},"required":["url"],"additionalProperties":false}},"required"
... [76 more characters in steps.jsonl]
```

## 131. Grep

```text
{
  "pattern": "rounds, \\d+ problem|PROBLEM",
  "path": "C:\\invoice-work\\14db8721\\workspace",
  "glob": "stress*.out",
  "output_mode": "content"
}
```

```text
No matches found
```

## 132. Said

Neither run has finished yet. I'll wait for the completion notice rather than poll.

## 133. ScheduleWakeup

```text
{
  "delaySeconds": 240,
  "reason": "Waiting for the two background stress runs (about 3 minutes total) to finish",
  "prompt": "Check stress7.out and stress19.out in the walq workspace for \"rounds, N problem(s)\" lines, then run npm test and finish the final report.",
  "noop": true
}
```

```text
Next wakeup scheduled for 16:26:00 (in 270s). If you owe the user a status update this tick, write it now as ordinary response text; then end the turn — the harness re-invokes you when the wakeup fires or a task-notification arrives.
```

## 134. Said

Stress runs for seeds 7 and 19 are in progress. I've fixed the code and the docs and added tests, and everything passes so far: 98 existing and new tests, plus a clean seed-3 stress run of 43 rounds. I'm waiting on the last two stress runs before I write up the details.

## 135. Grep

```text
{
  "pattern": "rounds, \\d+ problem|PROBLEM",
  "path": "C:\\invoice-work\\14db8721\\workspace",
  "glob": "stress*.out",
  "output_mode": "content"
}
```

```text
stress7.out:11627:43 rounds, 0 problem(s)
stress19.out:11708:44 rounds, 0 problem(s)
```

## 136. Bash (exit 0)

```text
rm -f stress7.out stress19.out && npm test 2>&1 | grep -E "^ℹ (pass|fail)|✖"; git status --short | grep -v "^ M"
```

```text
ℹ pass 99
ℹ fail 0
?? test/consistency.mjs
?? test/crash-recovery.mjs
?? test/helpers/crash-child.mjs
?? test/operators.mjs
?? test/rfc-007.mjs
```

## 137. Said

I fixed the root causes behind each symptom and implemented RFC 007. `npm test` passes (99 tests), and `npm run stress` was clean on seeds 3, 7 and 19 (130 rounds, 0 problems). Nothing is committed.

## What went wrong

**Tuesday's incident.** Two bugs combined:
- After a crash mid-append, the next process ignored the half-written record but appended after it. The following startup then hit a bad checksum and raised `CorruptLogError`. Trimming by hand removed the good records behind it. Now the incomplete tail is cut off under the lock before anything is written after it.
- `compact` and `create` renamed files into place before syncing them, which is the 0-byte `wal.log` after a power cut. Both now sync first.

**Double runs.**
- `claim` chose its job before taking the lock, so two workers could get the same job with the same token.
- Heartbeats lived only in the worker's memory, so the pool's reaper expired live workers.
- Lease tokens were never compared, so an old token could still act on a job.
- `reapExpired` also decided before the lock.

**Idempotency key reused after compaction.** Snapshots forgot keys once their job was pruned. They now carry the keys with their outcome. Key lookup also happens under the lock now, so two processes can't both create a job for one key.

**Retries.**
- Due times were computed at replay time, so a restart moved them. They now come from the record's own timestamp.
- Snapshots dropped `attempts`, `fence` and `priority`, so a job that always fails never reached its limit of 5. They're now saved.
- `requeueDead` reset the fence, which could reissue a token.

**Compaction.**
- A leftover temp file made every later compaction fail with `EEXIST`. It is now cleared first and removed on failure.
- `walq tail` held the log open, which on Windows blocks the rename (`EPERM`). It now opens the log only for each look and follows across compactions.
- Other processes noticed a compaction by comparing file size. They now compare the header generation.
- Automatic compaction now waits until the log is twice the snapshot size, so a large live state doesn't trigger a rewrite on every write.

**The large queue.** Catch-up read only the first 1 MiB of the log, so ids could be reused and jobs overwritten. A record over 1 MiB could never be read. Catch-up now reads the whole log in chunks, and any record up to the 64 MiB limit works. A record over the limit is refused before anything is written.

**Completions.** They weren't synced, so a power cut could lose an acknowledged completion. They are now.

## RFC 007

- `complete()` returns a receipt, with `outcome` `'committed'` or `'already-committed'`.
- `getResult()`, `completions()` and `reclaimWorker()` are new, along with the `release` record.
- Pools reclaim a worker's jobs as soon as it exits, with worker ids unique per pool so a reclaim only touches that pool's own workers.
- Workers keep retrying to record a finished job, and they report `job-fenced` if the job has been taken from them. A result that can never be serialised fails the attempt instead of hanging the worker.

The log format change is additive: the `release` record and extra snapshot fields. Old snapshots still load. Docs, CHANGELOG and the version (now 0.5.0) are updated. Failpoint names, the public API and `docs/guarantees.md` are unchanged.

## How I tested

- 5 new test files (`consistency`, `crash-recovery`, `rfc-007`, `operators`, plus a crash helper). They kill a child process at each failpoint, with and without the power-loss model, through the full RFC crash table. They race two queue instances on one directory, and cover very large records and logs, old-format snapshots and the `tail`/compaction case.
- Run against the original `src/`, 31 of those tests fail. I also ran the new tests against the old code to confirm they catch the bugs.
- The three tests that already failed before my changes now pass.

## Open points

- **G4 conflicts with an existing test.** `recovery.mjs` requires a log whose last record has a bad checksum to open. So a damaged final record is treated as an interrupted write and dropped, which can't be told apart from real damage to the last acknowledged record. Damage anywhere earlier raises `CorruptLogError` and leaves the file untouched. This is documented in `wal-format.md`.
- **Backups can still block compaction.** A backup tool holding `wal.log` open will still make compaction fail with `EPERM` on Windows. It's now harmless: the failure leaves nothing behind and the next attempt succeeds. I can't prevent it from inside walq.
- **Failed compactions retry on every write.** The cost is one snapshot build per write while one is failing. I didn't add a backoff, in case other teams' tests expect a prompt retry.
- **Cancelled jobs are never pruned.** They stay in the log forever. I left that alone because it isn't a documented guarantee.
- **The big-queue report is a diagnosis, not a reproduction.** The 1 MiB read limit explains it and is covered by tests, but I couldn't confirm it is what happened on your host.
- **Stress is probabilistic.** Three clean seeds is evidence, not proof.
- **Heartbeats cost an fsync each.** They're now durable log records, so there's one fsync per heartbeat, every `leaseMs/3` per running job.

## 138. Said

I already did these checks, so I'm not re-running anything. The `.out` files are deleted now, and the numbers below are from when I read them.

- **Stress, seed 7:** `43 rounds, 0 problem(s)`
- **Stress, seed 19:** `44 rounds, 0 problem(s)`
- **Stress, seed 3 (earlier):** `43 rounds, 0 problem(s)`
- **`npm test`:** 99 pass, 0 fail

The final report is in my previous message and nothing in it changes. Nothing is committed. The only untracked files are the five new test files: `consistency`, `crash-recovery`, `rfc-007`, `operators` and the helper `crash-child`.

I'd read the open points in that report before you merge, especially the G4 trade-off. An existing test requires a log with a bad checksum on its last record to open, so a damaged final record is dropped as if it were an interrupted write.
