import test from 'node:test'
import assert from 'node:assert/strict'
import { validateEnrollmentActionDate } from '../datedEnrollmentActions.js'
import { transferableEnrollmentDiscounts } from '../../billing/enrollmentDiscountTransfer.js'

test('action dates allow past, present and future while preserving chronological enrollment history', () => {
  const options = { today: '2026-11-11', signup: { status: 'confirmed', enrollment_start_date: '2026-09-01' }, targetStatus: 'paused' }
  for (const date of ['2026-10-15','2026-11-11','2026-12-01']) assert.equal(validateEnrollmentActionDate(date, options), date)
  for (const date of ['2026-02-30','2026-11-31','invalid','2026-08-31']) assert.throws(() => validateEnrollmentActionDate(date, options))
  assert.throws(() => validateEnrollmentActionDate('2026-10-15', { ...options, latestDate: '2026-11-01' }), /last recorded action/)
  assert.throws(() => validateEnrollmentActionDate('2026-11-11', { ...options, signup: { status: 'waitlisted' } }), /Only active/)
})

test('class transfers keep remaining discount windows and do not restart expired or cleared discounts', () => {
  const row = (id, from, through, amount = 2500) => ({ id, kind: 'legacy_discount', status: 'active', effective_from_month: from, effective_through_month: through,
    discount_rule_snapshot: { assignmentSource: 'enrollment_actions', amountValue: amount } })
  const history = [row(1,'2026-09','2026-09'), row(2,'2026-10','2026-12'), row(3,'2027-02',null)]
  assert.deepEqual(transferableEnrollmentDiscounts(history,'2026-11').map(item => item.id),[2,3])
  assert.equal(transferableEnrollmentDiscounts(history,'2026-11')[0].effective_through_month,'2026-12')
  history.push(row(4,'2026-11',null,0))
  assert.deepEqual(transferableEnrollmentDiscounts(history,'2026-11').map(item => item.id),[4])
})
