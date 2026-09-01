import test from 'node:test'
import assert from 'node:assert/strict'
import {
  loadActiveAnnualMembership,
  loadActiveAnnualMembershipFeeIds,
  memberHasActiveAnnualMembership,
} from '../annualMembership.js'

function mockPool(handler) {
  return {
    query: async (sql, params) => handler(String(sql), params),
  }
}

test('loadActiveAnnualMembership redemption query includes $0 waived memberships', async () => {
  let redemptionSql = ''
  const pool = mockPool((sql) => {
    if (sql.includes('FROM additional_fee_redemption')) {
      redemptionSql = sql
      return {
        rows: [
          {
            fee_id: 1,
            created_at: '2026-07-27T16:10:22.674Z',
            period_key: '2027-07-27',
            amount_cents: 0,
          },
        ],
      }
    }
    throw new Error(`unexpected: ${sql}`)
  })

  const window = await loadActiveAnnualMembership(pool, 62, {
    asOf: new Date(Date.UTC(2026, 11, 1)),
  })
  assert.match(redemptionSql, /amount_cents\s*>=\s*0/)
  assert.equal(window?.active, true)
  assert.equal(window?.source, 'redemption')
})

test('loadActiveAnnualMembership does not grant access from an unpaid renewal schedule', async () => {
  const pool = mockPool((sql) => {
    if (sql.includes('FROM additional_fee_redemption')) return { rows: [] }
    throw new Error(`unexpected: ${sql}`)
  })

  const window = await loadActiveAnnualMembership(pool, 62, {
    asOf: new Date(Date.UTC(2026, 7, 1)),
  })
  assert.equal(window, null)
  assert.equal(await memberHasActiveAnnualMembership(pool, 62, { asOf: new Date(Date.UTC(2026, 7, 1)) }), false)
})

test('loadActiveAnnualMembership falls back to anniversary redemption', async () => {
  const pool = mockPool((sql) => {
    if (sql.includes('FROM additional_fee_redemption')) {
      return {
        rows: [
          {
            fee_id: 1,
            created_at: '2026-07-27T16:10:22.674Z',
            period_key: '2026',
          },
        ],
      }
    }
    throw new Error(`unexpected: ${sql}`)
  })

  const window = await loadActiveAnnualMembership(pool, 62, {
    asOf: new Date(Date.UTC(2026, 11, 1)),
  })
  assert.equal(window?.active, true)
  assert.equal(window?.source, 'redemption')
  assert.equal(window?.renewsOn.toISOString().slice(0, 10), '2027-07-27')
})

test('loadActiveAnnualMembership is inactive after renews-on', async () => {
  const pool = mockPool((sql) => {
    if (sql.includes('FROM additional_fee_redemption')) {
      return {
        rows: [
          {
            fee_id: 1,
            created_at: '2026-07-27T16:10:22.674Z',
            period_key: '2027-07-27',
          },
        ],
      }
    }
    throw new Error(`unexpected: ${sql}`)
  })

  const window = await loadActiveAnnualMembership(pool, 62, {
    asOf: new Date(Date.UTC(2027, 6, 27)),
  })
  assert.equal(window, null)
})

test('loadActiveAnnualMembership uses the paid-through period instead of the posting date', async () => {
  const pool = mockPool((sql) => {
    if (sql.includes('FROM additional_fee_redemption')) {
      return {
        rows: [{
          fee_id: 1,
          created_at: '2026-09-01T05:00:00.000Z',
          satisfied_at: '2026-09-01T05:00:00.000Z',
          period_key: '2027-09-27',
          service_period_start: '2026-09-27',
          billing_subscription_id: 15,
          ended_at: null,
        }],
      }
    }
    throw new Error(`unexpected: ${sql}`)
  })
  const window = await loadActiveAnnualMembership(pool, 62, {
    asOf: new Date(Date.UTC(2027, 8, 15)),
  })
  assert.equal(window?.active, true)
  assert.equal(window?.source, 'redemption')
  assert.equal(window?.billingSubscriptionId, 15)
  assert.equal(window?.renewsOn.toISOString().slice(0, 10), '2027-09-27')
})

test('loadActiveAnnualMembershipFeeIds marks paid entitlements active', async () => {
  const pool = mockPool((sql) => {
    if (sql.includes('FROM additional_fee_redemption')) {
      return {
        rows: [{
          fee_id: 1,
          created_at: '2026-07-27T16:10:22.674Z',
          period_key: '2027-07-27',
          ended_at: null,
        }],
      }
    }
    throw new Error(`unexpected: ${sql}`)
  })
  const ids = await loadActiveAnnualMembershipFeeIds(pool, 62, [1, 9], new Date(Date.UTC(2026, 7, 1)))
  assert.deepEqual([...ids], [1])
})
