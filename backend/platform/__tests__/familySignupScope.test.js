import test from 'node:test'
import assert from 'node:assert/strict'
import { registerFamilySignupRoutes, finalizePendingDropIn } from '../familySignup.js'

test('admin signup catalog aliases require authentication and bind the authenticated facility', async () => {
  const routes = new Map(), queries = []
  const pool = { async query(sql, params = []) {
    const source = String(sql)
    queries.push({ sql: source, params })
    if (source.includes("table_name IN ('programs', 'program_categories')")) return { rows: [{ table_name: 'programs' }] }
    if (source.includes("column_name IN ('programs_id', 'category_id')")) return { rows: [{ column_name: 'programs_id' }] }
    if (source.includes("column_name IN ('programs_id', 'program_id')")) return { rows: [{ column_name: 'program_id' }, { column_name: 'programs_id' }] }
    if (source.includes('FROM waiver_template') && source.includes('active_from')) return { rows: [{ id: 81, name: 'Facility waiver' }] }
    return { rows: [] }
  } }
  const app = { get(path, ...handlers) { routes.set(path, handlers) }, post() {} }
  registerFamilySignupRoutes(app, pool, { jwtSecret: 'catalog-test-only' })
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
  const cases = [
    ['catalog/programs', {}, /pr.facility_id = \$1/, [7]],
    ['catalog/programs/:programsId/classes', { programsId: 2 }, /p.facility_id = \$2/, [2, 7]],
    ['catalog/classes/:classEventId/offerings', { classEventId: 3 }, /p.facility_id = \$2 AND pr.facility_id = \$2/, [3, 7]],
    ['catalog/prefill/:formId', { formId: 9 }, /p.facility_id = \$2 AND pr.facility_id = \$2/, [9, 7]],
    ['waivers', {}, /WHERE facility_id = \$1/, [7]],
  ]
  for (const [suffix, params, scopePattern, values] of cases) {
    const handlers = routes.get(`/api/admin/signup/${suffix}`)
    assert.equal(handlers.length, 3)
    const denied = response()
    await handlers[0]({ headers: {} }, denied, () => assert.fail('unauthenticated access'))
    assert.equal(denied.statusCode, 401)
    const res = response()
    await handlers.at(-1)({ params, adminAuth: { facility_id: 7 } }, res)
    assert.notEqual(res.statusCode, 500)
    const scoped = queries.findLast(query => scopePattern.test(query.sql))
    assert.ok(scoped, suffix)
    assert.deepEqual(scoped.params, values)
    assert.equal(routes.get(`/api/signup/${suffix}`).length, 1)
  }
})

test('a same-name and same-email pending drop-in in another facility is rejected before writes', async () => {
  const queries = []
  const db = { async query(sql) {
    queries.push(String(sql))
    return { rows: [{ id: 41, first_name: 'Avery', last_name: 'Stone', email: 'parent@example.test',
      class_facility_id: 2, benefit_type: 'free_trial', amount_cents: 0 }] }
  } }
  await assert.rejects(finalizePendingDropIn(db, 41, {
    primaryEmail: 'parent@example.test',
    createdMembers: [{ member: { id: 8, family_id: 3, facility_id: 1, first_name: 'Avery', last_name: 'Stone' } }],
  }), /does not belong to this family account facility/)
  assert.equal(queries.length, 1)
  assert.doesNotMatch(queries[0], /^\s*(INSERT|UPDATE)/)
})
