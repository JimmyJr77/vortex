import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classSwapSettlement,
  classSwapPaymentTransferCents,
  classSwapTargetChargeValues,
  classSwapTransferMetadata,
  normalizeCustomerBillingClassSwapInput,
  priceCustomerBillingClassSwapTargetFromOrderPreview,
  validateCustomerBillingClassSwapEffectiveDate,
} from '../customerBillingEnrollmentSwap.js'
import { computeAccountDiscountStats } from '../../scheduling/systemDiscounts.js'

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

test('a class move records distinct incoming and outgoing ledger markers', () => {
  const common = {
    sourceSignupId: 102,
    replacementSignupId: 111,
    sourceChargeId: 39,
    replacementChargeId: 100,
    effectiveDate: '2026-09-01',
    reason: 'Move to the available Tuesday class.',
  }
  assert.deepEqual(classSwapTransferMetadata({ ...common, direction: 'out' }), {
    direction: 'out',
    ...common,
  })
  assert.deepEqual(classSwapTransferMetadata({ ...common, direction: 'in' }), {
    direction: 'in',
    ...common,
  })
  assert.throws(
    () => classSwapTransferMetadata({ ...common, direction: 'replace' }),
    /incoming or outgoing/i,
  )
})

test('a higher or lower priced replacement reports its net prorated change for the in-place bill reconciliation', () => {
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

test('a class move uses the household-discounted monthly target from its preview', () => {
  const target = priceCustomerBillingClassSwapTargetFromOrderPreview(
    {
      newSignups: [{ slotKey: '3:4:5', billingType: 'recurring', incrementalMonthly: 150 }],
      discounts: {
        lines: [{ key: '3:4:5', baseCents: 15_000, applied: [] }],
      },
      firstMonth: {
        items: [{
          slotKey: '3:4:5',
          monthlyNetCents: 12_750,
          proratedCents: 12_750,
          prepaidFirstMonthCents: 0,
        }],
      },
    },
    { targetFormId: 3, targetSlotGroupId: 4, targetTimeSlotId: 5 },
  )

  assert.equal(target.grossCents, 15_000)
  assert.equal(target.discountCents, 2_250)
  assert.equal(target.netCents, 12_750)
  assert.equal(target.firstChargeCents, 12_750)
})

test('a partial-month replacement keeps its class price and records proration in the discount annotations', () => {
  assert.deepEqual(
    classSwapTargetChargeValues({
      grossCents: 15_000,
      automaticDiscountCents: 2_250,
      firstPeriodCents: 9_563,
    }),
    {
      amountCents: 9_563,
      grossAmountCents: 15_000,
      discountAmountCents: 5_437,
      automaticDiscountCents: 2_250,
      swapProrationCents: 3_187,
      discountAnnotations: [
        { kind: 'automatic', label: 'Automatic discount', amountCents: -2_250 },
        { kind: 'manual', label: 'Transfer adjustment', amountCents: -3_187 },
      ],
    },
  )
})

test('a class move reassigns only the source payment that no longer belongs to delivered service', () => {
  assert.equal(
    classSwapPaymentTransferCents({
      sourceAppliedCents: 12_750,
      sourceRetainedCents: 0,
      replacementChargeCents: 12_750,
      replacementAppliedCents: 0,
    }),
    12_750,
  )
  assert.equal(
    classSwapPaymentTransferCents({
      sourceAppliedCents: 12_750,
      sourceRetainedCents: 6_375,
      replacementChargeCents: 9_563,
      replacementAppliedCents: 0,
    }),
    6_375,
  )
})

test('a class move excludes its source enrollment from household discount counts', async () => {
  const pool = {
    async query() {
      return {
        rows: [
          {
            id: 41,
            member_id: 501,
            form_id: 601,
            programs_id: 701,
            family_id: 801,
            pricing_breakdown: { line: { listCents: 15_000, finalCents: 15_000 } },
          },
          {
            id: 42,
            member_id: 501,
            form_id: 602,
            programs_id: 701,
            family_id: 801,
            pricing_breakdown: { line: { listCents: 15_000, finalCents: 15_000 } },
          },
        ],
      }
    },
  }

  const stats = await computeAccountDiscountStats(
    pool,
    { familyId: 801 },
    [],
    { excludeSignupIds: [42] },
  )

  assert.equal(stats.paidClassCount, 1)
  assert.equal(stats.accountMonthlyCents, 15_000)
  assert.deepEqual(stats.dbLines.map((line) => line.signupId), [41])
})
