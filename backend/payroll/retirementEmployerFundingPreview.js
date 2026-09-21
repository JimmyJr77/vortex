import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {retirementEmployerCompensationPreview} from './retirementEmployerCompensation.js'
import {retirementEmployerEligibilityForPeriod} from './retirementEmployerEligibilityPeriod.js'
const fail=message=>Object.assign(new Error(message),{status:409})

// The payroll producer supplies the engine preview and scoped period ID.
// Dates and employer eligibility come from records, not request overrides.
export async function retirementEmployerFundingPreview(db,{facility,employeeId,planId,payDate,payrollPreview,payPeriodId,runId=null,runKind='REGULAR'}){
 const period=(await db.query(`SELECT p.id,p.period_start::text AS start,p.period_end::text AS end FROM payroll_pay_period p
 WHERE p.facility_id=$1 AND p.id=$2 AND ($3::bigint IS NULL OR EXISTS(
 SELECT 1 FROM payroll_run r WHERE r.id=$3 AND r.facility_id=p.facility_id AND r.pay_period_id=p.id))`,[facility,payPeriodId,runId])).rows[0]
 if(!period)throw fail('Use the employer contribution payroll’s actual workplace and pay period.')
 const compensation=await retirementEmployerCompensationPreview(db,{facility,employeeId,planId,payDate,payrollPreview,runId})
 let eligibility
 if(compensation.employerContributionPeriod==='ANNUAL_TRUE_UP')eligibility={status:'REVIEW_REQUIRED',message:'Review employer eligibility over the annual true-up period; a single pay-period review is insufficient.'}
 else if(runKind!=='REGULAR')eligibility={status:'REVIEW_REQUIRED',message:'Review the employer contribution earning period for this off-cycle payment.'}
 else{
  try{
   const review=await retirementEmployerEligibilityForPeriod(db,{facility,employeeId,planId,periodStart:period.start,periodEnd:period.end})
   eligibility={status:'REVIEWED_FOR_PAY_PERIOD',...review}
  }catch(error){
   if(![400,404,409].includes(error.status))throw error
   eligibility={status:'REVIEW_REQUIRED',message:error.message}
  }
 }
 const basis={version:1,compensationSourceFingerprint:compensation.sourceFingerprint,payPeriodId:String(period.id),periodStart:period.start,periodEnd:period.end,runKind,eligibility}
 const fundingSourceFingerprint=createHash('sha256').update(JSON.stringify(compensationEvidence(basis))).digest('hex')
 return {...compensation,...basis,fundingSourceFingerprint,requiresEmployerEligibilityReview:eligibility.status!=='REVIEWED_FOR_PAY_PERIOD',requiresContributionCalculation:true}
}
