import assert from 'node:assert/strict'
import test from 'node:test'
import { listScheduleInboxRows } from '../messageScheduleInbox.js'

for (const memberId of [null, 13]) {
  test(`schedule inbox binds every SQL parameter for ${memberId == null ? 'staff' : 'member'}`, async () => {
    const queries = []
    const pool = {
      async query(sql, params = []) {
        const positions = [...new Set([...sql.matchAll(/\$(\d+)/g)].map(match => Number(match[1])))].sort((a, b) => a - b)
        assert.deepEqual(positions, params.map((_, index) => index + 1), 'PostgreSQL must be able to infer every bound parameter type')
        queries.push({ sql, params })
        return { rows: [] }
      },
    }
    assert.deepEqual(await listScheduleInboxRows(pool, 1, { memberId }), [])
    if (memberId != null) {
      const visibility = queries.find(({ sql }) => sql.includes('e.tag_all_parents'))
      assert.ok(visibility)
      assert.deepEqual(visibility.params, [[0]])
    }
  })
}
