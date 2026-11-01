# Leases and retries

## Leases

`claim()` gives a job to a worker until `leaseUntil`, and hands back a `token`. The token goes on every later call about that attempt. A lease has expired once the clock reaches its deadline.

A worker running a long job calls `heartbeat()`. `JobRunner` does this on a timer, every `leaseMs / 3` by default.

Anyone can call `reapExpired()`. It returns expired jobs to the queue with a backoff, or sends them to `dead` when attempts have run out. An expired lease counts as a used attempt.

## Tokens

The token is the job's `fence`, which goes up by one with each claim. A call with a token that isn't current throws `StaleLeaseError`.

## Backoff

After an attempt fails, the job is due again after:

```
delay = min(maxMs, baseMs * factor ^ (attempts - 1))
```

With `jitter` above zero, the delay is reduced by up to that fraction. The reduction is derived from the job id and the attempt number, so that it's reproducible.

## Attempts

`attempts` counts claims. When an attempt ends in failure or expiry with `attempts >= maxAttempts`, the job goes `dead`. `requeueDead()` sets attempts back to zero and makes the job due now.

## Clocks

All processes are on one host and read the same system clock, so clock skew between processes isn't handled.
