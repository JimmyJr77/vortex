import {createHash} from 'node:crypto'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {i9SupplementBInput} from './i9SupplementB.js'
import {renderI9SupplementBPreview} from './i9SupplementBPdf.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(value).digest('hex')
const aad=(ctx,row)=>`i9-supplement-review:${ctx.facility}:${ctx.employee}:${row.compliance_task_id}:${row.actor_user_id}`
export const I9_SUPPLEMENT_B_ATTESTATION='I attest, under penalty of perjury, that to the best of my knowledge, this employee is authorized to work in the United States, and if the employee presented documentation, the documentation I examined appears to be genuine and to relate to the individual who presented it.'
export async function i9DocumentFollowupBasis(db,ctx,taskId,kind){
 await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility])
 const row=(await db.query(`SELECT c.id AS compliance_task_id,c.status,c.due_date::text AS due_on,f.kind,f.row_key AS followup_row_key,s.*,d.content_sha256,d.encrypted_content,e.status AS employee_status,e.response AS employee_response,t.status AS employer_status,t.response AS employer_response,t.onboarding_cycle AS current_cycle FROM payroll_compliance_task c JOIN payroll_i9_signature_followup f ON f.compliance_task_id=c.id JOIN payroll_i9_employer_signature s ON s.id=f.signature_id JOIN payroll_private_document d ON d.id=s.document_id JOIN payroll_onboarding_task t ON t.id=s.task_id JOIN payroll_onboarding_task e ON e.facility_id=s.facility_id AND e.employee_id=s.employee_id AND e.task_key='I9' WHERE c.id=$1 AND c.facility_id=$2 AND c.employee_id=$3 AND s.facility_id=c.facility_id AND s.employee_id=c.employee_id FOR UPDATE OF c,t,e`,[taskId,ctx.facility,ctx.employee])).rows[0]
 if(!row)throw fail('I-9 document follow-up not found.',404)
 if(row.kind!==kind)throw fail('This follow-up requires its document replacement or correction workflow.')
 if(!['OPEN','IN_PROGRESS'].includes(row.status))throw fail('This follow-up is already closed.')
 if(row.employee_status!=='COMPLETE'||row.employer_status!=='COMPLETE'||row.current_cycle!==row.onboarding_cycle||String(row.employee_response?.i9SubmissionId)!==String(row.submission_id)||String(row.employer_response?.i9EmployerSignatureId)!==String(row.id))throw fail('The source I-9 is historical or was reopened. Resolve its current certification first.')
 const retained=JSON.parse(decryptDocument(row.encrypted_signature,`i9-employer-signature:${ctx.facility}:${ctx.employee}:${row.task_id}:${row.onboarding_cycle}:${row.actor_user_id}`).toString())
 if(kind==='REVERIFICATION'&&['CITIZEN','NONCITIZEN_NATIONAL'].includes(retained.context.attestationKind))throw fail('Do not reverify a U.S. citizen or noncitizen national.')
 const bytes=decryptDocument(row.encrypted_content,`${ctx.facility}:${ctx.employee}:${row.task_id}`)
 if(hash(bytes)!==row.content_sha256||retained.documentSha256!==row.content_sha256)throw fail('The source employer certification failed its integrity check.')
 const previousSupplements=[]
 for(const prior of (await db.query('SELECT s.*,d.content_sha256,d.encrypted_content,d.task_id FROM payroll_i9_supplement_signature s JOIN payroll_private_document d ON d.id=s.document_id WHERE s.signature_id=$1 ORDER BY s.id',[row.id])).rows){
  const retainedPrior=JSON.parse(decryptDocument(prior.encrypted_evidence,`i9-supplement-signature:${ctx.facility}:${ctx.employee}:${prior.compliance_task_id}:${prior.actor_user_id}`).toString())
  const pdf=decryptDocument(prior.encrypted_content,`${ctx.facility}:${ctx.employee}:${prior.task_id}`)
  if(hash(pdf)!==prior.content_sha256||retainedPrior.documentSha256!==prior.content_sha256)throw fail('A prior supplement failed its integrity check.')
  previousSupplements.push({signatureId:prior.id,documentId:prior.document_id,documentKey:`prior:${prior.id}`,sha256:prior.content_sha256,pdfBase64:pdf.toString('base64'),pageCount:1})
 }
 const previousReceiptAmendments=[]
 for(const prior of (await db.query('SELECT s.*,d.content_sha256,d.encrypted_content,d.task_id FROM payroll_i9_receipt_signature s JOIN payroll_private_document d ON d.id=s.document_id WHERE s.signature_id=$1 ORDER BY s.id',[row.id])).rows){
  const evidence=JSON.parse(decryptDocument(prior.encrypted_evidence,`i9-receipt-signature:${ctx.facility}:${ctx.employee}:${prior.compliance_task_id}:${prior.actor_user_id}`).toString())
  const pdf=decryptDocument(prior.encrypted_content,`${ctx.facility}:${ctx.employee}:${prior.task_id}`)
  if(hash(pdf)!==prior.content_sha256||evidence.documentSha256!==prior.content_sha256||!Number.isInteger(evidence.pageCount)||evidence.pageCount<2||evidence.pageCount>100)throw fail('A prior receipt amendment failed its integrity check.')
  previousReceiptAmendments.push({signatureId:prior.id,documentId:prior.document_id,documentKey:`receipt:${prior.id}`,sha256:prior.content_sha256,pdfBase64:pdf.toString('base64'),pageCount:evidence.pageCount})
 }
 for(const prior of (await db.query('SELECT s.*,d.content_sha256,d.encrypted_content,d.task_id FROM payroll_i9_different_signature s JOIN payroll_private_document d ON d.id=s.document_id WHERE s.signature_id=$1 ORDER BY s.id',[row.id])).rows){
  const evidence=JSON.parse(decryptDocument(prior.encrypted_evidence,`i9-different-signature:${ctx.facility}:${ctx.employee}:${prior.compliance_task_id}:${prior.actor_user_id}`).toString())
  const pdf=decryptDocument(prior.encrypted_content,`${ctx.facility}:${ctx.employee}:${prior.task_id}`)
  if(hash(pdf)!==prior.content_sha256||evidence.documentSha256!==prior.content_sha256||!Number.isInteger(evidence.pageCount)||evidence.pageCount<2||evidence.pageCount>100)throw fail('A prior different-document certification failed its integrity check.')
  previousReceiptAmendments.push({signatureId:prior.id,documentId:prior.document_id,documentKey:`different:${prior.id}`,sha256:prior.content_sha256,pdfBase64:pdf.toString('base64'),pageCount:evidence.pageCount})
 }
 const basisHash=hash(JSON.stringify({signatureId:row.id,sourceSha256:row.content_sha256,cycle:row.current_cycle,employee:row.employee_response,employer:row.employer_response,status:row.status,dueOn:row.due_on,previousSupplements:previousSupplements.map(p=>[p.signatureId,p.sha256]),previousReceiptAmendments:previousReceiptAmendments.map(p=>[p.documentKey,p.signatureId,p.sha256])}))
 return {row,bytes,retained,basisHash,previousSupplements,previousReceiptAmendments}
}
export const i9SupplementBBasis=(db,ctx,taskId)=>i9DocumentFollowupBasis(db,ctx,taskId,'REVERIFICATION')
export async function previewI9SupplementB(db,ctx,taskId,body){
 if(!body||Object.keys(body).some(k=>!['signatureId','answers'].includes(k)))throw fail('Use the supported Supplement B preview fields.',400)
 const current=await i9SupplementBBasis(db,ctx,taskId)
 if(String(body.signatureId)!==String(current.row.id))throw fail('Reload the current employer certification before preparing Supplement B.')
 taskId=current.row.compliance_task_id
 const answers=i9SupplementBInput(body.answers),pdf=await renderI9SupplementBPreview(current.bytes,answers),previewSha256=hash(pdf)
 const evidence={answers,previousSupplements:current.previousSupplements,previousReceiptAmendments:current.previousReceiptAmendments,pdfBase64:pdf.toString('base64'),sourceDocumentId:current.row.document_id,sourceSha256:current.row.content_sha256,sourcePdfBase64:current.bytes.toString('base64')}
 const row=(await db.query(`INSERT INTO payroll_i9_supplement_review(facility_id,employee_id,compliance_task_id,signature_id,actor_user_id,basis_hash,preview_sha256,encrypted_review,document_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,expires_at`,[ctx.facility,ctx.employee,taskId,current.row.id,ctx.admin,current.basisHash,previewSha256,encryptDocument(Buffer.from(JSON.stringify(evidence)),aad(ctx,{compliance_task_id:taskId,actor_user_id:ctx.admin})),hash(JSON.stringify(answers.document))])).rows[0]
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'I9_SUPPLEMENT_PREVIEW_CREATED','i9_supplement_review',$3,$4)",[ctx.facility,ctx.admin,String(row.id),{employeeId:ctx.employee,complianceTaskId:taskId,signatureId:current.row.id,previewSha256}])
 return {reviewId:row.id,expiresAt:row.expires_at,previewSha256,pdfBase64:evidence.pdfBase64,pageCount:1,previousSupplements:current.previousSupplements,previousReceiptAmendments:current.previousReceiptAmendments,source:{documentId:evidence.sourceDocumentId,sha256:evidence.sourceSha256,pdfBase64:evidence.sourcePdfBase64,pageCount:4},attestation:I9_SUPPLEMENT_B_ATTESTATION}
}
export async function currentI9SupplementBReview(db,ctx,taskId,body){
 const current=await i9SupplementBBasis(db,ctx,taskId)
 if(!/^[1-9]\d*$/.test(String(body.reviewId))||!/^[a-f0-9]{64}$/.test(body.previewSha256||''))throw fail('Prepare and display the current Supplement B review.',400)
 const row=(await db.query('SELECT *,expires_at>clock_timestamp() AS unexpired FROM payroll_i9_supplement_review WHERE id=$1 AND facility_id=$2 AND employee_id=$3 AND compliance_task_id=$4 AND actor_user_id=$5',[body.reviewId,ctx.facility,ctx.employee,taskId,ctx.admin])).rows[0]
 const latest=(await db.query('SELECT id FROM payroll_i9_supplement_review WHERE compliance_task_id=$1 ORDER BY id DESC LIMIT 1',[taskId])).rows[0]
 if(!row||!row.unexpired||String(row.id)!==String(latest?.id)||row.preview_sha256!==body.previewSha256||row.basis_hash!==current.basisHash||String(row.signature_id)!==String(current.row.id))throw fail('This Supplement B review expired or its source changed. Prepare a new review.')
 const retained=JSON.parse(decryptDocument(row.encrypted_review,aad(ctx,row)).toString())
 if(row.document_fingerprint!==hash(JSON.stringify(retained.answers.document))||hash(Buffer.from(retained.pdfBase64,'base64'))!==row.preview_sha256||hash(Buffer.from(retained.sourcePdfBase64,'base64'))!==current.row.content_sha256)throw fail('The retained Supplement B review failed its integrity check.')
 return {row,retained,current}
}
export async function recordI9SupplementBPage(db,ctx,taskId,body){
 if(body.displayed!==true||!(['supplement','source'].includes(body.documentKey)||/^(prior|receipt|different):[1-9]\d*$/.test(body.documentKey))||!Number.isInteger(body.page)||body.page<1)throw fail('Display a page from the current Supplement B review packet.',400)
 const {row,retained}=await currentI9SupplementBReview(db,ctx,taskId,body)
 const count=body.documentKey==='source'?4:body.documentKey==='supplement'?1:[...(retained.previousSupplements||[]),...(retained.previousReceiptAmendments||[])].find(p=>p.documentKey===body.documentKey)?.pageCount
 if(!count||body.page>count)throw fail('Choose a page in this review packet.',400)
 await db.query('INSERT INTO payroll_i9_supplement_page_visit(review_id,document_key,page_number) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[row.id,body.documentKey,body.page])
 return {documentKey:body.documentKey,page:body.page,recorded:true}
}
