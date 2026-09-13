import {createHash} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {currentI9SupplementBReview} from './i9SupplementBReview.js'
import {documentInput,encryptDocument,decryptDocument} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(value).digest('hex')
const fingerprint=review=>hash(JSON.stringify(review.retained.answers.document))
const audit=(db,ctx,action,id,data)=>db.query('INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,$3,$4,$5,$6)',[ctx.facility,ctx.admin,action,'i9_supplement_copy',String(id),{employeeId:ctx.employee,...data}])
export async function listI9SupplementBCopies(db,ctx,taskId,body){
 const review=await currentI9SupplementBReview(db,ctx,taskId,body)
 const rows=(await db.query('SELECT c.id,c.document_id,c.page_count,c.created_at,d.filename,d.mime_type FROM payroll_i9_supplement_copy c JOIN payroll_private_document d ON d.id=c.document_id WHERE c.compliance_task_id=$1 AND c.signature_id=$2 AND c.document_fingerprint=$3 ORDER BY c.id',[review.row.compliance_task_id,review.row.signature_id,fingerprint(review)])).rows
 return {copies:rows.map(c=>({id:c.id,documentId:c.document_id,pageCount:c.page_count,createdAt:c.created_at,filename:c.filename,mime:c.mime_type}))}
}
export async function uploadI9SupplementBCopy(db,ctx,taskId,body){
 const review=await currentI9SupplementBReview(db,ctx,taskId,body),source=review.current.row,documentFingerprint=fingerprint(review)
 if(typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Use a unique replacement document upload key.',400)
 const file=documentInput(body),requestHash=hash(JSON.stringify({taskId:String(review.row.compliance_task_id),signatureId:String(source.id),documentFingerprint,contentSha256:file.hash}))
 const prior=(await db.query('SELECT * FROM payroll_i9_supplement_copy WHERE facility_id=$1 AND employee_id=$2 AND request_key=$3',[ctx.facility,ctx.employee,body.requestKey])).rows[0]
 const receipt=row=>({id:row.id,documentId:row.document_id,pageCount:row.page_count})
 if(prior){if(prior.request_hash!==requestHash||String(prior.actor_user_id)!==String(ctx.admin))throw fail('This upload key belongs to different replacement document evidence.');return receipt(prior)}
 let pageCount=1
 try{
  if(file.mime==='application/pdf'){pageCount=(await PDFDocument.load(file.bytes)).getPageCount();if(pageCount<1||pageCount>100)throw new Error('Page limit')}
  else{const pdf=await PDFDocument.create();if(file.mime==='image/png')await pdf.embedPng(file.bytes);else if(file.mime==='image/jpeg')await pdf.embedJpg(file.bytes);else throw new Error('Unsupported')}
 }catch{throw fail('Upload a readable PDF of 1–100 pages without password protection, or a valid PNG/JPEG image.',400)}
 const extension={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'}[file.mime]
 const doc=(await db.query('INSERT INTO payroll_private_document(facility_id,employee_id,task_id,onboarding_cycle,filename,mime_type,encrypted_content,content_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[ctx.facility,ctx.employee,source.task_id,source.onboarding_cycle,`I9-supplement-copy-${body.requestKey.toLowerCase().slice(0,8)}.${extension}`,file.mime,encryptDocument(file.bytes,`${ctx.facility}:${ctx.employee}:${source.task_id}`),file.hash])).rows[0]
 const row=(await db.query(`INSERT INTO payroll_i9_supplement_copy(facility_id,employee_id,compliance_task_id,signature_id,source_review_id,document_fingerprint,document_id,page_count,actor_user_id,request_key,request_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[ctx.facility,ctx.employee,review.row.compliance_task_id,source.id,review.row.id,documentFingerprint,doc.id,pageCount,ctx.admin,body.requestKey,requestHash])).rows[0]
 await audit(db,ctx,'I9_SUPPLEMENT_COPY_RETAINED',row.id,{complianceTaskId:review.row.compliance_task_id,reviewId:review.row.id,documentId:doc.id})
 return receipt(row)
}
export async function currentI9SupplementBCopy(db,ctx,taskId,body){
 const review=await currentI9SupplementBReview(db,ctx,taskId,body)
 if(!/^[1-9]\d*$/.test(String(body.copyId)))throw fail('Choose a retained replacement document copy.',400)
 const copy=(await db.query('SELECT c.*,d.encrypted_content,d.content_sha256,d.mime_type,d.filename,d.task_id FROM payroll_i9_supplement_copy c JOIN payroll_private_document d ON d.id=c.document_id WHERE c.id=$1 AND c.facility_id=$2 AND c.employee_id=$3 AND c.compliance_task_id=$4 AND c.signature_id=$5 AND c.document_fingerprint=$6',[body.copyId,ctx.facility,ctx.employee,review.row.compliance_task_id,review.row.signature_id,fingerprint(review)])).rows[0]
 if(!copy)throw fail('This copy does not match the replacement document in the current review.',404)
 const bytes=decryptDocument(copy.encrypted_content,`${ctx.facility}:${ctx.employee}:${copy.task_id}`)
 if(hash(bytes)!==copy.content_sha256)throw fail('The retained replacement copy failed its integrity check.')
 return {review,copy,bytes}
}
export async function viewI9SupplementBCopy(db,ctx,taskId,body){
 const {review,copy,bytes}=await currentI9SupplementBCopy(db,ctx,taskId,body)
 await audit(db,ctx,'I9_SUPPLEMENT_COPY_OPENED',copy.id,{reviewId:review.row.id,documentId:copy.document_id})
 return {copyId:copy.id,contentBase64:bytes.toString('base64'),mime:copy.mime_type,pageCount:copy.page_count,filename:copy.filename}
}
export async function recordI9SupplementBCopyPage(db,ctx,taskId,body){
 const {review,copy}=await currentI9SupplementBCopy(db,ctx,taskId,body)
 if(body.displayed!==true||!Number.isInteger(body.page)||body.page<1||body.page>copy.page_count)throw fail('Display a page from the retained replacement document copy.',400)
 await db.query('INSERT INTO payroll_i9_supplement_copy_page(review_id,copy_id,page_number) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[review.row.id,copy.id,body.page])
 return {copyId:copy.id,page:body.page,recorded:true}
}
