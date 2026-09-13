import {i9Section2Input} from './i9Section2.js'
import {i9DocumentEntries} from './i9DocumentEntries.js'
import {createHash} from 'node:crypto'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {prepareI9DifferentDocuments,i9DifferentDocumentsBasis} from './i9DifferentDocumentsBasis.js'
const hash=value=>createHash('sha256').update(value).digest('hex')
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const aad=(ctx,taskId,admin)=>`i9-different-review:${ctx.facility}:${ctx.employee}:${taskId}:${admin}`
const sourcePacket=current=>[
 {documentKey:'source',documentId:current.row.document_id,sha256:current.row.content_sha256,pdfBase64:current.bytes.toString('base64'),pageCount:4},
 {documentKey:'employee',documentId:current.employeeSource.documentId,sha256:current.employeeSource.sha256,pdfBase64:current.employeeSource.bytes.toString('base64'),pageCount:4},
 ...current.previousSupplements,...current.previousReceiptAmendments,
]
export async function previewI9DifferentDocuments(db,ctx,taskId,body){
 const prepared=await prepareI9DifferentDocuments(db,ctx,taskId,body),current=prepared.current
 taskId=current.row.compliance_task_id
 const packet=[{documentKey:'replacement',sha256:prepared.previewSha256,pdfBase64:prepared.pdf.toString('base64'),pageCount:prepared.pageCount},...sourcePacket(current)]
 const pageCounts=Object.fromEntries(packet.map(p=>[p.documentKey,p.pageCount]))
 const section2=i9Section2Input(body.section2),fingerprints=Object.fromEntries(i9DocumentEntries(section2).map(p=>[p.key,p.fingerprint]))
 const retained={answers:{section2,reason:body.reason,initials:body.initials},recordedOn:prepared.recordedOn,packet}
 const row=(await db.query(`INSERT INTO payroll_i9_different_review(facility_id,employee_id,compliance_task_id,signature_id,actor_user_id,basis_hash,preview_sha256,encrypted_review,page_counts,document_fingerprints) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,expires_at`,[ctx.facility,ctx.employee,taskId,current.row.id,ctx.admin,current.basisHash,prepared.previewSha256,encryptDocument(Buffer.from(JSON.stringify(retained)),aad(ctx,taskId,ctx.admin)),pageCounts,fingerprints])).rows[0]
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'I9_DIFFERENT_PREVIEW_CREATED','i9_different_review',$3,$4)",[ctx.facility,ctx.admin,String(row.id),{employeeId:ctx.employee,complianceTaskId:taskId,signatureId:current.row.id,previewSha256:prepared.previewSha256}])
 return {reviewId:row.id,expiresAt:row.expires_at,previewSha256:prepared.previewSha256,...retained}
}
export async function currentI9DifferentDocumentsReview(db,ctx,taskId,body){
 if(!/^[1-9]\d*$/.test(String(body.reviewId))||!/^[a-f0-9]{64}$/.test(body.previewSha256||''))throw fail('Prepare the current replacement review.',400)
 const current=await i9DifferentDocumentsBasis(db,ctx,taskId)
 const row=(await db.query('SELECT *,expires_at>clock_timestamp() AS unexpired FROM payroll_i9_different_review WHERE id=$1 AND facility_id=$2 AND employee_id=$3 AND compliance_task_id=$4 AND actor_user_id=$5',[body.reviewId,ctx.facility,ctx.employee,taskId,ctx.admin])).rows[0]
 const latest=(await db.query('SELECT id FROM payroll_i9_different_review WHERE compliance_task_id=$1 ORDER BY id DESC LIMIT 1',[taskId])).rows[0]
 if(!row||!row.unexpired||String(row.id)!==String(latest?.id)||row.preview_sha256!==body.previewSha256||row.basis_hash!==current.basisHash||String(row.signature_id)!==String(current.row.id))throw fail('This replacement review expired or its source changed. Prepare it again.')
 const retained=JSON.parse(decryptDocument(row.encrypted_review,aad(ctx,taskId,ctx.admin)).toString())
 const fingerprints=Object.fromEntries(i9DocumentEntries(retained.answers.section2).map(p=>[p.key,p.fingerprint]))
 if(Object.keys(fingerprints).length!==Object.keys(row.document_fingerprints).length||Object.entries(fingerprints).some(([key,value])=>row.document_fingerprints[key]!==value))throw fail('The replacement document entries failed their integrity check.')
 const expected=[{documentKey:'replacement',sha256:row.preview_sha256},...sourcePacket(current)]
 if(!Array.isArray(retained.packet)||retained.packet.length!==expected.length||Object.keys(row.page_counts).length!==expected.length)throw fail('The retained replacement packet is incomplete.')
 for(const part of expected){
  const matches=retained.packet.filter(p=>p.documentKey===part.documentKey),p=matches[0]
  if(matches.length!==1||p.sha256!==part.sha256||hash(Buffer.from(p.pdfBase64,'base64'))!==part.sha256||p.pageCount!==row.page_counts[p.documentKey]||(part.pageCount&&p.pageCount!==part.pageCount)||String(p.documentId)!==String(part.documentId))throw fail('The retained replacement packet failed its integrity check.')
 }
 return {row,retained,current}
}
export async function recordI9DifferentDocumentsPage(db,ctx,taskId,body){
 if(body.displayed!==true||typeof body.documentKey!=='string'||!Number.isInteger(body.page)||body.page<1)throw fail('Display a page of the current replacement packet.',400)
 const review=await currentI9DifferentDocumentsReview(db,ctx,taskId,body)
 if(!Object.hasOwn(review.row.page_counts,body.documentKey)||body.page>review.row.page_counts[body.documentKey])throw fail('Choose a page in this replacement packet.',400)
 await db.query('INSERT INTO payroll_i9_different_page_visit(review_id,document_key,page_number) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[review.row.id,body.documentKey,body.page])
 return {documentKey:body.documentKey,page:body.page,recorded:true}
}
