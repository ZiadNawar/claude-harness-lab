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
    state = (state + 0x6d2b79f5) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 2 ** 32;
  };
}

function pickMany(random, list, count) {
  const pool = [...list];
  const picked = [];
  while (picked.length < count && pool.length) {
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return picked;
}

function readLedger(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

class Round {
  constructor(index, name) {
    this.index = index;
    this.name = name;
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'walq-stress-'));
    this.markers = path.join(this.dir, 'markers');
    fs.mkdirSync(this.markers);
    this.queueDir = path.join(this.dir, 'q');
    this.ledger = path.join(this.dir, 'ledger.jsonl');
    this.problems = [];
  }

  say(line) {
    console.log(`[round ${this.index} ${this.name}] ${line}`);
  }

  problem(line) {
    this.problems.push(line);
    console.log(`[round ${this.index} ${this.name}] PROBLEM: ${line}`);
  }

  dumpLog() {
    try {
      const view = inspectLog(this.queueDir);
      this.say(`log: generation ${view.header.generation}, ${view.size} bytes, ${view.frames.length} records`);
      for (const frame of view.frames) this.say(`  @${frame.offset} ${describeRecord(frame.record)}`);
      if (view.tail) this.say(`  @${view.tail.offset} incomplete tail: ${view.tail.reason}`);
      return view;
    } catch (err) {
      this.problem(`the log cannot be read: ${err.name}: ${err.message}`);
      return null;
    }
  }

  dumpLedger() {
    const entries = readLedger(this.ledger);
    for (const entry of entries) {
      this.say(`  ${entry.event} ${entry.id} attempt=${entry.attempt} token=${entry.token} worker=${entry.worker}`);
    }
    return entries;
  }

  cleanup() {
    fs.rmSync(this.dir, { recursive: true, force: true, maxRetries: 40, retryDelay: 50 });
  }
}

function checkLogHistory(round, view) {
  if (!view) return;
  const committed = new Map();
  for (const { record } of view.frames) {
    if (record.id === undefined) continue;
    if (committed.has(record.id)) round.problem(`${record.t} for ${record.id} after it committed`);
    if (record.t === 'complete') committed.set(record.id, record);
  }
}

async function runPool(round, poolOptions) {
  const pool = new WorkerPool({
    dir: round.queueDir,
    handlers: HANDLERS,
    pollMs: 5,
    maxRespawns: 60,
    ...poolOptions,
    env: { WALQ_STRESS_LEDGER: round.ledger, WALQ_FAILPOINT_DIR: round.markers, ...(poolOptions.env ?? {}) },
  });
  pool.on('exit', ({ workerId, code }) => round.say(`worker ${workerId} exited with code ${code}`));
  pool.on('stderr', (text) => round.say(`worker stderr: ${text.trim().slice(0, 400)}`));
  pool.on('error-event', (err) => round.say(`pool error: ${err.message}`));
  pool.on('message', (message) => {
    if (message.kind !== 'ready') round.say(`${message.workerId} ${message.kind} ${message.id ?? ''} ${message.error ?? ''}`);
  });
  pool.start();
  try {
    await pool.drain({ timeoutMs: ROUND_LIMIT_MS });
  } catch (err) {
    round.problem(err.message);
  }
  await pool.stop();
}

/** Many workers, short jobs, nothing goes wrong: every job must run exactly once. */
async function contentionRound(round, random) {
  const queue = openQueue(round.queueDir);
  const total = 40 + Math.floor(random() * 30);
  queue.enqueueMany(Array.from({ length: total }, (_, n) => ({ type: 'work', payload: { n, ms: Math.floor(random() * 4) } })));
  await runPool(round, { size: 4, leaseMs: 15_000 });

  const entries = round.dumpLedger();
  const view = round.dumpLog();
  checkLogHistory(round, view);
  const starts = new Map();
  for (const entry of entries) {
    if (entry.event === 'start') starts.set(entry.id, (starts.get(entry.id) ?? 0) + 1);
  }
  for (const [id, count] of starts) {
    if (count !== 1) round.problem(`job ${id} ran ${count} times with no crash involved`);
  }
  const stats = queue.stats();
  if (stats.done !== total) round.problem(`${stats.done} of ${total} jobs finished`);
  queue.close();
}

