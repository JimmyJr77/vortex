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

  assert.deepEqual(dashboard.permissions, { canViewEnrollment: false, canViewBilling: false, canViewWaivers: false })
  assert.equal(dashboard.enrollment, null)
  assert.equal(dashboard.billing, null)
  assert.equal(dashboard.mediaReleaseOptOuts, null)
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
  assert.equal(dashboard.mediaReleaseOptOuts, null)
})

test('dashboard does not query the media-release roster without waiver access', async () => {
  const queries = []
  const pool = {
    query: async (sql) => {
      queries.push(sql)
      return { rows: [] }
    },
  }

  const dashboard = await getAdminDashboard(pool, {
    facilityId: 7,
    canViewEnrollment: true,
    canViewWaivers: false,
  })

  assert.equal(dashboard.mediaReleaseOptOuts, null)
  assert.equal(queries.some((sql) => sql.includes("template.waiver_type = 'MEDIA_RELEASE'")), false)
})

test('dashboard lists members without an accepted media release with active students first', async () => {
  const queries = []
  const pool = {
    query: async (sql) => {
      queries.push(sql)
      if (sql.includes("template.waiver_type = 'MEDIA_RELEASE'")) {
        return {
          rows: [{
            member_id: 12,
            first_name: 'Avery',
            last_name: 'Smith',
            family_name: 'Smith Family',
            is_active_student: true,
            active_class_count: 1,
            active_classes: [{
              className: 'Tumbling',
              scheduleMode: 'weekly',
              specificDate: null,
              dayOfWeek: 2,
              startTime: '16:00:00',
              endTime: '17:00:00',
            }],
          }],
        }
      }
      return { rows: [] }
    },
  }

  const dashboard = await getAdminDashboard(pool, {
    facilityId: 7,
    canViewEnrollment: true,
    canViewWaivers: true,
  })

  assert.deepEqual(dashboard.mediaReleaseOptOuts, [{
    memberId: 12,
    memberName: 'Avery Smith',
    familyName: 'Smith Family',
    isActiveStudent: true,
    activeClassCount: 1,
    activeClasses: [{
      className: 'Tumbling',
      scheduleMode: 'weekly',
      specificDate: null,
      dayOfWeek: 2,
      startTime: '16:00:00',
      endTime: '17:00:00',
    }],
  }])
  assert.match(queries.find((sql) => sql.includes("template.waiver_type = 'MEDIA_RELEASE'")), /ORDER BY is_active_student DESC/)
})
