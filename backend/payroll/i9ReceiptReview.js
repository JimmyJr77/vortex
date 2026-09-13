import {createHash} from 'node:crypto'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {i9DocumentFollowupBasis} from './i9SupplementBReview.js'
import {i9ReceiptReplacementInput,renderI9ReceiptReplacementPreview} from './i9ReceiptReplacementPdf.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(value).digest('hex')
const aad=(ctx,row)=>`i9-receipt-review:${ctx.facility}:${ctx.employee}:${row.compliance_task_id}:${row.actor_user_id}`
export const I9_RECEIPT_ATTESTATION='I certify that I examined the actual replacement document for the identified receipt, that it reasonably appears genuine and relates to this employee, and that this amendment and the retained examination findings accurately record my review.'
export async function i9ReceiptBasis(db,ctx,taskId){
 const current=await i9DocumentFollowupBasis(db,ctx,taskId,'RECEIPT_REPLACEMENT')
 let bytes=current.bytes,documentId=current.row.document_id,sourceKind='SECTION2',rowKey=current.row.followup_row_key,examination
 if(rowKey.startsWith('SUPPLEMENT:')){
  const id=rowKey.slice('SUPPLEMENT:'.length),prior=current.previousSupplements.find(p=>String(p.signatureId)===id)
  if(!prior)throw fail('The source receipt supplement is missing.')
  const signed=(await db.query('SELECT * FROM payroll_i9_supplement_signature WHERE id=$1 AND signature_id=$2',[id,current.row.id])).rows[0]
  const retained=JSON.parse(decryptDocument(signed.encrypted_evidence,`i9-supplement-signature:${ctx.facility}:${ctx.employee}:${signed.compliance_task_id}:${signed.actor_user_id}`).toString())
  examination=retained.examination;bytes=Buffer.from(prior.pdfBase64,'base64');documentId=prior.documentId;sourceKind='SUPPLEMENT_B';rowKey='SUPPLEMENT'
 }else examination=current.retained.examination.documents.find(d=>d.rowKey===rowKey)
 if(!examination||examination.acceptance!=='RECEIPT'||examination.followUpKind!=='RECEIPT_REPLACEMENT')throw fail('The retained examination does not establish this receipt replacement.')
 return {...current,receipt:{bytes,documentId,sourceKind,rowKey,sha256:hash(bytes),pageCount:sourceKind==='SECTION2'?4:1,examination}}
}
export async function previewI9Receipt(db,ctx,taskId,body){
 if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['signatureId','answers'].includes(k)))throw fail('Use the supported receipt preview fields.',400)
 const current=await i9ReceiptBasis(db,ctx,taskId)
 if(String(body.signatureId)!==String(current.row.id))throw fail('Reload the current employer certification before preparing the receipt amendment.')
 taskId=current.row.compliance_task_id
 const answers=i9ReceiptReplacementInput(body.answers),source=current.receipt
 if(answers.sourceKind!==source.sourceKind||answers.rowKey!==source.rowKey)throw fail('Amend the receipt row identified by this follow-up.',400)
 const rendered=await renderI9ReceiptReplacementPreview(source.bytes,answers),previewSha256=hash(rendered.pdf)
 const retained={answers,pdfBase64:rendered.pdf.toString('base64'),source:{documentId:source.documentId,sha256:source.sha256,pdfBase64:source.bytes.toString('base64'),pageCount:source.pageCount},pageCount:rendered.pageCount}
 const row=(await db.query(`INSERT INTO payroll_i9_receipt_review(facility_id,employee_id,compliance_task_id,signature_id,actor_user_id,basis_hash,preview_sha256,document_fingerprint,encrypted_review,page_count,source_page_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,expires_at`,[ctx.facility,ctx.employee,taskId,current.row.id,ctx.admin,current.basisHash,previewSha256,hash(JSON.stringify(answers.replacement)),encryptDocument(Buffer.from(JSON.stringify(retained)),aad(ctx,{compliance_task_id:taskId,actor_user_id:ctx.admin})),rendered.pageCount,source.pageCount])).rows[0]
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'I9_RECEIPT_PREVIEW_CREATED','i9_receipt_review',$3,$4)",[ctx.facility,ctx.admin,String(row.id),{employeeId:ctx.employee,complianceTaskId:taskId,signatureId:current.row.id,previewSha256}])
 return {reviewId:row.id,expiresAt:row.expires_at,previewSha256,attestation:I9_RECEIPT_ATTESTATION,...retained}
}
export async function currentI9ReceiptReview(db,ctx,taskId,body){
 const current=await i9ReceiptBasis(db,ctx,taskId)
 if(!/^[1-9]\d*$/.test(String(body.reviewId))||!/^[a-f0-9]{64}$/.test(body.previewSha256||''))throw fail('Prepare and display the current receipt amendment.',400)
 const row=(await db.query('SELECT *,expires_at>clock_timestamp() AS unexpired FROM payroll_i9_receipt_review WHERE id=$1 AND facility_id=$2 AND employee_id=$3 AND compliance_task_id=$4 AND actor_user_id=$5',[body.reviewId,ctx.facility,ctx.employee,taskId,ctx.admin])).rows[0]
 const latest=(await db.query('SELECT id FROM payroll_i9_receipt_review WHERE compliance_task_id=$1 ORDER BY id DESC LIMIT 1',[taskId])).rows[0]
 if(!row||!row.unexpired||String(row.id)!==String(latest?.id)||row.preview_sha256!==body.previewSha256||row.basis_hash!==current.basisHash||String(row.signature_id)!==String(current.row.id))throw fail('This receipt review expired or its source changed. Prepare a new review.')
 const retained=JSON.parse(decryptDocument(row.encrypted_review,aad(ctx,row)).toString())
 if(hash(Buffer.from(retained.pdfBase64,'base64'))!==row.preview_sha256||hash(JSON.stringify(retained.answers.replacement))!==row.document_fingerprint||retained.source.sha256!==current.receipt.sha256||hash(Buffer.from(retained.source.pdfBase64,'base64'))!==current.receipt.sha256||retained.pageCount!==row.page_count||retained.source.pageCount!==row.source_page_count)throw fail('The retained receipt review failed its integrity check.')
 return {row,retained,current}
}
export async function recordI9ReceiptPage(db,ctx,taskId,body){
 if(body.displayed!==true||!['source','amendment'].includes(body.documentKey)||!Number.isInteger(body.page)||body.page<1)throw fail('Display a page from the current receipt review.',400)
 const {row}=await currentI9ReceiptReview(db,ctx,taskId,body)
 if(body.page>(body.documentKey==='source'?row.source_page_count:row.page_count))throw fail('Choose a page in the current receipt packet.',400)
 await db.query('INSERT INTO payroll_i9_receipt_page_visit(review_id,document_key,page_number) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[row.id,body.documentKey,body.page])
 return {documentKey:body.documentKey,page:body.page,recorded:true}
}

export async function i9ReceiptContext(db,ctx,taskId){
 const current=await i9ReceiptBasis(db,ctx,taskId)
 const clock=(await db.query('SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[ctx.facility])).rows[0]
 return {sourceKind:current.receipt.sourceKind,rowKey:current.receipt.rowKey,today:clock.today,dueOn:current.row.due_on}
}
