import {employerRetirementApprovalReview} from './retirementEmployerApproval.js'
import {retirementPayrollCalculation} from './retirementPayrollCalculation.js'
import {retirementEmployerFundingPreview} from './retirementEmployerFundingPreview.js'
const fail=message=>Object.assign(new Error(message),{status:409})
// Rebuild the full payroll, including benefit collections, after calculating
// deferrals. All inputs originate from the same employer-scoped transaction.
export async function retirementCandidatesFor(db,facility,date,employees){
 // Employer obligations can exist without a signed employee deferral election.
 // Every employee in this payroll needs a disposition for applicable employer
 // terms; candidate inclusion does not itself establish participant eligibility.
 return (await db.query(`SELECT DISTINCT q.employee_id,q.plan_id FROM payroll_retirement_election q
   WHERE q.facility_id=$1 AND q.election->>'effectiveOn'<=$2
   AND q.employee_id=ANY($3::bigint[])
   UNION SELECT e.employee_id,e.plan_id FROM
   (SELECT DISTINCT ON(employee_id,plan_id) employee_id,plan_id,review FROM payroll_retirement_eligibility WHERE facility_id=$1 AND employee_id=ANY($3::bigint[]) ORDER BY employee_id,plan_id,revision DESC) e
   WHERE e.review->>'disposition'='ELIGIBLE' AND e.review->>'eligibleOn'<=$2
   UNION SELECT employee.id AS employee_id,plan.plan_id FROM payroll_employee employee
   CROSS JOIN (SELECT DISTINCT ON(plan_id) plan_id,plan FROM payroll_retirement_plan_revision
     WHERE facility_id=$1 AND tax_year=2026 AND plan->>'effectiveOn'<=$2
     ORDER BY plan_id,revision DESC) plan
   WHERE employee.facility_id=$1 AND employee.id=ANY($3::bigint[])
   AND plan.plan->>'employerContributions' IS DISTINCT FROM 'NONE'
   ORDER BY employee_id,plan_id`,[facility,date,employees])).rows
}
export async function retirementOffCycleWarnings(db,facility,employeeId,date){
 const candidates=await retirementCandidatesFor(db,facility,date,[employeeId])
 return candidates.length?[{employeeId,code:'RETIREMENT_OFF_CYCLE_REVIEW',severity:'critical',blocking:true,message:'A retirement election, eligibility review, or employer-funded plan applies. Reconcile off-cycle retirement compensation and withholding before approving this payment.'}]:[]
}
export async function regularRetirementPayroll(db,facility,result,excludeRunId,rebuild,runKind='REGULAR'){
 if(!result)return result
 const date=new Date(result.period.pay_date).toISOString().slice(0,10)
 const candidates=await retirementCandidatesFor(db,facility,date,result.preview.employees.map(e=>e.employeeId))
 if(!candidates.length)return result
 const calculations=new Map(),inputs={}
 const block=(employee,message)=>{const warning={employeeId:employee.employeeId,code:'RETIREMENT_PAYROLL_REVIEW',severity:'critical',blocking:true,message};employee.warnings.push(warning);result.preview.warnings.push(warning);result.preview.canApprove=false}
 for(const employee of result.preview.employees){
  const plans=candidates.filter(p=>String(p.employee_id)===String(employee.employeeId))
  if(!plans.length)continue
  try{
   if(plans.length!==1)throw fail('Reconcile multiple retirement plans before calculating this employee payroll.')
   const planId=plans[0].plan_id
   const terms=(await db.query('SELECT plan FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,planId])).rows[0]?.plan
   if(terms?.employerContributions!=='NONE'){
    employee.employerCompensationPreview=await retirementEmployerFundingPreview(db,{facility,employeeId:employee.employeeId,planId,payDate:date,payrollPreview:employee,payPeriodId:result.period.id,runId:excludeRunId??null,runKind},{rebuild})
    const review=await employerRetirementApprovalReview(db,facility,employee.employeeId,planId,employee.employerCompensationPreview)
    if(review){
     const calculation={...employee.employerCompensationPreview.deferralPreview.calculation,previewOnly:false}
     calculations.set(String(employee.employeeId),{planId,calculation,employerContributionReview:review,employerCompensationPreview:employee.employerCompensationPreview});inputs[employee.employeeId]=calculation.retirement401k
     continue
    }
    const eligibility=employee.employerCompensationPreview.eligibility
    const finding=eligibility.status==='REVIEWED_FOR_PAY_PERIOD'?` Matching eligibility: ${eligibility.components.matching.eligible?'eligible':'not eligible'}. Nonelective eligibility: ${eligibility.components.nonelective.eligible?'eligible':'not eligible'}.`:` ${eligibility.message}`
    const obligation=employee.employerCompensationPreview.obligationPreview?.obligation
    const amounts=obligation?` Matching obligation: ${obligation.matchingCents===null?'awaiting employee deferral calculation':`$${(obligation.matchingCents/100).toFixed(2)}`}. Nonelective obligation: $${(obligation.nonelectiveCents/100).toFixed(2)}.`:''
    const deferralIssue=employee.employerCompensationPreview.deferralPreview.message
    const capacity=employee.employerCompensationPreview.annualCapacityPreview
    const capacityIssue=capacity.status==='GROSS_OBLIGATION_CAPACITY_SHORTFALL'?` The full employer obligation exceeds remaining annual contribution capacity by $${(capacity.excessCents/100).toFixed(2)}. Reconcile prior funding and allocations; the obligation has not been reduced.`:''
    throw fail(`Employer retirement compensation preview: $${(employee.employerCompensationPreview.eligibleCompensationCents/100).toFixed(2)} after the annual compensation cap.${finding}${amounts}${deferralIssue?` ${deferralIssue}`:''}${capacityIssue} Employer funding is not ready for payroll approval. No employer contribution has been reserved.`)
   }
   const calculation=await retirementPayrollCalculation(db,{facility,employeeId:employee.employeeId,planId,payDate:date,runKind,payrollPreview:employee,excludeRunId})
   calculations.set(String(employee.employeeId),{planId,calculation});inputs[employee.employeeId]=calculation.retirement401k
  }catch(e){if(![400,409].includes(e.status))throw e;block(employee,e.message)}
 }
 if(!calculations.size||result.preview.warnings.some(w=>w.code==='RETIREMENT_PAYROLL_REVIEW'))return result
 const next=await rebuild(inputs)
 for(const employee of next.preview.employees){
  const retained=calculations.get(String(employee.employeeId));if(!retained)continue
  const before=result.preview.employees.find(e=>String(e.employeeId)===String(employee.employeeId)),c=retained.calculation
  if(employee.warnings.some(w=>w.blocking)||!Number.isSafeInteger(employee.netPayCents)||employee.netPayCents-employee.reimbursementCents<0){
   block(before,'Retirement contributions cannot be covered by wages after taxes and required deductions. Review payroll and the signed election.');continue
  }
  if(employee.grossPayCents!==before.grossPayCents||employee.retirement401k?.pretaxCents!==c.pretaxCents||employee.retirement401k?.rothCents!==c.rothCents)throw fail('Retirement payroll inputs changed during recalculation.')
  if(retained.employerContributionReview){
   employee.employerContributionReview=retained.employerContributionReview;employee.employerCompensationPreview=retained.employerCompensationPreview
   const o=retained.employerContributionReview.obligation,notice={employeeId:employee.employeeId,code:'EMPLOYER_RETIREMENT_CONTRIBUTION',severity:'info',blocking:false,message:`Employer retirement funding: $${(o.matchingCents/100).toFixed(2)} matching and $${(o.nonelectiveCents/100).toFixed(2)} nonelective, totaling $${(o.totalCents/100).toFixed(2)}. Approval reserves these employer amounts separately from employee deductions.`}
   employee.warnings.push(notice);next.preview.warnings.push(notice)
  }
  employee.retirementPlans=[{planId:retained.planId,calculation:{...c,requiresPayrollIntegration:false,availablePayEvidence:{version:1,grossPayCents:employee.grossPayCents,reimbursementCents:employee.reimbursementCents,netPayBeforeRetirementCents:before.netPayCents,netPayAfterRetirementCents:employee.netPayCents,wageNetAfterRetirementCents:employee.netPayCents-employee.reimbursementCents,employeeTaxCents:employee.socialSecurityTaxCents+employee.medicareTaxCents+employee.additionalMedicareTaxCents+employee.federalIncomeTaxCents+employee.stateIncomeTaxCents,totalDeductionCents:employee.totalDeductionCents}}}]
 }
 if(result.preview.warnings.some(w=>w.code==='RETIREMENT_PAYROLL_REVIEW'))return result
 return next
}
