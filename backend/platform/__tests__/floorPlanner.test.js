import assert from 'node:assert/strict'
import test from 'node:test'
import { registerFloorPlannerRoutes, saveFloorPlannerView, deleteFloorPlannerView, saveFloorPlan, validateFloorPlan } from '../floorPlannerRoutes.js'

const plan = () => ({ version: 1, start: 480, end: 1260, increment: 15, locations: [{ id: 'floor', name: 'Floor' }], classes: [], blocks: [{ id: 'one', instanceId: 'instance-one', classId: 'tumbling', name: 'Tumbling', program: 'Gymnastics', day: 0, locationId: 'floor', start: 600, end: 660, color: 0, coaches: ['Avery'] }] })

test('accepts all grid increments and rejects invalid placements and corrupt library data', () => {
  for (const increment of [5, 10, 15, 30]) assert.equal(validateFloorPlan({ ...plan(), increment }).increment, increment)
  for (const patch of [{ day: 7 }, { end: 600 }, { end: 1441 }, { start: -5 }, { locationId: 'missing' }, { coaches: null }]) {
    const input = plan(); Object.assign(input.blocks[0], patch)
    assert.throws(() => validateFloorPlan(input), /Invalid class placement/)
  }
  assert.throws(() => validateFloorPlan({ ...plan(), increment: 20 }), /settings/)
  const duplicate = plan(); duplicate.blocks.push({ ...duplicate.blocks[0] })
  assert.throws(() => validateFloorPlan(duplicate), /unique/)
  assert.throws(() => validateFloorPlan({ ...plan(), classes: [{ id: 'idea', name: 'Idea', program: 'Ideas', duration: 60 }] }), /idea class/)
})

test('save binds facility and actor from auth and requires an exact revision', async () => {
  const calls = []
  const pool = { query: async (sql, args) => { calls.push({ sql, args }); return { rows: [{ plan: plan(), revision: 3 }] } } }
  await saveFloorPlan(pool, 12, 42, { plan: plan(), revision: 2, facilityId: 999 })
  assert.match(calls[0].sql, /WHERE facility_id = \$1 AND revision = \$4/)
  assert.deepEqual([calls[0].args[0], calls[0].args[2], calls[0].args[3]], [12, 42, 2])
  await assert.rejects(() => saveFloorPlan(pool, 12, 42, { plan: plan() }), /revision/)
})

test('concurrent first saves and stale updates return conflict rather than overwrite', async () => {
  const pool = { query: async () => ({ rows: [] }) }
  for (const revision of [0, 7]) await assert.rejects(() => saveFloorPlan(pool, 1, 2, { plan: plan(), revision }), (error) => error.status === 409)
})

function registerRoutes(pool) {
  const routes = new Map()
  const app = Object.fromEntries(['get', 'put', 'post', 'delete'].map((method) => [method,
    (path, ...handlers) => routes.set(`${method} ${path}`, handlers),
  ]))
  registerFloorPlannerRoutes(app, pool, { jwtSecret: 'test', requirePermission: (_pool, _secret, permission) => [permission] })
  return routes
}

async function callRoute(routes, route, req) {
  const response = { status: 200 }
  await routes.get(route).at(-1)(req, {
    status(code) { response.status = code; return this },
    json(body) { response.body = body },
  })
  return response
}

test('routes enforce view and manage permissions, with facility-scoped reads', async () => {
  const queries = []
  const pool = { query: async (sql, args) => { queries.push({ sql, args }); return { rows: [] } } }
  const routes = registerRoutes(pool)
  for (const [route, [permission]] of routes) {
    assert.equal(permission, route.startsWith('get ') ? 'scheduling.view' : 'scheduling.manage', route)
  }
  const response = await callRoute(routes, 'get /api/admin/floor-planner', { platformAuth: { user: { facility_id: 9 } } })
  assert.deepEqual(response.body.data, { plan: null, revision: 0, facilityId: 9 })
  assert.deepEqual(queries[0].args, [9])
})

test('class colors and legacy form links load for the authenticated facility', async () => {
  const queries = []
  const pool = { query: async (sql, args) => {
    queries.push({ sql, args })
    const rows = sql.includes('floor_planner_class_color')
      ? [{ class_id: 'class:71', color: '#8365ff' }]
      : [{ form_id: '20', class_id: '71' }, { form_id: '28', class_id: '71' }]
    return { rows }
  } }
  const req = { platformAuth: { user: { facility_id: 9 } }, query: { facilityId: 999 } }
  const response = await callRoute(registerRoutes(pool), 'get /api/admin/floor-planner/class-colors', req)
  assert.deepEqual(response.body, {
    success: true,
    data: { colors: { 'class:71': '#8365ff' }, classesByForm: { 20: 'class:71', 28: 'class:71' } },
  })
  assert.match(queries[0].sql, /WHERE facility_id = \$1/)
  assert.match(queries[1].sql, /p\.id = sf\.program_id\s+WHERE p\.facility_id = \$1/)
  assert.doesNotMatch(queries[1].sql, /is_active|deleted_at/)
  assert.deepEqual(queries.map(({ args }) => args), [[9], [9]])
})

