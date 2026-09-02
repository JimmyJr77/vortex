import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import { createNotesHandlers, resolveAdminAuthor } from '../handlers.js'

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = Number(code)
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    },
  }
}

test('note subjects fail closed outside the authenticated facility', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params })
      if (String(sql).includes('SELECT 1 FROM member')) return { rows: [] }
      throw new Error(`unexpected query after facility rejection: ${sql}`)
    },
  }
  const res = responseRecorder()

  await createNotesHandlers(pool).listNotes({
    query: { subjectType: 'member', subjectId: '51' },
    canonicalAccess: { facilityId: 7 },
  }, res)

  assert.equal(res.statusCode, 404)
  assert.equal(res.payload.message, 'Note subject not found')
  assert.deepEqual(calls[0].params, [51, 7])
  assert.match(calls[0].sql, /id = \$1 AND facility_id = \$2/)
  assert.equal(calls.some(({ sql }) => /SELECT \* FROM note/.test(sql)), false)
})

test('note deletion rechecks the subject facility before mutating the note', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      const text = String(sql)
      calls.push({ sql: text, params })
      if (text.includes('SELECT subject_type, subject_id FROM note')) {
        return { rows: [{ subject_type: 'member', subject_id: '51' }] }
      }
      if (text.includes('SELECT 1 FROM member')) return { rows: [] }
      throw new Error(`unexpected mutation: ${text}`)
    },
  }
  const res = responseRecorder()

  await createNotesHandlers(pool).deleteNote({
    params: { id: '9' },
    canonicalAccess: { facilityId: 7 },
  }, res)

  assert.equal(res.statusCode, 404)
  assert.equal(res.payload.message, 'Note not found')
  assert.equal(calls.some(({ sql }) => /UPDATE note/.test(sql)), false)
})

test('note author identity is canonical and facility scoped without a legacy fallback', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params })
      return { rows: [{ full_name: 'Facility Administrator' }] }
    },
  }

  assert.deepEqual(await resolveAdminAuthor(pool, {
    adminId: 12,
    adminEmail: 'admin@example.test',
    canonicalAccess: { facilityId: 7 },
  }), {
    authorKind: 'admin',
    authorId: 12,
    authorEmail: 'admin@example.test',
    authorName: 'Facility Administrator',
  })
  assert.deepEqual(calls[0].params, [12, 7])
  assert.match(calls[0].sql, /WHERE id = \$1 AND facility_id = \$2/)

  const source = await fs.readFile(new URL('../handlers.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /FROM admins/)
})

test('legacy registration notes fail closed across multiple facilities', async () => {
  let scopeSql = ''
  const pool = {
    async query(sql) {
      scopeSql = String(sql)
      return { rows: [] }
    },
  }
  const res = responseRecorder()

  await createNotesHandlers(pool).listNotes({
    query: { subjectType: 'registration', subjectId: '88' },
    canonicalAccess: { facilityId: 7 },
  }, res)

  assert.equal(res.statusCode, 404)
  assert.match(scopeSql, /linked_member\.facility_id = \$2/)
  assert.match(scopeSql, /registration\.member_id IS NULL/)
  assert.match(scopeSql, /SELECT COUNT\(\*\) FROM facility/)
  assert.match(scopeSql, /EXISTS \(SELECT 1 FROM facility WHERE id = \$2\)/)
})

test('server permission mapping protects note reads and mutations separately', async () => {
  const source = await fs.readFile(new URL('../../server.js', import.meta.url), 'utf8')
  const permissionStart = source.indexOf('function legacyAdminPermissionFor')
  const permissionEnd = source.indexOf("app.use('/api/admin'", permissionStart)
  const permissions = source.slice(permissionStart, permissionEnd)

  assert.match(permissions, /path\.startsWith\('\/notes'\).*method === 'GET' \? 'members\.view' : 'members\.edit'/)
  assert.ok(source.indexOf("app.use('/api/admin'") < source.indexOf('registerNotesRoutes(app, pool)'))
})
