import {retirementReplacementAssessment} from './retirementReplacementAssessment.js'
const fields=['ordinaryPretaxCents','ordinaryRothCents','catchUpPretaxCents','catchUpRothCents','totalCents']
// Employee output contains only their own confirmed amount and public statuses.
// Original return history is preserved separately by the caller.
export async function employeeRetirementReplacement(db,facility,runId,employeeId,allocation,{now=new Date()}={}){
 const replacements=(await db.query(`SELECT r.id,r.preview FROM payroll_retirement_replacement_authorization r JOIN payroll_retirement_remittance_authorization original ON original.id=r.original_authorization_id WHERE r.facility_id=$1 AND original.facility_id=$1 AND original.run_id=$2 AND original.plan_id=$3 AND EXISTS(SELECT 1 FROM jsonb_array_elements(original.basis->'allocations') p WHERE p->>'employeeId'=$4) AND NOT EXISTS(SELECT 1 FROM payroll_retirement_replacement_cancellation c WHERE c.authorization_id=r.id)`,[facility,runId,allocation.planId,String(employeeId)])).rows
 if(!replacements.length)return null
 const data={status:'REVIEW_REQUIRED',postedCents:null,receiptCheckedAt:null,accountingStatus:'REVIEW_REQUIRED',caseStatus:'OPEN'}
 try{
  if(replacements.length!==1)throw new Error('Ambiguous replacement')
  const replacement=replacements[0],participants=replacement.preview.allocation.allocations.filter(p=>String(p.employeeId)===String(employeeId))
  if(participants.length!==1||fields.some(k=>participants[0][k]!==allocation[k]))throw new Error('Changed employee contribution')
  const assessment=await retirementReplacementAssessment(db,facility,replacement.id,{now})
  data.receiptCheckedAt=assessment.receiptCheckedAt
  data.accountingStatus=assessment.accountingStatus
  data.caseStatus=assessment.caseStatus
  if(assessment.deliveryStatus!=='MATCHED'||assessment.returnReviewRequired)throw new Error('Replacement delivery requires review')
  data.status='POSTED';data.postedCents=allocation.totalCents
 }catch{/* Withhold amounts when current scoped evidence does not reconcile. */}
 return data
}
