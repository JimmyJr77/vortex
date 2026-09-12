import {createHash} from 'node:crypto'
import {MW507_2026,mw507FormInput2026,mw507ReviewRequirements2026} from './mw507Form2026.js'
import {renderMw507Pdf2026 as renderMW507Pdf2026} from './mw507Pdf2026.js'
import {encryptDocument,decryptDocument} from './onboarding.js'

const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const aad=(session,task)=>`mw507-review:${session.facility_id}:${session.employee_id}:${task.id}:${task.onboarding_cycle}:${session.session_id}`
async function currentTask(db,session,taskId,cycle){
 const task=(await db.query('SELECT * FROM payroll_onboarding_task WHERE id=$1 AND facility_id=$2 AND employee_id=$3 FOR UPDATE',[taskId,session.facility_id,session.employee_id])).rows[0]
 if(!task||task.task_key!=='STATE_WITHHOLDING'||task.owner!=='EMPLOYEE')throw fail('MW507 onboarding step not found.',404)
 if(cycle!==task.onboarding_cycle)throw fail('The onboarding cycle changed. Reload before reviewing this MW507.')
 return task
}
const editable=task=>{if(!['OPEN','SUBMITTED','CHANGES_REQUESTED'].includes(task.status))throw fail('Ask your hiring admin to reopen the completed MW507 step.')}
export async function recordMW507PageVisit2026(db,session,taskId,body){
 const task=await currentTask(db,session,taskId,body.onboardingCycle);editable(task)
 if(!Number.isInteger(body.page)||body.page<1||body.page>2||body.displayed!==true||!/^\d+$/.test(String(body.reviewId)))throw fail('Display a valid MW507 page before continuing.',400)
 const review=(await db.query(`SELECT id FROM payroll_mw507_review r WHERE id=$1 AND facility_id=$2 AND employee_id=$3 AND task_id=$4 AND onboarding_cycle=$5 AND employee_session_id=$6 AND preview_sha256=$7 AND expires_at>clock_timestamp() AND NOT EXISTS(SELECT 1 FROM payroll_mw507_review n WHERE n.task_id=r.task_id AND n.onboarding_cycle=r.onboarding_cycle AND n.id>r.id)`,[body.reviewId,session.facility_id,session.employee_id,task.id,task.onboarding_cycle,session.session_id,body.previewSha256])).rows[0]
 if(!review)throw fail('This MW507 preview expired or changed. Generate and review it again.')
 await db.query('INSERT INTO payroll_mw507_page_visit(review_id,page_number) VALUES($1,$2) ON CONFLICT DO NOTHING',[review.id,body.page])
 return {page:body.page,recorded:true}
}
// The route must hold lockPayrollEmployeeSession in the same transaction.
export async function previewMW507Submission2026(db,session,taskId,body){
 const task=await currentTask(db,session,taskId,body.onboardingCycle);editable(task)
 const answers=mw507FormInput2026(body.answers)
 const today=(await db.query("SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1",[session.facility_id])).rows[0].today
 if(!today.startsWith('2026-'))throw fail('The current signing year requires a newer MW507 form.')
 const pdf=await renderMW507Pdf2026({answers}),pdfSha256=hash(pdf)
 const encrypted=encryptDocument(Buffer.from(JSON.stringify({answers,previewPdf:pdf.toString('base64')})),aad(session,task))
 const review=(await db.query(`INSERT INTO payroll_mw507_review(facility_id,employee_id,task_id,onboarding_cycle,employee_session_id,encrypted_review,preview_sha256)
 VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,expires_at`,[session.facility_id,session.employee_id,task.id,task.onboarding_cycle,session.session_id,encrypted,pdfSha256])).rows[0]
 await db.query(`INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'MW507_PREVIEW_CREATED','mw507_review',$2,$3)`,[session.facility_id,String(review.id),{employeeId:session.employee_id,taskId:task.id,onboardingCycle:task.onboarding_cycle,sessionId:session.session_id,previewSha256:pdfSha256}])
 return {reviewId:review.id,expiresAt:review.expires_at,previewSha256:pdfSha256,pdfBase64:pdf.toString('base64'),perjury:MW507_2026.perjury,pageCount:2}
}
export async function signMW507Submission2026(db,session,taskId,body){
 const task=await currentTask(db,session,taskId,body.onboardingCycle)
 if(typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Use a unique MW507 submission key.',400)
 if(body.confirmed!==true||body.reviewedAllPages!==true||body.perjury!==MW507_2026.perjury)throw fail('Review both pages and confirm the exact MW507 declaration before signing.',400)
 if(typeof body.signature!=='string'||!body.signature.trim()||body.signature.length>200||/[\u0000-\u001f\u007f]/.test(body.signature))throw fail('Enter your full name as your electronic signature.',400)
 if(!/^\d+$/.test(String(body.reviewId))||!/^[a-f\d]{64}$/.test(body.previewSha256||''))throw fail('Review the generated MW507 before signing.',400)
 const signature=body.signature.trim().normalize('NFC')
 const requestHash=hash(JSON.stringify({reviewId:String(body.reviewId),previewSha256:body.previewSha256,signature,perjury:body.perjury,onboardingCycle:body.onboardingCycle}))
 const prior=(await db.query('SELECT * FROM payroll_mw507_submission WHERE facility_id=$1 AND employee_id=$2 AND request_key=$3',[session.facility_id,session.employee_id,body.requestKey])).rows[0]
 if(prior){if(prior.request_hash!==requestHash||String(prior.employee_session_id)!==String(session.session_id)||String(prior.task_id)!==String(task.id))throw fail('This MW507 submission key was already used for different details.');return {documentId:prior.document_id,submissionId:prior.id,status:'SUBMITTED'}}
 editable(task)
 const review=(await db.query(`SELECT *,expires_at>clock_timestamp() AS unexpired FROM payroll_mw507_review WHERE id=$1 AND facility_id=$2 AND employee_id=$3 AND task_id=$4 AND onboarding_cycle=$5 AND employee_session_id=$6`,[body.reviewId,session.facility_id,session.employee_id,task.id,task.onboarding_cycle,session.session_id])).rows[0]
 const latest=(await db.query('SELECT id FROM payroll_mw507_review WHERE task_id=$1 AND onboarding_cycle=$2 ORDER BY id DESC LIMIT 1',[task.id,task.onboarding_cycle])).rows[0]
 if(!review||!review.unexpired||String(latest?.id)!==String(review.id)||review.preview_sha256!==body.previewSha256)throw fail('This MW507 preview expired or changed. Generate and review it again.')
 if((await db.query('SELECT id FROM payroll_mw507_submission WHERE review_id=$1',[review.id])).rowCount)throw fail('This MW507 preview has already been signed.')
 if((await db.query('SELECT page_number FROM payroll_mw507_page_visit WHERE review_id=$1',[review.id])).rowCount!==2)throw fail('Open both MW507 pages before signing.')
 const retained=JSON.parse(decryptDocument(review.encrypted_review,aad(session,task)).toString('utf8'))
 if(hash(Buffer.from(retained.previewPdf,'base64'))!==review.preview_sha256)throw fail('The retained MW507 preview failed its integrity check.')
 const signedOn=(await db.query("SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1",[session.facility_id])).rows[0].today
 const pdf=await renderMW507Pdf2026({answers:retained.answers,signature,signedOn})
 const doc=(await db.query(`INSERT INTO payroll_private_document(facility_id,employee_id,task_id,filename,mime_type,encrypted_content,content_sha256,onboarding_cycle)
 VALUES($1,$2,$3,'Form-MW507-2026-signed.pdf','application/pdf',$4,$5,$6) RETURNING id`,[session.facility_id,session.employee_id,task.id,encryptDocument(pdf,`${session.facility_id}:${session.employee_id}:${task.id}`),hash(pdf),task.onboarding_cycle])).rows[0]
 const evidence=encryptDocument(Buffer.from(JSON.stringify({signature,perjury:body.perjury,reviewedAllPages:true,signedOn,previewSha256:review.preview_sha256})),aad(session,task))
 const submission=(await db.query(`INSERT INTO payroll_mw507_submission(facility_id,employee_id,task_id,onboarding_cycle,employee_session_id,review_id,document_id,request_key,request_hash,encrypted_signature)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,[session.facility_id,session.employee_id,task.id,task.onboarding_cycle,session.session_id,review.id,doc.id,body.requestKey,requestHash,evidence])).rows[0]
 await db.query(`INSERT INTO payroll_mw507_draft(facility_id,employee_id,task_id,onboarding_cycle,revision,base_submission_id,employee_session_id) VALUES($1,$2,$3,$4,1,$5,$6)
 ON CONFLICT(task_id,onboarding_cycle) DO UPDATE SET revision=payroll_mw507_draft.revision+1,base_submission_id=EXCLUDED.base_submission_id,encrypted_draft=NULL,employee_session_id=EXCLUDED.employee_session_id,request_key=NULL,request_revision=NULL,updated_at=clock_timestamp()`,[session.facility_id,session.employee_id,task.id,task.onboarding_cycle,submission.id,session.session_id])
 await db.query(`UPDATE payroll_onboarding_task SET response=$1,status='SUBMITTED',submitted_at=clock_timestamp(),completed_at=NULL,updated_at=clock_timestamp() WHERE id=$2`,[{confirmed:true,reference:`Internal MW507 submission ${submission.id}`,mw507SubmissionId:submission.id,mw507ReviewRequirements:mw507ReviewRequirements2026(retained.answers)},task.id])
 await db.query("UPDATE payroll_employee SET state_withholding_status='REQUESTED',updated_at=clock_timestamp() WHERE facility_id=$1 AND id=$2",[session.facility_id,session.employee_id])
 await db.query("UPDATE payroll_tax_election SET elections=elections||$3::jsonb WHERE facility_id=$1 AND employee_id=$2",[session.facility_id,session.employee_id,{mw507ReviewRequired:submission.id}])
 await db.query(`INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'MW507_ELECTRONICALLY_SIGNED','mw507_submission',$2,$3)`,[session.facility_id,String(submission.id),{employeeId:session.employee_id,taskId:task.id,documentId:doc.id,reviewId:review.id,sessionId:session.session_id,onboardingCycle:task.onboarding_cycle,previewSha256:review.preview_sha256,documentSha256:hash(pdf)}])
 return {documentId:doc.id,submissionId:submission.id,status:'SUBMITTED'}
}
