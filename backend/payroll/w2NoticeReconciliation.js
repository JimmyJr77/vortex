import {hashEmail} from '../email/emailDeliveryStore.js'
import {readW2Notice} from './w2NoticeQueue.js'
// Reconcile only affirmative acceptance evidence for the exact retained send.
// Absence, generic failure, or a changed recipient never authorizes another send.
export async function reconcileW2NoticeAcceptance(pool,facility,publicationId){
 const db=await pool.connect();let lock=null
 try{
  const publication=(await db.query('SELECT employee_id FROM payroll_w2_publication WHERE facility_id=$1 AND id=$2',[facility,publicationId])).rows[0]
  if(!publication)return {status:'NOT_FOUND'}
  lock=`w2-consent:${facility}:${publication.employee_id}:2026`;await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);await db.query('BEGIN')
  const attempt=(await db.query(`SELECT a.id AS attempt_id,a.dispatch_key,a.created_at AS attempted_at,j.*,r.outcome,c.id AS reconciliation_id FROM payroll_w2_notice_attempt a JOIN payroll_w2_notice_job j ON j.id=a.job_id LEFT JOIN payroll_w2_notice_result r ON r.attempt_id=a.id LEFT JOIN payroll_w2_notice_reconciliation c ON c.attempt_id=a.id WHERE j.publication_id=$1 ORDER BY a.id DESC LIMIT 1`,[publicationId])).rows[0]
  if(!attempt||attempt.reconciliation_id||attempt.outcome&&attempt.outcome!=='UNCERTAIN'){await db.query('COMMIT');return {status:attempt?.reconciliation_id?'RECONCILED':'NOT_REQUIRED'}}
  if(!(await db.query("SELECT to_regclass('email_delivery') AS relation")).rows[0].relation){await db.query('COMMIT');return {status:'NO_EVIDENCE'}}
  const notice=readW2Notice(attempt)
  const source=(await db.query(`SELECT id,facility_id,recipient_hash,accepted_at,created_at,category,stream,template_version,status,idempotency_key,bounced_at,complained_at FROM email_delivery WHERE facility_id=$1 AND idempotency_key=$2 AND recipient_hash=$3 AND category='payroll_w2_notice' AND stream='transactional' AND template_version='w2-notice-2026-v1' AND status='accepted' AND created_at>=$4 AND accepted_at>=created_at AND bounced_at IS NULL AND complained_at IS NULL FOR SHARE`,[facility,`w2-notice-${attempt.dispatch_key}`,hashEmail(notice.recipient),attempt.attempted_at])).rows[0]
  if(!source){await db.query('COMMIT');return {status:'NO_EVIDENCE'}}
  const saved=(await db.query('INSERT INTO payroll_w2_notice_reconciliation(attempt_id,source_delivery_id,accepted_at,source_snapshot) VALUES($1,$2,$3,$4) RETURNING id',[attempt.attempt_id,source.id,source.accepted_at,source])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,NULL,'W2_NOTICE_ACCEPTANCE_RECONCILED','w2_notice_reconciliation',$2,$3)",[facility,String(saved.id),{publicationId:Number(publicationId),attemptId:Number(attempt.attempt_id),deliveryId:Number(source.id)}])
  await db.query('COMMIT');return {status:'RECONCILED',id:Number(saved.id)}
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error}finally{let releaseError;try{if(lock)await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch(error){releaseError=error}db.release(releaseError)}
}
