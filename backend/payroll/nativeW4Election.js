import {createHash} from 'node:crypto'
import {decryptDocument} from './onboarding.js'
import {w4FormInput2026} from './w4Form2026.js'
const fail=message=>Object.assign(new Error(message),{status:409})
export function federalElectionFromW4(answers){
 const a=w4FormInput2026(answers)
 return {filingStatus:a.filingStatus,multipleJobs:a.twoJobs,exempt:a.exempt,nonresidentAlien:a.nonresidentAlien,lockInLetter:false,...Object.fromEntries(['creditsCents','otherIncomeCents','deductionsCents','extraWithholdingCents'].map(k=>[k,a[k]??0]))}
}
// Only withholding choices leave the vault. Identity, address and SSN remain private.
export async function nativeW4Election(db,facility,employeeId){
 const task=(await db.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='W4'",[facility,employeeId])).rows[0]
 if(!task?.response?.w4SubmissionId)return null
 const row=(await db.query(`SELECT s.id,s.document_id,s.signed_at,s.employee_session_id,s.encrypted_signature,r.encrypted_review,r.preview_sha256,d.content_sha256
 FROM payroll_w4_submission s JOIN payroll_w4_review r ON r.id=s.review_id JOIN payroll_private_document d ON d.id=s.document_id
 WHERE s.id=$1 AND s.facility_id=$2 AND s.employee_id=$3 AND s.task_id=$4 AND s.onboarding_cycle=$5
 AND NOT EXISTS(SELECT 1 FROM payroll_w4_submission n WHERE n.task_id=s.task_id AND n.onboarding_cycle=s.onboarding_cycle AND n.id>s.id)`,[task.response.w4SubmissionId,facility,employeeId,task.id,task.onboarding_cycle])).rows[0]
 if(!row)throw fail('The signed W-4 source changed. Reload and review the current employee submission.')
 const retained=JSON.parse(decryptDocument(row.encrypted_review,`w4-review:${facility}:${employeeId}:${task.id}:${task.onboarding_cycle}:${row.employee_session_id}`).toString('utf8'))
 if(createHash('sha256').update(Buffer.from(retained.previewPdf,'base64')).digest('hex')!==row.preview_sha256)throw fail('The retained W-4 failed its integrity check.')
 const federal=federalElectionFromW4(retained.answers)
 const signature=JSON.parse(decryptDocument(row.encrypted_signature,`w4-review:${facility}:${employeeId}:${task.id}:${task.onboarding_cycle}:${row.employee_session_id}`).toString('utf8'))
 const effectiveOn=signature.signedOn
 if(!/^2026-\d{2}-\d{2}$/.test(effectiveOn||'')||!Number.isFinite(Date.parse(effectiveOn))||new Date(effectiveOn).toISOString().slice(0,10)!==effectiveOn||signature.previewSha256!==row.preview_sha256)throw fail('The retained W-4 signing date requires review.')
 const fingerprint=createHash('sha256').update(JSON.stringify({submissionId:row.id,documentSha256:row.content_sha256,onboardingCycle:task.onboarding_cycle,effectiveOn,federal})).digest('hex')
 return {submissionId:row.id,documentId:row.document_id,signedAt:row.signed_at,effectiveOn,onboardingCycle:task.onboarding_cycle,reviewed:task.status==='COMPLETE',fingerprint,federal}
}
