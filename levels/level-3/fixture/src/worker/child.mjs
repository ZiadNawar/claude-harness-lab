// Entry point of a worker process. Started by WorkerPool with one JSON argument.

import { openQueue } from '../queue.mjs';
import { send, STOP, WORKER_READY } from './protocol.mjs';
import { loadHandlers } from './registry.mjs';
import { JobRunner } from './runner.mjs';

const options = JSON.parse(process.argv[2]);

// A worker never outlives its pool: the channel closing means the parent is gone.
process.on('disconnect', () => process.exit(0));

const handlers = await loadHandlers(options.handlers);
const queue = openQueue(options.dir, options.queue);

const runner = new JobRunner({
  queue,
  workerId: options.workerId,
  handlers,
  leaseMs: options.leaseMs,
  heartbeatMs: options.heartbeatMs,
  pollMs: options.pollMs,
  types: options.types,
  emit: (message) => send({ ...message, workerId: options.workerId }),
});

process.on('message', (message) => {
  if (message?.kind === STOP) runner.stop();
});

send({ kind: WORKER_READY, workerId: options.workerId });
await runner.run();
queue.close();
process.exit(0);
