// Minimal structured logging to stderr. Silent unless WALQ_LOG names a level, so
// that programs embedding the queue do not get surprise output.

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold() {
  return LEVELS[process.env.WALQ_LOG] ?? Infinity;
}

function write(level, scope, message, fields) {
  if (LEVELS[level] < threshold()) return;
  const entry = { at: new Date().toISOString(), level, scope, message, pid: process.pid, ...fields };
  process.stderr.write(`${JSON.stringify(entry)}\n`);
}

export function createLogger(scope) {
  return {
    debug: (message, fields = {}) => write('debug', scope, message, fields),
    info: (message, fields = {}) => write('info', scope, message, fields),
    warn: (message, fields = {}) => write('warn', scope, message, fields),
    error: (message, fields = {}) => write('error', scope, message, fields),
  };
}
