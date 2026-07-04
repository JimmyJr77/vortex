import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CLASSES_PER_MONTH,
  firstOfMonth,
  firstOfNextMonth,
  monthBounds,
  prorationForLine,
  remainingOccurrencesInMonth,
} from '../firstMonthProration.js'
import { computeFirstMonthLayer } from '../orderPricing.js'
import { persistSignupCharges } from '../persistSignupCharges.js'
import { pauseCreditForLine, mergeFirstMonthPrepaidIntoCarriedForward } from '../pauseEnrollmentBilling.js'

/** A weekly time-slot row in the shape loadCalendarRowsForSlotGroups returns. */
function slotRow(overrides = {}) {
  return {
    id: 3,
    slot_group_id: 2,
    form_id: 1,
    program_id: 50,
    programs_id: 5,
    schedule_mode: 'day',
    day_of_week: 1, // Mondays
    week_letter: 'A',
    specific_date: null,
    start_time: '17:30:00',
    end_time: '19:00:00',
    max_participants: 20,
    is_active: true,
    dates_tbd: false,
    active_start: null,
    active_end: null,
    sg_is_active: true,
    sg_active_start: null,
    sg_active_end: null,
    sg_dates_tbd: false,
    sg_offering_id: 200,
    sg_inherits_offering_dates: true,
    offering_id: 200,
    offering_start_date: '2026-07-01',
    offering_end_date: '2026-08-31',
    offering_label: 'Summer 2026',
    form_title: 'Vortex Team',
    form_is_active: true,
    form_start_date: null,
    form_end_date: null,
    enroll_sites: ['athletics'],
    class_name: 'Vortex Team',
    program_name: 'Artistic Gymnastics',
    class_is_active: true,
    signup_count: 0,
    waitlist_count: 0,
    ...overrides,
  }
}

test('date helpers: monthBounds / firstOfMonth / firstOfNextMonth', () => {
  assert.deepEqual(monthBounds('2026-07-08'), { monthStart: '2026-07-01', monthEnd: '2026-07-31' })
  assert.equal(firstOfMonth('2026-09-02'), '2026-09-01')
  assert.equal(firstOfNextMonth('2026-07-08'), '2026-08-01')
  assert.equal(firstOfNextMonth('2026-12-15'), '2027-01-01')
})

test('remainingOccurrencesInMonth counts Mondays left from mid-month', () => {
  // July 2026 Mondays: 6, 13, 20, 27. From July 8 → 13, 20, 27 remain.
  const rows = [slotRow()]
  const remaining = remainingOccurrencesInMonth(rows, {
    slotGroupId: 2,
    timeSlotId: 3,
    fromDate: '2026-07-08',
  })
  assert.equal(remaining, 3)
})

test('prorationForLine mid-month: 3 of 4 Mondays left → ratio 0.75', () => {
  const result = prorationForLine([slotRow()], {
    slotGroupId: 2,
    timeSlotId: 3,
    fromDate: '2026-07-08',
  })
  assert.equal(result.remainingClasses, 3)
  assert.equal(result.ratio, 0.75)
  assert.equal(result.classStartsFutureMonth, false)
  assert.equal(result.firstBillDate, '2026-08-01')
  // 3/4 × $150 = $112.50
  assert.equal(Math.round(15000 * result.ratio), 11250)
})

test('prorationForLine caps 5-session months at full price', () => {
  // June 2026 Mondays: 1, 8, 15, 22, 29 → five occurrences.
  const rows = [slotRow({ offering_start_date: '2026-06-01', offering_end_date: '2026-08-31' })]
  const result = prorationForLine(rows, { slotGroupId: 2, timeSlotId: 3, fromDate: '2026-06-01' })
  assert.equal(result.remainingClasses, 5)
  assert.equal(result.ratio, 1)
})

test('prorationForLine: class starting next month → full month billed on service-month 1st', () => {
  const rows = [slotRow({ offering_start_date: '2026-09-01', offering_end_date: '2026-12-31' })]
  const result = prorationForLine(rows, { slotGroupId: 2, timeSlotId: 3, fromDate: '2026-07-08' })
  // September 2026 Mondays on/after offering start: 7, 14, 21, 28
  assert.equal(result.remainingClasses, 4)
  assert.equal(result.ratio, 1)
  assert.equal(result.classStartsFutureMonth, true)
  assert.equal(result.firstBillDate, '2026-09-01')
  assert.equal(result.firstServicePeriodStart, '2026-09-07')
  assert.equal(result.firstServicePeriodEnd, '2026-09-30')
})

