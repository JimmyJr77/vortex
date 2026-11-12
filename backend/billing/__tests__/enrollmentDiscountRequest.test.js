import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEnrollmentDiscountRequest } from '../enrollmentDiscountRequest.js'
import { effectiveEnrollmentPriceAdjustments } from '../customerBillingPricing.js'
import { runtimeDiscountRuleFromAdjustment } from '../recurringPeriodPricing.js'

const context = { signup_id: 17, facility_id: 2, subscription_start_date: '2026-01-01' }
const now = new Date('2026-11-11T12:00:00Z')
const db = { query: async () => { throw new Error('Unexpected database query') } }
const input = { mode: 'manual', percent: 25, effectiveFromMonth: '2026-11' }

test('discount durations use inclusive billing months and cross year boundaries', async () => {
  for (const [duration, months, expected] of [['once', undefined, '2026-11-01'], ['monthly', undefined, null], ['months', 3, '2027-01-01']]) {
    const result = await normalizeEnrollmentDiscountRequest(db, context, { ...input, duration, durationMonths: months }, now)
    assert.equal(result.effectiveThrough, expected)
    assert.equal(result.promo.snapshot.amountValue, 2500)
    assert.equal(result.promo.snapshot.config.assignmentOnly, true)
    assert.equal(runtimeDiscountRuleFromAdjustment({ kind: result.kind, discount_rule_snapshot: result.promo.snapshot }).id, -17)
  }
})

test('discount validation rejects invalid money, percentages, durations and backdating', async () => {
  for (const invalid of [
    { percent: NaN }, { percent: 101 }, { percent: -1 }, { amountCents: 100, percent: 25 },
    { percent: undefined, amountCents: 1.5 }, { duration: 'weekly' },
    { duration: 'months', durationMonths: 0 }, { duration: 'months', durationMonths: 1.5 },
    { duration: 'months', durationMonths: 121 }, { effectiveFromMonth: '2026-10' },
  ]) await assert.rejects(normalizeEnrollmentDiscountRequest(db, context, { ...input, ...invalid }, now))
})

test('selected discount rule is scoped to the facility and becomes a dated assignment', async () => {
  const scoped = { query: async (sql, values) => {
    assert.match(sql, /\(facility_id = \$2 OR facility_id IS NULL\) AND active = TRUE/)
    assert.deepEqual(values, [44, 2])
    return { rows: [{ id: 44, name: 'Scholarship', amount_type: 'fixed', amount_value: 4000 }] }
  } }
  const result = await normalizeEnrollmentDiscountRequest(scoped, context, { ...input, mode: 'rule', ruleId: 44, duration: 'once' }, now)
  assert.equal(result.promo.snapshot.selectedRuleId, 44)
  assert.equal(result.promo.snapshot.amountValue, 4000)
  await assert.rejects(normalizeEnrollmentDiscountRequest({ query: async () => ({ rows: [] }) }, context, { ...input, mode: 'rule', ruleId: 44 }, now), /unavailable/)
})

function assignment(id, from, through = null, amount = 1000) {
  return { id, status: 'active', kind: 'legacy_discount', effective_from_month: from, effective_through_month: through,
    discount_rule_snapshot: { assignmentSource: 'enrollment_actions', amountValue: amount } }
}

test('replacing, expiring and clearing discounts preserves past months without reviving older discounts', () => {
  const first = assignment(1, '2026-09')
  const temporary = assignment(2, '2026-11', '2026-12')
  const promo = { id: 7, kind: 'promo_code', promo_code: 'TEAM', status: 'active', effective_from_month: '2026-01' }
  const history = [first, temporary, promo]
  assert.deepEqual(effectiveEnrollmentPriceAdjustments(history, '2026-10').map(row => row.id), [1, 7])
  assert.deepEqual(effectiveEnrollmentPriceAdjustments(history, '2026-11').map(row => row.id), [2, 7])
  assert.deepEqual(effectiveEnrollmentPriceAdjustments(history, '2027-01').map(row => row.id), [7])
  history.push(assignment(3, '2026-12', null, 0))
  assert.deepEqual(effectiveEnrollmentPriceAdjustments(history, '2026-11').map(row => row.id), [2, 7])
  assert.deepEqual(effectiveEnrollmentPriceAdjustments(history, '2026-12').map(row => row.id), [7, 3])
})

test('a proposed replacement affects preview, while older manual history remains effective before its start', () => {
  const legacy = { id: 1, kind: 'legacy_discount', status: 'active', effective_from_month: '2026-01' }
  const proposed = { ...assignment(-1, '2026-11', '2026-11'), proposed: true, status: 'pending_sync' }
  assert.deepEqual(effectiveEnrollmentPriceAdjustments([legacy, proposed], '2026-10'), [legacy])
  assert.deepEqual(effectiveEnrollmentPriceAdjustments([legacy, proposed], '2026-11'), [proposed])
  assert.deepEqual(effectiveEnrollmentPriceAdjustments([legacy, proposed], '2026-12'), [])
})
