// Named failpoints. See docs/crash-testing.md for the list and what each one
// means. Production code calls hit() at each point; unless a rule is armed the
// call does nothing.
//
// Two ways to arm a point:
//
//   WALQ_FAILPOINTS="wal.mid-append#complete=kill@2,claim.before-lock=pause"
//   WALQ_FAILPOINT_DIR=<folder for marker files>
//
//   onFailpoint('claim.before-lock', (ctx) => { ... })   // same process
//
// A rule is name[#type]=action[@nth]. Actions are `kill` (terminate this
// process without running any cleanup) and `pause` (block until a release file
// appears). `kill` writes <name>.hit first and will not fire again while that
// file exists, so a restarted worker does not die at the same point forever.

import fs from 'node:fs';
import path from 'node:path';
import { sleepSync } from './clock.mjs';

const PAUSE_LIMIT_MS = 60_000;

const callbacks = new Map();
const counts = new Map();
const rules = parseRules(process.env.WALQ_FAILPOINTS ?? '');

function parseRules(spec) {
  const parsed = [];
  for (const item of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
    const match = /^([\w.-]+)(?:#([\w-]+))?=(kill|pause)(?:@(\d+))?$/.exec(item);
    if (!match) throw new Error(`bad failpoint rule: ${item}`);
    parsed.push({
      key: item.split('=')[0],
      name: match[1],
      type: match[2] ?? null,
      action: match[3],
      nth: match[4] ? Number(match[4]) : 1,
    });
  }
  return parsed;
}

function markerDir() {
  return process.env.WALQ_FAILPOINT_DIR ?? process.cwd();
}

function fire(rule) {
  const base = path.join(markerDir(), rule.key.replace('#', '.'));
  if (rule.action === 'kill') {
    const marker = `${base}.hit`;
    if (fs.existsSync(marker)) return;
    fs.writeFileSync(marker, String(process.pid));
    process.kill(process.pid, 'SIGKILL');
    sleepSync(PAUSE_LIMIT_MS);
    return;
  }
  fs.writeFileSync(`${base}.paused`, String(process.pid));
  const started = performance.now();
  while (!fs.existsSync(`${base}.release`)) {
    if (performance.now() - started > PAUSE_LIMIT_MS) process.exit(70);
    sleepSync(5);
  }
}

/** True when something would observe this point. Lets callers skip extra work. */
export function isArmed(name) {
  return callbacks.has(name) || rules.some((rule) => rule.name === name);
}

export function hit(name, context = {}) {
  callbacks.get(name)?.(context);
  for (const rule of rules) {
    if (rule.name !== name) continue;
    if (rule.type !== null && rule.type !== context.type) continue;
    const seen = (counts.get(rule.key) ?? 0) + 1;
    counts.set(rule.key, seen);
    if (seen === rule.nth) fire(rule);
  }
}

/** Registers an in-process callback. Returns a function that removes it. */
export function onFailpoint(name, callback) {
  callbacks.set(name, callback);
  return () => callbacks.delete(name);
}

export function clearFailpoints() {
  callbacks.clear();
}
