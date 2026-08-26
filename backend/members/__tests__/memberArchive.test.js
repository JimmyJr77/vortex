import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMemberArchiveBlockers,
  getMemberArchivePreflight,
  setMemberArchived,
} from '../memberArchive.js'

const member = {
  id: 75,
  first_name: 'Jamie',
  last_name: 'Vortex',
  family_id: 12,
  app_user_id: 34,
  is_active: true,
  status: 'legacy',
}

test('buildMemberArchiveBlockers explains classes and family payment responsibility', () => {
  const blockers = buildMemberArchiveBlockers(
    member,
    [
      { id: 101, class_name: 'Tornadoes', status: 'confirmed' },
      { id: 102, class_name: 'Cyclones', status: 'paused' },
    ],
    [
      {
        id: 9,
        family_id: 12,
        family_name: 'Vortex Family',
        dependent_names: ['Taylor Vortex'],
      },
    ],
  )

  assert.deepEqual(blockers.map((blocker) => blocker.type), [
    'active_enrollments',
    'payment_responsibility',
  ])
  assert.match(blockers[0].message, /Tornadoes \(enrolled\)/)
  assert.match(blockers[0].message, /Cyclones \(paused\)/)
  assert.match(blockers[1].message, /Vortex Family \(covers Taylor Vortex\)/)
  assert.match(blockers[1].message, /Assign another family payer/)
})

function archiveDb({ enrollments = [], paymentAccounts = [] } = {}) {
  return {
    async query(sql) {
      if (sql.includes('FROM member') && sql.includes('WHERE id = $1')) {
        return { rows: [member] }
      }
      if (sql.includes('FROM scheduling_signup s') && sql.includes('JOIN scheduling_form')) {
        return { rows: enrollments }
      }
      if (sql.includes('FROM family_billing_account fba')) {
        return { rows: paymentAccounts }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
}

test('getMemberArchivePreflight returns structured blockers without writing', async () => {
  const result = await getMemberArchivePreflight(archiveDb({
    enrollments: [{ id: 101, class_name: 'Tornadoes', status: 'confirmed' }],
    paymentAccounts: [{
      id: 9,
      family_id: 12,
      family_name: 'Vortex Family',
      dependent_names: ['Taylor Vortex'],
    }],
  }), 75)

  assert.equal(result.found, true)
  assert.equal(result.canArchive, false)
  assert.equal(result.blockers.length, 2)
})

test('setMemberArchived rolls back and does not update a blocked member', async () => {
  const queries = []
  const client = {
    async query(sql) {
      queries.push(sql)
      if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FROM member') && sql.includes('FOR UPDATE')) return { rows: [member] }
      if (sql.includes('FROM scheduling_signup s') && sql.includes('JOIN scheduling_form')) {
        return { rows: [{ id: 101, class_name: 'Tornadoes', status: 'confirmed' }] }
      }
      if (sql.includes('FROM family_billing_account fba')) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
    release() {},
  }
  const pool = { async connect() { return client } }

  const result = await setMemberArchived(pool, 75, true)

  assert.equal(result.canArchive, false)
  assert.equal(queries.at(-1), 'ROLLBACK')
  assert.equal(queries.some((sql) => sql.includes('UPDATE member')), false)
})

test('setMemberArchived archives the member and linked login in one transaction', async () => {
  const queries = []
  const updatedMember = { ...member, is_active: false, status: 'archived' }
  const client = {
    async query(sql, params = []) {
      queries.push({ sql, params })
      if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] }
      if (sql.includes('FROM member') && sql.includes('FOR UPDATE')) return { rows: [member] }
      if (sql.includes('FROM scheduling_signup s') && sql.includes('JOIN scheduling_form')) {
        return { rows: [] }
      }
      if (sql.includes('FROM family_billing_account fba')) return { rows: [] }
      if (sql.includes('UPDATE family_billing_account')) return { rows: [] }
      if (sql.includes('UPDATE member')) return { rows: [updatedMember] }
      if (sql.includes('UPDATE app_user')) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
    release() {},
  }
  const pool = { async connect() { return client } }

  const result = await setMemberArchived(pool, 75, true)

  assert.equal(result.member.status, 'archived')
  assert.equal(queries.at(-1).sql, 'COMMIT')
  const memberUpdate = queries.find((entry) => entry.sql.includes('UPDATE member'))
  assert.deepEqual(memberUpdate.params.slice(0, 2), [false, 75])
  const loginUpdate = queries.find((entry) => entry.sql.includes('UPDATE app_user'))
  assert.deepEqual(loginUpdate.params, [false, 34])
})
