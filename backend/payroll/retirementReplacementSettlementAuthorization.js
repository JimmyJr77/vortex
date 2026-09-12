import {randomUUID} from 'node:crypto'
import {prepareRetirementReplacementSettlement} from './retirementReplacementSettlementPreview.js'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status})}
const reviewed=b=>b?.confirmed===true&&typeof b.reference==='string'&&b.reference.trim().length>=20&&b.reference.length<=2000&&!/[\u0000-\u001f\u007f]/.test(b.reference)
export function registerRetirementReplacementSettlementAuthorization(app,pool,options){
 const endpoint=work=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{const facility=req.canonicalAccess.facilityId;await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[facility]);const data=await work(db,req,facility);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain replacement settlement review.'})}finally{db.release()}}
 const scoped=async(db,id,facility)=>{if(!uuid(id))fail('Choose a replacement contribution.',400);if(!(await db.query('SELECT id FROM payroll_retirement_replacement_authorization WHERE id=$1 AND facility_id=$2',[id,facility])).rowCount)fail('Replacement contribution not found.',404)}
 const path='/api/admin/payroll/retirement-replacement-authorizations/:id/settlement-authorizations'
 app.get(path,endpoint(async(db,req,facility)=>{
  await scoped(db,req.params.id,facility)
  const history=(await db.query('SELECT a.*,c.created_at AS cancelled_at,c.reference AS cancellation_reference,EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_claim p WHERE p.authorization_id=a.id) AS claimed FROM payroll_retirement_replacement_settlement_authorization a LEFT JOIN payroll_retirement_replacement_settlement_cancellation c ON c.authorization_id=a.id WHERE a.replacement_id=$1 AND a.facility_id=$2 ORDER BY a.created_at DESC,a.id',[req.params.id,facility])).rows
  for(const a of history){a.journals=(await db.query('SELECT j.id,j.event_key,j.payload,(SELECT result FROM payroll_retirement_replacement_settlement_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) AS result FROM payroll_retirement_replacement_settlement_journal j WHERE authorization_id=$1 ORDER BY event_key',[a.id])).rows;a.attempts=(await db.query('SELECT id,status,message,created_at FROM payroll_retirement_replacement_settlement_attempt WHERE authorization_id=$1 ORDER BY id DESC LIMIT 10',[a.id])).rows}
  return {history}
 }))
 app.post(path,endpoint(async(db,req,facility)=>{
  await scoped(db,req.params.id,facility);const b=req.body
  if(!reviewed(b)||b.autoPost!==true||b.outsideAccountingReviewed!==true||!uuid(b.requestKey)||typeof b.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(b.fingerprint))fail('Confirm automatic posting, reviewed outside accounting and the exact replacement settlement.',400)
  const previous=(await db.query('SELECT a.*,EXISTS(SELECT 1 FROM payroll_retirement_replacement_settlement_cancellation c WHERE c.authorization_id=a.id) AS cancelled FROM payroll_retirement_replacement_settlement_authorization a WHERE facility_id=$1 AND (replacement_id=$2 OR request_key=$3)',[facility,req.params.id,b.requestKey])).rows,retry=previous.find(a=>a.request_key===b.requestKey)
  if(retry){if(retry.replacement_id!==req.params.id||retry.fingerprint!==b.fingerprint||retry.reference!==b.reference.trim())fail('This request identity belongs to a different review.');return {id:retry.id,reused:true,cancelled:retry.cancelled}}
  if(previous.some(a=>!a.cancelled))fail('A replacement settlement approval is already active.')
  const preview=await prepareRetirementReplacementSettlement(db,facility,req.params.id,options)
  if(preview.fingerprint!==b.fingerprint)fail('Bank, return accounting, mapping or book-period facts changed. Review again.')
  const id=randomUUID();await db.query('INSERT INTO payroll_retirement_replacement_settlement_authorization(id,facility_id,replacement_id,mapping_id,preview,fingerprint,request_key,reference,auto_post,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true,$9)',[id,facility,req.params.id,preview.mappingId,preview,preview.fingerprint,b.requestKey,b.reference.trim(),req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_REPLACEMENT_SETTLEMENT_AUTHORIZED','retirement_replacement_settlement',$3,$4)",[facility,req.adminId,id,{replacementId:req.params.id,fingerprint:preview.fingerprint}]);return {id,reused:false}
 }))
 app.post('/api/admin/payroll/retirement-replacement-settlement-authorizations/:id/cancel',endpoint(async(db,req,facility)=>{
  if(!uuid(req.params.id)||!reviewed(req.body))fail('Confirm cancellation and retain its reason.',400)
  const a=(await db.query('SELECT id FROM payroll_retirement_replacement_settlement_authorization WHERE id=$1 AND facility_id=$2',[req.params.id,facility])).rows[0];if(!a)fail('Replacement settlement review not found.',404)
  const old=(await db.query('SELECT reference FROM payroll_retirement_replacement_settlement_cancellation WHERE authorization_id=$1',[a.id])).rows[0]
  if(old){if(old.reference!==req.body.reference.trim())fail('Cancellation already has a different reason.');return {id:a.id,reused:true}}
  if((await db.query('SELECT authorization_id FROM payroll_retirement_replacement_settlement_claim WHERE authorization_id=$1',[a.id])).rowCount)fail('Posting is claimed. Recover the original journals.')
  await db.query('INSERT INTO payroll_retirement_replacement_settlement_cancellation(authorization_id,reference,created_by) VALUES($1,$2,$3)',[a.id,req.body.reference.trim(),req.adminId])
  await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`retirement-replacement-settlement-${a.id}`])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_REPLACEMENT_SETTLEMENT_CANCELLED','retirement_replacement_settlement',$3,$4)",[facility,req.adminId,a.id,{reference:req.body.reference.trim()}]);return {id:a.id,reused:false}
 }))
}
