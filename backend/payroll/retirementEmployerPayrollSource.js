import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {retirementPlanInput} from './retirementPlanInput.js'
import {retirementPayrollWages} from './retirementPayrollWages.js'
import {verifyRetirementPosting} from './retirementJournal.js'
import {retirementStatementSummary} from './retirementStatement.js'
const fail=message=>Object.assign(new Error(message),{status:409})
const same=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))
const add=(a,b)=>{if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||a<0||b<0||!Number.isSafeInteger(a+b))throw fail('Retained employer payroll inputs require exact contribution cents.');return a+b}

// Caller uses a repeatable-read transaction, or the payroll approval lock.
// Only identifiers are accepted; wages and deductions come from scoped records.
// These are raw payroll inputs, not an employer eligibility or funding decision.
export async function retirementEmployerPayrollSource(db,{facility,employeeId,runId,planId}){
 const rows=(await db.query(`SELECT r.*,COALESCE(r.payment_date,p.pay_date)::text AS payment_day,to_jsonb(re) AS posted
 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
 JOIN payroll_run_employee re ON re.payroll_run_id=r.id
 JOIN payroll_employee e ON e.id=re.employee_id AND e.facility_id=r.facility_id
 WHERE r.facility_id=$1 AND r.id=$2 AND re.employee_id=$3`,[facility,runId,employeeId])).rows
 if(rows.length!==1||!['APPROVED','FINALIZED'].includes(rows[0].status))throw fail('Select one approved or finalized employee payroll in this workplace.')
 const run=rows[0],employees=run.calculation_snapshot?.employees?.filter(e=>String(e.employeeId)===String(employeeId))||[]
 if(employees.length!==1)throw fail('Retained payroll must identify the employee exactly once.')
 if(!/^2026-\d{2}-\d{2}$/.test(run.payment_day))throw fail('Review the employer payroll source payment year.')
 const employee=employees[0],entries=employee.retirementPlans?.filter(p=>p.planId===planId)||[]
 if(entries.length!==1)throw fail('Retained payroll must identify this retirement plan exactly once.')
 await verifyRetirementPosting(db,run)
 const calculation=entries[0].calculation
 if(calculation.unusedPto)throw fail('Unused PTO employer compensation needs its separate retained cashout assessment.')
 if(calculation.payDate!==run.payment_day)throw fail('Retained retirement payroll dates do not reconcile.')
 const planRows=(await db.query('SELECT plan FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND id=$3',[facility,planId,calculation.source?.planRevisionId])).rows
 if(planRows.length!==1)throw fail('Retained retirement plan revision is unavailable in this workplace.')
 const plan=retirementPlanInput({...planRows[0].plan,confirmed:true})
 if(plan.fingerprint!==planRows[0].plan.fingerprint||plan.fingerprint!==calculation.planFingerprint)throw fail('Retained retirement plan terms differ from payroll evidence.')
 for(const [column,key] of [['regular_pay_cents','regularPayCents'],['overtime_pay_cents','overtimePayCents'],['other_taxable_pay_cents','otherTaxablePayCents'],['paid_leave_cents','paidLeavePayCents'],['net_pay_cents','netPayCents']]){
  const value=run.posted[column]
  if(!Number.isSafeInteger(employee[key])||employee[key]<0||!/^\d+$/.test(String(value))||BigInt(value)!==BigInt(employee[key]))throw fail('Posted wages differ from the retained payroll calculation.')
 }
 if(add(add(employee.regularPayCents,employee.overtimePayCents),employee.otherTaxablePayCents)!==employee.grossPayCents)throw fail('Posted wages differ from the retained payroll gross amount.')
 if(run.status==='FINALIZED'&&!same(run.posted.statement_snapshot?.retirement,retirementStatementSummary(employee)))throw fail('Retained employee statement differs from retirement payroll evidence.')
 // Deductions have already been reconciled above. They are removed only from
 // the wage classifier's input; nothing is removed from the retained sources.
 const wageInput={...employee,retirement401k:undefined,payItems:employee.payItems.filter(item=>!item.kind?.startsWith('RETIREMENT_'))}
 const wages=retirementPayrollWages(wageInput,{compensation:{REGULAR:true,OVERTIME:true,BONUS:true,PAID_LEAVE:true}})
 const salaryCoveredLeave=employee.payItems.some(item=>item.kind==='PAID_LEAVE'&&item.includedInSalary)
 const ordinaryDeferralsCents=add(calculation.ordinary.pretax,calculation.ordinary.roth),catchUpDeferralsCents=add(calculation.catchUp.pretax,calculation.catchUp.roth)
 const basis={version:1,facilityId:String(facility),employeeId:String(employeeId),runId:String(runId),planId,runStatus:run.status,paymentDate:run.payment_day,planRevisionId:calculation.source.planRevisionId,planFingerprint:plan.fingerprint,compensation:wages.compensation,compensation415Cents:wages.compensation415Cents,salaryCoveredLeave,ordinaryDeferralsCents,catchUpDeferralsCents,retainedCalculation:calculation,posted:run.posted}
 const fingerprint=createHash('sha256').update(JSON.stringify(compensationEvidence(basis))).digest('hex')
 return {version:1,status:'RECONCILED_PAYROLL_INPUTS',facilityId:String(facility),employeeId:String(employeeId),runId:String(runId),planId,runStatus:run.status,paymentDate:run.payment_day,planRevisionId:calculation.source.planRevisionId,planFingerprint:plan.fingerprint,compensation:wages.compensation,compensation415Cents:wages.compensation415Cents,salaryCoveredLeave,ordinaryDeferralsCents,catchUpDeferralsCents,fingerprint,requiresEmployerEligibilityReview:true,requiresEmployerCompensationReview:true}
}
