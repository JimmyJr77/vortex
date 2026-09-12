import {createHash} from 'node:crypto'
import {currentI9Review} from './i9Review.js'
import {signI9Section1Pdf} from './i9SignaturePdf.js'
import {encryptDocument} from './onboarding.js'
import {I9_EMPLOYEE_ATTESTATION} from './i9Attestation.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(value).digest('hex')
export async function signI9(db,session,taskId,body){
 const task=(await db.query("SELECT * FROM payroll_onboarding_task WHERE id=$1 AND facility_id=$2 AND employee_id=$3 AND task_key='I9' AND owner='EMPLOYEE' FOR UPDATE",[taskId,session.facility_id,session.employee_id])).rows[0]
 if(!task)throw fail('I-9 employee step not found.',404)
 if(body.onboardingCycle!==task.onboarding_cycle)throw fail('Onboarding cycle changed. Reload the I-9 step.')
 if(typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Use a unique I-9 signing request key.',400)
 if(body.attestation!==I9_EMPLOYEE_ATTESTATION||body.attestationRead!==true||body.reviewedAllPages!==true||body.signingAsEmployee!==true)throw fail('Review all four pages, read the attestation and confirm you are signing as the employee named in Section 1.',400)
 if(typeof body.signature!=='string'||!body.signature.trim()||body.signature.length>200||/[\u0000-\u001f\u007f]/.test(body.signature))throw fail('Enter your name as your electronic signature.',400)
 const signature=body.signature.trim().normalize('NFC'),requestHash=hash(JSON.stringify({reviewId:String(body.reviewId),previewSha256:body.previewSha256,signature,attestation:body.attestation,onboardingCycle:body.onboardingCycle}))
 const prior=(await db.query('SELECT * FROM payroll_i9_submission WHERE facility_id=$1 AND employee_id=$2 AND request_key=$3',[session.facility_id,session.employee_id,body.requestKey])).rows[0]
 const receipt=row=>({submissionId:row.id,documentId:row.document_id,signedAt:row.signed_at,preparerRequired:row.preparer_required,status:'SUBMITTED'})
 if(prior){if(prior.request_hash!==requestHash||String(prior.employee_session_id)!==String(session.session_id)||String(prior.task_id)!==String(task.id))throw fail('This I-9 signing key was already used for different details.');return receipt(prior)}
 const {row,retained,current}=await currentI9Review(db,session,task.id,body)
 if((await db.query('SELECT id FROM payroll_i9_submission WHERE review_id=$1',[row.id])).rowCount)throw fail('This I-9 preview has already been signed.')
 if((await db.query('SELECT page_number FROM payroll_i9_page_visit WHERE review_id=$1',[row.id])).rowCount!==4)throw fail('Open all four I-9 pages before signing.')
 const clock=(await db.query('SELECT clock_timestamp() AS signed_at,(clock_timestamp() AT TIME ZONE timezone)::date::text AS signed_on FROM payroll_settings WHERE facility_id=$1',[session.facility_id])).rows[0]
 const pdf=await signI9Section1Pdf(Buffer.from(retained.previewPdf,'base64'),{signature,signedOn:clock.signed_on})
 const doc=(await db.query(`INSERT INTO payroll_private_document(facility_id,employee_id,task_id,filename,mime_type,encrypted_content,content_sha256,onboarding_cycle) VALUES($1,$2,$3,'Form-I9-Section1-signed.pdf','application/pdf',$4,$5,$6) RETURNING id`,[session.facility_id,session.employee_id,task.id,encryptDocument(pdf,`${session.facility_id}:${session.employee_id}:${task.id}`),hash(pdf),task.onboarding_cycle])).rows[0]
 const evidence=encryptDocument(Buffer.from(JSON.stringify({signature,attestation:body.attestation,attestationRead:true,reviewedAllPages:true,signingAsEmployee:true,authenticatedEmployeeId:session.employee_id,authenticatedSessionId:session.session_id,signedAt:clock.signed_at,signedOn:clock.signed_on,previewSha256:row.preview_sha256,documentSha256:hash(pdf),hiringRevision:row.hiring_revision,draftRevision:row.draft_revision})),`i9-signature:${session.facility_id}:${session.employee_id}:${task.id}:${task.onboarding_cycle}:${session.session_id}`)
 const submission=(await db.query(`INSERT INTO payroll_i9_submission(facility_id,employee_id,task_id,onboarding_cycle,employee_session_id,review_id,document_id,request_key,request_hash,encrypted_signature,preparer_required,signed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[session.facility_id,session.employee_id,task.id,task.onboarding_cycle,session.session_id,row.id,doc.id,body.requestKey,requestHash,evidence,retained.answers.preparerAssisted,clock.signed_at])).rows[0]
 await db.query('UPDATE payroll_i9_draft SET revision=revision+1,encrypted_draft=NULL,employee_session_id=$1,request_key=NULL,request_revision=NULL,updated_at=clock_timestamp() WHERE task_id=$2 AND onboarding_cycle=$3',[session.session_id,task.id,task.onboarding_cycle])
 await db.query("UPDATE payroll_onboarding_task SET response=$1,status='SUBMITTED',submitted_at=$2,completed_at=NULL,updated_at=clock_timestamp() WHERE id=$3",[{confirmed:true,reference:`Internal I-9 Section 1 submission ${submission.id}`,i9SubmissionId:submission.id,i9PreparerRequired:retained.answers.preparerAssisted,i9SignedAt:clock.signed_at,i9HiringRevision:current.hiring.revision},clock.signed_at,task.id])
 await db.query("UPDATE payroll_employee_document SET status='REVERIFY',completed_at=NULL,notes='Employee Section 1 signed; current employer review remains required.',updated_at=clock_timestamp() WHERE facility_id=$1 AND employee_id=$2 AND document_type='I9'",[session.facility_id,session.employee_id])
 await db.query("UPDATE payroll_employee SET i9_status='SECTION_1',updated_at=clock_timestamp() WHERE facility_id=$1 AND id=$2",[session.facility_id,session.employee_id])
 await db.query("UPDATE payroll_onboarding_task SET status='OPEN',completed_at=NULL,reviewed_by=NULL,review_note='Review the current employee-signed Section 1 before completing employer examination.',updated_at=clock_timestamp() WHERE facility_id=$1 AND employee_id=$2 AND task_key='I9_REVIEW'",[session.facility_id,session.employee_id])
 await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'I9_SECTION1_SIGNED','i9_submission',$2,$3)",[session.facility_id,String(submission.id),{employeeId:session.employee_id,taskId:task.id,onboardingCycle:task.onboarding_cycle,sessionId:session.session_id,reviewId:row.id,documentId:doc.id,previewSha256:row.preview_sha256,documentSha256:hash(pdf)}])
 return receipt(submission)
}
