# Billing principles

Agreed with finance. These hold across the whole library. Where a calculation isn't
spelled out anywhere, it should follow from them.

1. **Amounts are whole minor units.** The currency table says how many decimals a
   currency has. Anything that reads or writes an amount uses exactly that many, and
   amounts are never silently rounded on the way in.

2. **Currencies don't mix.** No figure adds up amounts in different currencies, unless
   it is a report that converts them on purpose.

3. **Time.** A period includes its start date and excludes its end date.

4. **Documents add up.** Every total on a document is the sum of the lines above it, and
   every journal entry balances.

5. **Tax is due per rate.** The tax due on an invoice is worked out for each rate, on the
   sum of the net amounts at that rate, and rounded once. Lines show how that tax is
   spread. Each line's tax stays within one minor unit of its own exact tax, sign
   included, on every invoice.

6. **Splits are fair.** When an amount is split across lines, the parts add up to it
   exactly, every part stays within one minor unit of its exact share, a line with no
   share gets nothing, and splitting a negative amount mirrors splitting the positive one.

7. **We only give back what we charged.** However money goes back to a customer, and
   however many times, what goes back on a charge never exceeds what they were actually
   charged for it after discounts. Tax goes back as it was charged: once a charge has been
   credited in full, the tax credited on it equals the tax charged on it, and part-way
   through it stays within one minor unit of the matching share.

8. **Money goes back the way it came.** A credit first reduces whatever is still owed on
   the invoice. Beyond that, cash goes back only up to the cash we received. The rest goes
   onto the customer's account.

9. **Account credit is money we owe the customer.** It settles an invoice the way a payment
   does. It doesn't change what the invoice charges.
