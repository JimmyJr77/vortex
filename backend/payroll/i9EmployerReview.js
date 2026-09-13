import {qualificationAllowsAlternative} from './i9Qualification.js'
import {createHash} from 'node:crypto'
import {i9EmployerBasis,readI9EmployerDraft} from './i9EmployerDraft.js'
import {preparerRoster} from './i9Preparers.js'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {renderI9Section2Preview} from './i9Section2Pdf.js'
import {i9Section2Input} from './i9Section2.js'
import {I9_EMPLOYER_ATTESTATION} from './i9Examination.js'
import {i9DocumentEntries} from './i9DocumentEntries.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(value).digest('hex')
const aad=(ctx,taskId,cycle)=>`i9-employer-review:${ctx.facility}:${ctx.employee}:${BigInt(taskId)}:${cycle}:${ctx.admin}`
export function employerDraftAnswers(draft){
 const {listA,listB,listC,...common}=draft
 return {...common,edition:'01/20/25',...(draft.documentChoice==='LIST_A'?{listA}:{listB,listC})}
}
async function basis(db,ctx,taskId,cycle){
 const current=await i9EmployerBasis(db,ctx,taskId,cycle)
 if(!['OPEN','SUBMITTED','CHANGES_REQUESTED'].includes(current.task.status))throw fail('Reopen the employer I-9 step before preparing a review.')
 if(current.employeeTask.status!=='COMPLETE'||!current.submissionId)throw fail('Review and approve the employee’s signed Section 1 and required preparer certifications first.')
 const submission=(await db.query('SELECT s.*,v.hiring_revision FROM payroll_i9_submission s JOIN payroll_i9_review v ON v.id=s.review_id WHERE s.id=$1',[current.submissionId])).rows[0]
 const hiring=(await db.query('SELECT revision FROM payroll_i9_hiring_context WHERE task_id=$1 AND onboarding_cycle=$2 ORDER BY revision DESC LIMIT 1',[current.employeeTask.id,cycle])).rows[0]
 if(!submission||submission.hiring_revision!==hiring?.revision)throw fail('The employee must review and sign Section 1 again after the hiring context changed.')
 const roster=await preparerRoster(db,ctx,current.employeeTask.id,cycle),active=roster.requests.filter(r=>!r.cancelledAt)
 if(submission.preparer_required&&(!active.length||active.some(r=>!r.signatureId)||current.employeeTask.response?.i9PreparerReview?.confirmed!==true||current.employeeTask.response?.i9PreparerReview?.fingerprint!==roster.fingerprint))throw fail('Review the complete current preparer roster before preparing the employer form.')
 const draft=await readI9EmployerDraft(db,ctx,taskId,cycle)
 if(!draft.draft)throw fail('Save the current employer draft before preparing the form.')
 return {...current,submission,roster,active,draft}
}
async function privatePdf(db,ctx,id){
 const row=(await db.query('SELECT * FROM payroll_private_document WHERE id=$1 AND facility_id=$2 AND employee_id=$3',[id,ctx.facility,ctx.employee])).rows[0]
 if(!row||row.mime_type!=='application/pdf')throw fail('A retained I-9 PDF is unavailable.')
 const bytes=decryptDocument(row.encrypted_content,`${ctx.facility}:${ctx.employee}:${row.task_id}`)
 if(hash(bytes)!==row.content_sha256)throw fail('A retained I-9 document failed its integrity check.')
 return {bytes,sha256:row.content_sha256}
}
export async function previewI9Employer(db,ctx,taskId,body){
 const current=await basis(db,ctx,taskId,body.onboardingCycle)
 if(body.expectedRevision!==current.draft.revision||body.basisHash!==current.draft.basisHash)throw fail('The employer draft changed. Save and prepare the current version.')
 const answers=i9Section2Input(employerDraftAnswers(current.draft.draft)),source=await privatePdf(db,ctx,current.submission.document_id)
 const pdf=await renderI9Section2Preview(source.bytes,employerDraftAnswers(answers)),previewSha256=hash(pdf),supplements=[]
 for(const person of current.active){
  if(!person.documentId)throw fail('A preparer certificate is missing.')
  const retained=await privatePdf(db,ctx,person.documentId)
  supplements.push({documentKey:String(person.documentId),documentId:person.documentId,sha256:retained.sha256,pdfBase64:retained.bytes.toString('base64'),pageCount:1})
 }
 const retained={answers,sourceDocumentId:current.submission.document_id,sourceSha256:source.sha256,pdfBase64:pdf.toString('base64'),supplements}
 const row=(await db.query(`INSERT INTO payroll_i9_employer_review(facility_id,employee_id,task_id,onboarding_cycle,submission_id,draft_revision,basis_hash,preparer_fingerprint,preparer_document_ids,actor_user_id,encrypted_review,preview_sha256)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,expires_at`,[ctx.facility,ctx.employee,taskId,body.onboardingCycle,current.submissionId,current.draft.revision,current.draft.basisHash,current.roster.fingerprint,supplements.map(s=>s.documentId),ctx.admin,encryptDocument(Buffer.from(JSON.stringify(retained)),aad(ctx,taskId,body.onboardingCycle)),previewSha256])).rows[0]
 for(const entry of i9DocumentEntries(answers))await db.query('INSERT INTO payroll_i9_review_document_entry(review_id,row_key,document_fingerprint) VALUES($1,$2,$3)',[row.id,entry.key,entry.fingerprint])
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'I9_EMPLOYER_PREVIEW_CREATED','i9_employer_review',$3,$4)",[ctx.facility,ctx.admin,String(row.id),{employeeId:ctx.employee,taskId,onboardingCycle:body.onboardingCycle,submissionId:current.submissionId,draftRevision:current.draft.revision,previewSha256,preparerDocumentIds:supplements.map(s=>s.documentId)}])
 const context=(await db.query('SELECT hire_date::text AS "hireDate",(clock_timestamp() AT TIME ZONE s.timezone)::date::text AS today FROM payroll_employee e JOIN payroll_settings s ON s.facility_id=e.facility_id WHERE e.id=$1 AND e.facility_id=$2',[ctx.employee,ctx.facility])).rows[0]
 const hiring=(await db.query('SELECT e_verify AS "eVerify",offer_accepted_on::text AS "offerAcceptedOn" FROM payroll_i9_hiring_context WHERE task_id=$1 AND onboarding_cycle=$2 ORDER BY revision DESC LIMIT 1',[current.employeeTask.id,body.onboardingCycle])).rows[0]
 return {attestation:I9_EMPLOYER_ATTESTATION,examinationContext:{...context,...hiring,qualification:current.qualification,eVerify:qualificationAllowsAlternative(current.qualification,hiring.eVerify),examinationMethod:answers.examinationMethod,documentChoice:answers.documentChoice,representativeNameAndTitle:answers.representativeNameAndTitle},reviewId:row.id,expiresAt:row.expires_at,previewSha256,pdfBase64:retained.pdfBase64,pageCount:4,supplements}
}
export async function currentI9EmployerReview(db,ctx,taskId,body){
 const current=await basis(db,ctx,taskId,body.onboardingCycle)
 if(!/^\d+$/.test(String(body.reviewId))||!/^[a-f0-9]{64}$/.test(body.previewSha256||''))throw fail('Prepare the employer form before recording its review.',400)
 const row=(await db.query('SELECT *,expires_at>clock_timestamp() AS unexpired FROM payroll_i9_employer_review WHERE id=$1 AND facility_id=$2 AND employee_id=$3 AND task_id=$4 AND onboarding_cycle=$5 AND actor_user_id=$6',[body.reviewId,ctx.facility,ctx.employee,taskId,body.onboardingCycle,ctx.admin])).rows[0]
 const latest=(await db.query('SELECT id FROM payroll_i9_employer_review WHERE task_id=$1 AND onboarding_cycle=$2 ORDER BY id DESC LIMIT 1',[taskId,body.onboardingCycle])).rows[0]
 if(!row||!row.unexpired||String(row.id)!==String(latest?.id)||row.preview_sha256!==body.previewSha256||row.draft_revision!==current.draft.revision||row.basis_hash!==current.draft.basisHash||row.preparer_fingerprint!==current.roster.fingerprint||String(row.submission_id)!==String(current.submissionId))throw fail('This employer review expired or its employee, draft or preparer evidence changed. Prepare it again.')
 const retained=JSON.parse(decryptDocument(row.encrypted_review,aad(ctx,taskId,body.onboardingCycle)).toString())
 if(hash(Buffer.from(retained.pdfBase64,'base64'))!==row.preview_sha256||retained.supplements.some(s=>hash(Buffer.from(s.pdfBase64,'base64'))!==s.sha256))throw fail('The retained employer review failed its integrity check.')
 return {row,retained,current}
}
export async function recordI9EmployerPage(db,ctx,taskId,body){
 const key=String(body.documentKey||'')
 if(body.displayed!==true||!Number.isInteger(body.page)||body.page<1||body.page>4||!(key==='main'||/^[1-9]\d*$/.test(key)))throw fail('Display the selected I-9 page before recording its review.',400)
 const {row,retained}=await currentI9EmployerReview(db,ctx,taskId,body)
 if(key!=='main'&&(!retained.supplements.some(s=>s.documentKey===key)||body.page!==1))throw fail('Choose a page from this employer review packet.',400)
 await db.query('INSERT INTO payroll_i9_employer_page_visit(review_id,document_key,page_number) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[row.id,key,body.page])
 return {documentKey:key,page:body.page,recorded:true}
}