test('class color changes and resets update a single facility preference', async () => {
  const queries = []
  const pool = { query: async (sql, args) => { queries.push({ sql, args }); return { rows: [] } } }
  const routes = registerRoutes(pool)
  const route = 'put /api/admin/floor-planner/class-colors/:classId'
  const req = { platformAuth: { user: { id: 42, facility_id: 9 } }, params: { classId: 'class:71' } }

  const set = await callRoute(routes, route, { ...req, body: { color: '#83ABFF', facilityId: 999, updatedBy: 999 } })
  assert.deepEqual(set.body, { success: true, data: { classId: 'class:71', color: '#83abff' } })
  assert.match(queries[0].sql, /ON CONFLICT \(facility_id, class_id\)/)
  assert.deepEqual(queries[0].args, [9, 'class:71', '#83abff', 42])

  const reset = await callRoute(routes, route, { ...req, body: { color: null } })
  assert.deepEqual(reset.body, { success: true, data: { classId: 'class:71', color: null } })
  assert.match(queries[1].sql, /DELETE FROM public\.floor_planner_class_color WHERE facility_id = \$1 AND class_id = \$2/)
  assert.deepEqual(queries[1].args, [9, 'class:71'])

  for (const color of [undefined, '#123', '#12345678', 'red']) {
    const response = await callRoute(routes, route, { ...req, body: { color } })
    assert.equal(response.status, 400)
  }
  for (const classId of ['__proto__', 'class/71', 'a'.repeat(101)]) {
    const response = await callRoute(routes, route, { ...req, params: { classId }, body: { color: '#123456' } })
    assert.equal(response.status, 400)
  }
  assert.equal(queries.length, 2)
})

const namedId = '00000000-0000-4000-8000-000000000001'
const namedBody = () => ({ plan: plan(), name: 'Evening rotation', selectedDay: 3, revision: 2 })

test('named views validate labels and selected days before writing', async () => {
  const pool = { query: async () => { throw new Error('should not query') } }
  for (const patch of [{ name: '' }, { name: '   ' }, { name: 'x'.repeat(81) }, { selectedDay: 7 }, { selectedDay: -1 }]) {
    await assert.rejects(() => saveFloorPlannerView(pool, 9, 11, { ...namedBody(), ...patch }), (error) => error.status === 400)
  }
  await assert.rejects(() => saveFloorPlannerView(pool, 9, 11, namedBody(), 'invalid'), /Invalid saved view/)
  await assert.rejects(() => saveFloorPlannerView(pool, 9, 11, { ...namedBody(), revision: 0 }, namedId), /revision/)
})

test('named create and update only write to a facility-scoped planning view', async () => {
  const calls = []
  const pool = { query: async (sql, args) => { calls.push({ sql, args }); return { rows: [{ id: namedId, revision: 3 }] } } }
  await saveFloorPlannerView(pool, 9, 11, namedBody())
  assert.match(calls[0].sql, /INSERT INTO public.floor_planner_view/)
  assert.equal(calls[0].args[0], 9)
  assert.equal(calls[0].args[5], 11)
  assert.deepEqual(JSON.parse(calls[0].args[3]), plan())
  await saveFloorPlannerView(pool, 9, 11, namedBody(), namedId)
  assert.match(calls[1].sql, /WHERE facility_id = \$1 AND id = \$2 AND revision = \$7/)
  assert.deepEqual([calls[1].args[0], calls[1].args[1], calls[1].args[5], calls[1].args[6]], [9, namedId, 11, 2])
})

test('duplicate view names and concurrent changes never overwrite another view', async () => {
  const duplicate = { query: async () => { throw Object.assign(new Error('unique violation'), { code: '23505' }) } }
  await assert.rejects(() => saveFloorPlannerView(duplicate, 9, 11, namedBody()), (error) => error.status === 409 && /name already exists/.test(error.message))
  const stale = { query: async () => ({ rows: [] }) }
  await assert.rejects(() => saveFloorPlannerView(stale, 9, 11, namedBody(), namedId), (error) => error.status === 409)
  await assert.rejects(() => deleteFloorPlannerView(stale, 9, namedId, 2), (error) => error.status === 409)
})

test('named view deletion requires matching facility, ID, and revision', async () => {
  let call
  const pool = { query: async (sql, args) => { call = { sql, args }; return { rows: [{ id: namedId }] } } }
  await deleteFloorPlannerView(pool, 9, namedId, 2)
  assert.match(call.sql, /WHERE facility_id = \$1 AND id = \$2 AND revision = \$3/)
  assert.deepEqual(call.args, [9, namedId, 2])
  await assert.rejects(() => deleteFloorPlannerView(pool, 9, namedId, 0), /revision/)
})
