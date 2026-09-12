import test from 'node:test'
import assert from 'node:assert/strict'
import { archiveClassSetupSchedule } from '../classSetupScheduleArchive.js'

function harness() {
  const slots = [
    { id: 272, classId: 44, formId: 33, day: 'Monday', is_active: true },
    { id: 271, classId: 44, formId: 33, day: 'Wednesday', is_active: true },
    { id: 273, classId: 44, formId: 33, day: 'Friday', is_active: true },
  ]
  const calls = []
  const pool = { async query(sql, params) {
    calls.push({ sql, params })
    assert.match(sql, /WHERE slot.id = \$2/)
    assert.match(sql, /slot.form_id = form.id/)
    assert.match(sql, /form.program_id = \$1/)
    assert.doesNotMatch(sql, /UPDATE program\b|\bDELETE\b/i)
    assert.match(sql, /slot_group.id = changed_slot.slot_group_id/)
    assert.match(sql, /sibling.id <> \$2 AND sibling.is_active = TRUE/)
    const slot = slots.find((s) => s.id === params[1] && s.classId === params[0])
    if (slot) slot.is_active = params[2]
    return { rows: slot ? [slot] : [] }
  } }
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
  return { slots, calls, pool, res }
}

test('archiving and restoring Monday preserves Wednesday and Friday of the same class', async () => {
  const { pool, slots, calls, res } = harness()
  const req = { params: { classId: '44', slotId: '272' }, body: { archived: true } }
  await archiveClassSetupSchedule(pool, req, res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(slots.map((s) => s.is_active), [false, true, true])
  assert.deepEqual(calls[0].params, [44, 272, false])
  await archiveClassSetupSchedule(pool, { ...req, body: { archived: false } }, res)
  assert.deepEqual(slots.map((s) => s.is_active), [true, true, true])
})

test('a schedule ID from another class cannot be archived', async () => {
  const { pool, slots, res } = harness()
  await archiveClassSetupSchedule(pool, { params: { classId: '45', slotId: '272' }, body: { archived: true } }, res)
  assert.equal(res.statusCode, 404)
  assert.ok(slots.every((s) => s.is_active))
})

test('missing schedule identity or non-boolean archive state fails before mutation', async () => {
  for (const req of [
    { params: { classId: '44' }, body: { archived: true } },
    { params: { classId: '44', slotId: '272' }, body: { archived: 'false' } },
  ]) {
    const { pool, calls, res } = harness()
    await archiveClassSetupSchedule(pool, req, res)
    assert.equal(res.statusCode, 400)
    assert.equal(calls.length, 0)
  }
})
