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

test('routes enforce view and manage permissions, with facility-scoped reads', async () => {
  const routes = [], permissions = []
  const app = { get: (path, ...handlers) => routes.push({ path, handlers }), put: (path, ...handlers) => routes.push({ path, handlers }), post: (path, ...handlers) => routes.push({ path, handlers }), delete: (path, ...handlers) => routes.push({ path, handlers }) }
  const queries = []
  const pool = { query: async (sql, args) => { queries.push({ sql, args }); return { rows: [] } } }
  registerFloorPlannerRoutes(app, pool, { jwtSecret: 'test', requirePermission: (_pool, _secret, permission) => { permissions.push(permission); return [() => {}] } })
  assert.deepEqual(permissions, ['scheduling.view', 'scheduling.manage', 'scheduling.view', 'scheduling.view', 'scheduling.manage', 'scheduling.manage', 'scheduling.manage', 'scheduling.view'])
  let data
  await routes[0].handlers.at(-1)({ platformAuth: { user: { facility_id: 9 } } }, { json: (body) => { data = body.data } })
  assert.deepEqual(data, { plan: null, revision: 0, facilityId: 9 })
  assert.deepEqual(queries[0].args, [9])
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
