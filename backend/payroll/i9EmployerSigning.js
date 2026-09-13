import {qualificationAllowsAlternative} from './i9Qualification.js'
import {createHash} from 'node:crypto'
import {i9EmployerBasis} from './i9EmployerDraft.js'
import {currentI9EmployerReview} from './i9EmployerReview.js'
import {i9DocumentEntries} from './i9DocumentEntries.js'
import {i9ExaminationInput,validateI9Examination,I9_EMPLOYER_ATTESTATION} from './i9Examination.js'
import {signRetainedPayrollForm} from './i9SignaturePdf.js'
import {encryptDocument,decryptDocument} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(value).digest('hex')
export async function signI9Employer(db,ctx,taskId,body){
 const basis=await i9EmployerBasis(db,ctx,taskId,body.onboardingCycle)
 if(typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Use a unique employer signing request key.',400)
 if(body.attestation!==I9_EMPLOYER_ATTESTATION||body.attestationRead!==true||body.signingAsExaminer!==true||body.reviewedAllPages!==true||body.representativeIdentityConfirmed!==true)throw fail('Read the certification and confirm that you are the named representative who performed this examination and reviewed the complete packet.',400)
 if(typeof body.signature!=='string'||!body.signature.trim()||body.signature.length>200||/[\u0000-\u001f\u007f]/.test(body.signature)||!/^\d+$/.test(String(body.reviewId)))throw fail('Enter your own name as the employer electronic signature.',400)
 const signature=body.signature.trim().normalize('NFC'),examination=i9ExaminationInput(body.examination)
 const requestHash=hash(JSON.stringify({taskId:String(basis.task.id),cycle:basis.task.onboarding_cycle,reviewId:String(BigInt(body.reviewId)),previewSha256:body.previewSha256,signature,examination,attestation:body.attestation}))
 const prior=(await db.query('SELECT * FROM payroll_i9_employer_signature WHERE facility_id=$1 AND employee_id=$2 AND request_key=$3',[ctx.facility,ctx.employee,body.requestKey])).rows[0]
 const receipt=row=>({signatureId:row.id,documentId:row.document_id,signedAt:row.signed_at,status:'SIGNED'})
 if(prior){if(prior.request_hash!==requestHash||String(prior.actor_user_id)!==String(ctx.admin))throw fail('This employer signing key was already used for different details.');return receipt(prior)}
 const {row,retained,current}=await currentI9EmployerReview(db,ctx,taskId,body)
 if((await db.query('SELECT id FROM payroll_i9_employer_signature WHERE review_id=$1',[row.id])).rowCount)throw fail('This employer review has already been signed.')
 const visits=(await db.query('SELECT document_key,page_number FROM payroll_i9_employer_page_visit WHERE review_id=$1',[row.id])).rows
 if([1,2,3,4].some(page=>!visits.some(v=>v.document_key==='main'&&v.page_number===page))||retained.supplements.some(s=>!visits.some(v=>v.document_key===s.documentKey&&v.page_number===1)))throw fail('Display every page of the employer form and every preparer certificate before signing.')
 const clock=(await db.query('SELECT clock_timestamp() AS signed_at,(clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[ctx.facility])).rows[0]
 const employee=(await db.query('SELECT hire_date::text AS hire_date FROM payroll_employee WHERE id=$1 AND facility_id=$2',[ctx.employee,ctx.facility])).rows[0]
 const hiring=(await db.query('SELECT offer_accepted_on::text AS offer_accepted_on,e_verify FROM payroll_i9_hiring_context WHERE task_id=$1 AND onboarding_cycle=$2 ORDER BY revision DESC LIMIT 1',[current.employeeTask.id,body.onboardingCycle])).rows[0]
 const employeeReview=(await db.query('SELECT * FROM payroll_i9_review WHERE id=$1',[current.submission.review_id])).rows[0]
 const employeeAnswers=JSON.parse(decryptDocument(employeeReview.encrypted_review,`i9-review:${ctx.facility}:${ctx.employee}:${current.employeeTask.id}:${body.onboardingCycle}:${employeeReview.employee_session_id}`).toString()).answers
 const context={qualification:current.qualification,alternativeQualified:qualificationAllowsAlternative(current.qualification,hiring.e_verify),today:clock.today,offerAcceptedOn:hiring.offer_accepted_on,eVerify:hiring.e_verify,hireDate:employee.hire_date,attestationKind:employeeAnswers.attestation.kind,authorizationExpiresOn:employeeAnswers.attestation.authorizationExpiresOn||null}
 const timing=validateI9Examination(examination,retained.answers,{...context,eVerify:context.alternativeQualified}),entries=i9DocumentEntries(retained.answers),copies=[]
 for(const decision of examination.documents){
  const entry=entries.find(e=>e.key===decision.rowKey)
  for(const copyId of decision.copyIds){
   const copy=(await db.query(`SELECT c.*,d.content_sha256,d.encrypted_content FROM payroll_i9_document_copy c JOIN payroll_private_document d ON d.id=c.document_id WHERE c.id=$1 AND c.task_id=$2 AND c.onboarding_cycle=$3 AND c.submission_id=$4 AND c.row_key=$5 AND c.document_fingerprint=$6`,[copyId,taskId,body.onboardingCycle,current.submissionId,decision.rowKey,entry.fingerprint])).rows[0]
   if(!copy)throw fail('A selected copy no longer matches the current employee document.')
   const pages=(await db.query('SELECT page_number FROM payroll_i9_copy_page_visit WHERE review_id=$1 AND copy_id=$2',[row.id,copy.id])).rows
   if(pages.length!==copy.page_count)throw fail('Display every page of each selected document copy before signing.')
   if(hash(decryptDocument(copy.encrypted_content,`${ctx.facility}:${ctx.employee}:${basis.task.id}`))!==copy.content_sha256)throw fail('A selected copy failed its integrity check.')
   copies.push({copyId:copy.id,documentId:copy.document_id,rowKey:decision.rowKey,sha256:copy.content_sha256,pageCount:copy.page_count})
  }
 }
 const pdf=await signRetainedPayrollForm(Buffer.from(retained.pdfBase64,'base64'),{signature,signedOn:clock.today,signatureField:'Signature of Employer or AR',dateField:'S2 Todays Date mmddyyyy',pageCount:4,title:'I-9 - employer certified'})
 const doc=(await db.query("INSERT INTO payroll_private_document(facility_id,employee_id,task_id,onboarding_cycle,filename,mime_type,encrypted_content,content_sha256) VALUES($1,$2,$3,$4,'Form-I9-employer-signed.pdf','application/pdf',$5,$6) RETURNING id",[ctx.facility,ctx.employee,basis.task.id,body.onboardingCycle,encryptDocument(pdf,`${ctx.facility}:${ctx.employee}:${basis.task.id}`),hash(pdf)])).rows[0]
 const evidence={signature,attestation:I9_EMPLOYER_ATTESTATION,attestationRead:true,signingAsExaminer:true,representativeIdentityConfirmed:true,reviewedAllPages:true,actorUserId:ctx.admin,signedAt:clock.signed_at,signedOn:clock.today,examination,timing,context,reviewId:row.id,submissionId:current.submissionId,previewSha256:row.preview_sha256,documentSha256:hash(pdf),copies,preparerDocuments:retained.supplements.map(s=>({documentId:s.documentId,sha256:s.sha256}))}
 const signed=(await db.query(`INSERT INTO payroll_i9_employer_signature(facility_id,employee_id,task_id,onboarding_cycle,submission_id,review_id,document_id,actor_user_id,request_key,request_hash,selected_copy_ids,encrypted_signature,signed_at)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[ctx.facility,ctx.employee,basis.task.id,body.onboardingCycle,current.submissionId,row.id,doc.id,ctx.admin,body.requestKey,requestHash,copies.map(c=>c.copyId),encryptDocument(Buffer.from(JSON.stringify(evidence)),`i9-employer-signature:${ctx.facility}:${ctx.employee}:${basis.task.id}:${body.onboardingCycle}:${ctx.admin}`),clock.signed_at])).rows[0]
 for(const decision of examination.documents.filter(d=>d.followUpKind!=='NONE')){
  const followup=(await db.query(`INSERT INTO payroll_compliance_task(facility_id,employee_id,task_key,title,category,jurisdiction,due_date,status,severity,description,source_url,source_authority,last_verified_on) VALUES($1,$2,$3,'I-9 document follow-up','ONBOARDING','US',$4,'OPEN','CRITICAL',$5,$6,'Examiner-verified I-9 rule',$7) RETURNING id`,[ctx.facility,ctx.employee,`I9_DOCUMENT_FOLLOWUP:${signed.id}:${decision.rowKey}`,decision.followUpOn,`Review the retained examination for employer certification ${signed.id}, document row ${decision.rowKey}. Complete the required document follow-up and retain the resulting I-9 evidence.`,decision.ruleSource,clock.today])).rows[0]
  await db.query('INSERT INTO payroll_i9_signature_followup(signature_id,row_key,kind,due_on,compliance_task_id) VALUES($1,$2,$3,$4,$5)',[signed.id,decision.rowKey,decision.followUpKind,decision.followUpOn,followup.id])
 }
 if(context.eVerify)await db.query(`INSERT INTO payroll_compliance_task(facility_id,employee_id,task_key,title,category,jurisdiction,due_date,status,severity,description,source_url,source_authority) VALUES($1,$2,$3,'E-Verify case review','ONBOARDING','US',$4,'OPEN','CRITICAL',$5,'https://www.e-verify.gov/employers/verification-process','E-Verify')`,[ctx.facility,ctx.employee,`I9_EVERIFY_CASE:${signed.id}`,timing.dueOn,`Create or reconcile the E-Verify case for employer I-9 certification ${signed.id}, including any pending-SSN requirements. Signing Section 2 does not create or resolve an E-Verify case.`])
 await db.query("UPDATE payroll_onboarding_task SET status='COMPLETE',response=$1,completed_at=$2,reviewed_by=$3,review_note='Employer signed the current retained I-9 packet and examination record.',updated_at=clock_timestamp() WHERE id=$4",[{i9EmployerSignatureId:signed.id,i9EmployeeSubmissionId:current.submissionId,i9EmployerDocumentId:doc.id,i9EmployerSignedAt:clock.signed_at},clock.signed_at,ctx.admin,basis.task.id])
 await db.query("UPDATE payroll_employee SET i9_status='COMPLETE',updated_at=clock_timestamp() WHERE facility_id=$1 AND id=$2",[ctx.facility,ctx.employee])
 await db.query("UPDATE payroll_employee_document SET status='VERIFIED',completed_at=$1,notes='Native employer I-9 certification retained; review any associated follow-up tasks.',updated_at=clock_timestamp() WHERE facility_id=$2 AND employee_id=$3 AND document_type='I9'",[clock.signed_at,ctx.facility,ctx.employee])
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'I9_EMPLOYER_SIGNED','i9_employer_signature',$3,$4)",[ctx.facility,ctx.admin,String(signed.id),{employeeId:ctx.employee,taskId:basis.task.id,onboardingCycle:body.onboardingCycle,submissionId:current.submissionId,reviewId:row.id,documentId:doc.id,copyIds:copies.map(c=>c.copyId),documentSha256:hash(pdf)}])
 return receipt(signed)
}
