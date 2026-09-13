import assert from 'node:assert/strict'
import test from 'node:test'
import { loadProgrammingLibraryPage } from '../programmingLibraryRepository.js'
import { libraryScopeId } from '../coachingLibraryContext.js'
import { registerProgrammingRoutes } from '../coachProgrammingRoutes.js'

test('programming retrieval scopes publication, visibility and filters with bound parameters', async () => {
  const calls = []
  const pool = { async query(sql, params) { calls.push({ sql, params }); return { rows: [] } } }
  await loadProgrammingLibraryPage(pool, { facilityId: 9, userId: 7 }, {
    q: "  sprint' OR TRUE --  ", category: 'interval', phaseKey: 'fitness_repeatability', groupFriendly: true,
  })
  const { sql, params } = calls[0]
  assert.match(sql, /pm.facility_id = \$1/)
  assert.match(sql, /pm.archived = FALSE/)
  assert.match(sql, /pm.is_published = TRUE AND \(pm.visibility = 'facility' OR pm.created_by = \$2\)/)
  assert.ok(!sql.includes("sprint'"))
  assert.deepEqual(params, ['9', '7', "%sprint' OR TRUE --%", 'interval', 'sustained_capacity', 501, 0])
  assert.equal(calls.length, 1)
})

test('draft access is explicit and pagination reports omitted rows without hydrating them', async () => {
  const calls = []
  const pool = { async query(sql, params) {
    calls.push({ sql, params })
    if (sql.includes('SELECT pm.*')) return { rows: [{ id: '9007199254740993', name: 'A' }, { id: '2', name: 'B' }] }
    return { rows: [] }
  } }
  const page = await loadProgrammingLibraryPage(pool, { facilityId: 9, userId: 7 }, { includeOwnDrafts: true, limit: 1 })
  assert.match(calls[0].sql, /\(\(pm.visibility = 'facility' AND pm.is_published = TRUE\) OR pm.created_by = \$2\)/)
  assert.equal(page.methods[0].id, '9007199254740993')
  assert.equal(page.hasMore, true)
  assert.equal(page.nextOffset, 1)
  for (const call of calls.slice(1)) assert.deepEqual(call.params, [['9007199254740993']])
})

test('scope IDs cannot be broadened or lose bigint precision', async () => {
  assert.equal(libraryScopeId('9007199254740993', 'id'), '9007199254740993')
  for (const id of [null, '', 0, -1, 1.2, true, {}, '1 OR 1=1', '1.0', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => libraryScopeId(id, 'id'))
  }
  assert.throws(() => libraryScopeId('9223372036854775808', 'id'), /bigint range/)
  const pool = { async query() { assert.fail('invalid scope/filter reached database') } }
  await assert.rejects(loadProgrammingLibraryPage(pool, { facilityId: null, userId: 7 }), /facilityId/)
  for (const filters of [{ limit: 0 }, { limit: 501 }, { offset: -1 }, { phaseKey: 'strength' }, { includeOwnDrafts: 'yes' }]) {
    await assert.rejects(loadProgrammingLibraryPage(pool, { facilityId: 9, userId: 7 }, filters))
  }
})

test('existing programming library route retains response shape and author draft access', async () => {
  const routes = new Map()
  const app = Object.fromEntries(['get', 'post', 'put', 'delete'].map((method) => [method, (path, ...handlers) => routes.set(`${method}:${path}`, handlers.at(-1))]))
  const calls = []
  const pool = { async query(sql, params) {
    calls.push({ sql, params })
    if (sql.includes('SELECT pm.*')) return { rows: [{ id: '1', name: 'Coach Method', best_session_phase: 'capacity', coach_summary: 'A reviewed method.' }] }
    return { rows: [] }
  } }
  registerProgrammingRoutes(app, pool, { can: () => [], ok: (res, body) => { res.body = body }, bad: (_res, message) => assert.fail(message) })
  const response = {}
  await routes.get('get:/api/coach/programming-methods')({ platformAuth: { user: { facility_id: 9, id: 7 } }, query: {} }, response)
  assert.ok(Array.isArray(response.body))
  assert.equal(response.body[0].name, 'Coach Method')
  assert.equal(response.body[0].best_session_phase, 'capacity')
  assert.equal(response.body[0].why_preview, 'A reviewed method.')
  assert.match(calls[0].sql, /OR pm.created_by = \$2\)/)
})