/** Workers die at chosen points: every job must still commit once, and none is lost. */
async function crashRound(round, random) {
  const queue = openQueue(round.queueDir, { backoff: { baseMs: 20, factor: 2, maxMs: 200 } });
  const total = 30;
  const acked = queue.enqueueMany(
    Array.from({ length: total }, (_, n) => ({
      type: n % 5 === 0 ? 'wobbly' : 'work',
      payload: { n, ms: Math.floor(random() * 6), succeedOn: 2 },
      options: { maxAttempts: 30 },
    })),
  );
  const points = pickMany(random, CRASH_POINTS.filter((p) => !p.startsWith('compact.')), 4);
  const rules = points.map((point) => `${point}=kill@${2 + Math.floor(random() * 12)}`).join(',');
  round.say(`armed: ${rules}`);
  await runPool(round, {
    size: 3,
    leaseMs: 900,
    env: { WALQ_FAILPOINTS: rules },
    queue: { backoff: { baseMs: 20, factor: 2, maxMs: 200 } },
  });

  round.dumpLedger();
  const view = round.dumpLog();
  checkLogHistory(round, view);
  for (const { id } of acked) {
    const job = queue.getJob(id);
    if (!job) round.problem(`job ${id} was acknowledged and has vanished`);
    else if (job.status !== 'done') round.problem(`job ${id} ended as ${job.status}`);
  }
  queue.close();
}

/** The log keeps being rewritten under the workers, and keys must keep working. */
async function compactionRound(round, random) {
  const options = { compactAfterBytes: 2_500, backoff: { baseMs: 20, factor: 2, maxMs: 200 } };
  const queue = openQueue(round.queueDir, options);
  const total = 40;
  const items = Array.from({ length: total }, (_, n) => ({
    type: 'work',
    payload: { n, ms: Math.floor(random() * 4) },
    options: { key: `key-${n}` },
  }));
  const first = queue.enqueueMany(items);

  const points = pickMany(random, CRASH_POINTS.filter((p) => p.startsWith('compact.')), 2);
  const rules = points.map((point) => `${point}=kill`).join(',');
  round.say(`armed: ${rules}`);

  const running = runPool(round, { size: 3, leaseMs: 900, env: { WALQ_FAILPOINTS: rules }, queue: options });
  for (let i = 0; i < 6; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    for (const again of queue.enqueueMany(items)) {
      if (!again.deduped) round.problem(`key for ${again.id} created a second job during compaction`);
    }
  }
  await running;

  round.dumpLedger();
  const view = round.dumpLog();
  if (view) round.say(`final generation ${view.header.generation}`);
  queue.close();

  const reopened = openQueue(round.queueDir, options);
  for (const { id } of first) {
    if (reopened.getJob(id)?.status !== 'done') round.problem(`job ${id} did not finish`);
  }
  const stats = reopened.stats();
  if (stats.total !== total) round.problem(`expected ${total} jobs, found ${stats.total}`);
  reopened.close();
}

/** Short leases and slow jobs: a live worker must keep its job. */
async function leaseRound(round, random) {
  const queue = openQueue(round.queueDir);
  const total = 8;
  queue.enqueueMany(Array.from({ length: total }, (_, n) => ({ type: 'work', payload: { n, ms: 1_200 + Math.floor(random() * 300) } })));
  await runPool(round, { size: 3, leaseMs: 800, heartbeatMs: 100 });

  const entries = round.dumpLedger();
  round.dumpLog();
  const starts = new Map();
  for (const entry of entries) {
    if (entry.event === 'start') starts.set(entry.id, (starts.get(entry.id) ?? 0) + 1);
  }
  for (const [id, count] of starts) {
    if (count !== 1) round.problem(`job ${id} ran ${count} times while its worker was alive`);
  }
  queue.close();
}

async function main() {
  const { seed, seconds } = parseArgs(process.argv.slice(2));
  const random = makeRandom(seed);
  const deadline = performance.now() + seconds * 1000;
  const kinds = [
    ['contention', contentionRound],
    ['crash', crashRound],
    ['compaction', compactionRound],
    ['lease', leaseRound],
  ];

  console.log(`walq stress: seed ${seed}, about ${seconds}s`);
  const summary = [];
  for (let index = 1; performance.now() < deadline; index += 1) {
    const [name, run] = kinds[(index - 1) % kinds.length];
    const round = new Round(index, name);
    const started = performance.now();
    round.say('starting');
    try {
      await run(round, random);
    } catch (err) {
      round.problem(`${err.name}: ${err.message}`);
    }
    const elapsed = Math.round(performance.now() - started);
    summary.push({ index, name, elapsed, problems: round.problems });
    round.say(`finished in ${elapsed}ms with ${round.problems.length} problem(s)`);
    round.cleanup();
  }

  console.log('\n=== summary ===');
  let bad = 0;
  for (const { index, name, elapsed, problems } of summary) {
    console.log(`round ${index} ${name}: ${elapsed}ms, ${problems.length} problem(s)`);
    for (const problem of problems) console.log(`    ${problem}`);
    bad += problems.length;
  }
  console.log(`${summary.length} rounds, ${bad} problem(s)`);
  process.exit(bad === 0 ? 0 : 1);
}

await main();
