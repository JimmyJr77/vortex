import {createHash} from 'node:crypto'
import {currentI9ReceiptReview,I9_RECEIPT_ATTESTATION} from './i9ReceiptReview.js'
import {currentI9ReceiptCopy} from './i9ReceiptCopies.js'
import {i9ReceiptExaminationInput,validateI9ReceiptExamination} from './i9ReceiptExamination.js'
import {signI9ReceiptReplacementPdf} from './i9ReceiptReplacementPdf.js'
import {encryptDocument} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(value).digest('hex')
export async function signI9Receipt(db,ctx,taskId,body){
 await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility])
 const task=(await db.query('SELECT id FROM payroll_compliance_task WHERE id=$1 AND facility_id=$2 AND employee_id=$3',[taskId,ctx.facility,ctx.employee])).rows[0]
 if(!task)throw fail('I-9 follow-up not found.',404)
 if(typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Use a unique receipt amendment signing key.',400)
 if(body.attestation!==I9_RECEIPT_ATTESTATION||body.attestationRead!==true||body.signingAsExaminer!==true||body.reviewedAllPages!==true||body.representativeIdentityConfirmed!==true)throw fail('Read the certification and confirm your identity as the named examiner who reviewed the complete packet.',400)
 if(typeof body.signature!=='string'||!body.signature.trim()||body.signature.length>200||/[\u0000-\u001f\u007f]/.test(body.signature)||!/^[1-9]\d*$/.test(String(body.reviewId)))throw fail('Enter your own name as the examiner electronic signature.',400)
 const signature=body.signature.trim().normalize('NFC'),examination=i9ReceiptExaminationInput(body.examination)
 const requestHash=hash(JSON.stringify({taskId:String(task.id),reviewId:String(BigInt(body.reviewId)),previewSha256:body.previewSha256,signature,examination,attestation:body.attestation}))
 const receipt=async row=>({signatureId:row.id,documentId:row.document_id,signedAt:row.signed_at,status:'COMPLETE',nextFollowup:(await db.query("SELECT c.id,c.due_date::text AS due_on,f.kind FROM payroll_i9_signature_followup f JOIN payroll_compliance_task c ON c.id=f.compliance_task_id WHERE f.signature_id=$1 AND f.row_key=$2",[row.signature_id,`RECEIPT:${row.id}`])).rows[0]||null})
 const prior=(await db.query('SELECT * FROM payroll_i9_receipt_signature WHERE facility_id=$1 AND employee_id=$2 AND request_key=$3',[ctx.facility,ctx.employee,body.requestKey])).rows[0]
 if(prior){if(prior.request_hash!==requestHash||String(prior.actor_user_id)!==String(ctx.admin))throw fail('This signing key was used for different receipt amendment evidence.');return receipt(prior)}
 const review=await currentI9ReceiptReview(db,ctx,taskId,body),root=review.current.row
 if(signature!==review.retained.answers.examinerName)throw fail('Sign as the representative named on the reviewed receipt.',400)
 const pages=(await db.query('SELECT document_key,page_number FROM payroll_i9_receipt_page_visit WHERE review_id=$1',[review.row.id])).rows
 for(const [key,count] of [['source',review.row.source_page_count],['amendment',review.row.page_count]])for(let n=1;n<=count;n++)if(!pages.some(p=>p.document_key===key&&p.page_number===n))throw fail('Display every source and amendment page before signing.')
 const clock=(await db.query('SELECT clock_timestamp() AS signed_at,(clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[ctx.facility])).rows[0]
 const context={today:clock.today,dueOn:root.due_on,originalExaminedOn:review.current.receipt.examination.examinedOn||review.current.retained.examination.examinedOn,attestationKind:review.current.retained.context.attestationKind,...review.current.examinationContext}
 const timing=validateI9ReceiptExamination(examination,review.retained.answers,context),copies=[]
 for(const copyId of examination.copyIds){
  const {copy}=await currentI9ReceiptCopy(db,ctx,taskId,{...body,copyId})
  const visits=(await db.query('SELECT page_number FROM payroll_i9_receipt_copy_page WHERE review_id=$1 AND copy_id=$2',[review.row.id,copy.id])).rows
  if(visits.length!==copy.page_count)throw fail('Display every page of each selected replacement copy before signing.')
  copies.push({copyId:copy.id,documentId:copy.document_id,sha256:copy.content_sha256,pageCount:copy.page_count})
 }
 const pdf=await signI9ReceiptReplacementPdf(Buffer.from(review.retained.pdfBase64,'base64'),{signature,signedOn:clock.today,pageCount:review.row.page_count})
 const document=(await db.query("INSERT INTO payroll_private_document(facility_id,employee_id,task_id,onboarding_cycle,filename,mime_type,encrypted_content,content_sha256) VALUES($1,$2,$3,$4,'Form-I9-receipt-amendment-signed.pdf','application/pdf',$5,$6) RETURNING id",[ctx.facility,ctx.employee,root.task_id,root.onboarding_cycle,encryptDocument(pdf,`${ctx.facility}:${ctx.employee}:${root.task_id}`),hash(pdf)])).rows[0]
 const evidence={signature,attestation:body.attestation,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,actorUserId:ctx.admin,signedOn:clock.today,signedAt:clock.signed_at,answers:review.retained.answers,examination,context,timing,copies,reviewId:review.row.id,sourceSignatureId:root.id,sourceSha256:review.current.receipt.sha256,sourceDocumentId:review.current.receipt.documentId,pageCount:review.row.page_count,previewSha256:review.row.preview_sha256,documentSha256:hash(pdf),priorSupplementIds:(review.retained.previousSupplements||[]).map(s=>s.signatureId)}
 const signed=(await db.query(`INSERT INTO payroll_i9_receipt_signature(facility_id,employee_id,compliance_task_id,signature_id,review_id,document_id,actor_user_id,request_key,request_hash,encrypted_evidence,selected_copy_ids,followup_kind,followup_on,signed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,[ctx.facility,ctx.employee,task.id,root.id,review.row.id,document.id,ctx.admin,body.requestKey,requestHash,encryptDocument(Buffer.from(JSON.stringify(evidence)),`i9-receipt-signature:${ctx.facility}:${ctx.employee}:${task.id}:${ctx.admin}`),examination.copyIds,examination.followUpKind,examination.followUpOn||null,clock.signed_at])).rows[0]
 if(examination.followUpKind!=='NONE'){
  const rowKey=`RECEIPT:${signed.id}`
  const next=(await db.query(`INSERT INTO payroll_compliance_task(facility_id,employee_id,task_key,title,category,jurisdiction,due_date,status,severity,description,source_url,source_authority,last_verified_on) VALUES($1,$2,$3,'I-9 document follow-up','ONBOARDING','US',$4,'OPEN','CRITICAL',$5,$6,'Examiner-verified I-9 rule',$7) RETURNING id`,[ctx.facility,ctx.employee,`I9_DOCUMENT_FOLLOWUP:${root.id}:${rowKey}`,examination.followUpOn,`Review the retained signed receipt amendment ${signed.id} and complete its next document follow-up.`,examination.acceptanceSource,clock.today])).rows[0]
  await db.query('INSERT INTO payroll_i9_signature_followup(signature_id,row_key,kind,due_on,compliance_task_id) VALUES($1,$2,$3,$4,$5)',[root.id,rowKey,examination.followUpKind,examination.followUpOn,next.id])
 }
 await db.query("UPDATE payroll_compliance_task SET status='COMPLETE',completion_note=$1,completed_at=$2,completed_by=$3,last_verified_on=$4,next_review_on=NULL,updated_at=clock_timestamp() WHERE id=$5",[`Retained signed receipt amendment ${signed.id}; review its examination evidence and any next follow-up.`,clock.signed_at,ctx.admin,clock.today,task.id])
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'I9_RECEIPT_SIGNED','i9_receipt_signature',$3,$4)",[ctx.facility,ctx.admin,String(signed.id),{employeeId:ctx.employee,complianceTaskId:task.id,documentId:document.id,reviewId:review.row.id,sourceSignatureId:root.id,copyIds:copies.map(c=>c.copyId),documentSha256:hash(pdf)}])
 return receipt(signed)
}
