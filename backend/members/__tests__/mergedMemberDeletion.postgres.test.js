import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import fs from 'node:fs/promises'
import test from 'node:test'
import pg from 'pg'
import {validateRehearsalDatabaseUrl} from '../../newAdmin/migrationAudit.js'
import {recordBillingActivity} from '../../billing/billingActivity.js'
import {listCustomerBillingActivity} from '../../billing/customerBillingQueries.js'
import {tryDeleteMergedMember} from '../mergedMemberDeletion.js'

const connectionString=process.env.NEW_ADMIN_TEST_DATABASE_URL
if(connectionString) validateRehearsalDatabaseUrl(connectionString,{nodeEnv:'development'})
const query=async(db,sql,params=[]) => (await db.query(sql,params)).rows

async function fixture(db) {
  const facility=(await query(db,"INSERT INTO facility(name) VALUES('Merged duplicate deletion fixture') RETURNING id"))[0]
  const family=(await query(db,"INSERT INTO family(facility_id,family_name) VALUES($1,'Preserved real household') RETURNING id",[facility.id]))[0]
  const login=(await query(db,"INSERT INTO app_user(facility_id,full_name,email,role) VALUES($1,'Surviving Person',$2,'MEMBER_ATHLETE') RETURNING id",[facility.id,`${randomUUID()}@example.test`]))[0]
  const survivor=(await query(db,"INSERT INTO member(facility_id,app_user_id,first_name,last_name,is_active) VALUES($1,$2,'Surviving','Person',TRUE) RETURNING id",[facility.id,login.id]))[0]
  await db.query('INSERT INTO family_member(family_id,member_id,is_active) VALUES($1,$2,TRUE)',[family.id,survivor.id])
  const account=(await query(db,'INSERT INTO family_billing_account(family_id,payer_member_id) VALUES($1,$2) RETURNING id',[family.id,survivor.id]))[0]
  const source=(await query(db,"INSERT INTO member(facility_id,first_name,last_name,is_active,signup_source) VALUES($1,'Imported','Alias',FALSE,'jackrabbit_history_merged') RETURNING id",[facility.id]))[0]
  await db.query('INSERT INTO family_member(family_id,member_id,is_active) VALUES($1,$2,FALSE)',[family.id,source.id])
  await db.query('UPDATE member_drop_in_entitlement SET lifetime_trial_granted=0 WHERE member_id=$1',[source.id])
  const organization=`fixture-${randomUUID()}`,personKey=`person-${randomUUID()}`,transactionKey=`transaction-${randomUUID()}`
  await db.query(`INSERT INTO jackrabbit_history_record(facility_id,organization_id,record_kind,source_id,family_id,member_id,source_data)
    VALUES($1,$2,'person',$3,$4,$5,'{}')`,[facility.id,organization,personKey,family.id,survivor.id])
  await db.query(`INSERT INTO jackrabbit_history_record(facility_id,organization_id,record_kind,source_id,family_id,member_id,amount_cents,source_data)
    VALUES($1,$2,'transaction',$3,$4,$5,7500,'{"Type":"Tuition Fee","Date":"2026-08-18"}')`,[facility.id,organization,transactionKey,family.id,survivor.id])
  for(const [kind,key,eventType] of [['person',personKey,'historical_person_profile'],['transaction',transactionKey,'jackrabbit_historical_transaction']]) {
    await recordBillingActivity(db,{eventKey:`jackrabbit:${organization}:${kind}:${key}`,accountId:account.id,memberId:source.id,
      eventType,summary:`Retained ${kind} evidence`,details:{historicalOnly:true},actorType:'system'})
  }
  await recordBillingActivity(db,{eventKey:`jackrabbit:${organization}:identity-merge:${source.id}`,accountId:account.id,memberId:survivor.id,
    eventType:'historical_identity_merged',summary:'Reviewed historical identity merge',actorType:'system',
    beforeValue:{importCreatedMemberId:Number(source.id),sourceName:'Imported Alias'},
    afterValue:{memberId:Number(survivor.id),sourceSystem:'Jackrabbit',sourceProfileId:personKey},
    details:{historicalOnly:true,retiredDuplicateId:Number(source.id),canonicalProfilePreserved:true}})
  // The surviving account has real financial history. Removing the stale alias
  // must not require dropping, transferring, or altering any of these records.
  await db.query("INSERT INTO billing_charge(family_billing_account_id,member_id,description,amount_cents) VALUES($1,$2,'Preserved real charge',5000)",[account.id,survivor.id])
  await db.query("INSERT INTO billing_payment(family_billing_account_id,amount_cents,method) VALUES($1,1000,'cash')",[account.id])
  return {facility,family,login,survivor,account,source,organization,personKey,transactionKey,target:{memberId:source.id,facilityId:facility.id}}
}

