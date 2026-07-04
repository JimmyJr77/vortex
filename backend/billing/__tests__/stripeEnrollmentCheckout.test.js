import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeEnrollmentDueNowCents,
  computeFirstMonthBillingAnchorDate,
  computeFirstMonthTuitionLineItems,
  computeSubscriptionBillingAnchorDate,
  formatFirstMonthTuitionLineName,
} from '../stripeEnrollmentCheckout.js'
import { firstOfNextMonth } from '../../scheduling/firstMonthProration.js'

test('formatFirstMonthTuitionLineName uses tuition wording for a full remaining month', () => {
  const name = formatFirstMonthTuitionLineName({
    formTitle: 'Typhoons',
    proratedCents: 15000,
    remainingClasses: 4,
    classesPerMonth: 4,
    ratio: 1,
  })
  assert.match(name, /first month tuition/i)
  assert.doesNotMatch(name, /prorated/i)
})

test('formatFirstMonthTuitionLineName uses prorated wording for partial months', () => {
  const name = formatFirstMonthTuitionLineName({
    formTitle: 'Typhoons',
    proratedCents: 7500,
    remainingClasses: 2,
    classesPerMonth: 4,
    ratio: 0.5,
  })
  assert.match(name, /first month \(prorated\)/i)
})

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
          remainingClasses: 3,
          classesPerMonth: 4,
          ratio: 0.75,
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

test('computeFirstMonthBillingAnchorDate uses next 1st after in-session tuition paid now', () => {
  const anchor = computeFirstMonthBillingAnchorDate(
    {
      proratedCents: 15000,
      classStartsFutureMonth: false,
      firstBillDate: '2026-08-01',
    },
    '2026-07-04',
  )
  assert.equal(anchor, '2026-08-01')
})

test('computeFirstMonthBillingAnchorDate defers recurring until month after prepaid service month', () => {
  const anchor = computeFirstMonthBillingAnchorDate(
    {
      proratedCents: 0,
      prepaidFirstMonthCents: 15000,
      classStartsFutureMonth: true,
      firstBillDate: '2026-09-01',
    },
    '2026-07-04',
  )
  assert.equal(anchor, firstOfNextMonth('2026-09-01'))
})

test('computeSubscriptionBillingAnchorDate picks latest anchor across lines', () => {
  const preview = {
    firstMonth: {
      enabled: true,
      items: [
        {
          proratedCents: 15000,
          classStartsFutureMonth: false,
          firstBillDate: '2026-08-01',
        },
        {
          prepaidFirstMonthCents: 15000,
          classStartsFutureMonth: true,
          firstBillDate: '2026-09-01',
        },
      ],
    },
  }
  assert.equal(computeSubscriptionBillingAnchorDate(preview, '2026-07-04'), '2026-10-01')
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
