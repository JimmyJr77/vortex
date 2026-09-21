import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {retirementPayrollDeferralPreview} from './retirementPayrollCalculation.js'
const fail=message=>Object.assign(new Error(message),{status:409})

// rebuild is the internal payroll engine callback, never a request argument.
// Nothing from this diagnostic rebuild replaces the payable run snapshot.
export async function retirementEmployerDeferralPreview(db,{facility,employeeId,planId,payDate,runKind,payrollPreview,runId=null},rebuild){
 if(typeof rebuild!=='function')throw fail('Calculate employee deferrals with the payroll engine before determining matching.')
 const calculation=await retirementPayrollDeferralPreview(db,{facility,employeeId,planId,payDate,runKind,payrollPreview,excludeRunId:runId})
 const rebuilt=await rebuild({[employeeId]:calculation.retirement401k})
 const employees=rebuilt?.preview?.employees?.filter(e=>String(e.employeeId)===String(employeeId))||[]
 if(employees.length!==1)throw fail('The deferral preview must contain this employee exactly once.')
 const after=employees[0]
 if(after.warnings.some(w=>w.blocking)||!Number.isSafeInteger(after.netPayCents)||after.netPayCents-after.reimbursementCents<0)throw fail('Wages after taxes and required deductions cannot cover the proposed retirement deferrals.')
 if(after.grossPayCents!==payrollPreview.grossPayCents||after.reimbursementCents!==payrollPreview.reimbursementCents||after.retirement401k?.pretaxCents!==calculation.pretaxCents||after.retirement401k?.rothCents!==calculation.rothCents)throw fail('Employee wages or retirement deductions changed during the deferral preview.')
 const employeeTaxCents=after.socialSecurityTaxCents+after.medicareTaxCents+after.additionalMedicareTaxCents+after.federalIncomeTaxCents+after.stateIncomeTaxCents
 if(!Number.isSafeInteger(employeeTaxCents)||after.netPayCents!==after.grossPayCents+after.reimbursementCents-employeeTaxCents-after.totalDeductionCents)throw fail('Employee deferral preview taxes, deductions and take-home pay do not reconcile.')
 const basis={version:1,calculation,ordinaryDeferralsCents:calculation.ordinary.pretax+calculation.ordinary.roth,catchUpDeferralsCents:calculation.catchUp.pretax+calculation.catchUp.roth,availablePayEvidence:{grossPayCents:after.grossPayCents,reimbursementCents:after.reimbursementCents,employeeTaxCents,totalDeductionCents:after.totalDeductionCents,netPayAfterRetirementCents:after.netPayCents,wageNetAfterRetirementCents:after.netPayCents-after.reimbursementCents}}
 return {...basis,status:'CALCULATED_NOT_APPLIED',fingerprint:createHash('sha256').update(JSON.stringify(compensationEvidence(basis))).digest('hex'),requiresPayrollIntegration:true}
}
