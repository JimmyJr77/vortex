import test from 'node:test'
import assert from 'node:assert/strict'
import { billingMonthStart } from '../householdMonthlyInvoice.js'

test('household invoices always use the first day of the UTC billing month', () => {
  assert.equal(billingMonthStart(new Date('2026-09-30T23:59:59.000Z')), '2026-09-01')
  assert.equal(billingMonthStart(new Date('2026-10-01T00:00:00.000Z')), '2026-10-01')
})
