import {createHash} from 'node:crypto'
import {readI9Draft} from './i9Draft.js'
import {readI9HiringContext} from './i9HiringContext.js'
import {i9DraftToSection1} from './i9DraftToSection1.js'
import {renderI9Section1Preview} from './i9Section1Pdf.js'
import {encryptDocument,decryptDocument} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(value).digest('hex')
const aad=(session,taskId,cycle)=>`i9-review:${session.facility_id}:${session.employee_id}:${BigInt(taskId)}:${cycle}:${session.session_id}`
async function basis(db,session,taskId,cycle){
 // Match the transaction's employee -> task locking order used by admin edits.
 const hiring=await readI9HiringContext(db,{facility:session.facility_id,employee:session.employee_id},taskId,cycle)
 const task=(await db.query('SELECT status FROM payroll_onboarding_task WHERE id=$1',[taskId])).rows[0]
 if(!['OPEN','SUBMITTED','CHANGES_REQUESTED'].includes(task.status))throw fail('Ask your hiring admin to reopen this I-9 step.')
 if(!hiring.current)throw fail('Your hiring admin must record the accepted offer and employer participation status before preparing your I-9.')
 const draft=await readI9Draft(db,session,taskId,cycle)
 if(!draft.draft)throw fail('Save your I-9 draft before preparing the form.')
 const today=(await db.query('SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[session.facility_id])).rows[0].today
 if(hiring.current.offerAcceptedOn>today)throw fail('The recorded offer acceptance date must not be after today.')
 return {draft,hiring,context:{eVerify:hiring.current.eVerify,offerAccepted:true,today}}
}
export async function previewI9(db,session,taskId,body){
 const current=await basis(db,session,taskId,body.onboardingCycle)
 if(body.expectedRevision!==current.draft.revision||body.baseResponseHash!==current.draft.baseResponseHash)throw fail('Your I-9 draft changed. Reload and save it before preparing the form.')
 const answers=i9DraftToSection1(current.draft.draft,current.context)
 const pdf=await renderI9Section1Preview({answers,context:current.context}),previewSha256=hash(pdf)
 const encrypted=encryptDocument(Buffer.from(JSON.stringify({answers,context:current.context,previewPdf:pdf.toString('base64')})),aad(session,taskId,body.onboardingCycle))
 const row=(await db.query(`INSERT INTO payroll_i9_review(facility_id,employee_id,task_id,onboarding_cycle,employee_session_id,draft_revision,base_response_hash,hiring_revision,encrypted_review,preview_sha256)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,expires_at`,[session.facility_id,session.employee_id,taskId,body.onboardingCycle,session.session_id,current.draft.revision,current.draft.baseResponseHash,current.hiring.revision,encrypted,previewSha256])).rows[0]
 await db.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id,after_data) VALUES($1,'I9_PREVIEW_CREATED','i9_review',$2,$3)",[session.facility_id,String(row.id),{employeeId:session.employee_id,taskId,onboardingCycle:body.onboardingCycle,draftRevision:current.draft.revision,hiringRevision:current.hiring.revision,previewSha256}])
 return {reviewId:row.id,expiresAt:row.expires_at,previewSha256,pdfBase64:pdf.toString('base64'),pageCount:4,hiringRevision:current.hiring.revision}
}
// Shared freshness and integrity check for page review and the future signing transaction.
export async function currentI9Review(db,session,taskId,body){
 const current=await basis(db,session,taskId,body.onboardingCycle)
 if(!/^\d+$/.test(String(body.reviewId))||!/^[a-f0-9]{64}$/.test(body.previewSha256||''))throw fail('Prepare the current I-9 form before reviewing it.',400)
 const row=(await db.query(`SELECT *,expires_at>clock_timestamp() AS unexpired FROM payroll_i9_review WHERE id=$1 AND facility_id=$2 AND employee_id=$3 AND task_id=$4 AND onboarding_cycle=$5 AND employee_session_id=$6`,[body.reviewId,session.facility_id,session.employee_id,taskId,body.onboardingCycle,session.session_id])).rows[0]
 const latest=(await db.query('SELECT id FROM payroll_i9_review WHERE task_id=$1 AND onboarding_cycle=$2 ORDER BY id DESC LIMIT 1',[taskId,body.onboardingCycle])).rows[0]
 if(!row||!row.unexpired||String(latest?.id)!==String(row.id)||row.preview_sha256!==body.previewSha256||row.draft_revision!==current.draft.revision||row.hiring_revision!==current.hiring.revision||row.base_response_hash!==current.draft.baseResponseHash)throw fail('This I-9 preview expired or its draft or hiring context changed. Prepare and review it again.')
 const retained=JSON.parse(decryptDocument(row.encrypted_review,aad(session,taskId,body.onboardingCycle)).toString('utf8'))
 if(hash(Buffer.from(retained.previewPdf,'base64'))!==row.preview_sha256)throw fail('The retained I-9 preview failed its integrity check.')
 return {row,retained,current}
}
export async function recordI9Page(db,session,taskId,body){
 if(!Number.isInteger(body.page)||body.page<1||body.page>4||body.displayed!==true)throw fail('Display one of the four I-9 pages before continuing.',400)
 const {row}=await currentI9Review(db,session,taskId,body)
 await db.query('INSERT INTO payroll_i9_page_visit(review_id,page_number) VALUES($1,$2) ON CONFLICT DO NOTHING',[row.id,body.page])
 return {page:body.page,recorded:true}
}
