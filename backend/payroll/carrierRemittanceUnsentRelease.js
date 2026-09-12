import {createHash} from 'node:crypto'
import {hashEmail} from '../email/emailDeliveryStore.js'
import {readCarrierRemittanceNotice} from './carrierRemittanceNotice.js'
import {readCarrierUnsentProof} from './carrierRemittanceUnsentProof.js'
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export function registerCarrierRemittanceUnsentRelease(app,pool){
 const base='/api/admin/payroll/carrier-payment-authorizations/:id/remittance-notices/:noticeId/release-unsent'
 const endpoint=work=>async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   if(!uuid(req.params.id)||!uuid(req.params.noticeId))throw fail('Choose a retained carrier notice.',400)
   await db.query('BEGIN')
   // Match the dispatch lock before employer/delivery locks. A sender in flight
   // must finish (or retain uncertainty) before this proof can be considered.
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`carrier-remittance-send:${req.params.noticeId.toLowerCase()}`])
   await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
   const row=(await db.query('SELECT * FROM payroll_carrier_remittance_notice WHERE id=$1 AND payment_id=$2 AND facility_id=$3',[req.params.noticeId,req.params.id,req.canonicalAccess.facilityId])).rows[0]
   if(!row)throw fail('Carrier notice was not found.',404)
   const data=await work(db,req,row);await db.query('COMMIT');res.json({success:true,data})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to verify and retain the non-send release.'})}finally{db.release()}
 }
 app.post(`${base}/preview`,endpoint(async(db,req,row)=>{
  if((await db.query('SELECT notice_id FROM payroll_carrier_remittance_unsent_release WHERE notice_id=$1',[row.id])).rowCount)throw fail('This notice already has a retained non-send release. Review its history.')
  const notice=readCarrierRemittanceNotice(row),proof=await readCarrierUnsentProof(db,row,hashEmail(notice.recipient.email))
  return {eligible:proof.eligible,reasons:proof.reasons,fingerprint:proof.fingerprint,attempts:proof.snapshot.attempts.map(item=>({id:item.id,outcome:item.outcome})),deliveryRecords:proof.snapshot.deliveries.length}
 }))
 app.post(base,endpoint(async(db,req,row)=>{
  const b=req.body||{}
  if(b.confirmed!==true||!uuid(b.requestKey)||typeof b.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(b.fingerprint)||typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Preview all non-send evidence, confirm release and retain an investigation reference.',400)
  const reference=b.reference.trim(),fingerprint=createHash('sha256').update(JSON.stringify({noticeId:row.id,fingerprint:b.fingerprint,reference})).digest('hex')
  const old=(await db.query('SELECT notice_id,request_fingerprint FROM payroll_carrier_remittance_unsent_release WHERE facility_id=$1 AND request_key=$2',[row.facility_id,b.requestKey])).rows[0]
  if(old){if(old.request_fingerprint!==fingerprint)throw fail('This release request was already used for different evidence.');return {id:old.notice_id,reused:true}}
  if((await db.query('SELECT notice_id FROM payroll_carrier_remittance_unsent_release WHERE notice_id=$1',[row.id])).rowCount)throw fail('This notice already has a retained release. Reload its history.')
  const notice=readCarrierRemittanceNotice(row),proof=await readCarrierUnsentProof(db,row,hashEmail(notice.recipient.email))
  if(!proof.eligible)throw fail(proof.reasons.join(' '))
  if(proof.fingerprint!==b.fingerprint)throw fail('Non-send evidence changed. Review its current state before release.')
  await db.query('INSERT INTO payroll_carrier_remittance_unsent_release(notice_id,facility_id,evidence,reference,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[row.id,row.facility_id,proof.snapshot,reference,b.requestKey,fingerprint,req.adminId])
  await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=clock_timestamp(),dismissed_by=$3 WHERE facility_id=$1 AND dedupe_key=$2",[row.facility_id,`carrier-remittance-${row.id}`,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_REMITTANCE_UNSENT_RELEASED','carrier_remittance_notice',$3,$4)",[row.facility_id,req.adminId,row.id,{attemptCount:proof.snapshot.attempts.length}])
  return {id:row.id,reused:false}
 }))
}
