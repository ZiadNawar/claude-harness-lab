// Opens the queue in argv[2] and enqueues one job. Run with a kill failpoint armed
// so that the process dies during the append.

import { openQueue } from '../../src/index.mjs';

const queue = openQueue(process.argv[2]);
queue.enqueue('from-child', { pid: process.pid });
queue.close();
