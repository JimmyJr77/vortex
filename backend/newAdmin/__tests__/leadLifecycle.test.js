import test from 'node:test'
import assert from 'node:assert/strict'
import { changeLeadLifecycle } from '../leadLifecycle.js'
import { permissionMiddleware } from '../registerRoutes.js'
import { leadFilters } from '../leadFilters.js'

function fixture(lead, { foreignKey = false, invites = [], held = false, sharedReference = false } = {}) {
  const calls = []
  const tables = ['registrations','account_invite','new_admin_lead_ownership_audit','note','utm_attribution','visitor_identities']
  const client = {
    async query(sql, values) {
      calls.push({ sql, values })
      if (sql.startsWith('SELECT id, archived')) return { rows: lead ? [{ id:5,...lead }] : [] }
      if (sql.includes("(pending_payload ? 'result')")) return { rows: invites }
      if (sql.startsWith('SELECT 1 FROM scheduling_signup')) return { rows: held ? [{}] : [] }
      if (sql.includes('WHERE c.oid=to_regclass($1)')) {
        const table=values[0].replace(/^public\./,'')
        return { rows:[{oid:String(tables.indexOf(table)+1),schema_name:'public',table_name:table,primary_key:['id']}] }
      }
      if (sql.startsWith('SELECT * FROM "public"."registrations"')) return { rows:lead ? [{id:5,...lead}] : [] }
      if (sql.startsWith('SELECT * FROM "public"."account_invite"')) return { rows:invites.filter(invite=>values[0].includes(invite.id)) }
      if (sql.includes('FROM pg_constraint c')) return { rows:sharedReference ? [{child_oid:'99',parent_oid:'1',child_schema:'public',child_table:'retained_evidence',confdeltype:'c',child_columns:['registration_id'],parent_columns:['id']}] : [] }
      if (sql.startsWith('WITH deletion_parameters')) return { rows:[{blocked:sharedReference}] }
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
  ['referenced', { archived: true }, { foreignKey: true }, /linked records/],
  ['unplanned cascade', { archived:true }, {sharedReference:true}, /linked to records/],
  ['unfinished reservation', {archived:true}, {invites:[{id:12,facility_id:2,used_at:null}],held:true}, /unfinished account registration/],
  ['pending family', {archived:true}, {invites:[{id:12,facility_id:2,used_at:null,pending_family_id:9}]}, /unfinished account registration/],
  ['completed payload without completion', {archived:true}, {invites:[{id:12,facility_id:2,used_at:null,has_completed_payload:true}]}, /unfinished account registration/],
  ['cross-facility invitation', {archived:true}, {invites:[{id:12,facility_id:3,used_at:new Date()}]}, /another facility/],
]) test(`delete protects ${label} leads and rolls back`, async () => {
  const pool = fixture(lead, options)
  await assert.rejects(changeLeadLifecycle(pool, 2, 5, 'delete'), message)
  assert.ok(pool.calls.some(c => c.sql === 'ROLLBACK'))
  assert.ok(!pool.calls.some(c => c.sql === 'COMMIT'))
})

test('delete removes only an archived inquiry even when its linked member has billing history', async () => {
  const pool = fixture({ archived: true, member_id:7, converted_member_id:7 }, {invites:[{id:12,facility_id:2,used_at:null}]})
  await changeLeadLifecycle(pool, 2, 5, 'delete')
  assert.deepEqual(pool.calls.find(c => c.sql.startsWith('DELETE FROM registrations')).values, [5, 2])
  assert.deepEqual(pool.calls.find(c => c.sql.startsWith('DELETE FROM note')).values, [5])
  assert.ok(pool.calls.some(c => c.sql === 'COMMIT'))
  assert.ok(pool.calls.some(c => c.sql.startsWith('DELETE FROM account_invite')))
  assert.ok(!pool.calls.some(c => /(?:DELETE FROM|UPDATE) (?:member|family|scheduling_signup|billing_)/.test(c.sql)))
  assert.ok(!pool.calls.some(c => c.sql.includes('family_billing_account') || c.sql.includes('hasFamilyPayments')))
})

test('completed invitation retains its enrollment links and only loses the obsolete inquiry backlink', async () => {
  const pool=fixture({archived:true,converted_member_id:7},{invites:[{id:12,facility_id:2,used_at:new Date()}]})
  await changeLeadLifecycle(pool,2,5,'delete')
  assert.deepEqual(pool.calls.find(c=>c.sql.startsWith('UPDATE account_invite')).values,[[12],5,2])
  assert.deepEqual(pool.calls.find(c=>c.sql.startsWith('DELETE FROM account_invite')).values,[[],5,2])
  assert.ok(!pool.calls.some(c=>/(?:UPDATE|DELETE FROM) scheduling_signup/.test(c.sql)))
  assert.ok(pool.calls.some(c=>c.sql==='COMMIT'))
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
