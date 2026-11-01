// Proves the task is sound. Run with: node check.mjs
//
// Works only on copies in the OS temp folder. Never runs an agent or calls a model.
// Each step prints PASS or FAIL and how long it took; the exit code is nonzero if any
// step fails. Takes around 25 minutes, most of it step 5.
//
// Options: --only=1,2,5   run some steps only.
//          --keep         keep the temp folder.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyHunks, DEFECTS } from './mutants/defects.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORTER = pathToFileURL(path.join(HERE, 'mutants', 'json-reporter.mjs')).href;
const SUITE_LIMIT_MS = 5 * 60_000;
const REPEATS = 5;
const SHALLOW_VISIBLE_RUNS = 3;

const argv = process.argv.slice(2);
const only = argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const keep = argv.includes('--keep');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'walq-check-'));

let serial = 0;
function workspace(...overlays) {
  serial += 1;
  const dir = path.join(tempRoot, `w${serial}`);
  fs.cpSync(path.join(HERE, 'fixture'), dir, { recursive: true });
  for (const overlay of overlays) fs.cpSync(path.join(HERE, overlay), dir, { recursive: true });
  fs.cpSync(path.join(HERE, 'hidden'), path.join(dir, 'test-hidden'), { recursive: true });
  return dir;
}

function killTree(pid) {
  spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
}

/** Runs node with a time limit, and returns what it printed. */
function runNode(cwd, args, limitMs) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    let err = '';
    let timedOut = false;
    child.stdout.on('data', (chunk) => (out += chunk));
    child.stderr.on('data', (chunk) => (err += chunk));
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child.pid);
    }, limitMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out, err, timedOut });
    });
  });
}

function parseResults(text) {
  const results = new Map();
  for (const line of text.split('\n')) {
    if (!line.startsWith('{"walq":')) continue;
    const { name, ok } = JSON.parse(line).walq;
    // A name seen twice counts as failed if either run failed.
    results.set(name, results.has(name) ? results.get(name) && ok : ok);
  }
  return results;
}

async function runHidden(dir, { pattern = null } = {}) {
  const args = ['--test', `--test-reporter=${REPORTER}`];
  if (pattern) args.push(`--test-name-pattern=${pattern}`);
  args.push('test-hidden/');
  const started = performance.now();
  const run = await runNode(dir, args, SUITE_LIMIT_MS);
  const results = parseResults(run.out);
  const passed = [...results.values()].filter(Boolean).length;
  return { results, passed, failed: results.size - passed, timedOut: run.timedOut, ms: performance.now() - started, raw: run };
}

async function runVisible(dir) {
  const started = performance.now();
  const args = ['--test', `--test-reporter=${REPORTER}`, ...visibleFiles(dir)];
  const run = await runNode(dir, args, SUITE_LIMIT_MS);
  const results = parseResults(run.out);
  const passed = [...results.values()].filter(Boolean).length;
  return { results, passed, failed: results.size - passed, code: run.code, ms: performance.now() - started };
}

function visibleFiles(dir) {
  return fs.readdirSync(path.join(dir, 'test')).filter((f) => f.endsWith('.mjs')).map((f) => path.join('test', f));
}

const failedNames = (run) => [...run.results].filter(([, ok]) => !ok).map(([name]) => name);

let failures = 0;
const summary = {};

async function step(id, title, body) {
  if (only && !only.includes(String(id))) return;
  const started = performance.now();
  let verdict;
  try {
    verdict = await body();
  } catch (err) {
    verdict = { ok: false, detail: `threw: ${err.stack}` };
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  if (!verdict.ok) failures += 1;
  console.log(`${verdict.ok ? 'PASS' : 'FAIL'}  ${id}. ${title} (${seconds}s)`);
  if (verdict.detail) console.log(`      ${verdict.detail.split('\n').join('\n      ')}`);
}

await step(1, 'untouched fixture fails most hidden tests', async () => {
  const run = await runHidden(workspace());
  const total = run.results.size;
  summary.start = `${run.passed}/${total}`;
  return {
    ok: !run.timedOut && total >= 30 && run.failed > total / 2,
    detail: `${run.passed} of ${total} pass, ${run.failed} fail, in ${(run.ms / 1000).toFixed(1)}s`,
  };
});

await step(2, 'fixture + reference passes every visible and hidden test', async () => {
  const dir = workspace('reference');
  const visible = await runVisible(dir);
  const hidden = await runHidden(dir);
  summary.total = hidden.results.size;
  const problems = [...failedNames(visible), ...failedNames(hidden)];
  return {
    ok: visible.failed === 0 && visible.results.size > 0 && hidden.failed === 0 && hidden.results.size >= 30 && !hidden.timedOut,
    detail:
      `visible ${visible.passed}/${visible.results.size}, hidden ${hidden.passed}/${hidden.results.size}, ` +
      `hidden suite took ${(hidden.ms / 1000).toFixed(1)}s` +
      (problems.length ? `\nfailed: ${problems.join('; ')}` : ''),
  };
});

await step(3, 'fixture + shallow turns the visible suite green but still fails hidden tests', async () => {
  const dir = workspace('shallow');
  const visibleRuns = [];
  for (let i = 0; i < SHALLOW_VISIBLE_RUNS; i += 1) visibleRuns.push(await runVisible(dir));
  const hidden = await runHidden(dir);
  summary.shallow = `${hidden.passed}/${hidden.results.size}`;
  return {
    ok: visibleRuns.every((run) => run.failed === 0 && run.results.size > 0) && hidden.failed > 0,
    detail:
      `visible: ${visibleRuns.map((run) => `${run.passed}/${run.results.size}`).join(', ')}; ` +
      `hidden ${hidden.passed}/${hidden.results.size}`,
  };
});

await step(4, `fixture + reference gives identical hidden results across ${REPEATS} repeats`, async () => {
  const dir = workspace('reference');
  const runs = [];
  for (let i = 0; i < REPEATS; i += 1) runs.push(await runHidden(dir));
  const signature = (run) => JSON.stringify([...run.results].sort());
  const same = runs.every((run) => signature(run) === signature(runs[0]));
  const slowest = Math.max(...runs.map((run) => run.ms));
  const clean = runs.every((run) => run.failed === 0 && !run.timedOut);
  return {
    ok: same && clean && slowest < SUITE_LIMIT_MS,
    detail: `${runs.map((run) => `${run.passed}/${run.results.size}`).join(', ')}; slowest ${(slowest / 1000).toFixed(1)}s`,
  };
});

await step(5, `each of the ${DEFECTS.length} defects is graded: reference minus that one fix fails a named test`, async () => {
  const lines = [];
  let ok = true;
  for (const defect of DEFECTS) {
    const dir = workspace('reference');
    applyHunks(
      (rel) => fs.readFileSync(path.join(dir, rel), 'utf8'),
      (rel, text) => fs.writeFileSync(path.join(dir, rel), text),
      defect.hunks,
    );
    const run = await runHidden(dir);
    const missing = defect.catchers.filter((name) => !run.results.has(name));
    const caught = defect.catchers.filter((name) => run.results.get(name) === false);
    const good = caught.length > 0 && missing.length === 0;
    if (!good) ok = false;
    lines.push(
      `${good ? 'caught' : 'MISSED'} ${defect.id} ${defect.title}: ${run.failed} of ${run.results.size} fail, ` +
        `${caught.length}/${defect.catchers.length} named catchers fail, ${(run.ms / 1000).toFixed(0)}s` +
        (missing.length ? `; unknown catchers: ${missing.join('; ')}` : ''),
    );
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 });
  }
  return { ok, detail: lines.join('\n') };
});

