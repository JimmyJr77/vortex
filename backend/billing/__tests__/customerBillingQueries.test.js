import test from 'node:test'
import assert from 'node:assert/strict'
import {
  listCustomerBillingActivity,
  listCustomerBillingTransactions,
} from '../customerBillingQueries.js'

test('member-filtered transactions retain household payments and one-time charges', async () => {
  let queryText = ''
  let queryParams = []
  const pool = {
    async query(text, params) {
      queryText = String(text)
      queryParams = params
      return {
        rows: [
          {
            entry_kind: 'payment',
            entry_type: 'payment',
            ref_id: '85',
            member_id: null,
            member_name: null,
            description: 'Link',
            amount_cents: -8500,
            occurred_at: '2026-08-26T12:00:00.000Z',
            status: 'succeeded',
            running_balance_cents: 0,
            details: { stripePaymentIntentId: 'pi_85' },
          },
          {
            entry_kind: 'charge',
            entry_type: 'one_time',
            ref_id: '84',
            member_id: '74',
            member_name: 'Alexis Barnett',
            description: 'One-time charge',
            amount_cents: 8500,
            occurred_at: '2026-08-26T11:59:00.000Z',
            status: 'paid',
            running_balance_cents: 8500,
            details: {},
          },
        ],
      }
    },
  }

  const page = await listCustomerBillingTransactions(pool, {
    accountId: 10895,
    memberId: 74,
    limit: 100,
  })

  assert.match(queryText, /wb\.member_id = \$2 OR wb\.member_id IS NULL/)
  assert.equal(queryParams.length, 11)
  assert.equal(queryParams[1], 74)
  assert.equal(page.rows.length, 2)
  assert.equal(page.rows[0].entryKind, 'payment')
  assert.equal(page.rows[0].memberId, null)
  assert.equal(page.rows[0].amountCents, -8500)
  assert.equal(page.rows[1].entryType, 'one_time')
})

test('activity pagination binds one cursor tuple and the requested page limit', async () => {
  const occurredAt = '2026-08-26T12:00:00.000Z'
  const cursor = Buffer.from(JSON.stringify({
    occurredAt,
    sortOrder: 0,
    refId: 44,
  })).toString('base64url')
  let queryParams = []
  const pool = {
    async query(_text, params) {
      queryParams = params
      return {
        rows: [{
          id: '43',
          event_key: 'payment:85',
          family_billing_account_id: '10895',
          member_id: null,
          signup_id: null,
          related_charge_id: null,
          related_payment_id: '85',
          related_refund_id: null,
          event_type: 'payment_succeeded',
          summary: '$85.00 payment succeeded.',
          before_value: null,
          after_value: { amountCents: 8500 },
          details: {},
          stripe_object_id: 'pi_85',
          actor_user_id: null,
          actor_name: null,
          actor_type: 'stripe',
          occurred_at: '2026-08-26T11:00:00.000Z',
        }],
      }
    },
  }

  const page = await listCustomerBillingActivity(pool, {
    accountId: 10895,
    memberId: 74,
    cursor,
    limit: 100,
  })

  assert.deepEqual(queryParams, [10895, 74, occurredAt, 44, 101])
  assert.equal(page.rows.length, 1)
  assert.equal(page.rows[0].relatedPaymentId, 85)
})
