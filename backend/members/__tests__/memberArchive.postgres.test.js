import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../../newAdmin/migrationAudit.js'
import { recordBillingActivity } from '../../billing/billingActivity.js'
import { listAccountingLines, listAccountingPayments } from '../../billing/accountingReport.js'
import { setMemberArchived } from '../memberArchive.js'
import { setFamilyArchived } from '../familyArchive.js'
import { deleteArchivedMember } from '../memberDeletion.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('archive preserves real household billing ownership, accounting, and other member rows', { skip: !connectionString }, async t => {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    await db.query(await fs.readFile(new URL('../../migrations/862_retire_member_archive_family_fanout.sql', import.meta.url), 'utf8'))
    const commands = { BEGIN: 'SAVEPOINT archive_action', COMMIT: 'RELEASE SAVEPOINT archive_action', ROLLBACK: 'ROLLBACK TO SAVEPOINT archive_action' }
    const pool = { async connect() { return { query: (sql, values) => db.query(commands[sql] || sql, values), release() {} } } }
    const row = async (sql, values = []) => (await db.query(sql, values)).rows[0]
    const rowsOf = async (table, predicate, values) => (await db.query(
      `SELECT to_jsonb(record) AS row FROM ${table} record WHERE ${predicate} ORDER BY to_jsonb(record)::text`, values,
    )).rows
    const facility = await row("INSERT INTO facility(name) VALUES('Archive ownership safety fixture') RETURNING id")
    const snapshot = async ({ family, real, account }) => {
      const result = {}
      for (const [table, predicate, values] of [
        ['family', 'id=$1', [family.id]], ['member', 'id=$1', [real.id]],
        ['family_member', 'member_id=$1', [real.id]], ['family_billing_account', 'id=$1', [account.id]],
        ...['billing_charge', 'billing_payment', 'billing_refund', 'billing_subscription', 'billing_account_activity',
          'account_charge', 'account_payment', 'account_refund'].map(table => [table, 'family_billing_account_id=$1', [account.id]]),
      ]) result[table] = await rowsOf(table, predicate, values)
      const { generatedAt: linesGeneratedAt, ...lines } = await listAccountingLines(db, { facilityId: facility.id, exportLimit: 10000 })
      const { generatedAt: paymentsGeneratedAt, ...payments } = await listAccountingPayments(db, { facilityId: facility.id, exportLimit: 10000 })
      assert.equal(lines.rows.length, lines.total)
      assert.equal(payments.rows.length, payments.total)
      return { ...result, lines, payments }
    }
    const fixture = async ({ archivedFamily, sharedLegacyFamily = false }) => {
      const family = await row("INSERT INTO family(facility_id,family_name,archived) VALUES($1,'Real inactive household',$2) RETURNING id", [facility.id, archivedFamily])
      const real = await row(`INSERT INTO member(facility_id,family_id,first_name,last_name,is_active,family_is_active)
        VALUES($1,$2,'Real','Member',FALSE,TRUE) RETURNING id`, [facility.id, family.id])
      await db.query('INSERT INTO family_member(family_id,member_id,is_active) VALUES($1,$2,$3)', [family.id, real.id, !sharedLegacyFamily])
      const source = await row(`INSERT INTO member(facility_id,family_id,first_name,last_name,is_active,family_is_active,signup_source)
        VALUES($1,$2,'Duplicate','Test',TRUE,TRUE,'admin_created') RETURNING id`, [facility.id, sharedLegacyFamily ? family.id : null])
      if (sharedLegacyFamily) await db.query('INSERT INTO family_member(family_id,member_id,is_active) VALUES($1,$2,TRUE)', [family.id, source.id])
      const account = await row('INSERT INTO family_billing_account(family_id,payer_member_id,is_active) VALUES($1,$2,TRUE) RETURNING id', [family.id, source.id])
      await db.query("INSERT INTO billing_charge(family_billing_account_id,member_id,description,amount_cents) VALUES($1,$2,'Retained real charge',5000)", [account.id, real.id])
      await db.query("INSERT INTO billing_payment(family_billing_account_id,amount_cents,method) VALUES($1,1000,'cash')", [account.id])
      await recordBillingActivity(db, { accountId: account.id, memberId: real.id, eventType: 'manual_note', summary: 'Retained real billing evidence', actorType: 'system' })
      return { family, real, source, account }
    }
    for (const archivedFamily of [false, true]) await t.test(`${archivedFamily ? 'archived' : 'inactive'} real household keeps its payer and complete ledger`, async () => {
      await db.query('SAVEPOINT ownership_scenario')
      try {
        const f = await fixture({ archivedFamily })
        const before = await snapshot(f)
        const result = await setMemberArchived(pool, f.source.id, true, { facilityId: facility.id })
        assert.equal(result.canArchive, true)
        assert.equal(result.member.is_active, false)
        assert.deepEqual(await snapshot(f), before)
        // Unresolved ownership remains visible and must block permanent deletion.
        await assert.rejects(deleteArchivedMember(pool, { memberId: f.source.id, facilityId: facility.id }), { statusCode: 409 })
        assert.deepEqual(await snapshot(f), before)
      } finally {
        await db.query('ROLLBACK TO SAVEPOINT ownership_scenario')
        await db.query('RELEASE SAVEPOINT ownership_scenario')
      }
    })
    await t.test('member archive and family archive leave an excluded legacy sibling unchanged', async () => {
      await db.query('SAVEPOINT sibling_scenario')
      try {
        const f = await fixture({ archivedFamily: true, sharedLegacyFamily: true })
        const before = await snapshot(f)
        const result = await setMemberArchived(pool, f.source.id, true, { facilityId: facility.id })
        assert.equal(result.canArchive, true)
        assert.deepEqual(await snapshot(f), before)
        assert.equal((await setMemberArchived(pool, f.source.id, false, { facilityId: facility.id })).canArchive, true)
        assert.deepEqual(await snapshot(f), before)
        const realBefore = await rowsOf('member', 'id=$1', [f.real.id])
        assert.equal((await setFamilyArchived(pool, f.family.id, true, { facilityId: facility.id })).canArchive, true)
        assert.deepEqual(await rowsOf('member', 'id=$1', [f.real.id]), realBefore)
        assert.deepEqual(await rowsOf('family_billing_account', 'id=$1', [f.account.id]), before.family_billing_account)
      } finally {
        await db.query('ROLLBACK TO SAVEPOINT sibling_scenario')
        await db.query('RELEASE SAVEPOINT sibling_scenario')
      }
    })
  } finally {
    await db.query('ROLLBACK').catch(() => {})
    await db.end()
  }
})
