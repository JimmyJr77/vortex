import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classSwapSettlement,
  normalizeCustomerBillingClassSwapInput,
  validateCustomerBillingClassSwapEffectiveDate,
} from '../customerBillingEnrollmentSwap.js'

test('a class move accepts a valid backdated date, target schedule, and audit reason', () => {
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
  assert.equal(
    normalizeCustomerBillingClassSwapInput({ targetFormId: 90, targetSlotGroupId: 91, effectiveDate: '2026-09-01', reason: 'Correct original move date.' }, now).effectiveDate,
    '2026-09-01',
  )
  assert.doesNotThrow(
    () => validateCustomerBillingClassSwapEffectiveDate({ effectiveDate: '2026-09-01' }, '2026-08-15'),
  )
  assert.throws(
    () => validateCustomerBillingClassSwapEffectiveDate({ effectiveDate: '2026-08-14' }, '2026-08-15'),
    /before the original enrollment started/i,
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