async function preservedSnapshot(db,f) {
  const result={}
  for(const [table,predicate,values] of [
    ['member','id=$1',[f.survivor.id]],['app_user','id=$1',[f.login.id]],['family','id=$1',[f.family.id]],
    ['family_member','member_id=$1',[f.survivor.id]],['family_billing_account','id=$1',[f.account.id]],
    ['billing_charge','family_billing_account_id=$1',[f.account.id]],['billing_payment','family_billing_account_id=$1',[f.account.id]],
    ['jackrabbit_history_record','facility_id=$1',[f.facility.id]],['account_record_source','facility_id=$1',[f.facility.id]],
    ...['account_charge','account_payment','account_refund','account_enrollment'].map(table=>[table,'record_facility_id=$1',[f.facility.id]]),
  ]) result[table]=await query(db,`SELECT to_jsonb(t) AS row FROM ${table} t WHERE ${predicate} ORDER BY to_jsonb(t)::text`,values)
  result.displayedActivity=await listCustomerBillingActivity(db,{accountId:f.account.id,memberId:f.survivor.id})
  result.auditContent=await query(db,"SELECT to_jsonb(a)-'member_id' AS row FROM billing_account_activity a WHERE family_billing_account_id=$1 ORDER BY id",[f.account.id])
  return result
}

test('reviewed merged duplicate deletion retains real profiles, financial history and audit attribution', {skip:!connectionString},async()=>{
  const db=new pg.Client({connectionString});await db.connect()
  try {
    await db.query('BEGIN')
    await db.query(await fs.readFile(new URL('../../migrations/861_merged_member_activity_detachment.sql',import.meta.url),'utf8'))
    const f=await fixture(db),before=await preservedSnapshot(db,f)
    assert.equal(await tryDeleteMergedMember(db,f.target),true)
    assert.equal((await query(db,'SELECT id FROM member WHERE id=$1',[f.source.id])).length,0)
    assert.equal((await query(db,'SELECT member_id FROM family_member WHERE member_id=$1',[f.source.id])).length,0)
    assert.equal((await query(db,'SELECT member_id FROM member_drop_in_entitlement WHERE member_id=$1',[f.source.id])).length,0)
    assert.deepEqual(await preservedSnapshot(db,f),before)
    assert.equal(Number((await query(db,'SELECT count(*) FROM billing_account_activity WHERE family_billing_account_id=$1 AND member_id IS NULL',[f.account.id]))[0].count),2)
  } finally {await db.query('ROLLBACK').catch(()=>{});await db.end()}
})

test('merged deletion fails closed for unverified mappings, financial ownership and unrelated references', {skip:!connectionString},async t=>{
  const db=new pg.Client({connectionString});await db.connect()
  try {
    await db.query('BEGIN')
    await db.query(await fs.readFile(new URL('../../migrations/861_merged_member_activity_detachment.sql',import.meta.url),'utf8'))
    const f=await fixture(db)
    const rejects=async(name,setup,code='MERGED_MEMBER_DELETE_BLOCKED')=>t.test(name,async()=>{
      await db.query('SAVEPOINT scenario')
      try {
        await setup()
        await assert.rejects(tryDeleteMergedMember(db,f.target),{statusCode:409,...(code?{code}:{})})
      } finally {await db.query('ROLLBACK TO SAVEPOINT scenario')}
      assert.equal((await query(db,'SELECT id FROM member WHERE id=$1',[f.source.id])).length,1)
    })
    await rejects('an inactive survivor is not a safe destination',()=>db.query('UPDATE member SET is_active=FALSE WHERE id=$1',[f.survivor.id]))
    await rejects('a source household link still active is protected',()=>db.query('UPDATE family_member SET is_active=TRUE WHERE member_id=$1',[f.source.id]))
    await rejects('remaining source credits are protected',()=>db.query('UPDATE member_drop_in_entitlement SET admin_credits_granted=1 WHERE member_id=$1',[f.source.id]))
    await rejects('missing person source mapping is protected',()=>db.query("UPDATE account_record_source SET deleted=TRUE WHERE facility_id=$1 AND record_kind='person'",[f.facility.id]))
    await rejects('source accounting projection still owns evidence',()=>db.query("UPDATE account_charge SET record_member_id=$1 WHERE record_facility_id=$2 AND record_source='jackrabbit'",[f.source.id,f.facility.id]))
    await rejects('an ordinary audit event cannot be detached',()=>recordBillingActivity(db,{accountId:f.account.id,memberId:f.source.id,eventType:'manual_note',summary:'Not imported source history',actorType:'system'}))
    await rejects('a new native charge prevents deletion',()=>db.query("INSERT INTO billing_charge(family_billing_account_id,member_id,description,amount_cents) VALUES($1,$2,'Must remain',2000)",[f.account.id,f.source.id]),null)
    await rejects('waiver signed for a surviving member prevents deletion',async()=>{
      const waiver=(await query(db,"INSERT INTO waiver_template(facility_id,name,version,body) VALUES($1,'Retain signer','1','Evidence') RETURNING id",[f.facility.id]))[0]
      await db.query('INSERT INTO member_waiver_acceptance(member_id,waiver_template_id,accepted_by_member_id) VALUES($1,$2,$3)',[f.survivor.id,waiver.id,f.source.id])
    },null)
    await t.test('similar identity without reviewed merge is not auto-merged',async()=>{
      await db.query('SAVEPOINT ordinary')
      await db.query("UPDATE member SET signup_source='family_signup' WHERE id=$1",[f.source.id])
      assert.equal(await tryDeleteMergedMember(db,f.target),false)
      await db.query('ROLLBACK TO SAVEPOINT ordinary')
    })
  } finally {await db.query('ROLLBACK').catch(()=>{});await db.end()}
})

