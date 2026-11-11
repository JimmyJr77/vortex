import { installSharedAccountRecords } from './sharedAccountFixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import pg from 'pg'
import { loadEnrollmentTrend } from '../enrollmentTrend.js'
import { saveMarketingSpend } from '../marketingSpend.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL || process.env.DASHBOARD_TEST_DATABASE_URL
if (connectionString) {
  const url = new URL(connectionString)
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.search && !url.hash)
  assert.match(url.pathname, /^\/(vortex_new_admin_dev(?:_[a-z0-9_]+)?|vortex_dashboard_test)$/)
}

test('monthly trend uses one read-only local snapshot with canonical owners and imported history', { skip: !connectionString }, async () => {
  const schema = `family_trend_${crypto.randomBytes(6).toString('hex')}`
  const admin = new pg.Pool({ connectionString })
  await admin.query(`CREATE SCHEMA "${schema}"`)
  const pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}`, max: 2 })
  try {
    const fixture = await fs.readFile(new URL('../../billing/__tests__/fixtures/turnover-schema.sql', import.meta.url), 'utf8')
    await pool.query(fixture.replaceAll('public.', `"${schema}".`))
    await installSharedAccountRecords(pool)
    const marketingMigration = await fs.readFile(new URL('../../migrations/844_enrollment_marketing_spend.sql', import.meta.url), 'utf8')
    await pool.query(marketingMigration)
    await pool.query(marketingMigration)
    await pool.query(`
      INSERT INTO facility(id,name,timezone) VALUES(1,'Trend fixture','America/New_York'),(2,'Other','America/New_York');
      INSERT INTO family(id,facility_id,family_name) VALUES(1,1,'One'),(2,1,'Two'),(3,2,'Foreign'),(4,1,'Moved');
      INSERT INTO member(id,facility_id,family_id,first_name,last_name) VALUES(1,1,4,'One','Fixture'),(2,1,2,'Two','Fixture'),(3,2,3,'Foreign','Fixture'),(4,1,4,'Canonical','Fixture');
      INSERT INTO family_member(family_id,member_id,is_active) VALUES(4,1,TRUE),(2,2,TRUE),(3,3,TRUE),(2,4,TRUE);
      INSERT INTO family_billing_account(id,family_id) VALUES(1,1),(2,2),(3,3);
      INSERT INTO scheduling_form(id,title) VALUES(1,'Fixture');
      INSERT INTO scheduling_slot_group(id,form_id,max_participants) VALUES(1,1,12);
      INSERT INTO scheduling_signup(id,form_id,slot_group_id,member_id,status,enrollment_start_date,cancel_effective_date) VALUES
        (1,1,1,1,'cancelled','2026-02-01','2026-03-01'),(2,1,1,2,'confirmed','2026-02-01',NULL),
        (3,1,1,3,'confirmed','2025-12-01',NULL),(4,1,1,4,'confirmed','2026-02-01',NULL);
      INSERT INTO billing_subscription(id,family_billing_account_id,member_id,source_id,description,monthly_amount_cents,status) VALUES(1,1,1,1,'Original family enrollment',1000,'cancelled');
      INSERT INTO jackrabbit_history_record(facility_id,organization_id,record_kind,source_id,family_id,member_id,source_data) VALUES
        (1,'fixture','enrollment','one',1,1,'{"Enroll Date":"2025-12-01","Drop Date":"2026-02-01"}'),
        (1,'fixture','enrollment','two',1,1,'{"Enroll Date":"2025-12-01","Drop Date":"2026-02-01"}'),
        (2,'fixture','enrollment','foreign',3,3,'{"Enroll Date":"2025-11-01"}');
      INSERT INTO billing_payment(id,family_billing_account_id,amount_cents,method) VALUES(1,1,1000,'cash');
    `)
    const fingerprint = async () => (await pool.query(`SELECT md5(string_agg(value::text,'|' ORDER BY value::text)) AS hash FROM (
      SELECT to_jsonb(t) AS value FROM billing_payment t UNION ALL SELECT to_jsonb(t) FROM billing_subscription t
      UNION ALL SELECT to_jsonb(t) FROM family_billing_account t UNION ALL SELECT to_jsonb(t) FROM jackrabbit_history_record t
      UNION ALL SELECT to_jsonb(t) FROM scheduling_signup t UNION ALL SELECT to_jsonb(t) FROM billing_account_activity t) facts`)).rows[0].hash
    await pool.query(`INSERT INTO billing_subscription(id,family_billing_account_id,member_id,source_id,description,monthly_amount_cents,net_monthly_cents,status,start_date)
      VALUES(2,2,2,'2','Tuition',16000,15000,'active','2026-02-01'),(3,2,4,'4','Tuition',10000,5000,'active','2026-02-01'),
      (4,3,3,'3','Foreign',999999,999999,'active','2025-12-01');`)
    const initialSpend = await saveMarketingSpend(pool,1,1,'2026-02',{amountCents:30000,version:0})
    assert.equal(initialSpend.version,1)
    await assert.rejects(saveMarketingSpend(pool,1,1,'2026-02',{amountCents:90000,version:0}),error=>error.statusCode===409)
    await saveMarketingSpend(pool,2,3,'2026-02',{amountCents:999999,version:0})
    const before = await fingerprint(), queries = []
    const tracked = { connect: async () => {
      const client = await pool.connect()
      return { query: async (sql, params) => {
        queries.push(sql)
        if (sql.includes('new-admin:enrollment-trend')) assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on')
        return client.query(sql, params)
      }, release: () => client.release() }
    } }
    const data = await loadEnrollmentTrend(tracked, 1, new Date('2026-04-15T12:00:00Z'))
    assert.equal(data.months[0].openingFamilies, 1)
    assert.equal(data.months[1].newFamilies, 1) // canonical membership beats stale member.family_id
    assert.equal(data.months[1].canceledFamilies, 0) // import handed off to original billed household
    assert.equal(data.months[2].openingFamilies, 2)
    assert.equal(data.months[2].canceledFamilies, 1)
    assert.equal(data.months[2].lossRate, 50)
    assert.equal(data.studentMonths[2].openingStudents, 3)
    assert.equal(data.studentSummary.lastMonthLossRate, 33.33)
    assert.equal(data.studentSummary.threeMonthLossRate, 33.33 / 3)
    assert.equal(data.studentSummary.twelveMonthLossRate, 33.33 / 3)
    assert.equal(data.studentSummary.twelveMonthRateMonths, 3)
    assert.equal(queries.filter(q => q.includes('new-admin:enrollment-trend')).length, 1)
    const empty = await loadEnrollmentTrend(pool, 999999, new Date('2026-04-15T12:00:00Z'))
    assert.ok(empty.months.every(row => row.newFamilies === null))
    const foreign = await loadEnrollmentTrend(pool, 2, new Date('2026-04-15T12:00:00Z'))
    assert.equal(foreign.months[0].openingFamilies, 1)
    assert.equal(foreign.months[1].newFamilies, 0)
    const financial = await loadEnrollmentTrend(pool,1,new Date('2026-04-15T12:00:00Z'),{canViewFinancial:true})
    assert.equal(financial.current.students,2)
    assert.equal(financial.current.families,1)
    assert.equal(financial.current.studentsPerFamily,2)
    assert.equal(financial.current.membership.averageMembershipCents,10000)
    assert.equal(financial.acquisition.cacCents,30000)
    assert.equal(financial.acquisition.includedMonths,1)
    assert.equal(financial.acquisition.totalSpendCents,30000)
    const cleared = await saveMarketingSpend(pool,1,1,'2026-02',{amountCents:null,version:1})
    assert.equal(cleared.version,2)
    const afterClear = await loadEnrollmentTrend(pool,1,new Date('2026-04-15T12:00:00Z'),{canViewFinancial:true})
    assert.equal(afterClear.acquisition.cacCents,null)
    await assert.rejects(saveMarketingSpend(pool,1,1,'2026-02',{amountCents:5000,version:1}),error=>error.statusCode===409)
    const zero = await saveMarketingSpend(pool,1,1,'2026-02',{amountCents:0,version:2})
    assert.equal(zero.amountCents,0)
    assert.equal(await fingerprint(), before)
  } finally {
    await pool.end()
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`)
    await admin.end()
  }
})
