import test from 'node:test'
import assert from 'node:assert/strict'
import { setAnnualMembershipAutoRenewal } from '../annualMembershipAutoRenewal.js'

function fixture({ subscription = null } = {}) {
  const queries = []
  const existing = subscription ?? {
    id: 41,
    family_billing_account_id: 9,
    member_id: 73,
    source_type: 'annual_membership',
    status: 'active',
    auto_renewal: true,
    next_bill_date: '2027-08-27',
    stripe_subscription_id: null,
  }
  const db = {
    release() {},
    async query(sql, params = []) {
      const text = String(sql)
      queries.push({ text, params })
      if (/pg_advisory_lock/.test(text)) return { rows: [] }
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
      if (/SELECT \* FROM billing_subscription/.test(text)) return { rows: [{ ...existing }] }
      if (/UPDATE billing_subscription/.test(text)) {
        return { rows: [{ ...existing, auto_renewal: params[1], updated_at: '2026-09-04T12:00:00.000Z' }] }
      }
      if (/INSERT INTO billing_account_activity/.test(text)) return { rows: [] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  return { db, queries }
}

test('disabling annual auto-renewal preserves the paid-through schedule and records the change', async () => {
  const { db, queries } = fixture()
  const saved = await setAnnualMembershipAutoRenewal(db, {
    account: { id: 9 },
    subscriptionId: 41,
    enabled: false,
    actorUserId: 4,
  })

  assert.equal(saved.auto_renewal, false)
  assert.equal(saved.next_bill_date, '2027-08-27')
  const update = queries.find((entry) => /UPDATE billing_subscription/.test(entry.text))
  assert.match(update.text, /SET auto_renewal = \$2/)
  assert.doesNotMatch(update.text, /next_bill_date|SET status/)
  const activity = queries.find((entry) => /INSERT INTO billing_account_activity/.test(entry.text))
  assert.equal(activity.params[10], JSON.stringify({ autoRenewal: false }))
  assert.match(activity.params[11], /paidThroughDate/)
})

test('a cancelled annual membership subscription cannot be resumed', async () => {
  const { db, queries } = fixture({ subscription: {
    id: 41,
    family_billing_account_id: 9,
    member_id: 73,
    source_type: 'annual_membership',
    status: 'cancelled',
    auto_renewal: false,
    next_bill_date: '2027-08-27',
  } })

  await assert.rejects(
    setAnnualMembershipAutoRenewal(db, {
      account: { id: 9 },
      subscriptionId: 41,
      enabled: true,
    }),
    (error) => error.statusCode === 409,
  )
  assert.equal(queries.some((entry) => /UPDATE billing_subscription/.test(entry.text)), false)
})
