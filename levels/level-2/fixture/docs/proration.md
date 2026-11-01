# Proration

When a customer changes plan or seats mid-period, we charge the new terms for the time
left in the period and give back what they paid for the old terms over that time.

## How the share is worked out

The share is counted in whole calendar days, using the actual length of the period in
question. A period can be anywhere from 28 to 366 days.

**The day of the change is billed at the new price.** The customer gets the new plan
from the morning of the change date, so that day counts as time left on the period. A
change on the first day of a period therefore credits the old price in full and charges
the new price in full.

The amount is `price * days left / days in period`, rounded to a whole minor unit in the
default rounding mode. The credit and the charge are rounded separately.

## Worked example

A customer on a plan at USD 29.00 per month, in the period 1 February 2024 to 1 March
2024, moves to a plan at USD 58.00 on 16 February 2024. No discount applies.

- Days in the period: 29, because 2024 is a leap year.
- Days left, counting 16 February: 14 (16 to 29 February).
- Credit for the old plan: 29.00 * 14 / 29 = USD -14.00.
- Charge for the new plan: 58.00 * 14 / 29 = USD 28.00.
- Net before tax: USD 14.00.

## Limits

A change date has to fall inside the period: on or after its start and before its end.
The end date belongs to the next period.
