import assert from 'node:assert/strict'
import test from 'node:test'

import {
  resolveAppUserEmail,
  resolveMemberContactEmail,
} from '../memberContact.js'

test('app-user contact resolution follows only the explicit member.app_user_id link', async () => {
  let statement = ''
  const db = {
    async query(sql, params) {
      statement = sql
      assert.deepEqual(params, [42])
      return { rows: [{ email: 'linked@example.com' }] }
    },
  }

  assert.equal(await resolveAppUserEmail(db, 42), 'linked@example.com')
  assert.match(statement, /LEFT JOIN member m ON m\.app_user_id = au\.id/)
  assert.doesNotMatch(statement, /m\.id = au\.id/)
})

test('member contact resolution uses an active authorized guardian in the same household', async () => {
  const statements = []
  const db = {
    async query(sql) {
      statements.push(sql)
      if (sql.includes('FROM member m')) {
        return { rows: [{ id: 70, first_name: 'Athlete', email: null }] }
      }
      if (sql.includes('FROM parent_guardian_authority')) {
        return { rows: [{ id: 71, first_name: 'Guardian', email: 'guardian@example.com' }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  assert.deepEqual(
    await resolveMemberContactEmail(db, { id: 70, email: null }),
    {
      email: 'guardian@example.com',
      contactName: 'Guardian',
      memberId: 71,
      contactRole: 'guardian',
    },
  )

  const guardianSql = statements.find((sql) => sql.includes('parent_guardian_authority'))
  assert.match(guardianSql, /authority\.has_legal_authority = TRUE/)
  assert.match(guardianSql, /child_membership\.is_active = TRUE/)
  assert.match(guardianSql, /guardian_membership\.family_id = child_membership\.family_id/)
  assert.match(guardianSql, /guardian_membership\.is_active = TRUE/)
  assert.match(guardianSql, /guardian\.is_active = TRUE/)
  assert.match(guardianSql, /guardian\.date_of_birth IS NOT NULL/)
  assert.match(guardianSql, /CURRENT_TIMESTAMP AT TIME ZONE COALESCE\(NULLIF\(facility_row\.timezone/)
  assert.match(guardianSql, /guardian_user\.id = guardian\.app_user_id/)
  assert.doesNotMatch(guardianSql, /parent_guardian_ids/i)
})

test('billing payer is a named opt-in fallback and is never treated as a guardian', async () => {
  let payerQueries = 0
  const db = {
    async query(sql) {
      if (sql.includes('FROM member m')) {
        return { rows: [{ id: 80, first_name: 'Athlete', email: null }] }
      }
      if (sql.includes('FROM parent_guardian_authority')) return { rows: [] }
      if (sql.includes('FROM member subject')) {
        payerQueries += 1
        return { rows: [{ id: 81, first_name: 'Payer', email: 'payer@example.com' }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  assert.equal(await resolveMemberContactEmail(db, { id: 80, email: null }), null)
  assert.equal(payerQueries, 0)

  assert.deepEqual(
    await resolveMemberContactEmail(
      db,
      { id: 80, email: null },
      { includeBillingPayer: true },
    ),
    {
      email: 'payer@example.com',
      contactName: 'Payer',
      memberId: 81,
      contactRole: 'payer',
    },
  )
  assert.equal(payerQueries, 1)
})
