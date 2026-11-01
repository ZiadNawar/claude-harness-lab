// Replaces the log with a one-record log holding the current state. Runs under
// the queue lock. docs/compaction.md describes the protocol.

import path from 'node:path';
import { sleepSync } from './clock.mjs';
import { encodeFrame, encodeHeader } from './frame.mjs';
import { hit } from './failpoints.mjs';
import { buildSnapshot } from './snapshot.mjs';

const SHARING_ERRORS = new Set(['EPERM', 'EACCES', 'EBUSY']);

// On Windows a rename fails while anything holds the target open: a virus
// scanner, a backup agent, `walq tail`. These holds are short, so wait them out.
function replaceFile(ops, from, to, retryMs) {
  const deadline = performance.now() + retryMs;
  let wait = 2;
  for (;;) {
    try {
      ops.rename(from, to);
      return;
    } catch (err) {
      if (!SHARING_ERRORS.has(err.code) || performance.now() >= deadline) throw err;
      sleepSync(wait);
      wait = Math.min(wait * 2, 50);
    }
  }
}

export function compactionTempPath(walFile) {
  return `${walFile}.compact`;
}

/**
 * Writes and installs the next generation of the log. Returns the snapshot and
 * the size of the new file. If this throws, the old log is still in place.
 */
export function compactLog({ wal, ops, state, generation, now, config }) {
  const nextGeneration = generation + 1;
  const snapshot = buildSnapshot(state, now, config);
  const bytes = Buffer.concat([encodeHeader(nextGeneration), encodeFrame(snapshot)]);
  const tempPath = compactionTempPath(wal.file);

  try {
    ops.create(tempPath);
    ops.writeAt(tempPath, bytes, 0);
    hit('compact.after-tmp-write', { generation: nextGeneration });
    ops.sync(tempPath);
    hit('compact.before-rename', { generation: nextGeneration });
    replaceFile(ops, tempPath, wal.file, config.renameRetryMs);
    hit('compact.after-rename', { generation: nextGeneration });
    ops.syncDir(path.dirname(wal.file));
  } catch (err) {
    ops.unlink(tempPath);
    throw err;
  }

  return { snapshot, generation: nextGeneration, size: bytes.length };
}
