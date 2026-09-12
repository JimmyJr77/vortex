import {createHash,randomBytes} from 'node:crypto'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {preparerInput,renderSupplementA,I9_PREPARER_ATTESTATION} from './i9SupplementA.js'
import {signRetainedPayrollForm} from './i9SignaturePdf.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(value).digest('hex')
const aad=(r,kind)=>`i9-preparer-${kind}:${r.facility_id}:${r.employee_id}:${r.task_id}:${r.onboarding_cycle}:${r.submission_id}`
const audit=(db,r,action,id,data={},actor=null)=>db.query('INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,$3,$4,$5,$6)',[r.facility_id,actor,action,'i9_preparer_request',String(id),{employeeId:r.employee_id,submissionId:r.submission_id,...data}])
async function taskScope(db,facility,employee,taskId){
 await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
 const e=(await db.query('SELECT id FROM payroll_employee WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,employee])).rows[0]
 if(!e)throw fail('Employee not found.',404)
 const task=(await db.query("SELECT * FROM payroll_onboarding_task WHERE id=$1 AND facility_id=$2 AND employee_id=$3 AND task_key='I9' FOR UPDATE",[taskId,facility,employee])).rows[0]
 if(!task)throw fail('I-9 step not found.',404)
 return task
}
export async function preparerRoster(db,ctx,taskId,cycle){
 const task=await taskScope(db,ctx.facility,ctx.employee,taskId)
 if(Number(cycle)!==task.onboarding_cycle)throw fail('Reload the current I-9 onboarding cycle.')
 const rows=(await db.query(`SELECT r.*,s.id AS signature_id,s.document_id,s.signed_at FROM payroll_i9_preparer_request r LEFT JOIN payroll_i9_preparer_signature s ON s.request_id=r.id WHERE r.task_id=$1 AND r.onboarding_cycle=$2 AND r.submission_id=$3 ORDER BY r.id`,[task.id,task.onboarding_cycle,task.response?.i9SubmissionId||null])).rows
 const requests=rows.map(r=>({id:r.id,...JSON.parse(decryptDocument(r.encrypted_recipient,aad(r,'recipient')).toString()),expiresAt:r.expires_at,cancelledAt:r.cancelled_at,signedAt:r.signed_at,documentId:r.document_id,signatureId:r.signature_id}))
 return {submissionId:task.response?.i9SubmissionId||null,requests,fingerprint:hash(JSON.stringify(rows.map(r=>[r.id,r.cancelled_at,r.signature_id])))}
}
export async function invitePreparer(db,ctx,taskId,body){
 const task=await taskScope(db,ctx.facility,ctx.employee,taskId)
 if(body.onboardingCycle!==task.onboarding_cycle||String(body.submissionId)!==String(task.response?.i9SubmissionId))throw fail('The employee Section 1 changed. Reload it before inviting a preparer.')
 if(!task.response?.i9PreparerRequired||!['SUBMITTED','CHANGES_REQUESTED'].includes(task.status))throw fail('A current employee signature reporting preparer assistance is required.')
 if(body.confirmed!==true||typeof body.name!=='string'||!body.name.trim()||body.name.length>200||typeof body.email!=='string'||body.email.length>254||!/^\S+@\S+\.\S+$/.test(body.email)||typeof body.evidence!=='string'||body.evidence.trim().length<12||body.evidence.length>2000||/[\u0000-\u001f\u007f]/.test(body.name+body.email+body.evidence))throw fail('Confirm the intended preparer name, email and identity/contact verification evidence.',400)
 if(typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Use a unique preparer invitation request key.',400)
 const r={facility_id:ctx.facility,employee_id:ctx.employee,task_id:task.id,onboarding_cycle:task.onboarding_cycle,submission_id:body.submissionId},recipient={name:body.name.trim().normalize('NFC'),email:body.email.trim(),evidence:body.evidence.trim()}
 const requestHash=hash(JSON.stringify({taskId:String(task.id),cycle:task.onboarding_cycle,submissionId:String(body.submissionId),recipient}))
 const prior=(await db.query('SELECT * FROM payroll_i9_preparer_request WHERE facility_id=$1 AND employee_id=$2 AND request_key=$3',[ctx.facility,ctx.employee,body.requestKey])).rows[0]
 if(prior){if(prior.request_hash!==requestHash||String(prior.actor_user_id)!==String(ctx.admin)||prior.cancelled_at)throw fail('This invitation key was already used for different or cancelled details.');return {id:prior.id,token:decryptDocument(prior.encrypted_access,aad(prior,'access')).toString(),expiresAt:prior.expires_at}}
 const token=randomBytes(32).toString('base64url'),encrypted=encryptDocument(Buffer.from(JSON.stringify(recipient)),aad(r,'recipient'))
 const row=(await db.query('INSERT INTO payroll_i9_preparer_request(facility_id,employee_id,task_id,onboarding_cycle,submission_id,token_hash,encrypted_recipient,actor_user_id,request_key,request_hash,encrypted_access) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,expires_at',[r.facility_id,r.employee_id,r.task_id,r.onboarding_cycle,r.submission_id,hash(token),encrypted,ctx.admin,body.requestKey,requestHash,encryptDocument(Buffer.from(token),aad(r,'access'))])).rows[0]
 await audit(db,r,'I9_PREPARER_INVITED',row.id,{},ctx.admin)
 return {id:row.id,token,expiresAt:row.expires_at}
}
export async function cancelPreparer(db,ctx,taskId,requestId,body){
 const task=await taskScope(db,ctx.facility,ctx.employee,taskId)
 if(body.onboardingCycle!==task.onboarding_cycle||typeof body.reason!=='string'||body.reason.trim().length<12||body.reason.length>2000)throw fail('Provide the current cycle and a cancellation reason of 12–2000 characters.',400)
 const r=(await db.query('SELECT * FROM payroll_i9_preparer_request WHERE id=$1 AND task_id=$2 AND onboarding_cycle=$3 FOR UPDATE',[requestId,task.id,task.onboarding_cycle])).rows[0]
 if(!r)throw fail('Preparer invitation not found.',404)
 if((await db.query('SELECT id FROM payroll_i9_preparer_signature WHERE request_id=$1',[r.id])).rowCount)throw fail('A signed preparer certification must be retained. Use the correction workflow.')
 if(r.cancelled_at)return {cancelled:true}
 await db.query('UPDATE payroll_i9_preparer_request SET cancelled_at=clock_timestamp(),cancelled_by=$1,cancellation_reason=$2 WHERE id=$3',[ctx.admin,body.reason.trim(),r.id])
 await audit(db,r,'I9_PREPARER_CANCELLED',r.id,{},ctx.admin);return {cancelled:true}
}
async function guest(db,token,mutation=false){
 if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw fail('A valid preparer access link is required.',401)
 const hint=(await db.query('SELECT * FROM payroll_i9_preparer_request WHERE token_hash=$1',[hash(token)])).rows[0]
 if(!hint)throw fail('Preparer access is invalid or expired.',401)
 const task=await taskScope(db,hint.facility_id,hint.employee_id,hint.task_id)
 const r=(await db.query('SELECT *,expires_at>clock_timestamp() AS live FROM payroll_i9_preparer_request WHERE id=$1 FOR UPDATE',[hint.id])).rows[0]
 if(r.cancelled_at||!r.live)throw fail('Preparer access is invalid or expired.',401)
 const current=task.onboarding_cycle===r.onboarding_cycle&&String(task.response?.i9SubmissionId)===String(r.submission_id)
 if(mutation&&(!current||!['SUBMITTED','CHANGES_REQUESTED'].includes(task.status)))throw fail('The employee Section 1 changed or was completed. Request a current preparer link.')
 return {r,current}
}
async function employeeName(db,r){
 const review=(await db.query('SELECT v.* FROM payroll_i9_review v JOIN payroll_i9_submission s ON s.review_id=v.id WHERE s.id=$1',[r.submission_id])).rows[0]
 const retained=JSON.parse(decryptDocument(review.encrypted_review,`i9-review:${r.facility_id}:${r.employee_id}:${r.task_id}:${r.onboarding_cycle}:${review.employee_session_id}`).toString())
 return Object.fromEntries(['lastName','firstName','middleInitial'].map(k=>[k,retained.answers.personal[k]||'']))
}
export async function preparerPacket(db,token){
 const {r,current}=await guest(db,token),signature=(await db.query('SELECT id,document_id,signed_at FROM payroll_i9_preparer_signature WHERE request_id=$1',[r.id])).rows[0]
 return {requestId:r.id,recipientName:JSON.parse(decryptDocument(r.encrypted_recipient,aad(r,'recipient')).toString()).name,employee:await employeeName(db,r),current,attestation:I9_PREPARER_ATTESTATION,signature:signature?{id:signature.id,documentId:signature.document_id,signedAt:signature.signed_at}:null}
}
export async function previewPreparer(db,token,body){
 const {r}=await guest(db,token,true)
 if((await db.query('SELECT id FROM payroll_i9_preparer_signature WHERE request_id=$1',[r.id])).rowCount)throw fail('This preparer certification is already signed.')
 const preparer=preparerInput(body.preparer),recipient=JSON.parse(decryptDocument(r.encrypted_recipient,aad(r,'recipient')).toString())
 const nameKey=value=>value.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US')
 if(![`${preparer.firstName} ${preparer.lastName}`,`${preparer.firstName} ${preparer.middleInitial} ${preparer.lastName}`].some(name=>nameKey(name)===nameKey(recipient.name)))throw fail('Use the name matching your intended preparer invitation. Ask the hiring admin to correct the invitation if its name is wrong.',400)
 const employee=await employeeName(db,r),pdf=await renderSupplementA({employee,preparer}),previewSha256=hash(pdf)
 const encrypted=encryptDocument(Buffer.from(JSON.stringify({preparer,employee,pdf:pdf.toString('base64')})),aad(r,`review-${r.id}`))
 const review=(await db.query('INSERT INTO payroll_i9_preparer_review(request_id,encrypted_review,preview_sha256) VALUES($1,$2,$3) RETURNING id,expires_at',[r.id,encrypted,previewSha256])).rows[0]
 await audit(db,r,'I9_PREPARER_PREVIEWED',r.id,{reviewId:review.id,previewSha256})
 return {reviewId:review.id,expiresAt:review.expires_at,previewSha256,pdfBase64:pdf.toString('base64'),attestation:I9_PREPARER_ATTESTATION,pageCount:1}
}
export async function signPreparer(db,token,body){
 const {r}=await guest(db,token)
 if(body.attestation!==I9_PREPARER_ATTESTATION||body.attestationRead!==true||body.reviewed!==true||body.signingAsPreparer!==true||typeof body.signature!=='string'||!body.signature.trim()||body.signature.length>200||/[\u0000-\u001f\u007f]/.test(body.signature)||typeof body.requestKey!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(body.requestKey))throw fail('Review the supplement, read its attestation and explicitly sign as the preparer named on it.',400)
 const signature=body.signature.trim().normalize('NFC'),requestHash=hash(JSON.stringify({reviewId:String(body.reviewId),previewSha256:body.previewSha256,signature,attestation:body.attestation}))
 const prior=(await db.query('SELECT * FROM payroll_i9_preparer_signature WHERE request_id=$1',[r.id])).rows[0]
 const receipt=s=>({id:s.id,documentId:s.document_id,signedAt:s.signed_at})
 if(prior){if(prior.request_key!==body.requestKey.toLowerCase()||prior.request_hash!==requestHash)throw fail('This preparer certification has already been signed with different request details.');return receipt(prior)}
 await guest(db,token,true)
 if(!/^\d+$/.test(String(body.reviewId)))throw fail('Prepare the supplement before signing.',400)
 const row=(await db.query('SELECT *,expires_at>clock_timestamp() AS live FROM payroll_i9_preparer_review WHERE id=$1 AND request_id=$2',[body.reviewId,r.id])).rows[0],latest=(await db.query('SELECT id FROM payroll_i9_preparer_review WHERE request_id=$1 ORDER BY id DESC LIMIT 1',[r.id])).rows[0]
 if(!row||!row.live||String(latest.id)!==String(row.id)||row.preview_sha256!==body.previewSha256)throw fail('This supplement preview expired or changed. Prepare it again.')
 if(!(await db.query('SELECT review_id FROM payroll_i9_preparer_page_visit WHERE review_id=$1',[row.id])).rowCount)throw fail('Display the prepared supplement before signing.')
 const retained=JSON.parse(decryptDocument(row.encrypted_review,aad(r,`review-${r.id}`)).toString())
 if(hash(Buffer.from(retained.pdf,'base64'))!==row.preview_sha256)throw fail('The retained supplement failed its integrity check.')
 const clock=(await db.query('SELECT clock_timestamp() AS signed_at,(clock_timestamp() AT TIME ZONE timezone)::date::text AS signed_on FROM payroll_settings WHERE facility_id=$1',[r.facility_id])).rows[0]
 const pdf=await signRetainedPayrollForm(Buffer.from(retained.pdf,'base64'),{signature,signedOn:clock.signed_on,signatureField:'Signature of Preparer or Translator 0',dateField:'Sig Date mmddyyyy 0',pageCount:1,title:'I-9 Supplement A - preparer signed'})
 const doc=(await db.query("INSERT INTO payroll_private_document(facility_id,employee_id,task_id,onboarding_cycle,filename,mime_type,encrypted_content,content_sha256) VALUES($1,$2,$3,$4,$5,'application/pdf',$6,$7) RETURNING id",[r.facility_id,r.employee_id,r.task_id,r.onboarding_cycle,`Form-I9-Supplement-A-${r.id}.pdf`,encryptDocument(pdf,`${r.facility_id}:${r.employee_id}:${r.task_id}`),hash(pdf)])).rows[0]
 const evidence=encryptDocument(Buffer.from(JSON.stringify({signature,attestation:body.attestation,attestationRead:true,reviewed:true,signingAsPreparer:true,accessRequestId:r.id,previewSha256:row.preview_sha256,signedAt:clock.signed_at,signedOn:clock.signed_on})),aad(r,`signature-${r.id}`))
 const signed=(await db.query('INSERT INTO payroll_i9_preparer_signature(request_id,review_id,document_id,request_key,request_hash,encrypted_signature,signed_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[r.id,row.id,doc.id,body.requestKey,requestHash,evidence,clock.signed_at])).rows[0]
 await audit(db,r,'I9_PREPARER_SIGNED',r.id,{signatureId:signed.id,documentId:doc.id,reviewId:row.id,documentSha256:hash(pdf)})
 return receipt(signed)
}
export async function preparerDocument(db,token){
 const {r}=await guest(db,token)
 const doc=(await db.query('SELECT d.* FROM payroll_private_document d JOIN payroll_i9_preparer_signature s ON s.document_id=d.id WHERE s.request_id=$1',[r.id])).rows[0]
 if(!doc)throw fail('No signed preparer supplement is available.',404)
 return {filename:doc.filename,bytes:decryptDocument(doc.encrypted_content,`${r.facility_id}:${r.employee_id}:${r.task_id}`)}
}

export async function recordPreparerPage(db,token,body){
 const {r}=await guest(db,token,true)
 if(body.displayed!==true||!/^\d+$/.test(String(body.reviewId)))throw fail('Display the supplement before acknowledging its page.',400)
 const row=(await db.query('SELECT id FROM payroll_i9_preparer_review WHERE id=$1 AND request_id=$2 AND preview_sha256=$3 AND expires_at>clock_timestamp() AND id=(SELECT MAX(id) FROM payroll_i9_preparer_review WHERE request_id=$2)',[body.reviewId,r.id,body.previewSha256])).rows[0]
 if(!row)throw fail('Prepare the current supplement again.')
 await db.query('INSERT INTO payroll_i9_preparer_page_visit(review_id) VALUES($1) ON CONFLICT DO NOTHING',[row.id]);return {recorded:true}
}
