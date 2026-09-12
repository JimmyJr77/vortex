import {noticeReturnTarget} from './w2NoticeReturnTarget.js'
import {hashEmail} from '../email/emailDeliveryStore.js'
import {readW2Notice} from './w2NoticeQueue.js'
export async function retainW2NoticeReturns(pool,facility,publicationId){
 const db=await pool.connect()
 try{
  await db.query('BEGIN')
  if(!(await db.query("SELECT to_regclass('email_delivery') AS relation")).rows[0].relation){await db.query('COMMIT');return}
  const attempts=(await db.query(`SELECT a.id AS attempt_id,a.dispatch_key,a.created_at AS attempted_at,j.* FROM payroll_w2_notice_attempt a JOIN payroll_w2_notice_job j ON j.id=a.job_id WHERE j.facility_id=$1 AND j.publication_id=$2 AND NOT EXISTS(SELECT 1 FROM payroll_w2_notice_return WHERE attempt_id=a.id)`,[facility,publicationId])).rows
  for(const attempt of attempts){
   const notice=readW2Notice(attempt),source=(await db.query(`SELECT id,facility_id,recipient_hash,idempotency_key,category,template_version,status,created_at,bounced_at FROM email_delivery WHERE facility_id=$1 AND idempotency_key=$2 AND recipient_hash=$3 AND category='payroll_w2_notice' AND stream='transactional' AND template_version='w2-notice-2026-v1' AND status='bounced' AND created_at>=$4 AND bounced_at>=created_at FOR SHARE`,[facility,`w2-notice-${attempt.dispatch_key}`,hashEmail(notice.recipient),attempt.attempted_at])).rows[0]
   if(!source)continue
   const settings=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0],target=noticeReturnTarget(source.bounced_at,settings.timezone)
   const saved=(await db.query('INSERT INTO payroll_w2_notice_return(attempt_id,source_delivery_id,returned_at,source_snapshot,followup_timezone,followup_due_on) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(attempt_id) DO NOTHING RETURNING id',[attempt.attempt_id,source.id,source.bounced_at,source,target.timeZone,target.dueOn])).rows[0]
   if(saved)await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,NULL,'W2_NOTICE_RETURN_RETAINED','w2_notice_return',$2,$3)",[facility,String(saved.id),{publicationId:Number(publicationId),attemptId:Number(attempt.attempt_id),deliveryId:Number(source.id)}])
  }
  await db.query('COMMIT')
 }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error}finally{db.release()}
}
