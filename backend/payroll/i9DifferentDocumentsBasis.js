import {createHash} from 'node:crypto'
import {decryptDocument} from './onboarding.js'
import {i9ReceiptBasis} from './i9ReceiptReview.js'
import {renderI9DifferentDocumentsPreview} from './i9DifferentDocumentsPdf.js'
const hash=value=>createHash('sha256').update(value).digest('hex')
const fail=message=>Object.assign(new Error(message),{status:409})
// Invoke inside the caller's transaction. The receipt basis locks the current
// employee/employer tasks and rejects historical or already resolved receipts.
export async function i9DifferentDocumentsBasis(db,ctx,taskId){
 const current=await i9ReceiptBasis(db,ctx,taskId),root=current.row
 const submission=(await db.query(`SELECT s.*,d.encrypted_content,d.content_sha256,d.mime_type FROM payroll_i9_submission s JOIN payroll_private_document d ON d.id=s.document_id AND d.facility_id=s.facility_id AND d.employee_id=s.employee_id AND d.task_id=s.task_id AND d.onboarding_cycle=s.onboarding_cycle WHERE s.id=$1 AND s.facility_id=$2 AND s.employee_id=$3 AND s.onboarding_cycle=$4`,[root.submission_id,ctx.facility,ctx.employee,root.onboarding_cycle])).rows[0]
 if(!submission||submission.mime_type!=='application/pdf')throw fail('The original signed employee I-9 is unavailable.')
 const bytes=decryptDocument(submission.encrypted_content,`${ctx.facility}:${ctx.employee}:${submission.task_id}`)
 const signature=JSON.parse(decryptDocument(submission.encrypted_signature,`i9-signature:${ctx.facility}:${ctx.employee}:${submission.task_id}:${submission.onboarding_cycle}:${submission.employee_session_id}`).toString())
 if(hash(bytes)!==submission.content_sha256||signature.documentSha256!==submission.content_sha256)throw fail('The original employee I-9 failed its integrity check.')
 const review=(await db.query('SELECT * FROM payroll_i9_employer_review WHERE id=$1 AND facility_id=$2 AND employee_id=$3 AND task_id=$4 AND onboarding_cycle=$5 AND submission_id=$6',[root.review_id,ctx.facility,ctx.employee,root.task_id,root.onboarding_cycle,submission.id])).rows[0]
 if(!review||String(current.retained.reviewId)!==String(review.id)||String(current.retained.submissionId)!==String(submission.id))throw fail('The original employer certification no longer matches its retained employee submission.')
 const retained=JSON.parse(decryptDocument(review.encrypted_review,`i9-employer-review:${ctx.facility}:${ctx.employee}:${root.task_id}:${root.onboarding_cycle}:${review.actor_user_id}`).toString())
 if(String(retained.sourceDocumentId)!==String(submission.document_id)||retained.sourceSha256!==submission.content_sha256||hash(Buffer.from(retained.pdfBase64,'base64'))!==review.preview_sha256||current.retained.previewSha256!==review.preview_sha256)throw fail('The original employer review failed its employee-source integrity check.')
 // The receipt basis holds the facility/task locks; avoid reversing the employee-update lock order.
 const hiring=(await db.query(`SELECT e.hire_date::text AS "hireDate",h.revision,h.e_verify AS "eVerify",h.offer_accepted_on::text AS "offerAcceptedOn",v.hiring_revision AS "signedHiringRevision" FROM payroll_employee e JOIN payroll_i9_review v ON v.id=$3 AND v.facility_id=e.facility_id AND v.employee_id=e.id JOIN LATERAL (SELECT revision,e_verify,offer_accepted_on FROM payroll_i9_hiring_context WHERE facility_id=e.facility_id AND employee_id=e.id AND task_id=$4 AND onboarding_cycle=$5 ORDER BY revision DESC LIMIT 1) h ON true WHERE e.id=$1 AND e.facility_id=$2`,[ctx.employee,ctx.facility,submission.review_id,submission.task_id,submission.onboarding_cycle])).rows[0]
 if(!hiring||hiring.revision!==hiring.signedHiringRevision||hiring.hireDate!==retained.answers.firstDayEmployed||hiring.eVerify!==current.retained.context.eVerify||hiring.offerAcceptedOn!==current.retained.context.offerAcceptedOn)throw fail('The current hiring information differs from the signed I-9. Reconcile the original employee and employer certification before replacing its receipt.')
 const receiptTasks=(await db.query(`SELECT c.id AS "taskId",f.row_key AS "rowKey",c.due_date::text AS "dueOn",c.status FROM payroll_i9_signature_followup f JOIN payroll_compliance_task c ON c.id=f.compliance_task_id WHERE f.signature_id=$1 AND f.kind='RECEIPT_REPLACEMENT' AND f.row_key IN ('A1','A2','A3','B','C') AND c.facility_id=$2 AND c.employee_id=$3 AND c.status IN ('OPEN','IN_PROGRESS') ORDER BY c.due_date,c.id FOR UPDATE OF c`,[root.id,ctx.facility,ctx.employee])).rows
 if(current.receipt.sourceKind==='SECTION2'&&(!receiptTasks.some(t=>String(t.taskId)===String(root.compliance_task_id))||receiptTasks.some(t=>!current.retained.examination.documents.some(d=>d.rowKey===t.rowKey&&d.acceptance==='RECEIPT'&&d.followUpKind==='RECEIPT_REPLACEMENT'))))throw fail('Reconcile the original receipt tasks with the signed examination before replacement.')
 const employeeSource={bytes,documentId:submission.document_id,sha256:submission.content_sha256,pageCount:4,submissionId:submission.id}
 // Include the employee source in addition to the receipt and prior amendments;
 // a later preview/sign operation must re-resolve and compare this exact basis.
 return {...current,receiptTasks,employeeSource,currentHiringContext:hiring,originalSection2:retained.answers,basisHash:hash(JSON.stringify({receiptBasisHash:current.basisHash,receiptTasks,currentHiringContext:hiring,employeeDocumentId:employeeSource.documentId,employeeSha256:employeeSource.sha256,employerReviewId:review.id,employerPreviewSha256:review.preview_sha256}))}
}

