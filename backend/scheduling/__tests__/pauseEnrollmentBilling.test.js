import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyPendingPauseCredits,
  applyScheduledPauses,
} from '../pauseEnrollmentBilling.js'

test('strict pause-credit idempotency rejects a mismatched existing charge', async () => {
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (/SELECT pc\.\*, sf\.title/.test(text)) {
        return {
          rows: [{
            id: 11,
            scheduling_signup_id: 101,
            family_billing_account_id: 9,
            member_id: 7,
            credit_cents: 3000,
            pause_date: '2026-08-20',
            service_month: '2026-08',
            apply_on_month: '2026-09',
            credit_kind: 'prorated_pause',
            remaining_classes: 1,
            form_title: 'Tornadoes',
          }],
        }
      }
      if (/INSERT INTO billing_charge/.test(text)) return { rows: [] }
      if (/SELECT id, family_billing_account_id/.test(text)) {
        return {
          rows: [{
            id: 88,
            family_billing_account_id: 9,
            member_id: 7,
            amount_cents: -1000,
            charge_type: 'credit',
            billing_interval: 'one_time',
          }],
        }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  await assert.rejects(
    applyPendingPauseCredits(pool, {
      periodStart: '2026-09-01',
      facilityId: 2,
      accountId: 9,
      strict: true,
    }),
    (error) => error.code === 'pause_credit_idempotency_mismatch',
  )
})

test('strict scheduled pause rolls back signup when subscription pause fails', async () => {
  const calls = []
  const client = {
    release() {},
    async query(sql) {
      const text = String(sql)
      calls.push(text)
      if (/SELECT DISTINCT signup\.id/.test(text)) {
        return { rows: [{ id: 101, pause_effective_date: '2026-09-01', pause_mode: 'next_month', family_id: 3 }] }
      }
      if (/SELECT stripe_subscription_id/.test(text)) return { rows: [] }
      if (text === 'BEGIN' || text === 'ROLLBACK' || /^SAVEPOINT /.test(text) || /^RELEASE SAVEPOINT /.test(text)) {
        return { rows: [] }
      }
      if (/FROM scheduling_signup/.test(text) && /FOR UPDATE/.test(text)) return { rows: [{ id: 101 }] }
      if (/FROM billing_subscription/.test(text) && /FOR UPDATE/.test(text)) return { rows: [{ id: 41 }] }
      if (/information_schema\.columns/.test(text)) return { rows: [{ n: 2 }] }
      if (/SET status = \$1/.test(text)) return { rows: [{ id: 101, status: 'paused' }] }
      if (/SET pause_effective_date = NULL/.test(text)) return { rows: [{ id: 101 }] }
      if (/UPDATE billing_subscription/.test(text)) throw new Error('injected subscription pause failure')
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  await assert.rejects(
    applyScheduledPauses(client, {
      strict: true,
      accountId: 9,
      facilityId: 2,
      asOfDate: '2026-09-01',
    }),
    /injected subscription pause failure/,
  )
  assert.ok(calls.includes('ROLLBACK'))
  assert.equal(calls.includes('COMMIT'), false)
})

test('strict scheduled pause finishes Stripe work before opening its local transaction', async () => {
  const calls = []
  const client = {
    release() {},
    async query(sql) {
      const text = String(sql)
      calls.push(text)
      if (/SELECT DISTINCT signup\.id/.test(text)) {
        return { rows: [{ id: 101, pause_effective_date: '2026-09-01', pause_mode: 'next_month', family_id: 3 }] }
      }
      if (/SELECT stripe_subscription_id/.test(text)) return { rows: [{ stripe_subscription_id: 'sub_legacy' }] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  await assert.rejects(
    applyScheduledPauses(client, {
      strict: true,
      accountId: 9,
      facilityId: 2,
      asOfDate: '2026-09-01',
      stripeStatusUpdater: async () => ({ status: 'error', reason: 'injected Stripe failure' }),
    }),
    (error) => error.code === 'enrollment_pause_stripe_sync_failed',
  )
  assert.equal(calls.includes('BEGIN'), false)
})
