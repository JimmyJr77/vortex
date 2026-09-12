import {createHash} from 'node:crypto'
import {retirementPlanInput} from './retirementPlanInput.js'
const fail=message=>Object.assign(new Error(message),{status:400})
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
export function retirementPtoEvidenceInput(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||body.confirmed!==true||!Number.isSafeInteger(body.employmentPeriodId)||body.employmentPeriodId<=0||!day(body.employmentStartedOn)||!(body.employmentEndedOn===null||day(body.employmentEndedOn)&&body.employmentEndedOn>=body.employmentStartedOn)||typeof body.usableIfContinued!=='boolean'||typeof body.sourceReference!=='string'||body.sourceReference.trim().length<20||body.sourceReference.length>2000||/[\u0000-\u001f\u007f]/.test(body.sourceReference))throw fail('Review the employment period, continued-use eligibility and supporting unused PTO evidence.')
 return {version:1,employmentPeriodId:body.employmentPeriodId,employmentStartedOn:body.employmentStartedOn,employmentEndedOn:body.employmentEndedOn,usableIfContinued:body.usableIfContinued,sourceReference:body.sourceReference.trim(),confirmed:true}
}
// A scoped source assessment, not a contribution or withholding calculation.
// Preserve all facts in the fingerprint so a saved draft cannot use changed
// plan, employment or payout evidence without recalculation.
export async function retirementPtoAssessment(db,{facility,employeeId,planId,payoutId,paymentDate,evidence}){
 const planRow=(await db.query('SELECT id,plan FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,planId])).rows[0]
 const payout=(await db.query('SELECT id,employee_id,pay_period_id,minutes,hourly_rate_cents,amount_cents,status,reserved_on::text,review FROM payroll_leave_payout WHERE facility_id=$1 AND employee_id=$2 AND id=$3',[facility,employeeId,payoutId])).rows[0]
 const periods=(await db.query('SELECT id,started_on::text,ended_on::text FROM payroll_employment_period WHERE facility_id=$1 AND employee_id=$2 ORDER BY started_on,id',[facility,employeeId])).rows
 const issues=[],review=evidence?retirementPtoEvidenceInput(evidence):null,plan=planRow?.plan
 let treatment=null,compensation415Cents=null
 if(!day(paymentDate)||paymentDate.slice(0,4)!=='2026')issues.push('Review the supported retirement payout tax year and payment date.')
 if(!payout||payout.status!=='RESERVED'||!Number.isSafeInteger(Number(payout.amount_cents))||Number(payout.amount_cents)<=0||payout.review?.unusedVacationVerified!==true||payout.review?.policyVerified!==true)issues.push('Reconcile the reserved unused-vacation payout and its policy evidence.')
 if(!plan||retirementPlanInput({...plan,confirmed:true}).fingerprint!==plan.fingerprint||plan.effectiveOn>paymentDate)issues.push('Review current effective retirement plan evidence for the payout.')
 if(!plan?.unusedPto)issues.push('Record unused PTO cashout terms in retirement plan setup; taken paid leave is a separate category.')
 if(!review)issues.push('Review which employment period earned this PTO and whether the leave could have been used if employment continued.')
 const period=review?periods.find(p=>String(p.id)===String(review.employmentPeriodId)):null
 if(review&&(!period||period.started_on>paymentDate||period.started_on>payout?.reserved_on))issues.push('The reviewed earning employment period does not match this employee and payout date.')
 if(period&&(period.started_on!==review.employmentStartedOn||period.ended_on!==review.employmentEndedOn))issues.push('Employment dates changed after the PTO review. Review and confirm the current employment evidence again.')
 if(period&&periods.some(p=>p.id!==period.id&&p.started_on>period.started_on&&p.started_on<=paymentDate))issues.push('Reconcile rehire and prior-employment PTO compensation before retirement processing.')
 if(plan?.unusedPto&&period&&payout&&day(paymentDate)){
  const postSeverance=!!period.ended_on&&paymentDate>period.ended_on
  treatment=postSeverance?plan.unusedPto.postSeveranceDeferrals:plan.unusedPto.inServiceDeferrals
  if(treatment==='REVIEW_REQUIRED')issues.push('Resolve the plan deferral treatment for this unused PTO payment.')
  if(postSeverance){
   const policy=plan.unusedPto.postSeverance415
   if(policy==='REVIEW_REQUIRED')issues.push('Resolve the plan section 415 treatment of post-employment unused PTO.')
   // Same-year calendar limitation periods establish the timing condition
   // without assuming a deadline for a non-calendar or prior-year severance.
   if(plan.unusedPto.limitationYear!=='CALENDAR_YEAR'||period.ended_on.slice(0,4)!==paymentDate.slice(0,4))issues.push('Reconcile the applicable limitation year and post-severance payment deadline.')
   if(policy!=='REVIEW_REQUIRED')compensation415Cents=policy==='INCLUDED'&&review.usableIfContinued?Number(payout.amount_cents):0
   if(treatment==='INCLUDED'&&(policy!=='INCLUDED'||!review.usableIfContinued))issues.push('Post-employment deferrals require qualifying unused-leave compensation; reconcile continued-use eligibility and plan terms.')
  }else compensation415Cents=Number(payout.amount_cents)
 }
 const source={version:1,facility:String(facility),employeeId:String(employeeId),planId,paymentDate,planRevisionId:planRow?.id||null,planFingerprint:plan?.fingerprint||null,payout:payout||null,employmentPeriods:periods,evidence:review}
 return {version:1,planId,planName:plan?.name||planId,status:issues.length?'REVIEW_REQUIRED':'EVIDENCE_READY',deferralTreatment:treatment,compensation415Cents:issues.length?null:compensation415Cents,issues,source,fingerprint:hash(source)}
}
