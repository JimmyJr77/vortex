import {createHash} from 'node:crypto'
import {decryptDocument} from './onboarding.js'
import {mw507FormInput2026,mw507ReviewRequirements2026} from './mw507Form2026.js'
const fail=message=>Object.assign(new Error(message),{status:409})
export function marylandChoicesFromMW507(answers){
 const a=mw507FormInput2026(answers)
 // Keep state-only Pennsylvania exemption distinct from exemption from both taxes.
 return {filingStatus:a.withholdingRate===null?null:a.withholdingRate==='MARRIED'?'JOINT':'SINGLE',exemptions:a.exemptions,extraWithholdingCents:a.additionalWithholdingCents??0,claim:a.claim,stateExempt:a.claim.kind!=='NONE',localExempt:a.claim.kind!=='NONE'&&!(a.claim.kind==='PENNSYLVANIA'&&a.claim.localExemption==='NONE')}
}
// Only withholding choices leave the vault. Identity, address and SSN remain private.
export async function nativeMW507Election(db,facility,employeeId){
 const task=(await db.query("SELECT * FROM payroll_onboarding_task WHERE facility_id=$1 AND employee_id=$2 AND task_key='STATE_WITHHOLDING'",[facility,employeeId])).rows[0]
 if(!task?.response?.mw507SubmissionId)return null
 const row=(await db.query(`SELECT s.id,s.document_id,s.signed_at,s.employee_session_id,s.encrypted_signature,r.encrypted_review,r.preview_sha256,d.content_sha256
 FROM payroll_mw507_submission s JOIN payroll_mw507_review r ON r.id=s.review_id JOIN payroll_private_document d ON d.id=s.document_id
 WHERE s.id=$1 AND s.facility_id=$2 AND s.employee_id=$3 AND s.task_id=$4 AND s.onboarding_cycle=$5
 AND NOT EXISTS(SELECT 1 FROM payroll_mw507_submission n WHERE n.task_id=s.task_id AND n.onboarding_cycle=s.onboarding_cycle AND n.id>s.id)`,[task.response.mw507SubmissionId,facility,employeeId,task.id,task.onboarding_cycle])).rows[0]
 if(!row)throw fail('The signed MW507 source changed. Reload and review the current employee submission.')
 const retained=JSON.parse(decryptDocument(row.encrypted_review,`mw507-review:${facility}:${employeeId}:${task.id}:${task.onboarding_cycle}:${row.employee_session_id}`).toString('utf8'))
 if(createHash('sha256').update(Buffer.from(retained.previewPdf,'base64')).digest('hex')!==row.preview_sha256)throw fail('The retained MW507 failed its integrity check.')
 const choices=marylandChoicesFromMW507(retained.answers),requirements=mw507ReviewRequirements2026(retained.answers)
 const signature=JSON.parse(decryptDocument(row.encrypted_signature,`mw507-review:${facility}:${employeeId}:${task.id}:${task.onboarding_cycle}:${row.employee_session_id}`).toString('utf8'))
 const receivedOn=signature.signedOn
 if(!/^2026-\d{2}-\d{2}$/.test(receivedOn||'')||!Number.isFinite(Date.parse(receivedOn))||new Date(receivedOn).toISOString().slice(0,10)!==receivedOn||signature.previewSha256!==row.preview_sha256)throw fail('The retained MW507 signing date requires review.')
 const fingerprint=createHash('sha256').update(JSON.stringify({submissionId:row.id,documentSha256:row.content_sha256,onboardingCycle:task.onboarding_cycle,receivedOn,choices,requirements})).digest('hex')
 return {submissionId:row.id,documentId:row.document_id,signedAt:row.signed_at,receivedOn,onboardingCycle:task.onboarding_cycle,reviewed:task.status==='COMPLETE',fingerprint,choices,requirements}
}
