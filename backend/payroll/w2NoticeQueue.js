import {readNoticeRetry} from './w2NoticeRetry.js'
import {createHash} from 'node:crypto'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {normalizeEmail,isValidEmail} from '../email/emailAddress.js'
import {publicAppUrl} from '../email/publicAppUrl.js'
const digest=value=>createHash('sha256').update(value).digest('hex')
export function w2AvailabilityNotice({publicationId,year,contact,baseUrl=publicAppUrl()}){
 const base=new URL(baseUrl)
 if(base.protocol!=='https:'||base.username||base.password)throw new Error('W-2 notices require a public HTTPS payroll URL.')
 if(!Number.isSafeInteger(Number(publicationId))||Number(publicationId)<1||year!==2026||!contact?.name||!contact?.phone||!contact?.address)throw new Error('Complete W-2 notice publication and payroll contact details are required.')
 const portalUrl=new URL('/employee/payroll',base).toString()
 return {version:1,year,publicationId:Number(publicationId),subject:'IMPORTANT TAX RETURN DOCUMENT AVAILABLE',text:[
 'IMPORTANT TAX RETURN DOCUMENT AVAILABLE',
 `Your ${year} Form W-2 employee copies are available in your payroll portal.`,
 `Sign in at ${portalUrl}`,
 `Select Pay statements, choose Load my W-2 documents, then Download W-2 document ${publicationId}. Open the PDF and save a copy. Use your PDF reader's Print command to print your employee copies. Printed copies may be needed for a federal, state or local tax return.`,
 'Your 2026 employee copies will remain accessible through at least December 31, 2031.',
 `For help accessing the document or requesting paper copies, contact ${contact.name} at ${contact.phone}, or write to ${contact.address}.`
 ].join('\n\n'),portalUrl}
}
// Called inside the publication transaction; creation never sends external mail.
export async function queueW2AvailabilityNotice(db,{publicationId,facility,employeeId,contact,now=new Date()}){
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-consent:${facility}:${employeeId}:2026`])
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`w2-notice-queue:${publicationId}`])
 const existing=(await db.query('SELECT * FROM payroll_w2_notice_job WHERE publication_id=$1 AND facility_id=$2 AND employee_id=$3 ORDER BY id DESC LIMIT 1',[publicationId,facility,employeeId])).rows[0]
 if(existing&&!(await readNoticeRetry(db,publicationId,now)).canAttempt)return existing
 const employee=(await db.query('SELECT personal_email FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,employeeId])).rows[0]
 if(!employee)throw new Error('W-2 notice employee not found.')
 const email=normalizeEmail(employee.personal_email),recipient=isValidEmail(email)?email:null,notice={...w2AvailabilityNotice({publicationId,year:2026,contact}),recipient},bytes=Buffer.from(JSON.stringify(notice))
 if(existing){readW2Notice(existing);if(existing.content_sha256===digest(bytes))return existing}
 const saved=(await db.query('INSERT INTO payroll_w2_notice_job(publication_id,facility_id,employee_id,initial_status,encrypted_notice,content_sha256) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,initial_status',[publicationId,facility,employeeId,recipient?'QUEUED':'NEEDS_CONTACT',encryptDocument(bytes,`w2-notice:${facility}:${employeeId}:${publicationId}`),digest(bytes)])).rows[0]
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,NULL,'W2_AVAILABILITY_NOTICE_QUEUED','w2_notice_job',$2,$3)",[facility,String(saved.id),{employeeId:Number(employeeId),publicationId:Number(publicationId),status:saved.initial_status,sha256:digest(bytes)}])
 return saved
}
export function readW2Notice(job){
 const bytes=decryptDocument(job.encrypted_notice,`w2-notice:${job.facility_id}:${job.employee_id}:${job.publication_id}`)
 if(digest(bytes)!==job.content_sha256)throw new Error('W-2 notice integrity mismatch')
 const notice=JSON.parse(bytes.toString())
 if(notice.version!==1||notice.year!==2026||notice.publicationId!==Number(job.publication_id))throw new Error('W-2 notice identity mismatch')
 return notice
}

export async function refreshW2NoticeQueue(pool,facility,{now=new Date()}={}){
 const publications=(await pool.query(`SELECT u.id,u.employee_id,c.encrypted_receipt FROM payroll_w2_publication u JOIN payroll_w2_consent c ON c.id=u.consent_id WHERE u.facility_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_w2_notice_job j JOIN payroll_w2_notice_attempt a ON a.job_id=j.id WHERE j.publication_id=u.id) OR (u.facility_id=$1 AND (SELECT r.outcome FROM payroll_w2_notice_job j JOIN payroll_w2_notice_attempt a ON a.job_id=j.id LEFT JOIN payroll_w2_notice_effective_result r ON r.attempt_id=a.id WHERE j.publication_id=u.id ORDER BY a.id DESC LIMIT 1)='NOT_SENT') ORDER BY u.id`,[facility])).rows
 for(const publication of publications){const db=await pool.connect();try{
  await db.query('BEGIN');const receipt=JSON.parse(decryptDocument(publication.encrypted_receipt,`w2-consent:${facility}:${publication.employee_id}:2026`).toString())
  await queueW2AvailabilityNotice(db,{publicationId:Number(publication.id),facility,employeeId:Number(publication.employee_id),contact:receipt.terms.contact,now});await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now(),dismissed_by=NULL WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`w2-notice-preparation-${publication.id}`]);await db.query('COMMIT')
 }catch(e){await db.query('ROLLBACK').catch(()=>{});await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','W-2 notice preparation needs attention',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,dismissed_by=NULL",[facility,`w2-notice-preparation-${publication.id}`,`Unable to prepare the availability notice for W-2 publication ${publication.id}. Verify document encryption and the payroll contact configuration.`])}finally{db.release()}}
}
