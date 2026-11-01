// Replaces the log with a one-record log holding the current state. Runs under
// the queue lock. docs/compaction.md describes the protocol.

import path from 'node:path';
import { encodeFrame, encodeHeader } from './frame.mjs';
import { hit } from './failpoints.mjs';
import { buildSnapshot } from './snapshot.mjs';

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
    // Exclusive, so two compactors can never write the same temp file.
    ops.create(tempPath, { exclusive: true });
    ops.writeAt(tempPath, bytes, 0);
    hit('compact.after-tmp-write', { generation: nextGeneration });
    hit('compact.before-rename', { generation: nextGeneration });
    ops.rename(tempPath, wal.file);
    hit('compact.after-rename', { generation: nextGeneration });
    ops.sync(wal.file);
    ops.syncDir(path.dirname(wal.file));
  } catch (err) {
    err.message = `compaction failed: ${err.message}`;
    throw err;
  }

  return { snapshot, generation: nextGeneration, size: bytes.length };
}
