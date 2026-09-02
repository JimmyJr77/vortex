import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveWaiverRecipient } from '../registerRoutes.js'

test('waiver recipient resolution uses an adult member own linked contact', async () => {
  let statement = ''
  const pool = {
    async query(sql) {
      statement = String(sql)
      return {
        rows: [
          { email: 'member@example.com', first_name: null, is_guardian: false },
          { email: 'guardian@example.com', first_name: 'Grace', is_guardian: true },
        ],
      }
    },
  }

  assert.deepEqual(
    await resolveWaiverRecipient(pool, { id: 50, facility_id: 7 }),
    { email: 'member@example.com', guardianName: null },
  )
  assert.match(statement, /target\.is_adult = TRUE/)
  assert.match(statement, /facility\.timezone AS facility_timezone/)
})

test('waiver recipient resolution falls back only to a canonical guardian', async () => {
  let statement = ''
  const pool = {
    async query(sql, params) {
      statement = sql
      assert.deepEqual(params, [50, 7])
      return {
        rows: [
          { email: null, first_name: null, is_guardian: false },
          { email: 'guardian@example.com', first_name: 'Grace', is_guardian: true },
        ],
      }
    },
  }

  assert.deepEqual(
    await resolveWaiverRecipient(pool, { id: 50, facility_id: 7 }),
    { email: 'guardian@example.com', guardianName: 'Grace' },
  )
  assert.match(statement, /child_user\.id = child\.app_user_id/)
  assert.match(statement, /child_user\.facility_id = child\.facility_id/)
  assert.match(statement, /parent_guardian_authority authority/)
  assert.match(statement, /authority\.has_legal_authority = TRUE/)
  assert.match(statement, /child_membership\.is_active = TRUE/)
  assert.match(statement, /guardian_membership\.family_id = child_membership\.family_id/)
  assert.match(statement, /guardian_membership\.is_active = TRUE/)
  assert.match(statement, /guardian\.is_active = TRUE/)
  assert.match(statement, /guardian_user\.facility_id = guardian\.facility_id/)
  assert.match(statement, /target\.is_minor = TRUE/)
  assert.match(statement, /guardian\.date_of_birth IS NOT NULL/)
  assert.match(statement, /CURRENT_TIMESTAMP AT TIME ZONE COALESCE\(target\.facility_timezone/)
  assert.doesNotMatch(statement, /parent_guardian_ids|family_billing_account/i)
})

test('waiver recipient resolution does not fall back to payer or arbitrary household adults', async () => {
  const pool = {
    async query() {
      return { rows: [{ email: null, first_name: null, is_guardian: false }] }
    },
  }

  assert.equal(
    await resolveWaiverRecipient(pool, { id: 50, facility_id: 7 }),
    null,
  )
})

test('waiver recipient resolution fails closed when DOB does not establish adult or minor status', async () => {
  let statement = ''
  const pool = {
    async query(sql) {
      statement = String(sql)
      return { rows: [] }
    },
  }

  assert.equal(await resolveWaiverRecipient(pool, { id: 50, facility_id: 7 }), null)
  assert.match(statement, /child\.date_of_birth IS NOT NULL[\s\S]*AS is_adult/)
  assert.match(statement, /child\.date_of_birth IS NOT NULL[\s\S]*AS is_minor/)
})
