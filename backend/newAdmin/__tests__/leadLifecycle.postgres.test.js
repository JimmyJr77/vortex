import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import test from 'node:test'
import pg from 'pg'
import { validateRehearsalDatabaseUrl } from '../migrationAudit.js'
import { changeLeadLifecycle } from '../leadLifecycle.js'
import { openLeadRegistration } from '../leadRegistration.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) validateRehearsalDatabaseUrl(connectionString, { nodeEnv: 'development' })

test('inquiry deletion preserves real member, enrollment, financial, and completed invitation records', { skip: !connectionString }, async () => {
  const db = new pg.Client({ connectionString })
  await db.connect()
  try {
    await db.query('BEGIN')
    const commands = { BEGIN: 'SAVEPOINT lead_deletion', COMMIT: 'RELEASE SAVEPOINT lead_deletion', ROLLBACK: 'ROLLBACK TO SAVEPOINT lead_deletion' }
    const pool = { async connect() { return { query: (sql, args) => db.query(commands[sql] || sql, args), release() {} } } }
    const one = async (sql, args = []) => (await db.query(sql, args)).rows[0]
    const facility = await one("INSERT INTO facility(name) VALUES('Inquiry deletion fixture') RETURNING id")
    const other = await one("INSERT INTO facility(name) VALUES('Other inquiry facility') RETURNING id")
    const family = await one("INSERT INTO family(facility_id,family_name) VALUES($1,'Real household') RETURNING id", [facility.id])
    const member = await one("INSERT INTO member(facility_id,family_id,first_name,last_name,is_active) VALUES($1,$2,'Real','Member',TRUE) RETURNING id", [facility.id, family.id])
    await db.query('INSERT INTO family_member(family_id,member_id,is_active) VALUES($1,$2,TRUE)', [family.id, member.id])
    const account = await one('INSERT INTO family_billing_account(family_id,payer_member_id) VALUES($1,$2) RETURNING id', [family.id, member.id])
    const charge = await one("INSERT INTO billing_charge(family_billing_account_id,member_id,description,amount_cents) VALUES($1,$2,'Real tuition',12000) RETURNING id", [account.id, member.id])
    const payment = await one("INSERT INTO billing_payment(family_billing_account_id,amount_cents,method) VALUES($1,12000,'cash') RETURNING id", [account.id])
    const email = `lead-delete-${randomUUID()}@example.test`
    const lead = await one("INSERT INTO registrations(facility_id,first_name,last_name,email,member_id,converted_member_id,archived) VALUES($1,'Old','Inquiry',$2,$3,$3,TRUE) RETURNING id", [facility.id, email, member.id])
    const invite = await one("INSERT INTO account_invite(facility_id,registration_id,invite_type,token_hash,invitee_email,expires_at,used_at,pending_payload) VALUES($1,$2,'lead_registration',$3,$4,now()+interval '1 day',now(),$5::jsonb) RETURNING id", [facility.id, lead.id, randomUUID(), email, JSON.stringify({ result: { payerMemberId: member.id, familyId: family.id } })])
    const form = await one("INSERT INTO scheduling_form(title) VALUES('Real class') RETURNING id")
    const signup = await one("INSERT INTO scheduling_signup(form_id,member_id,first_name,last_name,email,status,account_invite_id) VALUES($1,$2,'Real','Member',$3,'confirmed',$4) RETURNING id", [form.id, member.id, email, invite.id])
    const note = await one("INSERT INTO note(subject_type,subject_id,note_type,author_kind,body) VALUES('registration',$1,'staff_note','admin','Old inquiry note') RETURNING id", [lead.id])
    const realNote = await one("INSERT INTO note(subject_type,subject_id,note_type,author_kind,body) VALUES('member',$1,'staff_note','admin','Retain this member note') RETURNING id", [member.id])
    await db.query('INSERT INTO new_admin_lead_ownership_audit(batch_id,registration_id,new_facility_id) VALUES($1,$2,$3)', [randomUUID(), lead.id, facility.id])
    const attribution = await one("INSERT INTO utm_attribution(visitor_id,inquiry_id,touch_type,source) VALUES($1,$2,'first','fixture') RETURNING id", [randomUUID(), lead.id])
    const identity = await one("INSERT INTO visitor_identities(visitor_id,inquiry_id,member_id,link_method) VALUES($1,$2,$3,'fixture') RETURNING id", [randomUUID(), lead.id, member.id])
    const protectedRows = [
      ['member',member.id], ['family',family.id], ['family_billing_account',account.id],
      ['billing_charge',charge.id], ['billing_payment',payment.id], ['account_charge',charge.id], ['account_payment',payment.id],
      ['scheduling_signup',signup.id], ['account_enrollment',signup.id], ['note',realNote.id],
    ]
    const snapshot = async () => Promise.all(protectedRows.map(async ([table,key]) => (await one(`SELECT to_jsonb(t) AS row FROM ${table} t WHERE id=$1`, [key])).row))
    const before = await snapshot()
    const inviteBefore = (await one('SELECT to_jsonb(i) AS row FROM account_invite i WHERE id=$1', [invite.id])).row
    const analyticsBefore = await Promise.all([['utm_attribution',attribution.id],['visitor_identities',identity.id]].map(async ([table,key]) => (await one(`SELECT to_jsonb(t)-'inquiry_id' AS row FROM ${table} t WHERE id=$1`, [key])).row))
    await assert.rejects(changeLeadLifecycle(pool, other.id, lead.id, 'delete'), { statusCode:404 })
    await changeLeadLifecycle(pool, facility.id, lead.id, 'delete')
    assert.deepEqual(await snapshot(), before)
    assert.equal((await db.query('SELECT 1 FROM registrations WHERE id=$1', [lead.id])).rowCount, 0)
    assert.equal((await db.query('SELECT 1 FROM note WHERE id=$1', [note.id])).rowCount, 0)
    assert.equal((await db.query('SELECT 1 FROM new_admin_lead_ownership_audit WHERE registration_id=$1', [lead.id])).rowCount, 0)
    assert.deepEqual((await one('SELECT to_jsonb(i) AS row FROM account_invite i WHERE id=$1', [invite.id])).row, { ...inviteBefore, registration_id:null })
    for (const [index,[table,key]] of [['utm_attribution',attribution.id],['visitor_identities',identity.id]].entries()) {
      const retained = await one(`SELECT to_jsonb(t)-'inquiry_id' AS row,inquiry_id FROM ${table} t WHERE id=$1`, [key])
      assert.equal(retained.inquiry_id,null); assert.deepEqual(retained.row,analyticsBefore[index])
    }

    const heldLead = await one("INSERT INTO registrations(facility_id,first_name,last_name,email,archived) VALUES($1,'Pending','Inquiry',$2,TRUE) RETURNING id", [facility.id,`held-${email}`])
    const heldInvite = await one("INSERT INTO account_invite(facility_id,registration_id,invite_type,token_hash,invitee_email,expires_at) VALUES($1,$2,'lead_registration',$3,$4,now()+interval '1 day') RETURNING id", [facility.id,heldLead.id,randomUUID(),`held-${email}`])
    const hold = await one("INSERT INTO scheduling_signup(form_id,first_name,last_name,email,status,account_invite_id) VALUES($1,'Pending','Child',$2,'pending_setup',$3) RETURNING id", [form.id,`held-${email}`,heldInvite.id])
    const holdBefore = (await one('SELECT to_jsonb(s) AS row FROM scheduling_signup s WHERE id=$1', [hold.id])).row
    await assert.rejects(changeLeadLifecycle(pool,facility.id,heldLead.id,'delete'), /unfinished account registration or class reservation/)
    assert.deepEqual((await one('SELECT to_jsonb(s) AS row FROM scheduling_signup s WHERE id=$1', [hold.id])).row,holdBefore)
    assert.equal((await one('SELECT registration_id FROM account_invite WHERE id=$1', [heldInvite.id])).registration_id,heldLead.id)
    assert.equal((await db.query('SELECT 1 FROM registrations WHERE id=$1', [heldLead.id])).rowCount,1)

    const unusedLead = await one("INSERT INTO registrations(facility_id,first_name,last_name,email,archived) VALUES($1,'Unused','Inquiry',$2,TRUE) RETURNING id", [facility.id,`unused-${email}`])
    const token=randomUUID(),digest=createHash('sha256').update(token).digest('hex')
    const unusedInvite = await one("INSERT INTO account_invite(facility_id,registration_id,invite_type,token_hash,invitee_email,expires_at) VALUES($1,$2,'lead_registration',$3,$4,now()+interval '1 day') RETURNING id", [facility.id,unusedLead.id,digest,`unused-${email}`])
    await changeLeadLifecycle(pool,facility.id,unusedLead.id,'delete')
    assert.equal((await db.query('SELECT 1 FROM account_invite WHERE id=$1', [unusedInvite.id])).rowCount,0)
    await assert.rejects(openLeadRegistration(db,unusedInvite.id,{token}),{statusCode:404})

    // A new foreign-key dependency must not silently cascade into an unrelated
    // record. The completed invitation backlink also rolls back on this error.
    const protectedLead=await one("INSERT INTO registrations(facility_id,first_name,last_name,email,converted_member_id,archived) VALUES($1,'Protected','Inquiry',$2,$3,TRUE) RETURNING id", [facility.id,`protected-${email}`,member.id])
    const protectedInvite=await one("INSERT INTO account_invite(facility_id,registration_id,token_hash,invitee_email,expires_at,used_at) VALUES($1,$2,$3,$4,now()+interval '1 day',now()) RETURNING id", [facility.id,protectedLead.id,randomUUID(),`protected-${email}`])
    const guardTable=`lead_delete_guard_${randomUUID().replaceAll('-','')}`
    await db.query(`CREATE TABLE ${guardTable}(id bigint PRIMARY KEY,registration_id integer REFERENCES registrations(id) ON DELETE CASCADE)`)
    await db.query(`INSERT INTO ${guardTable} VALUES(1,$1)`,[protectedLead.id])
    await assert.rejects(changeLeadLifecycle(pool,facility.id,protectedLead.id,'delete'),{statusCode:409})
    assert.equal((await one('SELECT registration_id FROM account_invite WHERE id=$1',[protectedInvite.id])).registration_id,protectedLead.id)
    assert.equal((await db.query(`SELECT 1 FROM ${guardTable} WHERE id=1`)).rowCount,1)
    assert.deepEqual(await snapshot(),before)
  } finally { await db.query('ROLLBACK'); await db.end() }
})
