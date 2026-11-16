import test from 'node:test'
import assert from 'node:assert/strict'
import { saveClassSetupDropIns } from '../classSetupDropIns.js'
import { registerNewAdminRoutes } from '../../newAdmin/registerRoutes.js'

test('invalid drop-in scope, state, or identity is rejected before connecting', async () => {
  const pool = { connect() { assert.fail('Invalid input must not connect') } }
  for (const body of [undefined, {}, { allowDropIns: true }, { allowDropIns: 'true', scope: 'class' },
    { allowDropIns: true, scope: 'all' }, { allowDropIns: true, scope: 'class', timeSlotId: 0 },
    { allowDropIns: true, scope: 'class', timeSlotId: '12' }, { allowDropIns: true, scope: 'class', targetIds: [12] }]) {
    await assert.rejects(saveClassSetupDropIns(pool, 1, 10, body), { statusCode: 400 })
  }
  for (const classId of ['no-class', 0, -1, 1.5]) {
    await assert.rejects(saveClassSetupDropIns(pool, 1, classId, { allowDropIns: false, scope: 'class' }), { statusCode: 400 })
  }
})

test('an inaccessible source class rolls back without any mutation', async () => {
  const calls = []
  let released = false
  const pool = { connect: async () => ({
    query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] } },
    release() { released = true },
  }) }
  await assert.rejects(saveClassSetupDropIns(pool, 2, 10, { allowDropIns: false, scope: 'program' }), { statusCode: 404 })
  assert.deepEqual(calls[1].values, [10, 2])
  assert.equal(calls.at(-1).sql, 'ROLLBACK')
  assert.ok(calls.every(({ sql }) => !/^UPDATE/.test(sql)))
  assert.equal(released, true)
})

test('a concurrent program move cannot broaden a scoped edit', async () => {
  const calls = []
  const pool = { connect: async () => ({
    query: async sql => {
      calls.push(sql)
      if (sql.includes('SELECT id, programs_id, display_name')) return { rows: [{ id: 10, programs_id: 20, display_name: 'Class' }] }
      if (sql.includes('SELECT id, programs_id')) return { rows: [{ id: 10, programs_id: 1 }] }
      return { rows: [{ id: 1 }] }
    }, release() {},
  }) }
  await assert.rejects(saveClassSetupDropIns(pool, 1, 10, { allowDropIns: true, scope: 'program' }), { statusCode: 409 })
  assert.equal(calls.at(-1), 'ROLLBACK')
  assert.ok(calls.every(sql => !/^UPDATE/.test(sql)))
})

test('a schedule moved after selection cannot be edited under its former group lock', async () => {
  const calls = []
  const pool = { connect: async () => ({
    query: async sql => {
      calls.push(sql)
      if (sql.includes('SELECT id, programs_id')) return { rows: [{ id: 10, programs_id: 1, display_name: 'Class' }] }
      if (sql.includes('SELECT slot.id, slot.slot_group_id')) return { rows: [{ id: 101, slot_group_id: sql.includes('FOR UPDATE OF slot') ? 11 : 10 }] }
      return { rows: [{ id: 1 }] }
    }, release() {},
  }) }
  await assert.rejects(saveClassSetupDropIns(pool, 1, 10, { allowDropIns: false, scope: 'class', timeSlotId: 101 }),
    error => error.statusCode === 409 && /moved to another group/.test(error.message))
  assert.equal(calls.at(-1), 'ROLLBACK')
  assert.ok(calls.every(sql => !/^UPDATE/.test(sql)))
})

test('drop-in scope endpoint requires class management permission', async () => {
  let chain
  const app = { use() {}, get() {}, post() {}, put() {}, delete() {}, patch(path, ...handlers) {
    if (path === '/api/admin/new-admin/classes/:id/drop-ins') chain = handlers
  } }
  const pool = { connect() { assert.fail('Denied requests must not write') } }
  registerNewAdminRoutes(app, pool, { jwtSecret: 'test-only' })
  assert.ok(chain)
  const req = { canonicalAccess: { portalAccess: { admin: true }, facilityId: 1 },
    newAdminPermissions: new Map([['classes.manage', Promise.resolve(false)]]) }
  const res = { status(code) { this.statusCode = code; return this }, json(body) { this.body = body } }
  await chain[0](req, res, () => assert.fail('Denied request reached writer'))
  assert.equal(res.statusCode, 403)
  assert.match(res.body.message, /classes.manage/)
})
