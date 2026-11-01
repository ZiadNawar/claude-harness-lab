// Replaces the log. Each attempt writes to a temp file named for its generation, and
// whatever earlier attempts left behind is swept away by listing the folder.

import fs from 'node:fs';
import path from 'node:path';
import { sleepSync } from './clock.mjs';
import { hit } from './failpoints.mjs';
import { encodeFrame, encodeHeader } from './frame.mjs';
import { buildSnapshot } from './snapshot.mjs';

const RENAME_TRIES = 60;
const RENAME_PAUSE_MS = 50;

function sweep(ops, walFile) {
  const dir = path.dirname(walFile);
  const prefix = `${path.basename(walFile)}.`;
  for (const name of fs.readdirSync(dir)) {
    if (name.startsWith(prefix)) ops.unlink(path.join(dir, name));
  }
}

function renameOverLog(ops, from, to) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      ops.rename(from, to);
      return;
    } catch (err) {
      if (attempt >= RENAME_TRIES || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
      sleepSync(RENAME_PAUSE_MS);
    }
  }
}

export function compactLog({ wal, ops, state, generation, now, config }) {
  const next = generation + 1;
  const snapshot = buildSnapshot(state, now, config);
  const bytes = Buffer.concat([encodeHeader(next), encodeFrame(snapshot)]);
  const temp = `${wal.file}.next-${next}`;

  sweep(ops, wal.file);
  try {
    ops.create(temp);
    ops.writeAt(temp, bytes, 0);
    hit('compact.after-tmp-write', { generation: next });
    ops.sync(temp);
    hit('compact.before-rename', { generation: next });
    renameOverLog(ops, temp, wal.file);
  } catch (err) {
    sweep(ops, wal.file);
    throw err;
  }
  hit('compact.after-rename', { generation: next });
  ops.syncDir(path.dirname(wal.file));
  return { snapshot, generation: next, size: bytes.length };
}
