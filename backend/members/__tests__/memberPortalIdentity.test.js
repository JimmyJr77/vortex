import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'

import { findMemberForAppUser, updateMemberPassword } from '../createMemberStub.js'

test('app-user lookup requires the explicit member login link', async () => {
  let captured
  const db = {
    async query(sql, params) {
      captured = { sql, params }
      return { rows: [] }
    },
  }

  assert.equal(await findMemberForAppUser(db, 72), null)
  assert.deepEqual(captured.params, [72])
  assert.match(captured.sql, /m\.app_user_id = \$1/)
  assert.doesNotMatch(captured.sql, /m\.id = \$1|LOWER\(TRIM\(m\.email\)\)/)
})

test('new portal login uses a generated app_user id and stores credentials only there', async () => {
  const calls = []
  const member = {
    id: 72,
    facility_id: 4,
    app_user_id: null,
    first_name: 'New',
    last_name: 'Member',
    email: 'new@example.test',
    phone: null,
    username: 'newmember',
  }
  const client = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('SELECT *') && text.includes('FROM member')) return { rows: [{ ...member }] }
      if (text.includes('FROM app_user') && text.includes('LIMIT 1')) return { rows: [] }
      if (text.includes('INSERT INTO app_user (')) return { rows: [{ id: '900' }] }
      if (text.includes('INSERT INTO app_user_role')) return { rows: [] }
      if (text.includes('UPDATE member')) return { rows: [] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }

  const updated = await updateMemberPassword(client, member.id, 'Strong password 123')

  const loginInsert = calls.find((call) => call.text.includes('INSERT INTO app_user ('))
  assert.ok(loginInsert)
  assert.doesNotMatch(loginInsert.text, /INSERT INTO app_user \(\s*id,/)
  assert.match(loginInsert.text, /RETURNING id/)
  assert.equal(loginInsert.params.includes(member.id), false)
  const memberLink = calls.find((call) => call.text.includes('SET app_user_id = $2'))
  assert.deepEqual(memberLink.params, [72, 900])
  const memberWrites = calls.filter((call) => call.text.includes('UPDATE member'))
  assert.equal(memberWrites.every((call) => !/password_hash = \$/.test(call.text)), true)
  assert.equal(updated.app_user_id, 900)
  assert.equal(updated.password_hash, null)
  assert.equal(await bcrypt.compare('Strong password 123', loginInsert.params[4]), true)
})

test('password update preserves staff roles on an explicitly linked login', async () => {
  const calls = []
  const client = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('SELECT *') && text.includes('FROM member')) {
        return {
          rows: [{
            id: 72,
            facility_id: 4,
            app_user_id: 15,
            first_name: 'Staff',
            last_name: 'Customer',
            email: 'staff@example.test',
            phone: null,
            username: 'staffcustomer',
          }],
        }
      }
      if (text.includes('UPDATE app_user')) return { rows: [{ id: 15 }] }
      if (text.includes('UPDATE member')) return { rows: [] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }

  await updateMemberPassword(client, 72, 'Another strong password')

  const loginUpdate = calls.find((call) => call.text.includes('UPDATE app_user'))
  assert.ok(loginUpdate)
  const setClause = loginUpdate.text.slice(0, loginUpdate.text.indexOf('WHERE'))
  assert.doesNotMatch(setClause, /role\s*=|is_active\s*=|facility_id\s*=/)
  assert.match(loginUpdate.text, /WHERE id = \$6\s+AND facility_id = \$7/)
  assert.deepEqual(loginUpdate.params.slice(5), [15, 4])
  assert.equal(calls.some((call) => call.text.includes('INSERT INTO app_user')), false)
})

test('identifier collision fails instead of adopting or overwriting an existing login', async () => {
  const calls = []
  const client = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('SELECT *') && text.includes('FROM member')) {
        return {
          rows: [{
            id: 72,
            facility_id: 4,
            app_user_id: null,
            first_name: 'Collision',
            last_name: 'Attempt',
            email: 'owner@example.test',
            username: 'collision',
          }],
        }
      }
      if (text.includes('FROM app_user') && text.includes('LIMIT 1')) return { rows: [{ id: 72 }] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }

  await assert.rejects(
    updateMemberPassword(client, 72, 'Strong password 123'),
    /Link it explicitly/,
  )
  assert.equal(calls.some((call) => call.text.includes('INSERT INTO app_user')), false)
  assert.equal(calls.some((call) => call.text.includes('UPDATE app_user')), false)
})
