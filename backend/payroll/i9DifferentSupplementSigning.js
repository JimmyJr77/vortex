import {createHash} from 'node:crypto'
import {i9DifferentSupplementExaminationInput,reviewedI9DifferentSupplementExamination} from './i9DifferentSupplementExamination.js'
import {I9_EMPLOYER_ATTESTATION} from './i9Examination.js'
import {signI9DifferentSupplementPdf} from './i9DifferentSupplementPdf.js'
import {encryptDocument} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(value).digest('hex')
export async function signI9DifferentSupplement(db,ctx,taskId,body){
 await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[ctx.facility])
 const task=(await db.query('SELECT id FROM payroll_compliance_task WHERE id=$1 AND facility_id=$2 AND employee_id=$3',[taskId,ctx.facility,ctx.employee])).rows[0]
 if(!task)throw fail('I-9 follow-up not found.',404)
 if(typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Use a unique replacement signing key.',400)
 if(body.attestation!==I9_EMPLOYER_ATTESTATION||body.attestationRead!==true||body.signingAsExaminer!==true||body.reviewedAllPages!==true||body.representativeIdentityConfirmed!==true)throw fail('Read the employer certification and confirm your identity and complete examination review.',400)
 if(typeof body.signature!=='string'||!body.signature.trim()||body.signature.length>200||/[\u0000-\u001f\u007f]/.test(body.signature)||!/^[1-9]\d*$/.test(String(body.reviewId)))throw fail('Enter your own name as the examiner signature.',400)
 const signature=body.signature.trim().normalize('NFC'),facts=i9DifferentSupplementExaminationInput(body.findings)
 const requestHash=hash(JSON.stringify({taskId:String(task.id),reviewId:String(BigInt(body.reviewId)),previewSha256:body.previewSha256,signature,facts,attestation:body.attestation}))
 const receipt=row=>({signatureId:row.id,documentId:row.document_id,signedAt:row.signed_at,status:'COMPLETE'})
 const prior=(await db.query('SELECT * FROM payroll_i9_different_supplement_signature WHERE facility_id=$1 AND employee_id=$2 AND request_key=$3',[ctx.facility,ctx.employee,body.requestKey])).rows[0]
 if(prior){if(prior.request_hash!==requestHash||String(prior.actor_user_id)!==String(ctx.admin))throw fail('This signing key was used for different replacement evidence.');return receipt(prior)}
 const checked=await reviewedI9DifferentSupplementExamination(db,ctx,taskId,body),{review}=checked,root=review.current.row
 const named=review.retained.answers.supplement.representativeName.normalize('NFC')
 if(signature!==named)throw fail('Sign as the representative named on the reviewed supplement.',400)
 const clock=(await db.query('SELECT clock_timestamp() AS signed_at,(clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[ctx.facility])).rows[0]
 if(clock.today!==checked.today)throw fail('The signing date changed. Prepare and review the replacement again.')
 const context={...review.current.retained.context,...review.current.currentHiringContext,today:clock.today,dueOn:root.due_on,originalExaminedOn:review.current.receipt.examination.examinedOn}
 const timing=checked.findings,copies=checked.copies.map(c=>({...c,copyId:c.id}))
 const part=review.retained.packet.find(p=>p.documentKey==='replacement')
 const pdf=await signI9DifferentSupplementPdf(Buffer.from(part.pdfBase64,'base64'),{signature,signedOn:clock.today,pageCount:part.pageCount})
 const document=(await db.query("INSERT INTO payroll_private_document(facility_id,employee_id,task_id,onboarding_cycle,filename,mime_type,encrypted_content,content_sha256) VALUES($1,$2,$3,$4,'Form-I9-different-supplement-signed.pdf','application/pdf',$5,$6) RETURNING id",[ctx.facility,ctx.employee,root.task_id,root.onboarding_cycle,encryptDocument(pdf,`${ctx.facility}:${ctx.employee}:${root.task_id}`),hash(pdf)])).rows[0]
 const evidence={receiptSignatureId:review.current.receiptSignatureId,receiptDocumentId:review.current.receipt.documentId,receiptSha256:review.current.receipt.sha256,signature,attestation:body.attestation,actorUserId:ctx.admin,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,signedOn:clock.today,signedAt:clock.signed_at,answers:review.retained.answers,facts,context,timing,copies,reviewId:review.row.id,sourceSignatureId:root.id,sourceDocumentId:root.document_id,sourceSha256:root.content_sha256,sourceEmployeeSha256:review.current.employeeSource.sha256,pageCount:part.pageCount,previewSha256:review.row.preview_sha256,documentSha256:hash(pdf),reviewedSources:review.retained.packet.filter(p=>p.documentKey!=='replacement').map(({pdfBase64,...p})=>p)}
 const signed=(await db.query('INSERT INTO payroll_i9_different_supplement_signature(facility_id,employee_id,compliance_task_id,signature_id,review_id,document_id,actor_user_id,request_key,request_hash,encrypted_evidence,selected_copy_ids,signed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',[ctx.facility,ctx.employee,task.id,root.id,review.row.id,document.id,ctx.admin,body.requestKey,requestHash,encryptDocument(Buffer.from(JSON.stringify(evidence)),`i9-different-supplement-signature:${ctx.facility}:${ctx.employee}:${task.id}:${ctx.admin}`),copies.map(c=>c.copyId),clock.signed_at])).rows[0]
 if(timing.nextFollowUpKind!=='NONE'){
  const rowKey=`DIFFERENT_SUPPLEMENT:${signed.id}`
  const next=(await db.query("INSERT INTO payroll_compliance_task(facility_id,employee_id,task_key,title,category,jurisdiction,due_date,status,severity,description,source_url,source_authority,last_verified_on) VALUES($1,$2,$3,'I-9 document follow-up','ONBOARDING','US',$4,'OPEN','CRITICAL',$5,$6,'Examiner-verified I-9 rule',$7) RETURNING id",[ctx.facility,ctx.employee,`I9_DOCUMENT_FOLLOWUP:${root.id}:${rowKey}`,timing.nextFollowUpOn,`Review signed replacement Supplement B ${signed.id}.`,facts.examination.acceptanceSource,clock.today])).rows[0]
  await db.query('INSERT INTO payroll_i9_signature_followup(signature_id,row_key,kind,due_on,compliance_task_id) VALUES($1,$2,$3,$4,$5)',[root.id,rowKey,timing.nextFollowUpKind,timing.nextFollowUpOn,next.id])
 }
 await db.query("UPDATE payroll_compliance_task SET status='COMPLETE',completion_note=$1,completed_at=$2,completed_by=$3,last_verified_on=$4,next_review_on=NULL,updated_at=clock_timestamp() WHERE id=$5",[`Signed replacement Supplement B ${signed.id}; retained with original receipt and I-9.`,clock.signed_at,ctx.admin,clock.today,task.id])
 await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'I9_DIFFERENT_SUPPLEMENT_SIGNED','i9_different_supplement_signature',$3,$4)",[ctx.facility,ctx.admin,String(signed.id),{employeeId:ctx.employee,complianceTaskId:task.id,documentId:document.id,reviewId:review.row.id,sourceSignatureId:root.id,receiptSignatureId:review.current.receiptSignatureId,documentSha256:hash(pdf)}])
 return receipt(signed)
}