test('activity database guard permits only verified FK detachment, never audit edits or deletion', {skip:!connectionString},async t=>{
  const db=new pg.Client({connectionString});await db.connect()
  try {
    await db.query('BEGIN')
    await db.query(await fs.readFile(new URL('../../migrations/861_merged_member_activity_detachment.sql',import.meta.url),'utf8'))
    const f=await fixture(db)
    for(const [name,sql] of [
      ['manual pointer clearing', 'UPDATE billing_account_activity SET member_id=NULL WHERE member_id=$1'],
      ['content mutation', "UPDATE billing_account_activity SET summary='Changed' WHERE member_id=$1"],
      ['event deletion', 'DELETE FROM billing_account_activity WHERE member_id=$1'],
    ]) await t.test(name,async()=>{
      await db.query('SAVEPOINT guard_test')
      await assert.rejects(db.query(sql,[f.source.id]),/append-only/)
      await db.query('ROLLBACK TO SAVEPOINT guard_test')
    })
    await t.test('existing unpaid enrollment FK detachment remains supported',async()=>{
      const form=(await query(db,"INSERT INTO scheduling_form(title) VALUES('Retained audit signup fixture') RETURNING id"))[0]
      const signup=(await query(db,"INSERT INTO scheduling_signup(form_id,member_id,first_name,last_name,email,status) VALUES($1,$2,'Surviving','Person','fixture@example.test','pending_setup') RETURNING id",[form.id,f.survivor.id]))[0]
      const event=await recordBillingActivity(db,{accountId:f.account.id,memberId:f.survivor.id,signupId:signup.id,eventType:'enrollment_note',summary:'Retained enrollment evidence',actorType:'system'})
      await db.query('DELETE FROM scheduling_signup WHERE id=$1',[signup.id])
      const after=(await query(db,'SELECT * FROM billing_account_activity WHERE id=$1',[event.id]))[0]
      assert.equal(after.signup_id,null)
      assert.deepEqual({...after,signup_id:event.signup_id},event)
    })
    await t.test('raw parent deletion with missing mapping is rejected atomically',async()=>{
      await db.query('SAVEPOINT missing_mapping')
      await db.query("UPDATE account_record_source SET deleted=TRUE WHERE facility_id=$1 AND record_kind='person'",[f.facility.id])
      await db.query('SAVEPOINT attempted_delete')
      await assert.rejects(db.query('DELETE FROM member WHERE id=$1',[f.source.id]),/append-only/)
      await db.query('ROLLBACK TO SAVEPOINT attempted_delete')
      assert.equal((await query(db,'SELECT id FROM member WHERE id=$1',[f.source.id])).length,1)
      assert.equal(Number((await query(db,'SELECT count(*) FROM billing_account_activity WHERE member_id=$1',[f.source.id]))[0].count),2)
      await db.query('ROLLBACK TO SAVEPOINT missing_mapping')
    })
  } finally {await db.query('ROLLBACK').catch(()=>{});await db.end()}
})
