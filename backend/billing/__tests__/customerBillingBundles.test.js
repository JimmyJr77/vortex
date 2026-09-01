import test from 'node:test'
import assert from 'node:assert/strict'
import { loadCustomerBillingBundles } from '../customerBillingBundles.js'

test('loads household bundle balances and one bounded recent-usage page', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('FROM member_multi_class_pass pass')) {
        return { rows: [{
          id: '7',
          member_id: '12',
          member_name: 'Casey Rivera',
          programs_id: '9',
          package_id: 'ten-class-pass',
          package_label: '10-Class Pass',
          class_count_purchased: 10,
          classes_remaining: 7,
          price_cents: 18000,
          status: 'active',
          expires_at: '2027-01-31',
          purchased_at: '2026-08-15T12:00:00Z',
        }] }
      }
      return { rows: [{
        id: '8',
        member_pass_id: '7',
        signup_id: '20',
        member_id: '12',
        member_name: 'Casey Rivera',
        programs_id: '9',
        entry_type: 'use',
        classes_used: 1,
        credit_delta: -1,
        classes_remaining_after: 7,
        reason: 'Open gym visit',
        package_label: '10-Class Pass',
        created_at: '2026-08-29T12:00:00Z',
      }] }
    },
  }

  const result = await loadCustomerBillingBundles(pool, { familyId: 42, usageLimit: 500 })

  assert.equal(result.bundlePasses[0].memberId, 12)
  assert.equal(result.bundlePasses[0].classesRemaining, 7)
  assert.equal(result.bundleUsage[0].creditDelta, -1)
  assert.deepEqual(calls[1].params, [[12], 100])
  assert.match(calls[0].sql, /member\.is_active = TRUE/)
  assert.match(calls[0].sql, /bundle_membership\.is_active = TRUE/)
  assert.match(calls[0].sql, /FROM family_member bundle_membership_history/)
  assert.match(calls[0].sql, /NOT EXISTS/)
})

test('returns empty bundle collections when an older installation lacks the optional tables', async () => {
  const pool = {
    async query() {
      const error = new Error('relation does not exist')
      error.code = '42P01'
      throw error
    },
  }

  assert.deepEqual(await loadCustomerBillingBundles(pool, { familyId: 42 }), {
    bundlePasses: [],
    bundleUsage: [],
  })
})
