import assert from 'node:assert/strict'
import test from 'node:test'

import { billingCycleEvidenceFromCanonicalVerification } from '../billingRetirementCycleVerification.js'

test('cycle evidence maps canonical local and Stripe verification into strict counters', () => {
  const evidence = billingCycleEvidenceFromCanonicalVerification({
    verified: true,
    issues: [],
    snapshot: {
      attachedLocalSubscriptionIds: [],
      targetInvoices: [{
        subtotalCents: 36_000,
        creditCents: 0,
        totalCents: 36_000,
        lineSubtotalCents: 36_000,
        lineCreditCents: 0,
        lineTotalCents: 36_000,
      }],
      collectorInventory: {
        collectorCount: 1,
        householdInvoiceCount: 1,
        legacyCollectorCount: 0,
        unexpectedStripeInvoiceCount: 0,
      },
    },
  })
  assert.deepEqual({
    legacyCollectorCount: evidence.legacyCollectorCount,
    collectorCount: evidence.collectorCount,
    householdInvoiceCount: evidence.householdInvoiceCount,
    remoteHouseholdInvoiceCount: evidence.remoteHouseholdInvoiceCount,
    unexpectedStripeInvoiceCount: evidence.unexpectedStripeInvoiceCount,
    localInvoiceLineTotalCents: evidence.localInvoiceLineTotalCents,
    localInvoiceSubtotalCents: evidence.localInvoiceSubtotalCents,
    lineParity: evidence.lineParity,
  }, {
    legacyCollectorCount: 0,
    collectorCount: 1,
    householdInvoiceCount: 1,
    remoteHouseholdInvoiceCount: 1,
    unexpectedStripeInvoiceCount: 0,
    localInvoiceLineTotalCents: 36_000,
    localInvoiceSubtotalCents: 36_000,
    lineParity: true,
  })
})

test('cycle evidence accepts exact credited invoice subtotal, credit, and net totals', () => {
  const evidence = billingCycleEvidenceFromCanonicalVerification({
    verified: true,
    issues: [],
    snapshot: {
      attachedLocalSubscriptionIds: [],
      targetInvoices: [{
        subtotalCents: 12_000,
        creditCents: 3_000,
        totalCents: 9_000,
        lineSubtotalCents: 12_000,
        lineCreditCents: 3_000,
        lineTotalCents: 9_000,
      }],
      collectorInventory: {
        collectorCount: 1,
        householdInvoiceCount: 1,
        legacyCollectorCount: 0,
        unexpectedStripeInvoiceCount: 0,
      },
    },
  })

  assert.equal(evidence.localInvoiceLineSubtotalCents, 12_000)
  assert.equal(evidence.localInvoiceLineCreditCents, 3_000)
  assert.equal(evidence.localInvoiceLineTotalCents, 9_000)
  assert.equal(evidence.localInvoiceSubtotalCents, 12_000)
  assert.equal(evidence.localInvoiceCreditCents, 3_000)
  assert.equal(evidence.localInvoiceTotalCents, 9_000)
  assert.equal(evidence.lineParity, true)
})

test('cycle evidence rejects a credited invoice whose line credit differs from its header', () => {
  const evidence = billingCycleEvidenceFromCanonicalVerification({
    verified: false,
    issues: [],
    snapshot: {
      targetInvoices: [{
        subtotalCents: 12_000,
        creditCents: 3_000,
        totalCents: 9_000,
        lineSubtotalCents: 12_000,
        lineCreditCents: 2_000,
        lineTotalCents: 10_000,
      }],
      collectorInventory: {},
    },
  })

  assert.equal(evidence.lineParity, false)
})

test('cycle evidence fails parity and counts every surviving legacy collector signal', () => {
  const evidence = billingCycleEvidenceFromCanonicalVerification({
    verified: false,
    issues: [
      { code: 'remote_legacy_subscription_active' },
      { code: 'household_invoice_item_missing' },
    ],
    snapshot: {
      attachedLocalSubscriptionIds: [17],
      targetInvoices: [{ subtotalCents: 20_000, lineTotalCents: 19_000 }],
      collectorInventory: {
        collectorCount: 2,
        householdInvoiceCount: 1,
        legacyCollectorCount: 1,
        unexpectedStripeInvoiceCount: 1,
      },
    },
  })
  assert.equal(evidence.legacyCollectorCount, 3)
  assert.equal(evidence.collectorCount, 4)
  assert.equal(evidence.lineParity, false)
  assert.equal(evidence.unexpectedStripeInvoiceCount, 1)
})
