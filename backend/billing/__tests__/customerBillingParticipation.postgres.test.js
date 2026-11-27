import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { installSharedAccountRecords } from '../../newAdmin/__tests__/sharedAccountFixture.js'
import { validateRehearsalDatabaseUrl } from '../../newAdmin/migrationAudit.js'
import { applyCanonicalMembershipDisplay, loadCustomerBillingAnnualMemberships, loadCustomerBillingParticipation } from '../customerBillingQueries.js'
import { memberHasActiveMembershipSql } from '../../newAdmin/memberActivity.js'
import { listCustomerBillingOverviews } from '../customerBillingOverviewList.js'
import { getAdminDashboard } from '../../platform/adminDashboard.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('billing and dashboard separate family activity from current enrollment', { skip: !connectionString }, async t => {
  const schema = `billing_participation_${randomBytes(6).toString('hex')}`
  const admin = new pg.Pool({ connectionString })
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}`, max: 2 })
  t.after(async () => { await pool.end(); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end() })
  const fixture = await readFile(new URL('./fixtures/turnover-schema.sql', import.meta.url), 'utf8')
  await pool.query(fixture.replaceAll('public.', `"${schema}".`))
  await installSharedAccountRecords(pool)
  await pool.query(`
    INSERT INTO facility(id,name,timezone) VALUES(1,'Participation fixture','America/New_York'),(2,'Foreign fixture','America/New_York');
    INSERT INTO family(id,facility_id,family_name) VALUES(1,1,'Member child'),(2,1,'Adult student'),(3,1,'Drop-in child'),(4,1,'Future student'),(5,2,'Foreign family');
    INSERT INTO member(id,facility_id,family_id,first_name,last_name,date_of_birth,is_active) VALUES
      (1,1,1,'Member','Child','2016-01-01',FALSE),(2,1,2,'Adult','Student','1986-01-01',TRUE),
      (3,1,3,'Drop-in','Child','2016-01-01',TRUE),(4,1,4,'Future','Student','2016-01-01',TRUE),
      (5,2,5,'Foreign','Child','2016-01-01',TRUE);
    INSERT INTO family_member(family_id,member_id,is_active) VALUES(1,1,TRUE),(2,2,TRUE),(3,3,TRUE),(4,4,TRUE),(5,5,TRUE);
    INSERT INTO scheduling_form(id,title) VALUES(1,'Current class');
    INSERT INTO scheduling_slot_group(id,form_id) VALUES(1,1);
    INSERT INTO scheduling_signup(id,form_id,slot_group_id,member_id,status,enrollment_start_date) VALUES
      (1,1,1,2,'confirmed','2026-10-01'),(2,1,1,3,'confirmed','2026-10-01'),
      (3,1,1,4,'confirmed','2026-12-01'),(4,1,1,5,'confirmed','2026-10-01');
    INSERT INTO additional_fee(id,facility_id,name,amount_cents,apply_basis,trigger_type) VALUES(1,1,'Annual membership',8500,'per_year','once_per_year');
    INSERT INTO additional_fee_redemption(fee_id,member_id,period_key,amount_cents,satisfied_at) VALUES
      (1,1,'2027-10-01',8500,'2026-10-01T12:00:00Z'),(1,2,'2027-10-01',8500,'2026-10-01T12:00:00Z'),
      (1,4,'2027-10-01',8500,NULL);
    INSERT INTO drop_in_registration(id,member_id,form_id,slot_group_id,class_date,first_name,last_name,email,status,benefit_type) VALUES
      (1,3,1,1,'2026-11-01','Drop-in','Child','dropin@example.test','attended','paid'),
      (2,4,1,1,'2026-11-01','Future','Student','trial@example.test','attended','free_trial');
  `)
  const asOf = new Date('2026-11-25T17:00:00Z')
  const participation = familyId => loadCustomerBillingParticipation(pool, { familyId, facilityId: 1, today: '2026-11-25' })
  await t.test('child activity and any-age current enrollment are independent of account lifecycle', async () => {
    assert.deepEqual(await participation(1), { active: true, enrolled: false })
    assert.deepEqual(await participation(2), { active: false, enrolled: true })
    assert.deepEqual(await participation(3), { active: true, enrolled: true })
    assert.deepEqual(await participation(4), { active: false, enrolled: false })
    assert.deepEqual(await participation(5), { active: false, enrolled: false })
  })
  await t.test('membership display agrees with canonical entitlement for satisfied, unpaid and drop-in-only members', async () => {
    const result = await pool.query(`SELECT m.id,${memberHasActiveMembershipSql('m.id', '$1::date')} AS valid
      FROM member m WHERE m.facility_id=1 AND m.id IN (1,3,4) ORDER BY m.id`, ['2026-11-25'])
    const members = result.rows.map(row => ({ id: Number(row.id), hasActiveMembership: row.valid }))
    assert.deepEqual(members.map(row => [row.id,row.hasActiveMembership]), [[1,true],[3,false],[4,false]])
    const projected = await loadCustomerBillingAnnualMemberships(pool, { accountId: 99, members, asOf })
    assert.deepEqual(projected.map(row => [row.memberId,row.active]), [[1,true],[3,false],[4,true]])
    const displayed = applyCanonicalMembershipDisplay(projected, members)
    assert.deepEqual(displayed.map(row => [row.memberId,row.active]), [[1,true],[3,false],[4,false]])
    const financialFields = ({ active, ...fields }) => fields
    assert.deepEqual(displayed.map(financialFields), projected.map(financialFields))
  })
  await t.test('billing list exposes canonical flags and combines independent filters', async () => {
    const list = async filters => (await listCustomerBillingOverviews(pool, { facilityId: 1, asOf, ...filters })).families
      .map(row => [row.familyId,row.active,row.enrolled])
    // The existing billing roster excludes archived identities; the family
    // participation reader above remains independent of that lifecycle filter.
    assert.deepEqual(await list({}), [[2,false,true],[3,true,true],[4,false,false]])
    assert.deepEqual(await list({ active: true, enrolled: true }), [[3,true,true]])
    assert.deepEqual(await list({ active: false, enrolled: true }), [[2,false,true]])
  })
  await t.test('dashboard uses active and enrolled counters for distinct populations', async () => {
    const dashboardPool = {
      query: pool.query.bind(pool),
      // Trend reporting is outside this regression; the dashboard enrollment
      // queries still execute against real PostgreSQL above.
      connect: async () => ({ query: async () => ({ rows: [] }), release() {} }),
    }
    const dashboard = await getAdminDashboard(dashboardPool, { facilityId: 1, canViewEnrollment: true, now: asOf })
    assert.equal(dashboard.enrollment.activeAthletes, 3)
    assert.equal(dashboard.enrollment.activeFamilies, 2)
    assert.equal(dashboard.enrollment.enrolledAthletes, 2)
    assert.equal(dashboard.enrollment.enrolledFamilies, 2)
    assert.equal(dashboard.enrollment.currentEnrollments, 2)
    assert.deepEqual(dashboard.enrollment.withoutMembership.map(row => row.memberId), [3])
  })
  await t.test('pause, cancel and program dates stop current enrollment without changing activity', async () => {
    await pool.query("UPDATE scheduling_signup SET pause_effective_date='2026-11-25' WHERE id=2")
    assert.deepEqual(await participation(3), { active: true, enrolled: false })
    await pool.query("UPDATE scheduling_signup SET pause_effective_date=NULL,cancel_effective_date='2026-11-25' WHERE id=2")
    assert.deepEqual(await participation(3), { active: true, enrolled: false })
    await pool.query("UPDATE scheduling_signup SET cancel_effective_date=NULL WHERE id=2")
    await pool.query("UPDATE scheduling_form SET start_date='2026-12-01' WHERE id=1")
    assert.deepEqual(await participation(3), { active: true, enrolled: false })
    await pool.query("UPDATE scheduling_form SET start_date=NULL,end_date='2026-11-24' WHERE id=1")
    assert.deepEqual(await participation(3), { active: true, enrolled: false })
    await pool.query("UPDATE drop_in_registration SET class_date='2026-08-01' WHERE id=1")
    assert.deepEqual(await participation(3), { active: false, enrolled: false })
  })
})
