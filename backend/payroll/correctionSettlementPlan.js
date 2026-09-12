import {compensationEvidence} from './employmentCompensation.js'
const fail=message=>{throw Object.assign(new Error(message),{status:409})}
const canonical=value=>JSON.stringify(compensationEvidence(JSON.parse(JSON.stringify(value))))

// Freeze the complete source and payment evidence into the approved payroll.
// This is an unapplied plan; only an atomic finalization may consume it.
export function correctionSettlementPlan({request,authorizationId,preview,original,employee}){
 const employeeId=Number(request.employee_id),requestId=Number(request.id)
 if(request.kind!=='TIME_CORRECTION'||request.status!=='PENDING'||preview.version!==3||preview.employeeId!==employeeId||preview.requestId!==requestId||Number(employee.employeeId)!==employeeId)fail('Correction settlement evidence belongs to a different request or employee.')
 if(!Number.isSafeInteger(authorizationId)||authorizationId<=0||!/^[a-f0-9]{64}$/.test(preview.fingerprint)||!/^[a-f0-9]{64}$/.test(preview.calculationFingerprint))fail('Correction settlement requires retained authorization and calculation evidence.')
 if(request.payload.entryId){
  if(!original||Number(original.id)!==Number(request.payload.entryId)||Number(original.employee_id)!==employeeId||Number(original.facility_id)!==Number(request.facility_id))fail('Correction settlement source time no longer matches the request.')
 }else if(original)fail('A missing-time correction cannot replace an existing time entry.')
 for(const [key,value] of Object.entries(preview.after))if(employee[key]!==value)fail('Combined payroll amounts differ from the authorized correction payment. Review it again.')
 if(employee.regularMinutes!==preview.targetHours.after.regularMinutes||employee.overtimeMinutes!==preview.targetHours.after.overtimeMinutes)fail('Combined payroll hours differ from the authorized correction payment.')
 const leave=preview.targetLeave.after
 if(employee.sickLeaveAccrualMinutes!==leave.accrualMinutes||employee.sickLeaveBalanceBeforeMinutes!==leave.balanceBeforeMinutes||employee.sickLeaveYearAccruedBeforeMinutes!==leave.yearAccruedBeforeMinutes||canonical(employee.sickLeaveFraction)!==canonical(leave.fraction))fail('Combined payroll leave differs from the authorized correction payment.')
 const items=employee.payItems.filter(i=>i.kind==='WAGE_CORRECTION')
 if(items.length!==1||items[0].amountCents!==preview.priorWageCorrectionCents||items[0].correction?.authorizationId!==authorizationId||items[0].correction?.requestId!==requestId||items[0].correction?.fingerprint!==preview.calculationFingerprint)fail('The correction earning does not match its settlement authorization.')
 return JSON.parse(JSON.stringify({version:1,status:'AUTHORIZED_UNAPPLIED',authorizationId,requestId,employeeId,
  fingerprint:preview.fingerprint,calculationId:preview.calculationId,calculationFingerprint:preview.calculationFingerprint,
  originalTime:original,proposedTime:request.payload,paymentDate:preview.paymentDate,payPeriodId:preview.input.payPeriodId,
  overtimeSource:preview.overtimeSource,
  priorWageCorrectionCents:preview.priorWageCorrectionCents,currentWageReclassificationCents:preview.currentWageReclassificationCents,
  before:preview.before,after:preview.after,delta:preview.delta,targetHours:preview.targetHours,
  correctionLeave:preview.correctionLeave,targetLeave:preview.targetLeave,paymentApplied:false}))
}