test('prorationForLine: mid-month start in signup month uses remaining sessions', () => {
  const rows = [slotRow({ offering_start_date: '2026-09-01', offering_end_date: '2026-12-31' })]
  const result = prorationForLine(rows, { slotGroupId: 2, timeSlotId: 3, fromDate: '2026-09-15' })
  // Mondays left in September from Sep 15: 21, 28
  assert.equal(result.remainingClasses, 2)
  assert.equal(result.ratio, 0.5)
  assert.equal(result.classStartsFutureMonth, false)
  assert.equal(result.firstBillDate, '2026-10-01')
})

test('prorationForLine: dates TBD → full price, no proration', () => {
  const rows = [slotRow({ dates_tbd: true, sg_dates_tbd: true })]
  const result = prorationForLine(rows, { slotGroupId: 2, timeSlotId: 3, fromDate: '2026-07-08' })
  assert.equal(result.remainingClasses, null)
  assert.equal(result.ratio, 1)
  assert.equal(result.classStartsFutureMonth, false)
})

test('prorationForLine: unknown slot group → full price fallback', () => {
  const result = prorationForLine([slotRow()], { slotGroupId: 999, timeSlotId: 1, fromDate: '2026-07-08' })
  assert.equal(result.ratio, 1)
  assert.equal(result.remainingClasses, null)
})

function fakeCalendarPool(rows) {
  return {
    query: async (sql) => {
      if (/FROM scheduling_time_slot/.test(sql)) return { rows }
      return { rows: [] }
    },
  }
}

test('computeFirstMonthLayer allocates household discount across full account', async () => {
  const pool = fakeCalendarPool([slotRow()])
  const shadows = [1, 2, 3, 4, 5].map((id) => ({
    signupId: id,
    baseCents: 15000,
    finalCents: 15000,
    discountCents: 0,
    applied: [],
  }))
  const slotKeys = ['1:2:3', '1:2:4', '1:2:5']
  const cartLines = slotKeys.map((key) => ({
    key,
    baseCents: 15000,
    finalCents: 15000,
    discountCents: 0,
    applied: [],
  }))
  const layer = await computeFirstMonthLayer(pool, {
    newSignupItems: slotKeys.map((slotKey) => ({
      slotKey,
      formId: 1,
      formTitle: 'Cyclones',
      slotGroupId: 2,
      timeSlotId: 3,
      lineType: 'slot',
      billingType: 'recurring',
      incrementalMonthly: 150,
    })),
    discounts: {
      enabled: true,
      lines: cartLines,
      accountLines: shadows,
      orderDiscounts: [{ amountCents: 42000 }], // 35% of $1,200 household
    },
    asOfDate: '2026-07-08',
  })

  assert.equal(layer.items.length, 3)
  for (const item of layer.items) {
    // $150 − ($420 × $150/$1,200) = $97.50; prorated 3/4 of July → $73.13
    assert.equal(item.monthlyNetCents, 9750)
    assert.equal(item.proratedCents, Math.round(9750 * 0.75))
  }
})

test('computeFirstMonthLayer prepays future-start classes and shows $0 prorated', async () => {
  const pool = fakeCalendarPool([
    slotRow({ offering_start_date: '2026-09-01', offering_end_date: '2027-06-15' }),
  ])
  const slotKey = '1:2:3'
  const layer = await computeFirstMonthLayer(pool, {
    newSignupItems: [
      {
        slotKey,
        formId: 1,
        formTitle: 'Cyclones',
        slotGroupId: 2,
        timeSlotId: 3,
        lineType: 'slot',
        billingType: 'recurring',
        incrementalMonthly: 150,
      },
    ],
    discounts: {
      enabled: true,
      lines: [{ key: slotKey, baseCents: 15000, finalCents: 15000, applied: [] }],
      orderDiscounts: [{ amountCents: 3750 }],
    },
    asOfDate: '2026-07-08',
  })

  const item = layer.items[0]
  assert.equal(item.classStartsFutureMonth, true)
  assert.equal(item.firstBillDate, '2026-09-01')
  assert.equal(item.monthlyNetCents, 11250)
  assert.equal(item.proratedCents, 0)
  assert.equal(item.prepaidFirstMonthCents, 11250)
  assert.equal(layer.totalPrepaidCents, 11250)
  assert.equal(layer.totalProratedCents, 0)
  assert.equal(layer.totalCents, 11250)
})

test('mergeFirstMonthPrepaidIntoCarriedForward adds checkout credits for future-start lines', () => {
  const merged = mergeFirstMonthPrepaidIntoCarriedForward(
    { enabled: true, items: [], creditsCents: 0, debitsCents: 0, totalCents: 0 },
    {
      enabled: true,
      items: [
        {
          slotKey: '1:2:3',
          prepaidFirstMonthCents: 9750,
          displayLine: 'Cyclones · Mondays',
          firstBillDate: '2026-09-01',
        },
      ],
    },
  )
  assert.equal(merged.items.length, 1)
  assert.equal(merged.creditsCents, 9750)
  assert.equal(merged.items[0].amountCents, -9750)
  assert.equal(merged.items[0].kind, 'prepaid_first_month')
})

