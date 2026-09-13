import {createHash} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {currentI9EmployerReview} from './i9EmployerReview.js'
import {documentInput,encryptDocument,decryptDocument} from './onboarding.js'
import {i9DocumentEntries} from './i9DocumentEntries.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(value).digest('hex')
async function scope(db,ctx,taskId,body){
 const review=await currentI9EmployerReview(db,ctx,taskId,body)
 const documents=i9DocumentEntries(review.retained.answers),entries=(await db.query('SELECT row_key,document_fingerprint FROM payroll_i9_review_document_entry WHERE review_id=$1',[review.row.id])).rows
 if(entries.length!==documents.length||documents.some(doc=>!entries.some(entry=>entry.row_key===doc.key&&entry.document_fingerprint===doc.fingerprint)))throw fail('Prepare a new employer review before retaining document copies.')
 return {...review,documents}
}
const audit=(db,ctx,action,id,data)=>db.query('INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,$3,$4,$5,$6)',[ctx.facility,ctx.admin,action,'i9_document_copy',String(id),{employeeId:ctx.employee,...data}])
export async function listI9EmployerCopies(db,ctx,taskId,body){
 const current=await scope(db,ctx,taskId,body)
 const copies=(await db.query('SELECT c.id,c.row_key,c.document_fingerprint,c.document_id,c.page_count,c.created_at,d.filename,d.mime_type FROM payroll_i9_document_copy c JOIN payroll_private_document d ON d.id=c.document_id WHERE c.task_id=$1 AND c.onboarding_cycle=$2 AND c.submission_id=$3 ORDER BY c.id',[taskId,body.onboardingCycle,current.row.submission_id])).rows
 return {documents:current.documents.map(row=>({key:row.key,label:row.label,copies:copies.filter(c=>c.row_key===row.key&&c.document_fingerprint===row.fingerprint).map(c=>({id:c.id,documentId:c.document_id,pageCount:c.page_count,filename:c.filename,mime:c.mime_type,createdAt:c.created_at}))}))}
}
export async function uploadI9EmployerCopy(db,ctx,taskId,body){
 const current=await scope(db,ctx,taskId,body),selected=current.documents.find(row=>row.key===body.rowKey)
 if(!selected)throw fail('Choose a document in the current employer form.',400)
 if(typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Use a unique document-copy upload key.',400)
 const input=documentInput(body),requestHash=hash(JSON.stringify({taskId:String(current.row.task_id),cycle:Number(body.onboardingCycle),submissionId:String(current.row.submission_id),rowKey:selected.key,fingerprint:selected.fingerprint,contentSha256:input.hash}))
 const prior=(await db.query('SELECT * FROM payroll_i9_document_copy WHERE facility_id=$1 AND employee_id=$2 AND request_key=$3',[ctx.facility,ctx.employee,body.requestKey])).rows[0]
 const receipt=row=>({id:row.id,documentId:row.document_id,pageCount:row.page_count})
 if(prior){if(prior.request_hash!==requestHash||String(prior.actor_user_id)!==String(ctx.admin))throw fail('This upload key was already used for different document details.');return receipt(prior)}
 let pageCount=1
 if(input.mime==='application/pdf'){
  try{const pdf=await PDFDocument.load(input.bytes);pageCount=pdf.getPageCount();if(!pageCount)throw new Error('Empty PDF')}catch{throw fail('Upload a readable PDF without password protection, or a PNG/JPEG image.',400)}
 }
 const extension={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'}[input.mime],filename=`I9-${selected.key}-copy-${body.requestKey.toLowerCase().slice(0,8)}.${extension}`
 const doc=(await db.query('INSERT INTO payroll_private_document(facility_id,employee_id,task_id,onboarding_cycle,filename,mime_type,encrypted_content,content_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[ctx.facility,ctx.employee,taskId,body.onboardingCycle,filename,input.mime,encryptDocument(input.bytes,`${ctx.facility}:${ctx.employee}:${current.row.task_id}`),input.hash])).rows[0]
 const row=(await db.query(`INSERT INTO payroll_i9_document_copy(facility_id,employee_id,task_id,onboarding_cycle,submission_id,source_review_id,row_key,document_fingerprint,document_id,page_count,actor_user_id,request_key,request_hash)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,[ctx.facility,ctx.employee,taskId,body.onboardingCycle,current.row.submission_id,current.row.id,selected.key,selected.fingerprint,doc.id,pageCount,ctx.admin,body.requestKey,requestHash])).rows[0]
 await audit(db,ctx,'I9_DOCUMENT_COPY_RETAINED',row.id,{taskId,onboardingCycle:body.onboardingCycle,submissionId:row.submission_id,rowKey:selected.key,documentId:doc.id})
 return receipt(row)
}
async function currentCopy(db,ctx,taskId,body){
 const current=await scope(db,ctx,taskId,body)
 if(!/^[1-9]\d*$/.test(String(body.copyId)))throw fail('Choose a retained document copy.',400)
 const copy=(await db.query('SELECT c.*,d.encrypted_content,d.content_sha256,d.mime_type,d.filename FROM payroll_i9_document_copy c JOIN payroll_private_document d ON d.id=c.document_id WHERE c.id=$1 AND c.task_id=$2 AND c.onboarding_cycle=$3 AND c.submission_id=$4',[body.copyId,taskId,body.onboardingCycle,current.row.submission_id])).rows[0]
 if(!copy||!current.documents.some(row=>row.key===copy.row_key&&row.fingerprint===copy.document_fingerprint))throw fail('This copy does not match the current employee submission and document entry.',404)
 return {current,copy}
}
export async function viewI9EmployerCopy(db,ctx,taskId,body){
 const {copy}=await currentCopy(db,ctx,taskId,body),bytes=decryptDocument(copy.encrypted_content,`${ctx.facility}:${ctx.employee}:${copy.task_id}`)
 if(hash(bytes)!==copy.content_sha256)throw fail('The retained document copy failed its integrity check.')
 await audit(db,ctx,'I9_DOCUMENT_COPY_OPENED',copy.id,{taskId,reviewId:body.reviewId,documentId:copy.document_id})
 return {copyId:copy.id,contentBase64:bytes.toString('base64'),mime:copy.mime_type,pageCount:copy.page_count,filename:copy.filename}
}
export async function recordI9CopyPage(db,ctx,taskId,body){
 const {current,copy}=await currentCopy(db,ctx,taskId,body)
 if(body.displayed!==true||!Number.isInteger(body.page)||body.page<1||body.page>copy.page_count)throw fail('Display a page from this retained document copy.',400)
 await db.query('INSERT INTO payroll_i9_copy_page_visit(review_id,copy_id,page_number) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[current.row.id,copy.id,body.page])
 return {copyId:copy.id,page:body.page,recorded:true}
}