export async function prepareI9DifferentDocuments(db,ctx,taskId,body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['signatureId','section2','reason','initials'].includes(k)))throw Object.assign(new Error('Use the supported different-document preparation fields.'),{status:400})
 const current=await i9DifferentDocumentsBasis(db,ctx,taskId)
 if(current.receipt.sourceKind!=='SECTION2')throw fail('A receipt recorded during reverification requires its Supplement B replacement workflow.')
 if(String(body.signatureId)!==String(current.row.id))throw fail('Reload the current employer certification before replacing its receipt.')
 if(body.section2?.firstDayEmployed!==current.originalSection2.firstDayEmployed)throw fail('Keep the original first day of employment on the replacement certification.')
 const clock=(await db.query('SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[ctx.facility])).rows[0]
 const rendered=await renderI9DifferentDocumentsPreview(current.employeeSource.bytes,{section2:body.section2,reason:body.reason,initials:body.initials,recordedOn:clock.today,originalEmployerSha256:current.row.content_sha256,receiptTasks:current.receiptTasks})
 return {current,...rendered,previewSha256:hash(rendered.pdf),recordedOn:clock.today}
}

export async function i9DifferentDocumentsContext(db,ctx,taskId){
 const current=await i9DifferentDocumentsBasis(db,ctx,taskId)
 const clock=(await db.query('SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[ctx.facility])).rows[0]
 const original=current.originalSection2
 return {receiptTasks:current.receiptTasks,signatureId:current.row.id,sourceKind:current.receipt.sourceKind,rowKey:current.receipt.rowKey,dueOn:current.row.due_on,today:clock.today,originalExaminedOn:current.retained.examination.examinedOn,retainedHiringContext:{attestationKind:current.retained.context.attestationKind,eVerify:current.retained.context.eVerify},employerDefaults:{firstDayEmployed:original.firstDayEmployed,businessName:original.businessName,businessAddress:original.businessAddress}}
}