test('computeFirstMonthLayer prorates the discounted net (household 25% off)', async () => {
  const pool = fakeCalendarPool([slotRow()])
  const slotKey = '1:2:3'
  const layer = await computeFirstMonthLayer(pool, {
    newSignupItems: [
      {
        slotKey,
        formId: 1,
        formTitle: 'Vortex Team',
        slotGroupId: 2,
        timeSlotId: 3,
        lineType: 'slot',
        billingType: 'recurring',
        incrementalMonthly: 150,
        displayLine: 'Vortex Team · Mondays',
      },
    ],
    discounts: {
      enabled: true,
      lines: [{ key: slotKey, baseCents: 15000, finalCents: 15000, applied: [] }],
      orderDiscounts: [{ amountCents: 3750 }], // 25% household discount
    },
    asOfDate: '2026-07-08',
  })

  assert.equal(layer.enabled, true)
  assert.equal(layer.periodStart, '2026-07-08')
  assert.equal(layer.periodEnd, '2026-07-31')
  assert.equal(layer.items.length, 1)
  const item = layer.items[0]
  assert.equal(item.remainingClasses, 3)
  assert.equal(item.ratio, 0.75)
  // Net after order discount: $150 − $37.50 = $112.50; prorated 3/4 → $84.38
  assert.equal(item.monthlyNetCents, 11250)
  assert.equal(item.proratedCents, Math.round(11250 * 0.75))
  assert.equal(layer.totalCents, item.proratedCents)
})

test('computeFirstMonthLayer skips one-time lines and pass-covered $0 lines', async () => {
  const pool = fakeCalendarPool([slotRow()])
  const layer = await computeFirstMonthLayer(pool, {
    newSignupItems: [
      {
        slotKey: '1:2:3',
        formId: 1,
        slotGroupId: 2,
        timeSlotId: 3,
        lineType: 'slot',
        billingType: 'one_time',
        incrementalMonthly: 80,
      },
      {
        slotKey: '1:2:4',
        formId: 1,
        slotGroupId: 2,
        timeSlotId: 4,
        lineType: 'slot',
        billingType: 'recurring',
        incrementalMonthly: 0, // pass-covered
      },
    ],
    discounts: { enabled: false, lines: [], orderDiscounts: [] },
    asOfDate: '2026-07-08',
  })
  assert.equal(layer.enabled, false)
  assert.equal(layer.items.length, 0)
})

function fakeBillingPool() {
  const calls = { subscriptions: [], charges: [], orderCredits: [], feeRedemptions: [] }
  const pool = {
    calls,
    query: async (sql, params = []) => {
      if (/SELECT family_id FROM member/.test(sql)) return { rows: [{ family_id: 9 }] }
      if (/FROM family_billing_account WHERE family_id/.test(sql)) return { rows: [{ id: 77 }] }
      if (/INSERT INTO billing_subscription/.test(sql)) {
        calls.subscriptions.push(params)
        return { rows: [{ id: 500 + calls.subscriptions.length, created: true }] }
      }
      if (/INSERT INTO additional_fee_redemption/.test(sql)) {
        calls.feeRedemptions.push(params)
        return { rows: [] }
      }
      if (/INSERT INTO billing_charge/.test(sql)) {
        if (/'order_discount'/.test(sql)) {
          calls.orderCredits.push(params)
          return { rows: [{ id: 900 }] }
        }
        calls.charges.push(params)
        return { rows: [{ id: 800 + calls.charges.length }] }
      }
      return { rows: [] }
    },
  }
  return pool
}

