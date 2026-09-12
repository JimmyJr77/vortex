import {readNoticeReturnTarget} from './w2NoticeReturnTarget.js'
import {retainW2NoticeReturns} from './w2NoticeReturns.js'
import {reconcileW2NoticeAcceptance} from './w2NoticeReconciliation.js'
import {readNoticeRetry,nextNoticeRetry} from './w2NoticeRetry.js'
import {readW2PaperFallback} from './w2NoticePaper.js'
import {randomUUID,createHash} from 'node:crypto'
import {readW2Notice,w2AvailabilityNotice} from './w2NoticeQueue.js'
import {electronicTermsFor} from './w2ElectronicAccess.js'
import {normalizeEmail} from '../email/emailAddress.js'
import {decryptDocument} from './onboarding.js'
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
export function w2NoticeOutcome(result,error){
 if(error)return {outcome:'UNCERTAIN',reason:'sender_error',providerMessageId:null}
 if(result?.sent===true)return {outcome:'SMTP_ACCEPTED',reason:'smtp_accepted',providerMessageId:typeof result.messageId==='string'?result.messageId.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,500):null}
 if(result?.sent===false&&(result.skipped===true||result.suppressed===true)&&result.reason!=='duplicate')return {outcome:'NOT_SENT',reason:'sender_declined',providerMessageId:null}
 return {outcome:'UNCERTAIN',reason:result?.reason==='duplicate'?'provider_duplicate':'unconfirmed_sender_result',providerMessageId:null}
}
// Sender must be injected. Claim persists before external I/O; no automatic resend
// follows an incomplete/uncertain attempt or a known previous send.
export async function dispatchW2Notice(pool,facility,jobId,{sender,now=new Date()}={}){
 if(typeof sender!=='function')throw new Error('A configured W-2 notice sender is required.')
 const db=await pool.connect();let consentLock=null
 try{
  const job=(await db.query('SELECT j.*,u.consent_id,u.packet_id,p.approval_id,p.payment_year,p.encrypted_pdf,p.content_sha256 AS packet_sha256,c.terms_fingerprint FROM payroll_w2_notice_job j JOIN payroll_w2_publication u ON u.id=j.publication_id JOIN payroll_w2_packet p ON p.id=u.packet_id JOIN payroll_w2_consent c ON c.id=u.consent_id WHERE j.facility_id=$1 AND j.id=$2',[facility,jobId])).rows[0]
  if(!job)return {status:'NOT_FOUND'}
  consentLock=`w2-consent:${facility}:${job.employee_id}:2026`;await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[consentLock]);await db.query('BEGIN')
  // Match the same lock ordering as consent/publication writes.
  await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  const employee=(await db.query('SELECT personal_email FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,job.employee_id])).rows[0]
  const retry=await readNoticeRetry(db,job.publication_id,now)
  if(!retry.canAttempt){await db.query('COMMIT');return {status:retry.state==='SMTP_ACCEPTED'?'SMTP_ACCEPTED':retry.state==='UNCERTAIN'?'UNCERTAIN':retry.state==='NOTICE_RETURNED'?'NOTICE_RETURNED':'NOT_SENT',attemptId:retry.attemptId,reused:true,retry}}
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-furnishing:${job.packet_id}`])
  if((await readW2PaperFallback(db,facility,job.publication_id))?.status==='PAPER_RECORDED'){await db.query('COMMIT');return {status:'PAPER_RECORDED'}}
  const latest=(await db.query('SELECT id FROM payroll_w2_notice_job WHERE publication_id=$1 ORDER BY id DESC LIMIT 1',[job.publication_id])).rows[0]
  if(Number(latest.id)!==Number(job.id)){await db.query('COMMIT');return {status:'SUPERSEDED'}}
  const consent=(await db.query('SELECT decision,terms_fingerprint FROM payroll_w2_consent WHERE facility_id=$1 AND employee_id=$2 AND payment_year=2026 ORDER BY id DESC LIMIT 1',[facility,job.employee_id])).rows[0],terms=await electronicTermsFor(db,facility)
  if(consent?.decision!=='CONSENT'||!terms.available||consent.terms_fingerprint!==terms.fingerprint||consent.terms_fingerprint!==job.terms_fingerprint){await db.query('COMMIT');return {status:'BLOCKED_CONSENT'}}
  let notice
  try{
   notice=readW2Notice(job)
   const packet=decryptDocument(job.encrypted_pdf,`payroll-w2-packet:${facility}:${job.employee_id}:${job.approval_id}:${job.payment_year}`)
   if(createHash('sha256').update(packet).digest('hex')!==job.packet_sha256)throw new Error('Packet mismatch')
   const current=w2AvailabilityNotice({publicationId:Number(job.publication_id),year:2026,contact:terms.terms.contact})
   if(notice.text!==current.text||notice.subject!==current.subject||notice.portalUrl!==current.portalUrl)throw new Error('Notice configuration changed')
  }catch{await db.query('COMMIT');return {status:'BLOCKED_DOCUMENT'}}
  if(job.initial_status!=='QUEUED'||!notice.recipient||normalizeEmail(employee?.personal_email)!==notice.recipient){await db.query('COMMIT');return {status:'BLOCKED_CONTACT'}}
  const dispatchKey=randomUUID(),attempt=(await db.query('INSERT INTO payroll_w2_notice_attempt(job_id,dispatch_key) VALUES($1,$2) RETURNING id',[job.id,dispatchKey])).rows[0]
  await db.query('COMMIT')
  let result,error
  try{result=await sender({to:notice.recipient,subject:notice.subject,text:notice.text,html:notice.text.split('\n\n').map(p=>`<p>${escape(p)}</p>`).join(''),category:'payroll_w2_notice',facilityId:Number(facility),templateVersion:'w2-notice-2026-v1',idempotencyKey:`w2-notice-${dispatchKey}`})}catch(e){error=e}
  const outcome=w2NoticeOutcome(result,error)
  await db.query('BEGIN');await db.query('INSERT INTO payroll_w2_notice_result(attempt_id,outcome,provider_message_id,reason,retry_not_before) VALUES($1,$2,$3,$4,$5)',[attempt.id,outcome.outcome,outcome.providerMessageId,outcome.reason,outcome.outcome==='NOT_SENT'?nextNoticeRetry(now,retry.attemptCount+1):null])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,NULL,'W2_NOTICE_DISPATCH_RECORDED','w2_notice_attempt',$2,$3)",[facility,String(attempt.id),{publicationId:Number(job.publication_id),jobId:Number(job.id),outcome:outcome.outcome}])
  if(outcome.outcome==='SMTP_ACCEPTED')await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now(),dismissed_by=NULL WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`w2-notice-${job.publication_id}`])
  await db.query('COMMIT');return {status:outcome.outcome,attemptId:Number(attempt.id),reused:false}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let releaseError;try{if(consentLock)await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[consentLock])}catch(e){releaseError=e}db.release(releaseError)}
}

export async function w2NoticeEvidence(db,facility,publicationId,{now=new Date()}={}){
 const job=(await db.query(`SELECT j.id,j.initial_status,j.created_at,a.id AS attempt_id,a.created_at AS attempted_at,r.outcome,r.created_at AS recorded_at
 FROM payroll_w2_notice_job j LEFT JOIN LATERAL(SELECT a.* FROM payroll_w2_notice_attempt a JOIN payroll_w2_notice_job origin ON origin.id=a.job_id WHERE origin.publication_id=j.publication_id ORDER BY a.id DESC LIMIT 1)a ON true
 LEFT JOIN payroll_w2_notice_effective_result r ON r.attempt_id=a.id WHERE j.facility_id=$1 AND j.publication_id=$2 ORDER BY j.id DESC LIMIT 1`,[facility,publicationId])).rows[0]
 const history=job?(await db.query('SELECT a.id,a.created_at,r.outcome,r.original_outcome,r.reconciliation_id,r.retry_not_before,b.source_kind AS return_source,b.reference AS return_reference,b.returned_at,b.id AS return_id,b.correction_id,b.original_returned_at,(SELECT source_kind FROM payroll_w2_notice_return WHERE id=b.id) AS original_return_source,b.is_retracted,b.retraction_reference,b.retracted_at,b.provider_reinstated,(SELECT COALESCE(max(id),0) FROM payroll_w2_return_cycle WHERE return_id=b.id) AS cycle_revision,(SELECT json_agg(v ORDER BY v.id) FROM (SELECT id,action,reference,created_at,correction_id FROM payroll_w2_return_cycle WHERE return_id=b.id)v) AS return_cycles,(SELECT json_agg(c ORDER BY c.id) FROM (SELECT id,returned_at,reference,created_at,provider_event_id FROM payroll_w2_return_correction WHERE return_id=b.id)c) AS corrections,(SELECT event_id FROM payroll_w2_provider_event WHERE attempt_id=a.id ORDER BY returned_at,event_id LIMIT 1) AS provider_event_id,(SELECT returned_at FROM payroll_w2_provider_event WHERE attempt_id=a.id ORDER BY returned_at,event_id LIMIT 1) AS provider_returned_at FROM payroll_w2_notice_attempt a JOIN payroll_w2_notice_job j ON j.id=a.job_id LEFT JOIN payroll_w2_notice_effective_result r ON r.attempt_id=a.id LEFT JOIN payroll_w2_current_return b ON b.attempt_id=a.id WHERE j.facility_id=$1 AND j.publication_id=$2 ORDER BY a.id DESC',[facility,publicationId])).rows:[]
 const paperFallback=job?await readW2PaperFallback(db,facility,publicationId):null
 return job?{returnTarget:await readNoticeReturnTarget(db,facility,publicationId,now,paperFallback),history,jobId:Number(job.id),status:job.outcome||(job.attempt_id?'UNCERTAIN':job.initial_status),attemptId:job.attempt_id?Number(job.attempt_id):null,attemptedAt:job.attempted_at,recordedAt:job.recorded_at,paperFallback,retry:await readNoticeRetry(db,publicationId)}:null
}
export async function refreshW2NoticeDispatch(pool,facility,{sender,now=new Date(),publicationId=null}={}){
 const jobs=(await pool.query(`SELECT DISTINCT ON(j.publication_id) j.id,j.publication_id FROM payroll_w2_notice_job j WHERE j.facility_id=$1 AND ($2::bigint IS NULL OR j.publication_id=$2) ORDER BY j.publication_id,j.id DESC`,[facility,publicationId])).rows
 for(const job of jobs){
  let status
  try{await retainW2NoticeReturns(pool,facility,job.publication_id);await reconcileW2NoticeAcceptance(pool,facility,job.publication_id);const evidence=await w2NoticeEvidence(pool,facility,job.publication_id);status=evidence.paperFallback?.status==='PAPER_RECORDED'?'PAPER_RECORDED':!(await readNoticeRetry(pool,job.publication_id,now)).canAttempt?evidence.status:sender?(await dispatchW2Notice(pool,facility,job.id,{sender,now})).status:'SENDER_NOT_CONFIGURED'}catch{status='DISPATCH_REVIEW_REQUIRED'}
  const db=await pool.connect()
  try{
   await db.query('BEGIN')
   const publication=(await db.query('SELECT packet_id FROM payroll_w2_publication WHERE facility_id=$1 AND id=$2',[facility,job.publication_id])).rows[0]
   await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-furnishing:${publication.packet_id}`])
   const current=await w2NoticeEvidence(db,facility,job.publication_id,{now})
   status=current.paperFallback?.status==='PAPER_RECORDED'?'PAPER_RECORDED':['SMTP_ACCEPTED','UNCERTAIN','NOTICE_RETURNED'].includes(current.status)?current.status:status==='PAPER_RECORDED'?'NOTICE_PENDING':status
  if(['SMTP_ACCEPTED','PAPER_RECORDED'].includes(status))await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now(),dismissed_by=NULL WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`w2-notice-${job.publication_id}`])
  else await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','W-2 availability notice needs attention',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,dismissed_by=NULL,title=EXCLUDED.title,message=EXCLUDED.message",[facility,`w2-notice-${job.publication_id}`,`Publication ${job.publication_id}: ${status}. ${current.returnTarget?`Paper follow-up target ${current.returnTarget.dueOn} (${current.returnTarget.status}). `:''}${current.retry.state==='EXHAUSTED'?'Automatic retries exhausted after three attempts. ':current.retry.nextAttemptAt?`Next retry no earlier than ${current.retry.nextAttemptAt}. `:''}Review portal publication in annual preparation. Verify the employee contact and delivery preferences. Retain paper furnishing evidence when electronic notice cannot be completed. Uncertain attempts are not automatically resent.`])
   await db.query('COMMIT')
  }catch(error){await db.query('ROLLBACK').catch(()=>{});throw error}finally{db.release()}
 }
 return {reviewed:jobs.length}
}

export const w2PublicationNoticeStatus=notice=>notice?.paperFallback?.status==='PAPER_RECORDED'?'AVAILABLE_PAPER_RECORDED':notice?.status==='SMTP_ACCEPTED'?'AVAILABLE_NOTICE_ACCEPTED':'AVAILABLE_NOTICE_PENDING'
