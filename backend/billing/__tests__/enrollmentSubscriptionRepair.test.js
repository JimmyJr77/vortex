import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildEnrollmentRepairPlans,
  defaultSavedPaymentMethodId,
  enrollmentRepairFirstBillDate,
  ensureLegacyEnrollmentAdjustmentRecords,
  findEnrollmentSubscriptionGaps,
  promoCodeFromLegacyRule,
} from '../enrollmentSubscriptionRepair.js'
import { enrollmentStripeSubscriptionIdempotencyKey } from '../stripeEnrollmentCheckout.js'

test('repair anchors to the next calendar month without catch-up collection', () => {
  const now = new Date('2026-08-29T16:00:00.000Z')
  assert.equal(
    enrollmentRepairFirstBillDate({ now, enrollmentStartDate: '2026-08-25' }),
    '2026-09-01',
  )
  assert.equal(
    enrollmentRepairFirstBillDate({ now, enrollmentStartDate: '2026-09-01' }),
    '2026-09-01',
  )
  assert.equal(
    enrollmentRepairFirstBillDate({ now, enrollmentStartDate: '2026-10-15' }),
    '2026-10-01',
  )
  assert.equal(
    enrollmentRepairFirstBillDate({
      now: new Date('2026-09-01T12:00:00.000Z'),
      enrollmentStartDate: '2026-08-25',
    }),
    '2026-10-01',
  )
})

test('only a reusable default Stripe payment method qualifies as a saved card', () => {
  assert.equal(defaultSavedPaymentMethodId(null), null)
  assert.equal(defaultSavedPaymentMethodId({ deleted: true }), null)
  assert.equal(defaultSavedPaymentMethodId({ invoice_settings: {} }), null)
  assert.equal(
    defaultSavedPaymentMethodId({ invoice_settings: { default_payment_method: 'pm_123' } }),
    'pm_123',
  )
  assert.equal(
    defaultSavedPaymentMethodId({ invoice_settings: { default_payment_method: { id: 'pm_456' } } }),
    'pm_456',
  )
})

test('legacy promo codes are normalized from either supported rule config field', () => {
  assert.equal(
    promoCodeFromLegacyRule({ type: 'promo_code', config: { code: ' 50offvortex26 ' } }),
    '50OFFVORTEX26',
  )
  assert.equal(
    promoCodeFromLegacyRule({
      type: 'promo_code',
      config: JSON.stringify({ promo_code: 'save50' }),
    }),
    'SAVE50',
  )
  assert.equal(promoCodeFromLegacyRule({ type: 'multi_class', config: { code: 'NOPE' } }), null)
})

test('legacy promo attribution is corrected with a revoked and linked replacement', async () => {
  const calls = { revoked: [], inserted: [], activity: [] }
  const client = {
    async query(sql, params = []) {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (/SELECT \* FROM discount_rule/.test(sql)) {
        return {
          rows: [{
            id: 9,
            name: '50% Off',
            type: 'promo_code',
            amount_type: 'percent',
            amount_value: 5000,
            apply_to: 'order_total',
            calc_base: 'pre',
            config: { code: '50OFFVORTEX26' },
          }],
        }
      }
      if (/FROM scheduling_signup signup/.test(sql)) {
        return {
          rows: [{
            id: 96,
            member_id: 74,
            enrollment_start_date: '2026-08-31',
            subscription_id: 901,
            monthly_amount_cents: 15000,
          }],
        }
      }
      if (/FROM enrollment_price_adjustment/.test(sql)) {
        return {
          rows: [{
            id: 1,
            signup_id: 96,
            promo_code: null,
            reason: 'half-time-athlete',
            status: 'active',
          }],
        }
      }
      if (/UPDATE enrollment_price_adjustment/.test(sql)) {
        calls.revoked.push(params)
        return { rows: [] }
      }
      if (/INSERT INTO enrollment_price_adjustment/.test(sql)) {
        calls.inserted.push(params)
        return { rows: [{ id: 4 }] }
      }
      if (/INSERT INTO billing_account_activity/.test(sql)) {
        calls.activity.push(params)
        return { rows: [{ id: 10 }] }
      }
      if (/INSERT INTO discount_redemption/.test(sql)) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
    release() {},
  }
  const pool = { async connect() { return client } }

  const result = await ensureLegacyEnrollmentAdjustmentRecords(pool, {
    accountId: 10895,
    signupIds: [96],
    ruleId: 9,
    reason: 'Original enrollment used promo code 50OFFVORTEX26',
  })

  assert.deepEqual(result, {
    inserted: 1,
    superseded: 1,
    promoCode: '50OFFVORTEX26',
  })
  assert.deepEqual(calls.revoked, [[1, null, 'Promo attribution corrected to 50OFFVORTEX26']])
  assert.equal(calls.inserted[0][4], '50OFFVORTEX26')
  assert.equal(calls.inserted[0][11], 'Original enrollment used promo code 50OFFVORTEX26')
  assert.equal(calls.inserted[0][13], 1)
  assert.equal(calls.activity.length, 1)
})

test('repair plans skip unresolved and zero-dollar enrollments', () => {
  const candidates = [
    { signup_id: 1, account_id: 10, enrollment_start_date: '2026-08-20' },
    { signup_id: 2, account_id: 10, enrollment_start_date: '2026-08-20' },
    { signup_id: 3, account_id: 10, enrollment_start_date: '2026-08-20' },
  ]
  const prices = new Map([
    [1, { grossCents: 15000, discountCents: 2250, netCents: 12750 }],
    [2, { grossCents: 15000, discountCents: 15000, netCents: 0 }],
  ])
  const result = buildEnrollmentRepairPlans(candidates, prices, {
    now: new Date('2026-08-29T16:00:00.000Z'),
  })
  assert.deepEqual(result.plans.map((plan) => plan.candidate.signup_id), [1])
  assert.equal(result.plans[0].nextBillDate, '2026-09-01')
  assert.deepEqual(
    result.skipped.map((entry) => [entry.signupId, entry.reason]),
    [
      [2, 'nonpositive_recurring_price'],
      [3, 'price_unresolved'],
    ],
  )
})

test('candidate query enforces recurring active enrollment boundaries and scoped IDs', async () => {
  let captured
  const db = {
    async query(sql, params) {
      captured = { sql, params }
      return { rows: [{ signup_id: 96 }] }
    },
  }
  const rows = await findEnrollmentSubscriptionGaps(db, {
    accountIds: [10895],
    signupIds: [96, 97, 98],
  })
  assert.deepEqual(rows, [{ signup_id: 96 }])
  assert.deepEqual(captured.params, [[10895], [96, 97, 98]])
  assert.match(captured.sql, /signup\.status = 'confirmed'/)
  assert.match(captured.sql, /signup\.orphaned_at IS NULL/)
  assert.match(captured.sql, /cancel_effective_date IS NULL/)
  assert.match(captured.sql, /<> 'one_time'/)
  assert.match(captured.sql, /subscription\.id IS NULL OR subscription\.stripe_subscription_id IS NULL/)
})

test('Stripe subscription retries use a stable local-subscription idempotency key', () => {
  assert.equal(
    enrollmentStripeSubscriptionIdempotencyKey(123),
    'enrollment-subscription:123:create-v1',
  )
  assert.equal(
    enrollmentStripeSubscriptionIdempotencyKey(123),
    enrollmentStripeSubscriptionIdempotencyKey(123),
  )
  assert.notEqual(
    enrollmentStripeSubscriptionIdempotencyKey(123),
    enrollmentStripeSubscriptionIdempotencyKey(124),
  )
})
