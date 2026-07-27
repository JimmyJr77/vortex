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
    if (sql.includes('FROM billing_subscription')) return { rows: [] }
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

test('loadActiveAnnualMembership prefers active annual billing_subscription', async () => {
  const pool = mockPool((sql) => {
    if (sql.includes('FROM billing_subscription')) {
      return {
        rows: [
          {
            id: 15,
            member_id: 62,
            source_id: '1:62',
            start_date: '2026-07-27',
            next_bill_date: '2027-07-27',
            status: 'active',
          },
        ],
      }
    }
    throw new Error(`unexpected: ${sql}`)
  })

  const window = await loadActiveAnnualMembership(pool, 62, {
    asOf: new Date(Date.UTC(2026, 7, 1)),
  })
  assert.equal(window?.active, true)
  assert.equal(window?.source, 'billing_subscription')
  assert.equal(window?.feeId, 1)
  assert.equal(window?.renewsOn.toISOString().slice(0, 10), '2027-07-27')
  assert.equal(await memberHasActiveAnnualMembership(pool, 62, { asOf: new Date(Date.UTC(2026, 7, 1)) }), true)
})

test('loadActiveAnnualMembership falls back to anniversary redemption', async () => {
  const pool = mockPool((sql) => {
    if (sql.includes('FROM billing_subscription')) return { rows: [] }
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
    if (sql.includes('FROM billing_subscription')) return { rows: [] }
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

test('loadActiveAnnualMembershipFeeIds marks subscription-covered fees active', async () => {
  const pool = mockPool((sql) => {
    if (sql.includes('FROM billing_subscription')) {
      return { rows: [{ source_id: '1:62' }] }
    }
    throw new Error(`unexpected: ${sql}`)
  })
  const ids = await loadActiveAnnualMembershipFeeIds(pool, 62, [1, 9], new Date(Date.UTC(2026, 7, 1)))
  assert.deepEqual([...ids], [1])
})
