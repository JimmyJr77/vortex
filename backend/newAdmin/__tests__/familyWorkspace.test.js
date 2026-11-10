import test from 'node:test'
import assert from 'node:assert/strict'
import { participationStatus, readFamilyHistory, withFamilyRead } from '../familyWorkspace.js'

test('participation respects ended, paused, upcoming and requested enrollment dates', () => {
  const today = '2026-11-09', active = { status: 'confirmed', startDate: '2026-01-01' }
  assert.equal(participationStatus(active, today), 'active')
  assert.equal(participationStatus({ ...active, startDate: '2026-12-01' }, today), 'upcoming')
  assert.equal(participationStatus({ ...active, cancelDate: '2026-12-01' }, today), 'pending_cancellation')
  assert.equal(participationStatus({ ...active, cancelDate: today }, today), 'ended')
  assert.equal(participationStatus({ ...active, pauseDate: today }, today), 'paused')
  assert.equal(participationStatus({ ...active, status: 'waitlisted', endDate: '2026-11-08' }, today), 'ended')
  assert.equal(participationStatus({ ...active, status: 'requested' }, today), 'requested')
  assert.equal(participationStatus({ ...active, archived: true }, today), 'ended')
})

test('read snapshot rolls back and releases the connection on errors', async () => {
  const calls = []
  const pool = { connect: async () => ({ query: async sql => calls.push(sql), release: () => calls.push('release') }) }
  await assert.rejects(withFamilyRead(pool, async () => { throw new Error('fixture failure') }), /fixture failure/)
  assert.equal(calls[0], 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
  assert.deepEqual(calls.slice(-2), ['ROLLBACK', 'release'])
})

test('invalid history cursors fail before querying and unknown source dates stay unknown', async () => {
  let calls = 0
  const db = { query: async () => { calls++; return { rows: [{ key: 'jackrabbit:1', cursor_date: '0001-01-01 00:00:00+00', sort_at: '0001-01-01', amount_cents: null }] } } }
  for (const cursor of ['garbage', 'a'.repeat(501), Buffer.from('{"date":"no","key":"x"}').toString('base64url')]) {
    await assert.rejects(readFamilyHistory(db, { familyId: 1, facilityId: 1, memberIds: [], cursor }), /Invalid history cursor/)
  }
  assert.equal(calls, 0)
  const page = await readFamilyHistory(db, { familyId: 1, facilityId: 1, memberIds: [] })
  assert.equal(page.rows[0].date, null)
})
