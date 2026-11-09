import fs from 'node:fs/promises'
import dotenv from 'dotenv'
import pg from 'pg'
import { planJackrabbitImport, normalizeIdentity, sourceHash } from '../newAdmin/jackrabbitImport.js'
import { recordBillingActivity } from '../billing/billingActivity.js'

dotenv.config({path:new URL('../.env.local',import.meta.url),quiet:true})
const args=process.argv.slice(2), apply=args.includes('--apply')
const file=args.find(a=>a.startsWith('--source='))?.slice(9)
if(!file)throw new Error('Use --source=<private source-packet.json> [--apply] [--rehearse].')
const packet=JSON.parse(await fs.readFile(file,'utf8'))
const pool=new pg.Pool({connectionString:process.env.EXTERNAL_DB_URL||process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},connectionTimeoutMillis:15000,max:1})
const client=await pool.connect()
try {
  await client.query('BEGIN')
  await client.query("SET LOCAL lock_timeout='5s'")
  await client.query('SELECT pg_advisory_xact_lock(557920,842)')
  const liveFootprint=async()=> (await client.query(`SELECT
    (SELECT COUNT(*)::text||':'||COALESCE(SUM(amount_cents),0)::text FROM billing_charge) AS charges,
    (SELECT COUNT(*)::text||':'||COALESCE(SUM(amount_cents),0)::text FROM billing_payment) AS payments,
    (SELECT COUNT(*) FROM program)::int AS classes,
    (SELECT COUNT(*) FROM scheduling_signup)::int AS signups,
    (SELECT COUNT(*) FROM app_user)::int AS logins`)).rows[0]
  const before=await liveFootprint()
  const facility=(await client.query('SELECT id,name FROM facility WHERE id=1')).rows[0]
  if(facility?.name!=='Vortex Athletics')throw new Error('Unexpected destination facility.')
  await client.query(await fs.readFile(new URL('../migrations/842_jackrabbit_history.sql',import.meta.url),'utf8'))
  const previous=(await client.query('SELECT record_kind,source_id,family_id,member_id,source_data FROM jackrabbit_history_record WHERE facility_id=1 AND organization_id=$1',[packet.organizationId])).rows
  const members=(await client.query(`SELECT m.id,m.first_name,m.last_name,m.email,m.phone,m.date_of_birth::text,m.app_user_id,fm.family_id FROM member m LEFT JOIN family_member fm ON fm.member_id=m.id AND fm.is_active=TRUE WHERE m.facility_id=1`)).rows
  const families=planJackrabbitImport(packet,members,previous)
  const report={mode:apply?'apply':'rehearsal',families:families.length,matchedFamilies:families.filter(f=>f.familyId).length,people:families.flatMap(f=>f.people).length,matchedPeople:families.flatMap(f=>f.people).filter(p=>p.memberId).length,createdFamilies:0,createdPeople:0,insertedRecords:0,transactions:packet.transactions.length,enrollments:packet.enrollments.length,conflicts:[],unmappedEnrollments:[]}
  const archive=async(kind,sourceId,sourceFamilyId,familyId,memberId,data,date=null,amount=null)=>{
    const old=previous.find(r=>r.record_kind===kind&&r.source_id===sourceId)
    if(old&&sourceHash(old.source_data)!==sourceHash(data))throw new Error(`Source changed since import: ${kind}/${sourceId}`)
    if(old&&old.member_id==null&&memberId!=null)await client.query(`UPDATE jackrabbit_history_record SET family_id=$4,member_id=$5 WHERE facility_id=1 AND organization_id=$1 AND record_kind=$2 AND source_id=$3 AND member_id IS NULL`,[packet.organizationId,kind,sourceId,familyId,memberId])
    const result=await client.query(`INSERT INTO jackrabbit_history_record(facility_id,organization_id,record_kind,source_id,source_family_id,family_id,member_id,source_data,occurred_on,amount_cents) VALUES(1,$1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) ON CONFLICT(facility_id,organization_id,record_kind,source_id) DO NOTHING RETURNING id`,[packet.organizationId,kind,sourceId,sourceFamilyId,familyId,memberId,JSON.stringify(data),date?.slice(0,10)||null,amount])
    report.insertedRecords+=result.rowCount
  }
  const accounts=new Map(),students=new Map()
  const claimedEmails=new Set(members.map(m=>String(m.email||'').toLowerCase()).filter(Boolean))
  for(const f of families){
    if(!f.familyId){f.familyId=(await client.query('INSERT INTO family(facility_id,family_name) VALUES(1,$1) RETURNING id',[f.name])).rows[0].id;report.createdFamilies++}
    await archive('family',f.sourceId,f.sourceId,f.familyId,null,{contacts:f.contacts,sourceFamily:packet.families.find(x=>normalizeIdentity(x.Family)===normalizeIdentity(f.name))||null})
    for(const p of f.people){
      if(!p.memberId){
        const sourceEmail=p.contact?.Email||null
        const email=sourceEmail&&!claimedEmails.has(sourceEmail.toLowerCase())?sourceEmail:null
        if(sourceEmail&&members.some(m=>String(m.email||'').toLowerCase()===sourceEmail.toLowerCase()&&String(m.family_id)!==String(f.familyId)))throw new Error(`Email belongs to another household: ${p.sourceId}`)
        p.memberId=(await client.query(`INSERT INTO member(facility_id,first_name,last_name,date_of_birth,email,phone,is_active,family_is_active,signup_source) VALUES(1,$1,$2,$3,$4,$5,TRUE,TRUE,'jackrabbit_history') RETURNING id`,[p.firstName,p.lastName,p.dateOfBirth,email,p.contact?.['Cell Phone']||p.contact?.['Primary Phone']||null])).rows[0].id
        if(email)claimedEmails.add(email.toLowerCase())
        await client.query(`INSERT INTO family_member(family_id,member_id) VALUES($1,$2)`,[f.familyId,p.memberId])
        report.createdPeople++
      }
      if(p.conflicts.length)report.conflicts.push({sourceId:p.sourceId,memberId:p.memberId,fields:p.conflicts})
      await archive('person',p.sourceId,f.sourceId,f.familyId,p.memberId,{contact:p.contact,student:p.student})
      if(p.student)students.set(p.student['Student ID'],{f,p})
    }
    // Imported billing accounts contain history only; no subscriptions or cards.
    let account=(await client.query('SELECT id FROM family_billing_account WHERE family_id=$1',[f.familyId])).rows[0]
    if(!account)account=(await client.query('INSERT INTO family_billing_account(family_id,is_active) VALUES($1,TRUE) RETURNING id',[f.familyId])).rows[0]
    accounts.set(f.sourceId,account.id)
  }
  for(const [archivedId,currentId] of Object.entries(packet.confirmedStudentAliases||{})){
    const current=students.get(currentId)
    if(!current)throw new Error(`Unmapped confirmed student alias ${currentId}`)
    students.set(archivedId,current)
  }
  for(const t of packet.transactions){
    const f=families.find(f=>f.sourceId===t['Jackrabbit Family ID'])
    const person=f?.people.filter(p=>normalizeIdentity(`${p.firstName} ${p.lastName}`)===normalizeIdentity(t.Student))||[]
    const memberId=person.length===1?person[0].memberId:null
    await archive('transaction',t['Trans ID'],t['Jackrabbit Family ID'],f?.familyId||null,memberId,t,t.Date,t.amountCents)
    if(f)await recordBillingActivity(client,{eventKey:`jackrabbit:557920:transaction:${t['Trans ID']}`,accountId:accounts.get(f.sourceId),memberId,eventType:'jackrabbit_historical_transaction',summary:`Jackrabbit: ${t.Type} $${(t.amountCents/100).toFixed(2)}${t.Activity?' · '+t.Activity:''}`,details:{source:'Jackrabbit',sourceId:t['Trans ID'],historicalOnly:true,...t},actorType:'system',occurredAt:`${t.Date.slice(0,10)}T12:00:00-05:00`})
  }
  const seen=new Map()
  for(const e of packet.enrollments){
    const mapped=students.get(e['Student ID'])
    const hash=sourceHash(e),nth=(seen.get(hash)||0)+1;seen.set(hash,nth)
    const sourceId=`${hash}:${nth}`
    // Source dates are locale dates in XLS exports.
    const parsed=new Date(e['Enroll Date']);if(!Number.isFinite(parsed.getTime()))throw new Error('Invalid enrollment date.')
    const date=parsed.toISOString().slice(0,10)
    await archive('enrollment',sourceId,mapped?.f.sourceId||null,mapped?.f.familyId||null,mapped?.p.memberId||null,e,date)
    if(mapped)await recordBillingActivity(client,{eventKey:`jackrabbit:557920:enrollment:${sourceId}`,accountId:accounts.get(mapped.f.sourceId),memberId:mapped.p.memberId,eventType:'jackrabbit_historical_enrollment',summary:`Jackrabbit: ${e.Type} · ${e.Class}`,details:{source:'Jackrabbit',historicalOnly:true,...e},actorType:'system',occurredAt:`${date}T12:00:00-05:00`})
    else report.unmappedEnrollments.push({studentId:e['Student ID'],name:`${e['Student First']} ${e['Student Last']}`})
  }
  const reconciliation=(await client.query(`SELECT COUNT(*) FILTER(WHERE record_kind='transaction')::int AS transactions,COUNT(*) FILTER(WHERE record_kind='enrollment')::int AS enrollments,SUM(amount_cents) FILTER(WHERE record_kind='transaction')::bigint AS net_cents FROM jackrabbit_history_record WHERE facility_id=1 AND organization_id=$1`,[packet.organizationId])).rows[0]
  if(reconciliation.transactions!==packet.transactions.length||reconciliation.enrollments!==packet.enrollments.length||Number(reconciliation.net_cents)!==packet.transactions.reduce((n,t)=>n+t.amountCents,0))throw new Error('Historical source reconciliation failed.')
  report.reconciliation=reconciliation
  const after=await liveFootprint()
  if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Live billing, classes, signups, or login counts changed during import. Roll back and investigate before retrying.')
  report.liveDataUnchanged=after
  await client.query(apply?'COMMIT':'ROLLBACK')
  await fs.writeFile(`${file}.${apply?'applied':'rehearsal'}.json`,JSON.stringify(report,null,2),{mode:0o600})
  console.log(JSON.stringify(report,null,2))
}catch(error){await client.query('ROLLBACK');throw error}finally{client.release();await pool.end()}