await step(6, 'fixture + alternative, a differently built solution, passes everything', async () => {
  const dir = workspace('alternative');
  const visible = await runVisible(dir);
  const hidden = await runHidden(dir);
  const again = await runHidden(dir);
  const problems = [...failedNames(visible), ...failedNames(hidden), ...failedNames(again)];
  return {
    ok: visible.failed === 0 && visible.results.size > 0 && hidden.failed === 0 && again.failed === 0 && hidden.results.size >= 30,
    detail:
      `visible ${visible.passed}/${visible.results.size}, hidden ${hidden.passed}/${hidden.results.size} ` +
      `and ${again.passed}/${again.results.size}` +
      (problems.length ? `\nfailed: ${problems.join('; ')}` : ''),
  };
});

await step(7, 'npm run stress: reference is clean, in 60-120 seconds, with plenty of output', async () => {
  const dir = workspace('reference');
  const started = performance.now();
  const run = await runNode(dir, ['scripts/stress.mjs'], 180_000);
  const seconds = (performance.now() - started) / 1000;
  const lines = run.out.split('\n').length;
  return {
    ok: run.code === 0 && seconds >= 60 && seconds <= 120 && lines > 2_000,
    detail: `exit ${run.code}, ${seconds.toFixed(0)}s, ${lines} lines, ${(run.out.length / 1024).toFixed(0)} KiB`,
  };
});

await step(8, 'nothing given to the agent gives the game away', async () => {
  const banned = /benchmark|harness|experiment|hidden test|grader|grading|reference solution|shallow|test-hidden|coding agent|claude|codex|opencode/i;
  const hits = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (banned.test(entry.name)) hits.push(full);
      if (entry.isDirectory()) walk(full);
      else if (banned.test(fs.readFileSync(full, 'utf8'))) hits.push(full);
    }
  };
  walk(path.join(HERE, 'fixture'));
  if (banned.test(fs.readFileSync(path.join(HERE, 'prompt.txt'), 'utf8'))) hits.push('prompt.txt');
  const testNamedFiles = fs.readdirSync(path.join(HERE, 'fixture', 'test')).filter((f) => f.includes('.test.'));
  const fixtureRefersOut = /level-3|reference\/|alternative\//.test(fs.readFileSync(path.join(HERE, 'fixture', 'package.json'), 'utf8'));
  return {
    ok: hits.length === 0 && testNamedFiles.length === 0 && !fixtureRefersOut,
    detail: hits.length ? `found in: ${hits.join(', ')}` : 'fixture and prompt are clean',
  };
});

await step(9, 'no child process was left behind', async () => {
  const query = `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'walq-|test-hidden' -and $_.ProcessId -ne ${process.pid} } | ForEach-Object { $_.ProcessId }`;
  const result = spawnSync('powershell', ['-NoProfile', '-Command', query], { encoding: 'utf8' });
  const left = result.stdout.trim().split(/\s+/).filter(Boolean);
  return { ok: left.length === 0, detail: left.length ? `still running: ${left.join(', ')}` : '' };
});

if (!keep) fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 40, retryDelay: 50 });

console.log('');
console.log(`Hidden total: ${summary.total ?? 'not run'}. Start score: ${summary.start ?? 'not run'}. Shallow score: ${summary.shallow ?? 'not run'}.`);
console.log(failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
