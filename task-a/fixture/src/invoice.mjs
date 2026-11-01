import Decimal from "decimal.js"

export function invoiceTotal(lines, vatRate) {
  const net = lines.reduce(
    (sum, line) => sum.plus(new Decimal(line.price).times(line.qty)),
    new Decimal(0),
  )
  const gross = net.times(new Decimal(1).plus(vatRate))
  return gross.toDecimalPlaces(2, Decimal.ROUND_DOWN).toNumber()
}
