import {buildEmployeePreview} from './payrollEngine.js'
import {retirementPayrollCalculation} from './retirementPayrollCalculation.js'
const fail=message=>Object.assign(new Error(message),{status:409})
// The calling payroll service must supply its scoped engine arguments under a
// consistent transaction. This composes calculation only; processing approval,
// reporting and provider execution must be connected before activation.
export async function retirementEmployeePayroll(db,{facility,planId,payDate,runKind,payrollArgs,excludeRunId=null}){
 if(!payrollArgs?.employee||payrollArgs.retirement401k!==undefined)throw fail('Use payroll inputs before retirement deductions are applied.')
 const before=buildEmployeePreview(payrollArgs)
 const calculation=await retirementPayrollCalculation(db,{facility,employeeId:payrollArgs.employee.id,planId,payDate,runKind,payrollPreview:before,excludeRunId})
 const after=buildEmployeePreview({...payrollArgs,retirement401k:calculation.retirement401k})
 if(after.netPayCents===null||after.warnings.some(w=>w.blocking))throw fail('Retirement payroll cannot proceed: '+after.warnings.filter(w=>w.blocking).map(w=>w.message).join(' '))
 // Reimbursements cannot fund employee wage deferrals. Taxes are recalculated
 // first, so genuine pretax savings are available without a guessed net cap.
 if(!Number.isSafeInteger(after.netPayCents)||after.netPayCents-after.reimbursementCents<0)throw fail('Wages after taxes and required deductions cannot cover retirement contributions.')
 const retirementPlans=[{planId,calculation:{...calculation,availablePayEvidence:{version:1,grossPayCents:after.grossPayCents,reimbursementCents:after.reimbursementCents,netPayBeforeRetirementCents:before.netPayCents,netPayAfterRetirementCents:after.netPayCents,wageNetAfterRetirementCents:after.netPayCents-after.reimbursementCents,employeeTaxCents:after.socialSecurityTaxCents+after.medicareTaxCents+after.additionalMedicareTaxCents+after.federalIncomeTaxCents+after.stateIncomeTaxCents,totalDeductionCents:after.totalDeductionCents}}}]
 return {...after,retirementPlans}
}
