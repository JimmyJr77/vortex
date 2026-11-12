import assert from 'node:assert/strict'
import test from 'node:test'
import { missingRequiredWaiverIds } from '../waiverCompletion.js'

const base = { facilityId: 7, memberIds: [10], requiredIds: [1, 2], acceptedTemplateIds: [2] }

test('a renewal can submit only new waivers while preserving existing signatures', async () => {
  const pool = { async query(sql, params) {
    assert.match(sql, /m\.facility_id = \$1/)
    assert.match(sql, /template\.facility_id = m\.facility_id/)
    assert.deepEqual(params, [7, [10], [1]])
    return { rows: [{ member_id: '10', waiver_template_id: '1' }] }
  } }
  assert.deepEqual(await missingRequiredWaiverIds(pool, base), [])
})

test('a missing signature still requires explicit acceptance', async () => {
  const pool = { async query() { return { rows: [] } } }
  assert.deepEqual(await missingRequiredWaiverIds(pool, base), [1])
})

test('a guardian signature on one family member does not satisfy another member', async () => {
  const pool = { async query() { return { rows: [{ member_id: 10, waiver_template_id: 1 }] } } }
  assert.deepEqual(await missingRequiredWaiverIds(pool, { ...base, memberIds: [10, 20] }), [1])
})

test('an old template signature does not satisfy a replacement version', async () => {
  const pool = { async query() { return { rows: [{ member_id: 10, waiver_template_id: 99 }] } } }
  assert.deepEqual(await missingRequiredWaiverIds(pool, base), [1])
})

test('accepting the entire current set needs no existing-signature lookup', async () => {
  const pool = { async query() { assert.fail('unexpected signature lookup') } }
  assert.deepEqual(await missingRequiredWaiverIds(pool, { ...base, acceptedTemplateIds: [1, 2] }), [])
})