test('persistSignupCharges posts the prorated first charge and prorated order credit', async () => {
  const pool = fakeBillingPool()
  const slotKey = '1:2:3'
  const preview = {
    newSignups: [
      { slotKey, formId: 1, billingType: 'recurring', incrementalMonthly: 150, selectedPricingOptionKey: null },
    ],
    formSummaries: [],
    discounts: {
      enabled: true,
      lines: [{ key: slotKey, baseCents: 15000, applied: [] }],
      orderDiscounts: [{ amountCents: 3750 }],
    },
    firstMonth: {
      enabled: true,
      classesPerMonth: CLASSES_PER_MONTH,
      items: [
        {
          slotKey,
          ratio: 0.75,
          remainingClasses: 3,
          monthlyNetCents: 11250,
          proratedCents: 8438, // round(11250 × 0.75)
          classStartsFutureMonth: false,
          firstBillDate: '2026-08-01',
        },
      ],
      totalCents: 8438,
    },
  }

  const result = await persistSignupCharges(pool, {
    memberId: 4,
    signups: [{ signupId: 11, formId: 1, slotGroupId: 2, timeSlotId: 3, formTitle: 'Vortex Team', slotLabel: '' }],
    preview,
  })

  assert.equal(result.charges, 1)
  assert.equal(result.subscriptions, 1)

  // Subscription keeps the full monthly rate.
  const subParams = pool.calls.subscriptions[0]
  assert.equal(subParams[5], 15000) // monthly_amount_cents

  // First charge uses preview proratedCents (after order-level discount allocation).
  const chargeParams = pool.calls.charges[0]
  assert.equal(chargeParams[4], 8438) // amount_cents
  assert.equal(chargeParams[5], 11250) // gross_amount_cents (75% of $150)

  // Order discount is already reflected in monthlyNetCents for the prorated charge.
  assert.equal(pool.calls.orderCredits.length, 0)
})

test('persistSignupCharges posts prepaid first-month charge and credit for future-start classes', async () => {
  const pool = fakeBillingPool()
  const slotKey = '1:4:5'
  const preview = {
    newSignups: [
      { slotKey, formId: 1, billingType: 'recurring', incrementalMonthly: 100, selectedPricingOptionKey: null },
    ],
    formSummaries: [],
    discounts: { enabled: false, lines: [], orderDiscounts: [] },
    firstMonth: {
      enabled: true,
      classesPerMonth: CLASSES_PER_MONTH,
      items: [
        {
          slotKey,
          ratio: 1,
          remainingClasses: 4,
          monthlyNetCents: 10000,
          proratedCents: 0,
          prepaidFirstMonthCents: 10000,
          classStartsFutureMonth: true,
          firstBillDate: '2026-09-01',
          firstServicePeriodStart: '2026-09-07',
          firstServicePeriodEnd: '2026-09-30',
        },
      ],
      totalCents: 10000,
      totalProratedCents: 0,
      totalPrepaidCents: 10000,
    },
  }

  const result = await persistSignupCharges(pool, {
    memberId: 4,
    signups: [{ signupId: 12, formId: 1, slotGroupId: 4, timeSlotId: 5, formTitle: 'Fall Team', slotLabel: '' }],
    preview,
  })

  assert.equal(result.subscriptions, 1)
  assert.equal(result.charges, 1)
  assert.equal(pool.calls.charges[0][4], 10000)
  assert.equal(pool.calls.subscriptions[0][10], '2026-09-01') // next_bill_date
})

test('persistSignupCharges posts additional_fee billing_charge and once-per-year redemption', async () => {
  const pool = fakeBillingPool()
  const preview = {
    newSignups: [],
    formSummaries: [],
    discounts: { enabled: false, lines: [], orderDiscounts: [] },
    additionalFees: {
      enabled: true,
      items: [
        {
          feeId: 3,
          name: 'Annual Fee',
          triggerType: 'once_per_year',
          amountCents: 8500,
        },
      ],
    },
  }

  const result = await persistSignupCharges(pool, {
    memberId: 4,
    signups: [{ signupId: 11, formId: 1, slotGroupId: 2, timeSlotId: 3, formTitle: 'Vortex Team', slotLabel: '' }],
    preview,
  })

  assert.equal(result.charges, 1)
  assert.equal(pool.calls.feeRedemptions.length, 1)
  const feeCharge = pool.calls.charges.find((params) => params[3] === 'Annual Fee')
  assert.ok(feeCharge)
  assert.match(String(feeCharge[2]), /^3:4:\d{4}$/)
  assert.equal(feeCharge[4], 8500)
})

test('pauseCreditForLine awards prorated credit for remaining sessions after pause', () => {
  const rows = [slotRow()]
  const result = pauseCreditForLine(rows, {
    slotGroupId: 2,
    timeSlotId: 3,
    pauseDate: '2026-07-15',
    netMonthlyCents: 15000,
  })
  assert.ok(result.remainingClasses > 0)
  assert.equal(result.ratio, Math.min(result.remainingClasses, CLASSES_PER_MONTH) / CLASSES_PER_MONTH)
  assert.equal(result.creditCents, Math.round(15000 * result.ratio))
})

test('pauseCreditForLine returns zero credit when no sessions remain after pause', () => {
  const rows = [slotRow({ day_of_week: 2 })]
  const result = pauseCreditForLine(rows, {
    slotGroupId: 2,
    timeSlotId: 3,
    pauseDate: '2026-07-31',
    netMonthlyCents: 12000,
  })
  assert.equal(result.remainingClasses, 0)
  assert.equal(result.creditCents, 0)
})
