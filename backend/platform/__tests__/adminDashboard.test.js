import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRevenueMonths, getAdminDashboard } from '../adminDashboard.js'

test('buildRevenueMonths fills six calendar months and preserves collected revenue', () => {
  const months = buildRevenueMonths([
    { month_key: '2026-04', amount_cents: 12500 },
    { month_key: '2026-06', amount_cents: 30000 },
  ], new Date('2026-06-30T12:00:00.000Z'))

  assert.deepEqual(months, [
    { key: '2026-01', label: 'Jan', amountCents: 0 },
    { key: '2026-02', label: 'Feb', amountCents: 0 },
    { key: '2026-03', label: 'Mar', amountCents: 0 },
    { key: '2026-04', label: 'Apr', amountCents: 12500 },
    { key: '2026-05', label: 'May', amountCents: 0 },
    { key: '2026-06', label: 'Jun', amountCents: 30000 },
  ])
})

test('dashboard does not query or disclose enrollment or billing data without permission', async () => {
  const pool = {
    query: async () => {
      throw new Error('Dashboard should not query protected data without permission.')
    },
  }

  const dashboard = await getAdminDashboard(pool, {
    canViewEnrollment: false,
    canViewBilling: false,
    now: new Date('2026-06-30T12:00:00.000Z'),
  })

  assert.deepEqual(dashboard.permissions, { canViewEnrollment: false, canViewBilling: false })
  assert.equal(dashboard.enrollment, null)
  assert.equal(dashboard.billing, null)
})

test('dashboard requires a positive facility scope before querying protected data', async () => {
  const pool = {
    query: async () => {
      throw new Error('Dashboard must not query without a facility scope.')
    },
  }

  const dashboard = await getAdminDashboard(pool, {
    facilityId: null,
    canViewEnrollment: true,
    canViewBilling: true,
  })

  assert.equal(dashboard.enrollment, null)
  assert.equal(dashboard.billing, null)
})
