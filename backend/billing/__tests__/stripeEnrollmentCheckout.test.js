import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeEnrollmentDueNowCents,
  computeFirstMonthTuitionLineItems,
  computeSubscriptionTrialEndUnix,
} from '../stripeEnrollmentCheckout.js'
import { firstOfNextMonth } from '../../scheduling/firstMonthProration.js'

test('computeFirstMonthTuitionLineItems separates prorated and prepaid per class', () => {
  const preview = {
    firstMonth: {
      enabled: true,
      items: [
        {
          slotKey: 'a',
          formTitle: 'Typhoons',
          proratedCents: 11250,
          prepaidFirstMonthCents: 0,
        },
        {
          slotKey: 'b',
          displayLine: 'Future Class',
          proratedCents: 0,
          prepaidFirstMonthCents: 15000,
        },
      ],
    },
  }
  const lines = computeFirstMonthTuitionLineItems(preview)
  assert.equal(lines.length, 2)
  assert.equal(lines[0].amountCents, 11250)
  assert.match(lines[0].name, /prorated/i)
  assert.equal(lines[1].amountCents, 15000)
  assert.match(lines[1].name, /prepaid/i)
})

test('computeSubscriptionTrialEndUnix defers recurring until next 1st after prorated signup', () => {
  const preview = {
    firstMonth: {
      enabled: true,
      items: [
        {
          proratedCents: 15000,
          classStartsFutureMonth: false,
          firstBillDate: '2026-08-01',
        },
      ],
    },
  }
  const trialEnd = computeSubscriptionTrialEndUnix(preview, '2026-07-04')
  assert.equal(trialEnd, computeSubscriptionTrialEndUnix({ firstMonth: { enabled: true, items: [{
    proratedCents: 1,
    classStartsFutureMonth: false,
    firstBillDate: '2026-08-01',
  }] } }, '2026-07-04'))
  const expected = Math.floor(Date.UTC(2026, 7, 1, 12, 0, 0) / 1000)
  assert.equal(trialEnd, expected)
})

test('computeSubscriptionTrialEndUnix defers recurring until month after prepaid service month', () => {
  const preview = {
    firstMonth: {
      enabled: true,
      items: [
        {
          proratedCents: 0,
          prepaidFirstMonthCents: 15000,
          classStartsFutureMonth: true,
          firstBillDate: '2026-09-01',
        },
      ],
    },
  }
  const trialEnd = computeSubscriptionTrialEndUnix(preview, '2026-07-04')
  const afterPrepaidMonth = firstOfNextMonth('2026-09-01')
  const expected = Math.floor(
    Date.UTC(
      Number(afterPrepaidMonth.slice(0, 4)),
      Number(afterPrepaidMonth.slice(5, 7)) - 1,
      Number(afterPrepaidMonth.slice(8, 10)),
      12,
      0,
      0,
    ) / 1000,
  )
  assert.equal(trialEnd, expected)
})

test('computeEnrollmentDueNowCents matches fees plus first-month tuition', () => {
  const preview = {
    additionalFeesOneTime: 85,
    firstMonth: { totalCents: 15000 },
    passPurchaseTotalCents: 0,
    carriedForward: { totalCents: 0 },
  }
  assert.equal(computeEnrollmentDueNowCents(preview), 23500)
})
