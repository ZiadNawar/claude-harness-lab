# Rounding

All division in the library goes through `divideRounded` and `scaleRounded`, which
use exact integer arithmetic and then round once.

## The default mode

The default rounding mode is half-up: an exact half always rounds away from zero.
So 2.5 rounds to 3, 3.5 rounds to 4 and -2.5 rounds to -3.

This is the mode used for tax, discounts and proration.

## Other modes

Callers can pass a mode explicitly:

| Mode | 2.5 | 3.5 | 2.4 | -2.5 |
|---|---|---|---|---|
| `half-up` | 3 | 4 | 2 | -3 |
| `down` | 2 | 3 | 2 | -2 |

## Sign

Rounding is symmetric. The result for a negative value is always the negative of
the result for the same positive value, so a credit rounds the same way as the
charge it reverses.
