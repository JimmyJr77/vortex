import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {retirementEmployerEligibilitySource,retirementEmployerEligibilityInput} from './retirementEmployerEligibility.js'
const fail=message=>Object.assign(new Error(message),{status:409})
const day=value=>typeof value==='string'&&/^2026-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
export function employerEligibilityPeriod(source,row,periodStart,periodEnd){
 if(!day(periodStart)||!day(periodEnd)||periodStart>periodEnd)throw fail('Use the actual employer contribution period in 2026.')
 if(!row||row.source_fingerprint!==source.fingerprint)throw fail('Review current employer eligibility before calculating contributions.')
 let review
 try{review=retirementEmployerEligibilityInput({...row.review,confirmed:true,sourceFingerprint:row.source_fingerprint},source)}catch{throw fail('Retain employer eligibility with an explicit current assessment date range.')}
 if(review.assessedFrom>periodStart||review.assessedThrough<periodEnd)throw fail('Employer eligibility assessment does not cover the full contribution period.')
 const components={}
 for(const key of ['matching','nonelective']){
  const finding=review[key]
  if(finding.status==='REVIEW_REQUIRED')throw fail('Resolve each employer contribution eligibility finding before calculation.')
  if(finding.status==='ELIGIBLE'&&finding.eligibleOn>periodStart&&finding.eligibleOn<=periodEnd)throw fail('Employer entry falls inside the contribution period. Reconcile dated compensation and deferrals on each side of entry.')
  components[key]={eligible:finding.status==='ELIGIBLE'&&finding.eligibleOn<=periodStart,vestedBps:finding.vestedBps,eligibleOn:finding.eligibleOn,status:finding.status}
 }
 const basis={version:1,sourceFingerprint:source.fingerprint,reviewId:row.id,periodStart,periodEnd,review,components}
 return {...basis,fingerprint:createHash('sha256').update(JSON.stringify(compensationEvidence(basis))).digest('hex')}
}
// Reads server-owned source and latest review under the caller's transaction.
export async function retirementEmployerEligibilityForPeriod(db,{facility,employeeId,planId,periodStart,periodEnd}){
 const source=await retirementEmployerEligibilitySource(db,facility,employeeId,planId)
 const row=(await db.query('SELECT id,source_fingerprint,review FROM payroll_retirement_employer_eligibility WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 ORDER BY revision DESC LIMIT 1',[facility,employeeId,planId])).rows[0]
 return employerEligibilityPeriod(source,row,periodStart,periodEnd)
}
