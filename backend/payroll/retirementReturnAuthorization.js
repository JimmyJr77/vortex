import {randomUUID} from 'node:crypto'
import {retirementScheduleUuid as uuid} from './retirementDispatchScheduleState.js'
import {prepareRetirementReturn} from './retirementReturnPreview.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const review=b=>b?.confirmed===true&&typeof b.reference==='string'&&b.reference.trim().length>=12&&b.reference.length<=2000&&!/[\u0000-\u001f\u007f]/.test(b.reference)
export function registerRetirementReturnAuthorization(app,pool,options){
 const endpoint=work=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${req.canonicalAccess.facilityId}`]);await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE NOWAIT',[req.canonicalAccess.facilityId]);const data=await work(db,req);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain retirement return approval.'})}finally{db.release()}}
 const scoped=async(db,req)=>{if(!uuid(req.params.id))throw fail('Choose a retirement contribution.',400);if(!(await db.query('SELECT id FROM payroll_retirement_remittance_authorization WHERE id=$1 AND facility_id=$2',[req.params.id,req.canonicalAccess.facilityId])).rowCount)throw fail('Retirement contribution not found.',404)}
 const path='/api/admin/payroll/retirement-remittance-authorizations/:id/return-authorizations'
 app.get(path,endpoint(async(db,req)=>{await scoped(db,req);const history=(await db.query('SELECT a.*,c.created_at AS cancelled_at,c.reference AS cancellation_reference,EXISTS(SELECT 1 FROM payroll_retirement_return_claim p WHERE p.authorization_id=a.id) AS claimed FROM payroll_retirement_return_authorization a LEFT JOIN payroll_retirement_return_cancellation c ON c.authorization_id=a.id WHERE a.facility_id=$1 AND a.payment_authorization_id=$2 ORDER BY a.created_at DESC,a.id',[req.canonicalAccess.facilityId,req.params.id])).rows;for(const a of history){a.release=(await db.query('SELECT fingerprint,reference,created_at FROM payroll_retirement_return_release WHERE authorization_id=$1',[a.id])).rows[0]??null;a.attempts=(await db.query('SELECT id,status,message,created_at FROM payroll_retirement_return_attempt WHERE authorization_id=$1 ORDER BY id DESC LIMIT 10',[a.id])).rows;a.journal=(await db.query('SELECT j.id,j.payload,(SELECT result FROM payroll_retirement_return_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) AS result,(SELECT created_at FROM payroll_retirement_return_observation WHERE journal_id=j.id ORDER BY id DESC LIMIT 1) AS checked_at FROM payroll_retirement_return_journal j WHERE authorization_id=$1 AND facility_id=$2',[a.id,req.canonicalAccess.facilityId])).rows[0]??null;}return {history}}))
 app.post(path,endpoint(async(db,req)=>{
  await scoped(db,req);const b=req.body,facility=req.canonicalAccess.facilityId
  if(!review(b)||!uuid(b.requestKey)||b.autoPost!==true||b.outsideAccountingReviewed!==true||typeof b.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(b.fingerprint))throw fail('Approve the exact return journal, automatic posting and absence of outside duplicate accounting.',400)
  const previous=(await db.query('SELECT a.*,EXISTS(SELECT 1 FROM payroll_retirement_return_cancellation c WHERE c.authorization_id=a.id) AS cancelled FROM payroll_retirement_return_authorization a WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(previous){if(previous.payment_authorization_id!==req.params.id||previous.fingerprint!==b.fingerprint||previous.reference!==b.reference.trim())throw fail('This request identity belongs to a different return review.');return {id:previous.id,reused:true,cancelled:previous.cancelled}}
  if((await db.query('SELECT id FROM payroll_retirement_return_authorization a WHERE payment_authorization_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_retirement_return_cancellation c WHERE c.authorization_id=a.id)',[req.params.id])).rowCount)throw fail('A return approval is already active. Review its history.')
  const preview=await prepareRetirementReturn(db,facility,req.params.id,options)
  if(preview.fingerprint!==b.fingerprint)throw fail('Return, bank or accounting evidence changed. Review a new preview.')
  const id=randomUUID()
  await db.query('INSERT INTO payroll_retirement_return_authorization(id,facility_id,payment_authorization_id,original_settlement_id,preview,fingerprint,request_key,reference,auto_post,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true,$9)',[id,facility,req.params.id,preview.source.authorizationId,preview,preview.fingerprint,b.requestKey,b.reference.trim(),req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_RETURN_AUTHORIZED','retirement_return_authorization',$3,$4)",[facility,req.adminId,id,{paymentAuthorizationId:req.params.id,fingerprint:preview.fingerprint,outsideAccountingReviewed:true}]);return {id,reused:false}
 }))
 app.post('/api/admin/payroll/retirement-return-authorizations/:id/cancel',endpoint(async(db,req)=>{
  if(!uuid(req.params.id)||!review(req.body))throw fail('Confirm cancellation with its reason.',400)
  const id=req.params.id,facility=req.canonicalAccess.facilityId
  if(!(await db.query('SELECT id FROM payroll_retirement_return_authorization WHERE id=$1 AND facility_id=$2',[id,facility])).rowCount)throw fail('Return approval not found.',404)
  const old=(await db.query('SELECT reference FROM payroll_retirement_return_cancellation WHERE authorization_id=$1',[id])).rows[0]
  if(old){if(old.reference!==req.body.reference.trim())throw fail('A different cancellation reason is already retained.');return {id,reused:true}}
  if((await db.query('SELECT authorization_id FROM payroll_retirement_return_claim WHERE authorization_id=$1',[id])).rowCount)throw fail('Return accounting is claimed. Recover its outcome.')
  await db.query('INSERT INTO payroll_retirement_return_cancellation(authorization_id,reference,created_by) VALUES($1,$2,$3)',[id,req.body.reference.trim(),req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'RETIREMENT_RETURN_CANCELLED','retirement_return_authorization',$3,$4)",[facility,req.adminId,id,{reference:req.body.reference.trim()}]);return {id,reused:false}
 }))
}
