import {i9SupplementBExaminationInput,validateI9SupplementBExamination} from './i9SupplementBExamination.js'
const fail=message=>Object.assign(new Error(message),{status:400})
export function i9DifferentSupplementExaminationInput(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(key=>!['examination','differentDocumentsConfirmed','replacementEvidence'].includes(key)))throw fail('Use the replacement Supplement B examination fields.')
 if(raw.differentDocumentsConfirmed!==true)throw fail('Confirm that the employee chose different acceptable documentation to replace the retained receipt.')
 if(typeof raw.replacementEvidence!=='string'||raw.replacementEvidence.trim().length<12||raw.replacementEvidence.length>2000||/[\u0000-\u001f\u007f]/.test(raw.replacementEvidence))throw fail('Retain meaningful evidence explaining the different-document replacement.')
 const examination=i9SupplementBExaminationInput(raw.examination)
 if(examination.acceptance==='RECEIPT'||examination.followUpKind==='RECEIPT_REPLACEMENT')throw fail('Complete this replacement with acceptable documentation; another receipt needs separate review.')
 return {examination,differentDocumentsConfirmed:true,replacementEvidence:raw.replacementEvidence.trim().normalize('NFC')}
}
export function validateI9DifferentSupplementExamination(input,retained,context){
 const exam=input.examination
 if(retained.recordedOn!==context.today)throw fail('Prepare the replacement supplement with today’s actual date before signing.')
 if(exam.examinerInitials!==retained.answers.initials.trim().normalize('NFC'))throw fail('Use the examiner initials retained on the replacement explanation.')
 const findings=validateI9SupplementBExamination(exam,retained.answers.supplement,context)
 if(!exam.authorizationIndefinite&&exam.followUpKind!=='REVERIFICATION')throw fail('Schedule reverification for the current finite employment authorization.')
 return findings
}

// Called inside the signing transaction after acquiring the review's source locks.
export async function reviewedI9DifferentSupplementExamination(db,ctx,taskId,body){
 const {currentI9DifferentSupplementReview}=await import('./i9DifferentSupplementReview.js')
 const {currentI9DifferentSupplementCopy}=await import('./i9DifferentSupplementCopies.js')
 const review=await currentI9DifferentSupplementReview(db,ctx,taskId,body)
 const input=i9DifferentSupplementExaminationInput(body.findings)
 const clock=(await db.query('SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[ctx.facility])).rows[0]
 const findings=validateI9DifferentSupplementExamination(input,review.retained,{today:clock.today,dueOn:review.current.row.due_on,originalExaminedOn:review.current.receipt.examination.examinedOn,attestationKind:review.current.retained.context.attestationKind,eVerify:review.current.currentHiringContext.eVerify})
 const visits=(await db.query('SELECT document_key,count(*)::integer AS count FROM payroll_i9_different_supplement_page_visit WHERE review_id=$1 GROUP BY document_key',[review.row.id])).rows
 for(const [key,count] of Object.entries(review.row.page_counts))if(visits.find(v=>v.document_key===key)?.count!==count)throw Object.assign(new Error('Review every page of the current replacement packet.'),{status:409})
 const copies=[]
 for(const copyId of input.examination.copyIds){
  const {copy}=await currentI9DifferentSupplementCopy(db,ctx,taskId,{...body,copyId,rowKey:'document'})
  const count=(await db.query('SELECT count(*)::integer AS count FROM payroll_i9_different_supplement_copy_page WHERE review_id=$1 AND copy_id=$2',[review.row.id,copy.id])).rows[0].count
  if(count!==copy.page_count)throw Object.assign(new Error('Review every page of each selected replacement copy.'),{status:409})
  copies.push({id:copy.id,documentId:copy.document_id,sha256:copy.content_sha256,pageCount:copy.page_count})
 }
 return {review,input,findings,copies,today:clock.today}
}
