import test from 'node:test'
import assert from 'node:assert/strict'
import { listActiveFamilyMemberIds } from '../familyMembers.js'

test('listActiveFamilyMemberIds includes fallback member when junction is empty', async () => {
  const queries = []
  const pool = {
    query: async (sql, params) => {
      queries.push({ sql, params })
      return { rows: [] }
    },
  }

  const ids = await listActiveFamilyMemberIds(pool, 42, { fallbackMemberId: 7 })
  assert.deepEqual(ids, [7])
  assert.match(queries[0].sql, /m\.family_id = \$1/)
})

test('listActiveFamilyMemberIds dedupes fallback against query results', async () => {
  const pool = {
    query: async () => ({ rows: [{ id: 7 }, { id: 9 }] }),
  }

  const ids = await listActiveFamilyMemberIds(pool, 42, { fallbackMemberId: 7 })
  assert.deepEqual(ids, [7, 9])
})
