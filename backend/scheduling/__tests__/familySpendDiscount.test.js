import test from 'node:test'
import assert from 'node:assert/strict'
import { computeOrderDiscounts } from '../discountEngine.js'
import {
  computeAccountStats,
  pickMonthlySpendTier,
  isHouseholdSpendVolumeRule,
  nextSpendTierHint,
  spendTierQualificationLabel,
} from '../systemDiscounts.js'

// Mirrors the production rule: created via admin UI, so config has NO system_key
// and exclusivity_group is null. Tier thresholds are monthly-spend cents.
const familySpendRule = {
  id: 7,
  name: 'Family multi-class spend discount',
  type: 'spend_volume',
  active: true,
  amountType: 'percent',
  amountValue: 1000,
  applyTo: 'order_total',
  calcBase: 'post',
  priority: 100,
  stackable: true,
  exclusivityGroup: null,
  config: { promo_code: 'SPND-FAMILYMULT', promo_code_auto_generated: true },
  tiers: [
    { threshold: 15000, amountType: 'percent', amountValue: 500, minPaidEnrollments: 2 },
    { threshold: 25000, amountType: 'percent', amountValue: 1000, minPaidEnrollments: 2 },
    { threshold: 30000, amountType: 'percent', amountValue: 1500, minPaidEnrollments: 2 },
    { threshold: 45000, amountType: 'percent', amountValue: 2000, minPaidEnrollments: 3 },
    { threshold: 60000, amountType: 'percent', amountValue: 2500, minPaidEnrollments: 3 },
    { threshold: 75000, amountType: 'percent', amountValue: 3000, minPaidEnrollments: 4 },
    { threshold: 90000, amountType: 'percent', amountValue: 3500, minPaidEnrollments: 4 },
    { threshold: 105000, amountType: 'percent', amountValue: 4000, minPaidEnrollments: 5 },
  ],
}

function makeLine(overrides) {
  return {
    memberId: 1,
    familyId: 1,
    includeInSubtotal: true,
    ...overrides,
  }
}

function attachStats(lines) {
  const paid = lines.filter((l) => (l.baseCents ?? 0) > 0)
  const spend = paid.reduce((sum, l) => sum + l.baseCents, 0)
  for (const line of lines) {
    line.accountPaidClassCount = paid.length
    line.accountMonthlyCents = spend
    line.accountAllLines = lines
  }
  return lines
}

test('admin-created spend rule without system_key is treated as household rule', () => {
  assert.equal(isHouseholdSpendVolumeRule(familySpendRule), true)
})

test('pickMonthlySpendTier selects 25% at $600 with 4 paid classes', () => {
  const stats = computeAccountStats(
    Array.from({ length: 4 }, () => ({ listCents: 15000, finalCents: 15000, baseCents: 15000 })),
  )
  assert.equal(stats.paidClassCount, 4)
  assert.equal(stats.accountMonthlyCents, 60000)
  const tier = pickMonthlySpendTier(familySpendRule, stats)
  assert.equal(tier.amountValue, 2500)
})

test('1 existing + 3 new classes at $150 each gets 25% of $600 = $150', () => {
  const shadow = makeLine({
    key: 'account-db-101',
    signupId: 101,
    formId: 10,
    baseCents: 15000,
    listCents: 15000,
    finalCents: 15000,
    includeInSubtotal: false,
    shadowOnly: true,
  })
  const cart = [1, 2, 3].map((i) =>
    makeLine({ key: `new-${i}`, formId: 10 + i, baseCents: 15000, listCents: 15000, finalCents: 15000 }),
  )
  const lines = attachStats([shadow, ...cart])

  const result = computeOrderDiscounts({
    lines,
    rules: [familySpendRule],
    promoCodes: [],
    caps: {},
  })

  assert.equal(result.totalDiscountCents, 15000)
  assert.equal(result.orderDiscounts.length, 1)
  const d = result.orderDiscounts[0]
  assert.equal(d.amountCents, 15000)
  assert.equal(d.name, 'Family multi-class spend discount')
  assert.equal(d.qualifiedLabel, '25% off for a minimum of 3 Classes and $600')
  assert.equal(d.nextTierHint, '$150 more will unlock a 30% discount.')
})

test('existing-only shadow lines receive proportional spend discount per class', () => {
  const lines = attachStats(
    [101, 102, 103, 104].map((id) =>
      makeLine({
        key: `account-db-${id}`,
        signupId: id,
        formId: 10 + id,
        baseCents: 15000,
        listCents: 15000,
        finalCents: 15000,
        includeInSubtotal: false,
        shadowOnly: true,
      }),
    ),
  )

  const result = computeOrderDiscounts({
    lines,
    rules: [familySpendRule],
    promoCodes: [],
    caps: {},
  })

  assert.equal(result.totalDiscountCents, 15000)
  assert.equal(result.accountLines.length, 4)
  for (const line of result.accountLines) {
    assert.equal(line.finalCents, 11250)
    assert.equal(line.discountCents, 3750)
  }
})

test('2 classes at $300 total gets 15% and hint requires 1 more class at $150', () => {
  const shadow = makeLine({
    key: 'account-db-101',
    signupId: 101,
    formId: 10,
    baseCents: 15000,
    listCents: 15000,
    finalCents: 15000,
    includeInSubtotal: false,
    shadowOnly: true,
  })
  const cart = makeLine({
    key: 'new-1',
    formId: 11,
    baseCents: 15000,
    listCents: 15000,
    finalCents: 15000,
  })
  const lines = attachStats([shadow, cart])

  const result = computeOrderDiscounts({
    lines,
    rules: [familySpendRule],
    promoCodes: [],
    caps: {},
  })

  assert.equal(result.totalDiscountCents, 4500)
  const d = result.orderDiscounts[0]
  assert.equal(d.qualifiedLabel, '15% off for a minimum of 2 Classes and $300')
  assert.equal(d.nextTierHint, '1 more class at $150 or more will unlock a 20% discount.')
})

test('spendTierQualificationLabel includes reward and minimums', () => {
  assert.equal(
    spendTierQualificationLabel({
      threshold: 60000,
      minPaidEnrollments: 3,
      amountType: 'percent',
      amountValue: 2500,
    }),
    '25% off for a minimum of 3 Classes and $600',
  )
  assert.equal(
    spendTierQualificationLabel({ threshold: 15000, amountType: 'percent', amountValue: 500 }),
    '5% off for a minimum of $150',
  )
})

test('nextSpendTierHint omits class requirement when count already met', () => {
  const applied = familySpendRule.tiers[4] // $600 / 25%
  const hint = nextSpendTierHint(
    familySpendRule,
    applied,
    { paidClassCount: 4, accountMonthlyCents: 60000 },
  )
  assert.equal(hint, '$150 more will unlock a 30% discount.')
})

test('nextSpendTierHint omits spend when only classes are missing', () => {
  // 2 classes but $800 spend: qualifies for the $300/15% tier (higher tiers need 3+ classes).
  const applied = familySpendRule.tiers[2] // $300 / 15%
  const hint = nextSpendTierHint(
    familySpendRule,
    applied,
    { paidClassCount: 2, accountMonthlyCents: 80000 },
  )
  assert.equal(hint, '1 more class will unlock a 20% discount.')
})

test('nextSpendTierHint returns null at the top tier', () => {
  const applied = familySpendRule.tiers[7] // $1050 / 40%
  const hint = nextSpendTierHint(
    familySpendRule,
    applied,
    { paidClassCount: 6, accountMonthlyCents: 120000 },
  )
  assert.equal(hint, null)
})
