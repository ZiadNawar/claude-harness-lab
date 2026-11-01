// Read-only view of a log, for tools and debugging. Takes no lock and changes
// nothing, so a torn tail is reported here and left for the next writer.

import fs from 'node:fs';
import path from 'node:path';
import { decodeHeader, HEADER_SIZE, scanFrames } from './frame.mjs';
import { WAL_FILE } from './store.mjs';

export function inspectLog(dir) {
  const file = path.join(dir, WAL_FILE);
  const bytes = fs.readFileSync(file);
  const header = decodeHeader(bytes, file);
  const { frames, end, tail } = scanFrames(bytes.subarray(HEADER_SIZE), HEADER_SIZE);
  return { file, header, frames, end, tail, size: bytes.length };
}

export function describeRecord(record) {
  switch (record.t) {
    case 'enqueue':
      return `enqueue ${record.id} type=${record.type}${record.key ? ` key=${record.key}` : ''}`;
    case 'claim':
      return `claim ${record.id} worker=${record.worker} fence=${record.fence} until=${record.leaseUntil}`;
    case 'heartbeat':
      return `heartbeat ${record.id} fence=${record.fence} until=${record.leaseUntil}`;
    case 'complete':
      return `complete ${record.id} fence=${record.fence}`;
    case 'fail':
    case 'expire':
      return `${record.t} ${record.id} fence=${record.fence} delayMs=${record.delayMs}`;
    case 'cancel':
      return `cancel ${record.id} fence=${record.fence}`;
    case 'dead':
      return `dead ${record.id} fence=${record.fence} error=${record.error}`;
    case 'snapshot':
      return `snapshot jobs=${record.jobs.length} seq=${record.seq}`;
    default:
      return `${record.t} ${record.id ?? ''}`.trim();
  }
}
