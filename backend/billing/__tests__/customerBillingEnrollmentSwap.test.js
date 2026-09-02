import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classSwapSettlement,
  normalizeCustomerBillingClassSwapInput,
} from '../customerBillingEnrollmentSwap.js'

test('a class move requires a future-or-today date, target schedule, and audit reason', () => {
  const now = new Date('2026-09-02T15:00:00.000Z')
  assert.deepEqual(
    normalizeCustomerBillingClassSwapInput({
      targetFormId: 90,
      targetSlotGroupId: 91,
      targetTimeSlotId: 92,
      effectiveDate: '2026-09-05',
      reason: 'Family requested a Saturday schedule.',
    }, now),
    {
      targetFormId: 90,
      targetSlotGroupId: 91,
      targetTimeSlotId: 92,
      effectiveDate: '2026-09-05',
      reason: 'Family requested a Saturday schedule.',
      today: '2026-09-02',
    },
  )
  assert.throws(
    () => normalizeCustomerBillingClassSwapInput({ targetFormId: 90, targetSlotGroupId: 91, effectiveDate: '2026-09-01', reason: 'Late' }, now),
    /past/i,
  )
  assert.throws(
    () => normalizeCustomerBillingClassSwapInput({ targetFormId: 90, targetSlotGroupId: 91, effectiveDate: '2026-09-02' }, now),
    /reason/i,
  )
})

test('a same-price move has no net balance change when its unused source credit offsets the replacement cost', () => {
  assert.deepEqual(
    classSwapSettlement({ targetProratedCents: 7_875, unusedSourceCreditCents: 7_875 }),
    {
      targetChargeCents: 7_875,
      sourceCreditCents: 7_875,
      ledgerDeltaCents: 0,
      settlementKind: 'no_change',
      settlementAmountCents: 0,
    },
  )
})

test('a higher or lower priced replacement becomes an immutable one-time charge or account credit', () => {
  assert.deepEqual(
    classSwapSettlement({ targetProratedCents: 10_125, unusedSourceCreditCents: 7_875 }),
    {
      targetChargeCents: 10_125,
      sourceCreditCents: 7_875,
      ledgerDeltaCents: 2_250,
      settlementKind: 'one_time_charge',
      settlementAmountCents: 2_250,
    },
  )
  assert.deepEqual(
    classSwapSettlement({ targetProratedCents: 6_000, unusedSourceCreditCents: 7_875 }),
    {
      targetChargeCents: 6_000,
      sourceCreditCents: 7_875,
      ledgerDeltaCents: -1_875,
      settlementKind: 'account_credit',
      settlementAmountCents: 1_875,
    },
  )
})
