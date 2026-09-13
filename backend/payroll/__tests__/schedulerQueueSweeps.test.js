import assert from 'node:assert/strict'
import test from 'node:test'
import {createHarness} from '../testing/harness.js'
import {startCarrierSettlementScheduler} from '../carrierSettlementAutomation.js'
import {startRetirementSettlementScheduler} from '../retirementSettlementAutomation.js'
import {startRetirementReturnScheduler} from '../retirementReturnAutomation.js'
import {startRetirementReplacementSettlementScheduler} from '../retirementReplacementSettlementAutomation.js'
import {startRetirementReplacementAllocationScheduler} from '../retirementReplacementAutomation.js'
import {startRetirementReplacementBankScheduler} from '../retirementReplacementBankAutomation.js'
import {startRetirementContributionScheduler} from '../retirementContributionAutomation.js'
import {startCarrierReconciliationScheduler} from '../carrierReconciliationAutomation.js'
import {startCarrierInvoiceScheduler} from '../carrierInvoiceAutomation.js'
import {startCarrierRemittanceScheduler} from '../carrierRemittanceAutomation.js'

test('simultaneous carrier and retirement timer work drains without starving API queries', {
  skip: !process.env.PAYROLL_TEST_DATABASE_URL, timeout: 60000,
}, async t => {
  const h = await createHarness()
  t.after(() => h.close())
  const starters = [startCarrierSettlementScheduler, startRetirementSettlementScheduler,
    startRetirementReturnScheduler, startRetirementReplacementSettlementScheduler,
    startRetirementReplacementAllocationScheduler, startRetirementReplacementBankScheduler,
    startRetirementContributionScheduler, startCarrierReconciliationScheduler,
    startCarrierInvoiceScheduler, startCarrierRemittanceScheduler]
  const errors = [], ticks = []
  t.mock.method(console, 'error', (...args) => errors.push(args))
  const originalInterval = globalThis.setInterval, originalEnv = process.env.NODE_ENV
  try {
    // Capture only the timer registrations; execute real callbacks below.
    globalThis.setInterval = callback => { ticks.push(callback); return {unref() {}} }
    process.env.NODE_ENV = 'production'
    for (const start of starters) start(h.pool)
  } finally {
    globalThis.setInterval = originalInterval
    if (originalEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalEnv
  }
  assert.equal(ticks.length, starters.length)
  // Empty synthetic data means these real timer callbacks cannot transmit
  // anything to a bank, carrier, recordkeeper, or accounting provider.
  await Promise.all(ticks.map(tick => tick()))
  assert.equal((await h.pool.query('SELECT 1 AS healthy')).rows[0].healthy, 1)
  assert.deepEqual(errors, [])
  assert.equal(h.pool.waitingCount, 0)
  assert.equal(h.pool.idleCount, h.pool.totalCount)
})
