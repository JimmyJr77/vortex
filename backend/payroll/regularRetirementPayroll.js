import {retirementPayrollCalculation} from './retirementPayrollCalculation.js'
const fail=message=>Object.assign(new Error(message),{status:409})
// Rebuild the full payroll, including benefit collections, after calculating
// deferrals. All inputs originate from the same employer-scoped transaction.
export async function retirementCandidatesFor(db,facility,date,employees){
 return (await db.query(`SELECT DISTINCT q.employee_id,q.plan_id FROM payroll_retirement_election q
   WHERE q.facility_id=$1 AND q.election->>'effectiveOn'<=$2
   AND q.employee_id=ANY($3::bigint[])
   UNION SELECT e.employee_id,e.plan_id FROM
   (SELECT DISTINCT ON(employee_id,plan_id) employee_id,plan_id,review FROM payroll_retirement_eligibility WHERE facility_id=$1 AND employee_id=ANY($3::bigint[]) ORDER BY employee_id,plan_id,revision DESC) e
   WHERE e.review->>'disposition'='ELIGIBLE' AND e.review->>'eligibleOn'<=$2 ORDER BY employee_id,plan_id`,[facility,date,employees])).rows
}
export async function retirementOffCycleWarnings(db,facility,employeeId,date){
 const candidates=await retirementCandidatesFor(db,facility,date,[employeeId])
 return candidates.length?[{employeeId,code:'RETIREMENT_OFF_CYCLE_REVIEW',severity:'critical',blocking:true,message:'Retirement election or eligibility applies. Reconcile off-cycle retirement compensation and withholding before approving this payment.'}]:[]
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
   const planId=plans[0].plan_id,calculation=await retirementPayrollCalculation(db,{facility,employeeId:employee.employeeId,planId,payDate:date,runKind,payrollPreview:employee,excludeRunId})
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
  employee.retirementPlans=[{planId:retained.planId,calculation:{...c,requiresPayrollIntegration:false,availablePayEvidence:{version:1,grossPayCents:employee.grossPayCents,reimbursementCents:employee.reimbursementCents,netPayBeforeRetirementCents:before.netPayCents,netPayAfterRetirementCents:employee.netPayCents,wageNetAfterRetirementCents:employee.netPayCents-employee.reimbursementCents,employeeTaxCents:employee.socialSecurityTaxCents+employee.medicareTaxCents+employee.additionalMedicareTaxCents+employee.federalIncomeTaxCents+employee.stateIncomeTaxCents,totalDeductionCents:employee.totalDeductionCents}}}]
 }
 if(result.preview.warnings.some(w=>w.code==='RETIREMENT_PAYROLL_REVIEW'))return result
 return next
}
