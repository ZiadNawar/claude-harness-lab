# Rounding

All division in the library goes through `divideRounded` and `scaleRounded`.

Amounts round half-even by default; half-up only when a caller asks for it. Before
version 0.4.0 the default was half-up, which is why older invoices may differ.

With `half-up`, 2.5 rounds to 3. With the default, 2.5 rounds to 2 and 3.5 to 4.

`down` truncates towards zero. Rounding is symmetric for negative values.
