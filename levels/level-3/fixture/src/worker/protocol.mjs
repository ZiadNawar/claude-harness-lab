// Messages between a WorkerPool and its child processes, over the fork() channel.

export const WORKER_READY = 'ready';
export const JOB_STARTED = 'job-started';
export const JOB_COMPLETED = 'job-completed';
export const JOB_FAILED = 'job-failed';
export const JOB_FENCED = 'job-fenced';
export const WORKER_ERROR = 'worker-error';
export const STOP = 'stop';

/** Sends if the channel is still open. A dead parent is not this worker's problem. */
export function send(message) {
  if (process.connected) {
    try {
      process.send(message);
    } catch {
      // The channel closed between the check and the send.
    }
  }
}
