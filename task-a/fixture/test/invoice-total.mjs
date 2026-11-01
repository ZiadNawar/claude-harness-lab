import assert from "node:assert/strict"
import { test } from "node:test"
import { invoiceTotal } from "../src/invoice.mjs"

test("adds VAT to the sum of the lines", () => {
  assert.equal(invoiceTotal([{ price: "100.00", qty: 2 }], "0.21"), 242)
})

test("rounds half a cent up", () => {
  assert.equal(invoiceTotal([{ price: "1.50", qty: 1 }], "0.21"), 1.82)
})
