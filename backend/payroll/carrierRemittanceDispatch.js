import {randomUUID} from 'node:crypto'
import {hashEmail} from '../email/emailDeliveryStore.js'
import {carrierNoticeReadiness,readCarrierRemittanceNotice} from './carrierRemittanceNotice.js'
import {carrierDeliveryState,carrierNoticeCategory,carrierNoticeTemplate} from './carrierRemittanceDeliveryState.js'
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function carrierNoticeSenderOutcome(result,error){
 if(error)return {outcome:'UNCERTAIN',providerMessageId:null}
 if(result?.sent===true)return {outcome:'SMTP_ACCEPTED',providerMessageId:typeof result.messageId==='string'?result.messageId.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,500):null}
 if(result?.sent===false&&(result.skipped===true||result.suppressed===true)&&result.reason!=='duplicate')return {outcome:'NOT_SENT',providerMessageId:null}
 return {outcome:'UNCERTAIN',providerMessageId:null}
}
async function reconcileAcceptance(db,row,notice){
 const state=await carrierDeliveryState(db,row.id),attempt=state.history[0]
 if(!['UNCERTAIN','NOT_SENT','EXHAUSTED'].includes(state.status)||!attempt||!(await db.query("SELECT to_regclass('email_delivery') AS relation")).rows[0].relation)return
 const source=(await db.query(`SELECT id,facility_id,recipient_hash,category,stream,template_version,status,idempotency_key,created_at,accepted_at,bounced_at,complained_at FROM email_delivery WHERE facility_id=$1 AND idempotency_key=$2 AND recipient_hash=$3 AND category=$4 AND template_version=$5 AND stream='transactional' AND status='accepted' AND created_at>=$6 AND accepted_at>=created_at AND bounced_at IS NULL AND complained_at IS NULL FOR SHARE`,[row.facility_id,`carrier-remittance-${attempt.dispatch_key}`,hashEmail(notice.recipient.email),carrierNoticeCategory,carrierNoticeTemplate,attempt.created_at])).rows[0]
 if(source)await db.query('INSERT INTO payroll_carrier_remittance_acceptance(attempt_id,source_delivery_id,source_snapshot) VALUES($1,$2,$3) ON CONFLICT(attempt_id) DO NOTHING',[attempt.id,source.id,source])
}
// The claim and individual attempt commit before external I/O. Existing uncertain
// claims are lookup-only, including a legacy claim without an attempt record.
export async function processCarrierRemittance(pool,facility,noticeId,{sender,now=new Date()}={}){
 const db=await pool.connect();let locked=false
 try{
  await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[`carrier-remittance-send:${noticeId}`]);locked=true
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
  const row=(await db.query('SELECT * FROM payroll_carrier_remittance_notice WHERE id=$1 AND facility_id=$2',[noticeId,facility])).rows[0]
  if(!row){await db.query('COMMIT');return {status:'NOT_FOUND'}}
  if((await db.query('SELECT notice_id FROM payroll_carrier_remittance_cancellation WHERE notice_id=$1',[noticeId])).rowCount){await db.query('COMMIT');return {status:'CANCELLED'}}
  const notice=readCarrierRemittanceNotice(row);await reconcileAcceptance(db,row,notice)
  const prior=await carrierDeliveryState(db,noticeId,{now})
  if(!prior.canAttempt){await db.query('COMMIT');return prior}
  const readiness=await carrierNoticeReadiness(db,row)
  if(!readiness.ready){await db.query('COMMIT');return {...prior,status:'BLOCKED',message:readiness.reason}}
  if(typeof sender!=='function'){await db.query('COMMIT');return {...prior,status:'NOT_CONFIGURED'}}
  if(!prior.claimed)await db.query('INSERT INTO payroll_carrier_remittance_claim(notice_id,dispatch_key,created_at) VALUES($1,$2,$3)',[noticeId,randomUUID(),now])
  const dispatchKey=randomUUID(),attempt=(await db.query('INSERT INTO payroll_carrier_remittance_attempt(notice_id,dispatch_key,created_at) VALUES($1,$2,$3) RETURNING id',[noticeId,dispatchKey,now])).rows[0]
  await db.query('COMMIT')
  let result,error
  try{result=await sender({to:notice.recipient.email,subject:notice.advice.subject,text:notice.advice.text,html:notice.advice.text.split('\n\n').map(p=>`<p>${escape(p).replaceAll('\n','<br>')}</p>`).join(''),facilityId:Number(facility),category:carrierNoticeCategory,templateVersion:carrierNoticeTemplate,idempotencyKey:`carrier-remittance-${dispatchKey}`})}catch(e){error=e}
  const outcome=carrierNoticeSenderOutcome(result,error)
  await db.query('BEGIN');await db.query('INSERT INTO payroll_carrier_remittance_result(attempt_id,outcome,provider_message_id) VALUES($1,$2,$3)',[attempt.id,outcome.outcome,outcome.providerMessageId]);await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,NULL,'CARRIER_REMITTANCE_DISPATCH_RECORDED','carrier_remittance_attempt',$2,$3)",[facility,String(attempt.id),{noticeId,outcome:outcome.outcome}]);await db.query('COMMIT')
  return await carrierDeliveryState(db,noticeId,{now})
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[`carrier-remittance-send:${noticeId}`])}catch{destroy=true}db.release(destroy)}
}
