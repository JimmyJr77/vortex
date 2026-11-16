import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../../newAdmin/migrationAudit.js'
import { listAccountingLines, listAccountingPayments } from '../../billing/accountingReport.js'
import { deleteArchivedMember } from '../memberDeletion.js'
import { deleteArchivedFamily } from '../familyDeletion.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('normal archive deletion preserves financial records and other identities', { skip: !connectionString }, async t => {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    const commands = { BEGIN: 'SAVEPOINT account_deletion', COMMIT: 'RELEASE SAVEPOINT account_deletion', ROLLBACK: 'ROLLBACK TO SAVEPOINT account_deletion' }
    const pool = { async connect() { return { query: (sql, values) => db.query(commands[sql] || sql, values), release() {} } } }
    const row = async (sql, values = []) => (await db.query(sql, values)).rows[0]
    const facilityId = (await row("INSERT INTO facility(name) VALUES('Archive safety fixture') RETURNING id")).id
    const waiverId = (await row("INSERT INTO waiver_template(facility_id,name,version,body) VALUES($1,'Safety waiver','1','Fixture') RETURNING id", [facilityId])).id
    const formId = (await row("INSERT INTO scheduling_form(title) VALUES('Archive safety class') RETURNING id")).id
    const rowsOf = async (table, predicate = 'TRUE', values = []) => (await db.query(
      `SELECT to_jsonb(record) AS row FROM ${table} record WHERE ${predicate} ORDER BY to_jsonb(record)::text`, values,
    )).rows
    const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
    const household = async ({ archived = true, children = 0, payer = false } = {}) => {
      const family = await row("INSERT INTO family(facility_id,family_name,archived) VALUES($1,'Safety household',$2) RETURNING *", [facilityId, archived])
      const login = await row("INSERT INTO app_user(facility_id,role,email,full_name) VALUES($1,'MEMBER_ATHLETE',$2,'Safety Parent') RETURNING *", [facilityId, `${randomUUID()}@example.test`])
      const people = []
      for (let index = 0; index <= children; index++) {
        const member = await row(`INSERT INTO member(facility_id,family_id,app_user_id,first_name,last_name,date_of_birth,is_active)
          VALUES($1,$2,$3,$4,'Fixture',$5,$6) RETURNING *`,
        [facilityId, family.id, index === 0 ? login.id : null, index === 0 ? 'Parent' : 'Child', index === 0 ? '1990-01-01' : '2016-01-01', !archived])
        await db.query('INSERT INTO family_member(family_id,member_id,is_active) VALUES($1,$2,TRUE)', [family.id, member.id])
        people.push(member)
      }
      const account = await row('INSERT INTO family_billing_account(family_id,payer_member_id,household_monthly_billing_enabled) VALUES($1,$2,FALSE) RETURNING *', [family.id, payer ? people[0].id : null])
      return { family, login, people, account }
    }
    const signupFor = async (memberId, inviteId = null) => row(`INSERT INTO scheduling_signup(form_id,member_id,first_name,last_name,email,status,account_invite_id)
      VALUES($1,$2,'Safety','Fixture','safety@example.test','pending_setup',$3) RETURNING *`, [formId, memberId, inviteId])
    const leadFor = async (memberId, convertedId = memberId) => row(`INSERT INTO registrations(facility_id,first_name,last_name,email,member_id,converted_member_id,archived)
      VALUES($1,'Safety','Inquiry',$2,$3,$4,TRUE) RETURNING *`, [facilityId, `${randomUUID()}@example.test`, memberId, convertedId])
    const inviteFor = async (leadId, payload = {}) => row(`INSERT INTO account_invite(facility_id,registration_id,token_hash,invitee_email,expires_at,used_at,pending_payload)
      VALUES($1,$2,$3,'safety@example.test',now()+interval '1 day',now(),$4::jsonb) RETURNING *`, [facilityId, leadId, randomUUID(), JSON.stringify(payload)])
    const progressFor = async (accountId, status, result) => {
      const runId = randomUUID()
      await db.query("INSERT INTO billing_recurring_run(id,as_of,collect_payments,status) VALUES($1,now(),FALSE,'completed')", [runId])
      await db.query(`INSERT INTO billing_recurring_account_progress(run_id,family_billing_account_id,phase,status,result)
        VALUES($1,$2,'preparation',$3,$4::jsonb)`, [runId, accountId, status, JSON.stringify(result)])
      return runId
    }
    const deletion = (kind, target) => kind === 'family'
      ? deleteArchivedFamily(pool, { facilityId, familyId: target.family.id })
      : deleteArchivedMember(pool, { facilityId, memberId: target.people[0].id })
    const rejected = async operation => assert.rejects(operation, error => error.statusCode === 409)
    const scenario = async (name, run) => t.test(name, async () => {
      await db.query('SAVEPOINT safety_scenario')
      try { await run() } finally {
        await db.query('ROLLBACK TO SAVEPOINT safety_scenario')
        await db.query('RELEASE SAVEPOINT safety_scenario')
      }
    })

    for (const status of ['pending', 'failed']) await scenario(`${status} payments prevent family deletion and retain the complete payment`, async () => {
      const target = await household()
      const payment = await row("INSERT INTO billing_payment(family_billing_account_id,amount_cents,method,external_status) VALUES($1,2500,'card',$2) RETURNING id", [target.account.id, status])
      const before = await rowsOf('billing_payment', 'id=$1', [payment.id])
      await rejected(deletion('family', target))
      assert.deepEqual(await rowsOf('billing_payment', 'id=$1', [payment.id]), before)
      assert.equal((await rowsOf('family', 'id=$1', [target.family.id])).length, 1)
      assert.equal((await rowsOf('member', 'id=$1', [target.people[0].id])).length, 1)
    })

    await scenario('an active billing collector prevents account deletion', async () => {
      const target = await household()
      const collector = new pg.Client({ connectionString })
      await collector.connect()
      const key = `household-monthly-invoice:${target.account.id}`
      try {
        await collector.query('SELECT pg_advisory_lock(hashtextextended($1::text,0))', [key])
        const before = await rowsOf('family_billing_account', 'id=$1', [target.account.id])
        await assert.rejects(deletion('family', target), error => error.statusCode === 409 && /currently processing/.test(error.message))
        assert.deepEqual(await rowsOf('family_billing_account', 'id=$1', [target.account.id]), before)
        assert.equal((await rowsOf('family', 'id=$1', [target.family.id])).length, 1)
      } finally {
        await collector.query('SELECT pg_advisory_unlock(hashtextextended($1::text,0))', [key]).catch(() => {})
        await collector.end()
      }
    })

    for (const amount of [0, 2500]) for (const kind of ['member', 'family']) await scenario(`${kind} deletion retains ${amount === 0 ? 'zero-value' : 'unpaid'} charges`, async () => {
      const target = await household()
      const charge = await row(`INSERT INTO billing_charge(family_billing_account_id,member_id,description,amount_cents,collection_status)
        VALUES($1,$2,'Preserve charge evidence',$3,'unpaid') RETURNING id`, [target.account.id, target.people[0].id, amount])
      const before = await rowsOf('billing_charge', 'id=$1', [charge.id])
      const projection = await rowsOf('account_charge', 'id=$1', [charge.id])
      await rejected(deletion(kind, target))
      assert.deepEqual(await rowsOf('billing_charge', 'id=$1', [charge.id]), before)
      assert.deepEqual(await rowsOf('account_charge', 'id=$1', [charge.id]), projection)
      assert.equal((await rowsOf('member', 'id=$1', [target.people[0].id])).length, 1)
    })

    await scenario('an inquiry converted to another person prevents member deletion', async () => {
      const target = await household(), real = await household({ archived: false })
      const lead = await leadFor(target.people[0].id, real.people[0].id)
      const before = await rowsOf('registrations', 'id=$1', [lead.id])
      const realBefore = await rowsOf('member', 'id=$1', [real.people[0].id])
      await rejected(deletion('member', target))
      assert.deepEqual(await rowsOf('registrations', 'id=$1', [lead.id]), before)
      assert.deepEqual(await rowsOf('member', 'id=$1', [real.people[0].id]), realBefore)
    })

    await scenario('a shared invitation cannot detach or modify another member’s signup', async () => {
      const target = await household(), real = await household({ archived: false })
      const lead = await leadFor(target.people[0].id)
      const invite = await inviteFor(lead.id)
      const signup = await signupFor(real.people[0].id, invite.id)
      const before = await rowsOf('scheduling_signup', 'id=$1', [signup.id])
      const inviteBefore = await rowsOf('account_invite', 'id=$1', [invite.id])
      await rejected(deletion('family', target))
      assert.deepEqual(await rowsOf('scheduling_signup', 'id=$1', [signup.id]), before)
      assert.deepEqual(await rowsOf('account_invite', 'id=$1', [invite.id]), inviteBefore)
    })

    for (const kind of ['member', 'family']) await scenario(`${kind} deletion retains its pending signup linked to another household’s invitation`, async () => {
      const target = await household(), real = await household({ archived: false })
      const lead = await leadFor(real.people[0].id)
      const invite = await inviteFor(lead.id, { result: { familyId: Number(real.family.id), memberIds: [Number(real.people[0].id)] } })
      const signup = await signupFor(target.people[0].id, invite.id)
      const before = {
        invite: await rowsOf('account_invite', 'id=$1', [invite.id]),
        signup: await rowsOf('scheduling_signup', 'id=$1', [signup.id]),
        enrollment: await rowsOf('account_enrollment', 'id=$1', [signup.id]),
        realLead: await rowsOf('registrations', 'id=$1', [lead.id]),
      }
      await rejected(deletion(kind, target))
      assert.deepEqual({
        invite: await rowsOf('account_invite', 'id=$1', [invite.id]),
        signup: await rowsOf('scheduling_signup', 'id=$1', [signup.id]),
        enrollment: await rowsOf('account_enrollment', 'id=$1', [signup.id]),
        realLead: await rowsOf('registrations', 'id=$1', [lead.id]),
      }, before)
      assert.equal((await rowsOf('member', 'id=$1', [target.people[0].id])).length, 1)
    })

    const invitationReferences = [
      ['member', 'memberIds', ids => ({ memberIds: [Number(ids.member)] })],
      ['family', 'memberIds', ids => ({ memberIds: [String(ids.member)] })],
      ['member', 'payerMemberId', ids => ({ payerMemberId: Number(ids.member) })],
      ['family', 'loginMemberId', ids => ({ loginMemberId: Number(ids.member) })],
      ['member', 'pendingEnrollments.memberId', ids => ({ pendingEnrollments: [{ memberId: Number(ids.member) }] })],
      ['family', 'pendingEnrollments.signupId', ids => ({ pendingEnrollments: [{ signupId: String(ids.signup) }] })],
      ['family', 'familyId', ids => ({ familyId: Number(ids.family) })],
      ['member', 'malformed scalar memberIds', ids => ({ memberIds: String(ids.member) })],
      ['family', 'malformed object pendingEnrollments', ids => ({ pendingEnrollments: { memberId: Number(ids.member) } })],
    ]
    for (const [kind, name, makeResult] of invitationReferences) await scenario(`${kind} deletion retains identities referenced only in another invitation’s ${name}`, async () => {
      const target = await household(), real = await household({ archived: false })
      const signup = await signupFor(target.people[0].id)
      const lead = await leadFor(real.people[0].id)
      const invite = await inviteFor(lead.id, { result: makeResult({ member: target.people[0].id, family: target.family.id, signup: signup.id }) })
      const snapshot = async () => ({
        invite: await rowsOf('account_invite', 'id=$1', [invite.id]),
        signup: await rowsOf('scheduling_signup', 'id=$1', [signup.id]),
        enrollment: await rowsOf('account_enrollment', 'id=$1', [signup.id]),
        member: await rowsOf('member', 'id=$1', [target.people[0].id]),
        family: await rowsOf('family', 'id=$1', [target.family.id]),
        realLead: await rowsOf('registrations', 'id=$1', [lead.id]),
      })
      const before = await snapshot()
      await rejected(deletion(kind, target))
      assert.deepEqual(await snapshot(), before)
    })

    for (const [field, value] of [['pendingEnrollments', {}], ['enrollmentReceipts', {}], ['pendingEnrollments', [null]]]) await scenario(`an invitation with malformed ${field} ${JSON.stringify(value)} remains archived`, async () => {
      const target = await household()
      const lead = await leadFor(target.people[0].id)
      const invite = await inviteFor(lead.id, { result: { familyId: Number(target.family.id), memberIds: [Number(target.people[0].id)], [field]: value } })
      const before = await rowsOf('account_invite', 'id=$1', [invite.id])
      await rejected(deletion('family', target))
      assert.deepEqual(await rowsOf('account_invite', 'id=$1', [invite.id]), before)
    })

    await scenario('an invitation result linked to another family is retained', async () => {
      const target = await household(), real = await household({ archived: false })
      const lead = await leadFor(target.people[0].id)
      const invite = await inviteFor(lead.id, { result: { familyId: Number(real.family.id), memberIds: [Number(target.people[0].id)] } })
      const before = await rowsOf('account_invite', 'id=$1', [invite.id])
      await rejected(deletion('family', target))
      assert.deepEqual(await rowsOf('account_invite', 'id=$1', [invite.id]), before)
    })

    for (const [status, result] of [['blocked', {}], ['completed', { chargesPosted: 1 }], ['completed', { result: { chargeIds: [123] } }]]) {
      await scenario(`recurring billing ${status} evidence ${JSON.stringify(result)} is retained`, async () => {
        const target = await household()
        const runId = await progressFor(target.account.id, status, result)
        const before = await rowsOf('billing_recurring_account_progress', 'run_id=$1', [runId])
        await rejected(deletion('family', target))
        assert.deepEqual(await rowsOf('billing_recurring_account_progress', 'run_id=$1', [runId]), before)
      })
    }

    for (const attribution of ['member_id', 'record_member_id', 'record_facility_id']) await scenario(`a pending enrollment projection attributed to another ${attribution} prevents deletion`, async () => {
      const target = await household(), real = await household({ archived: false })
      const signup = await signupFor(target.people[0].id)
      const otherFacilityId = (await row("INSERT INTO facility(name) VALUES('Other projection facility') RETURNING id")).id
      const otherId = attribution === 'record_facility_id' ? otherFacilityId : real.people[0].id
      await db.query(`UPDATE account_enrollment SET ${attribution}=$1 WHERE id=$2`, [otherId, signup.id])
      const projectionBefore = await rowsOf('account_enrollment', 'id=$1', [signup.id])
      assert.equal(projectionBefore.length, 1)
      const signupBefore = await rowsOf('scheduling_signup', 'id=$1', [signup.id])
      await rejected(deletion('family', target))
      assert.deepEqual(await rowsOf('account_enrollment', 'id=$1', [signup.id]), projectionBefore)
      assert.deepEqual(await rowsOf('scheduling_signup', 'id=$1', [signup.id]), signupBefore)
    })

    for (const evidence of ['guardian', 'waiver']) await scenario(`an archived child outside the deletion retains ${evidence} evidence`, async () => {
      const target = await household(), real = await household({ children: 1 })
      const child = real.people[1]
      const table = evidence === 'guardian' ? 'parent_guardian_authority' : 'member_waiver_acceptance'
      const record = evidence === 'guardian'
        ? await row('INSERT INTO parent_guardian_authority(parent_member_id,child_member_id,has_legal_authority) VALUES($1,$2,TRUE) RETURNING id', [target.people[0].id, child.id])
        : await row('INSERT INTO member_waiver_acceptance(member_id,waiver_template_id,accepted_by_member_id) VALUES($1,$2,$3) RETURNING id', [child.id, waiverId, target.people[0].id])
      const before = await rowsOf(table, 'id=$1', [record.id])
      await rejected(deletion('member', target))
      assert.deepEqual(await rowsOf(table, 'id=$1', [record.id]), before)
      assert.equal((await rowsOf('member', 'id=$1', [child.id])).length, 1)
    })

    for (const action of ['CASCADE', 'SET NULL']) await scenario(`an unknown ${action} dependency prevents member deletion`, async () => {
      const target = await household()
      const table = `public.archive_reference_${randomUUID().replaceAll('-', '')}`
      await db.query(`CREATE TABLE ${table}(id integer PRIMARY KEY,person bigint REFERENCES member(id) ON DELETE ${action},evidence text NOT NULL)`)
      await db.query(`INSERT INTO ${table} VALUES(1,$1,'Retained evidence')`, [target.people[0].id])
      const before = await rowsOf(table)
      await rejected(deletion('member', target))
      assert.deepEqual(await rowsOf(table), before)
    })

    await scenario('an unconstrained logical member reference prevents deletion', async () => {
      const target = await household()
      const table = `public.archive_logical_${randomUUID().replaceAll('-', '')}`
      await db.query(`CREATE TABLE ${table}(id integer PRIMARY KEY,member_id bigint,evidence text NOT NULL)`)
      await db.query(`INSERT INTO ${table} VALUES(1,$1,'Logical reference without FK')`, [target.people[0].id])
      const before = await rowsOf(table)
      await rejected(deletion('member', target))
      assert.deepEqual(await rowsOf(table), before)
    })

    await scenario('an empty archived member can be removed while its family and billing account remain intact', async () => {
      const target = await household()
      const familyBefore = await rowsOf('family', 'id=$1', [target.family.id])
      const accountBefore = await rowsOf('family_billing_account', 'id=$1', [target.account.id])
      await deletion('member', target)
      assert.equal((await rowsOf('member', 'id=$1', [target.people[0].id])).length, 0)
      assert.equal((await rowsOf('app_user', 'id=$1', [target.login.id])).length, 0)
      assert.deepEqual(await rowsOf('family', 'id=$1', [target.family.id]), familyBefore)
      assert.deepEqual(await rowsOf('family_billing_account', 'id=$1', [target.account.id]), accountBefore)
    })

    await scenario('empty setup family deletion preserves the other household and accounting', async () => {
      const target = await household({ children: 1, payer: true }), real = await household({ archived: false, children: 1, payer: true })
      const targetIds = target.people.map(person => person.id)
      const realIds = real.people.map(person => person.id)
      await db.query('INSERT INTO parent_guardian_authority(parent_member_id,child_member_id,has_legal_authority) VALUES($1,$2,TRUE)', [targetIds[0], targetIds[1]])
      for (const memberId of targetIds) await db.query('INSERT INTO member_waiver_acceptance(member_id,waiver_template_id,accepted_by_member_id) VALUES($1,$2,$3)', [memberId, waiverId, targetIds[0]])
      const lead = await leadFor(targetIds[0])
      const invite = await inviteFor(lead.id, { result: { familyId: Number(target.family.id), memberIds: targetIds.map(Number) } })
      const signup = await signupFor(targetIds[1], invite.id)
      const runId = await progressFor(target.account.id, 'completed', { chargesPosted: 0, result: { actualChargeCount: 0, chargeIds: [] } })
      await db.query("INSERT INTO note(subject_type,subject_id,note_type,body) VALUES('registration',$1,'staff_note','Unused setup note')", [lead.id])
      await db.query(`INSERT INTO billing_charge(family_billing_account_id,member_id,description,amount_cents,collection_status)
        VALUES($1,$2,'Real account balance',2500,'unpaid')`, [real.account.id, realIds[1]])
      await db.query("INSERT INTO billing_payment(family_billing_account_id,amount_cents,method,external_status) VALUES($1,1000,'cash','settled')", [real.account.id])
      const realSignup = await signupFor(realIds[1])
      const snapshot = async () => {
        const result = {
          family: await rowsOf('family', 'id=$1', [real.family.id]),
          members: await rowsOf('member', 'id=ANY($1::bigint[])', [realIds]),
          login: await rowsOf('app_user', 'id=$1', [real.login.id]),
          links: await rowsOf('family_member', 'family_id=$1', [real.family.id]),
          account: await rowsOf('family_billing_account', 'id=$1', [real.account.id]),
          signup: await rowsOf('scheduling_signup', 'id=$1', [realSignup.id]),
          enrollment: await rowsOf('account_enrollment', 'id=$1', [realSignup.id]),
        }
        for (const table of ['billing_charge', 'billing_payment', 'billing_refund', 'billing_subscription', 'billing_payment_application',
          'billing_monthly_invoice', 'billing_monthly_invoice_line', 'billing_account_activity', 'account_charge', 'account_payment', 'account_refund']) {
          result[table] = digest(await rowsOf(table))
        }
        const { generatedAt: linesAt, ...lines } = await listAccountingLines(db, { facilityId, exportLimit: 10000 })
        const { generatedAt: paymentsAt, ...payments } = await listAccountingPayments(db, { facilityId, exportLimit: 10000 })
        assert.equal(lines.rows.length, lines.total)
        assert.equal(payments.rows.length, payments.total)
        return { ...result, lines, payments }
      }
      const before = await snapshot()
      await deletion('family', target)
      assert.deepEqual(await snapshot(), before)
      for (const [table, predicate, values] of [
        ['family', 'id=$1', [target.family.id]], ['member', 'id=ANY($1::bigint[])', [targetIds]],
        ['app_user', 'id=$1', [target.login.id]], ['family_billing_account', 'id=$1', [target.account.id]],
        ['scheduling_signup', 'id=$1', [signup.id]], ['account_enrollment', 'id=$1', [signup.id]],
        ['account_invite', 'id=$1', [invite.id]], ['registrations', 'id=$1', [lead.id]],
        ['member_waiver_acceptance', 'member_id=ANY($1::bigint[])', [targetIds]],
        ['billing_recurring_account_progress', 'run_id=$1', [runId]],
      ]) assert.equal((await rowsOf(table, predicate, values)).length, 0, `${table} retained deleted setup`)
      assert.equal((await rowsOf('billing_recurring_run', 'id=$1', [runId])).length, 1)
    })
  } finally {
    await db.query('ROLLBACK').catch(() => {})
    await db.end()
  }
})
