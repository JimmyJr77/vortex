import test from 'node:test'
import assert from 'node:assert/strict'
import { changeLeadLifecycle } from '../leadLifecycle.js'
import { permissionMiddleware } from '../registerRoutes.js'
import { leadFilters } from '../leadFilters.js'

function fixture(lead, { paid = false, foreignKey = false } = {}) {
  const calls = []
  const client = {
    async query(sql, values) {
      calls.push({ sql, values })
      if (sql.startsWith('SELECT id, archived')) return { rows: lead ? [lead] : [] }
      if (sql.includes('AS retained')) return { rows: [{ retained: paid }] }
      if (sql.startsWith('DELETE FROM registrations') && foreignKey) throw Object.assign(new Error('linked'), { code: '23503' })
      return { rows: [] }
    },
    release() { calls.push({ sql: 'RELEASE' }) },
  }
  return { calls, connect: async () => client }
}

for (const action of ['archive', 'restore']) test(`${action} is facility scoped and committed`, async () => {
  const pool = fixture({ id: 5, archived: false })
  const result = await changeLeadLifecycle(pool, 2, 5, action)
  assert.equal(result.archived, action === 'archive')
  assert.deepEqual(pool.calls.find(c => c.sql.startsWith('SELECT id')).values, [5, 2])
  assert.deepEqual(pool.calls.find(c => c.sql.startsWith('UPDATE registrations')).values, [5, 2, action === 'archive'])
  assert.ok(pool.calls.some(c => c.sql === 'COMMIT'))
})

for (const [label, lead, options, message] of [
  ['missing/foreign facility', null, {}, /not found/],
  ['active', { archived: false }, {}, /Archive this lead/],
  ['paid converted', { archived: true, converted_member_id: 7 }, { paid: true }, /Payments have been made/],
  ['referenced', { archived: true }, { foreignKey: true }, /linked records/],
]) test(`delete protects ${label} leads and rolls back`, async () => {
  const pool = fixture(lead, options)
  await assert.rejects(changeLeadLifecycle(pool, 2, 5, 'delete'), message)
  assert.ok(pool.calls.some(c => c.sql === 'ROLLBACK'))
  assert.ok(!pool.calls.some(c => c.sql === 'COMMIT'))
  assert.ok(!pool.calls.some(c => c.sql.startsWith('DELETE FROM note')))
})

test('delete removes an unpaid converted lead and invitations without deleting its member', async () => {
  const pool = fixture({ archived: true, converted_member_id: 7 })
  await changeLeadLifecycle(pool, 2, 5, 'delete')
  assert.deepEqual(pool.calls.find(c => c.sql.startsWith('DELETE FROM registrations')).values, [5, 2])
  assert.deepEqual(pool.calls.find(c => c.sql.startsWith('DELETE FROM note')).values, [5])
  assert.ok(pool.calls.some(c => c.sql === 'COMMIT'))
  assert.ok(pool.calls.some(c => c.sql.startsWith('DELETE FROM account_invite')))
  assert.ok(!pool.calls.some(c => c.sql.startsWith('DELETE FROM member')))
})

test('archived lead filter is explicit and validates input', () => {
  assert.match(leadFilters({}, 2, []).where, /archived IS NOT TRUE/)
  assert.match(leadFilters({ archived: 'true' }, 2, []).where, /archived IS TRUE/)
  assert.throws(() => leadFilters({ archived: 'invalid' }, 2, []), /Invalid archived/)
})

for (const [owner, override, expected] of [[true, null, true], [false, 'allow', true], [false, null, false], [false, 'deny', false]]) {
  test(`lifecycle authorization: owner=${owner}, override=${override}`, async () => {
    const pool = { async query(sql) {
      if (sql.includes('FROM v_app_user_access_context')) return { rows: [{ user_id: 19, facility_id: 1, is_owner: owner, is_active: true, can_access_admin_portal: true, storage_roles: ['ADMIN'] }] }
      return { rows: [{ base_allowed: false, override_effect: override }] }
    } }
    let allowed = false, status = null
    const res = { status(value) { status = value; return this }, json() {} }
    await permissionMiddleware(pool, 'accounts.lifecycle')({ canonicalAccess: { userId: 19, facilityId: 1, portalAccess: { admin: true } } }, res, () => { allowed = true })
    assert.equal(allowed, expected)
    if (!expected) assert.equal(status, 403)
  })
}
