import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {retirementEmployerCompensationSource} from './retirementEmployerCompensation.js'
import {retirementEmployerEligibilityForPayroll} from './retirementEmployerEligibilityPeriod.js'
import {retirementEmployerCalculation} from './retirementEmployerCalculation.js'
import {retirementInternalBalances} from './retirementLedger.js'
import {retirementAnnualCapacity} from './retirementAnnualCapacity.js'
const fail=message=>Object.assign(new Error(message),{status:409})
const hash=value=>createHash('sha256').update(JSON.stringify(compensationEvidence(value))).digest('hex')

// Internal approval boundary. Call inside the same transaction as employee
// deferral retention, holding payroll_settings FOR UPDATE. This service does
// not approve a run, change wages, or authorize a remittance.
export async function retirementEmployerApprovedCalculation(db,{facility,runId,employeeId,planId}){
 const run=(await db.query(`SELECT r.*,COALESCE(r.payment_date,p.pay_date)::text pay_date,p.period_start::text,p.period_end::text
 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 AND r.id=$2`,[facility,runId])).rows[0]
 if(!run||!['APPROVED','FINALIZED'].includes(run.status)||run.run_kind!=='REGULAR')throw fail('Employer reservations currently require an approved regular payroll.')
 const employees=(run.calculation_snapshot?.employees||[]).filter(e=>String(e.employeeId)===String(employeeId))
 if(employees.length!==1)throw fail('Employer reservation employee must appear exactly once in approved payroll.')
 const compensation=await retirementEmployerCompensationSource(db,{facility,employeeId,planId,runId})
 if(compensation.employerContributionPeriod!=='PER_PAYROLL')throw fail('Annual true-up requires separate retained annual funding reconciliation.')
 const plan=(await db.query('SELECT plan FROM payroll_retirement_plan_revision WHERE id=$1',[compensation.source.planRevisionId])).rows[0]?.plan
 const annual=(await db.query('SELECT facts FROM payroll_retirement_annual_source WHERE id=$1',[compensation.source.annualSourceId])).rows[0]?.facts
 const eligibility=await retirementEmployerEligibilityForPayroll(db,{facility,employeeId,planId,periodStart:run.period_start,periodEnd:run.period_end,payrollPreview:employees[0]})
 const deferral=(await db.query('SELECT calculation FROM payroll_retirement_run_ledger WHERE facility_id=$1 AND run_id=$2 AND employee_id=$3 AND plan_id=$4',[facility,runId,employeeId,planId])).rows[0]?.calculation
 if(!deferral||deferral.previewOnly===true||deferral.requiresPayrollIntegration!==false||deferral.planFingerprint!==plan.fingerprint||deferral.annualSourceFingerprint!==annual.fingerprint||deferral.source?.planRevisionId!==compensation.source.planRevisionId||deferral.source?.annualSourceId!==compensation.source.annualSourceId)throw fail('Employer reservation requires current, integrated employee deferral evidence.')
 const prior=(await db.query('SELECT id FROM payroll_retirement_employer_run_ledger WHERE run_id=$1 AND employee_id=$2 AND plan_id=$3',[runId,employeeId,planId])).rows
 if(prior.length)throw fail('Employer contributions are already reserved for this payroll; use the retained entry.')
 const funded=(await db.query(`SELECT l.run_id FROM payroll_retirement_employer_run_ledger l JOIN payroll_run r ON r.id=l.run_id
 WHERE l.facility_id=$1 AND l.employee_id=$2 AND l.plan_id=$3 AND r.status IN ('APPROVED','FINALIZED')`,[facility,employeeId,planId])).rows
 const fundedIds=new Set(funded.map(row=>String(row.run_id)))
 if(compensation.records.some(record=>record.runId!==String(runId)&&!fundedIds.has(record.runId)))throw fail('Earlier employer payroll obligations need retained reservations before allocating more annual capacity.')
 const balances=await retirementInternalBalances(db,facility,employeeId,planId,2026)
 if(balances.unreconciledPayrollIds.length)throw fail('Reconcile earlier employee contribution ledgers before employer reservation.')
 // The current employee reservation is already included. Do not subtract it
 // again, and never add external employer balances twice.
 const capacity=retirementAnnualCapacity({plan,annual,internal:balances.totals})
 const source={planRevisionId:compensation.source.planRevisionId,annualSourceId:compensation.source.annualSourceId,compensationFingerprint:compensation.fingerprint,eligibilityFingerprint:eligibility.fingerprint,deferralFingerprint:hash(deferral),capacityFingerprint:hash(capacity)}
 const sourceFingerprint=hash(source)
 const contribution=retirementEmployerCalculation({plan,sourceFingerprint,eligibleCompensationCents:compensation.eligibleCompensationCents,ordinaryDeferralsCents:deferral.ordinary.pretax+deferral.ordinary.roth,catchUpDeferralsCents:deferral.catchUp.pretax+deferral.catchUp.roth,priorMatchingCents:0,priorNonelectiveCents:0,annualAdditionsRemainingCents:capacity.annualAdditionsRemainingCents,eligibilityConfirmed:true,matchingEligible:eligibility.components.matching.eligible,nonelectiveEligible:eligibility.components.nonelective.eligible})
 return {version:1,facilityId:String(facility),runId:String(runId),employeeId:String(employeeId),planId,payDate:run.pay_date,source,sourceFingerprint,contribution,previewOnly:false,requiresPayrollIntegration:true}
}

export async function retainEmployerRetirementRunLedger(db,facility,runId){
 await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
 const run=(await db.query('SELECT status,calculation_snapshot FROM payroll_run WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,runId])).rows[0]
 if(!run||!['APPROVED','FINALIZED'].includes(run.status))throw fail('Employer reservations require approved payroll.')
 const employees=run.calculation_snapshot?.employees||[]
 if(new Set(employees.map(e=>String(e.employeeId))).size!==employees.length)throw fail('Employer reservations require unique employee payroll evidence.')
 let retained=0
 for(const employee of employees){
  const seen=new Set()
  for(const entry of employee.employerRetirementPlans||[]){
   const c=entry.calculation
   if(!entry.planId||seen.has(entry.planId)||c?.requiresPayrollIntegration!==false||c.previewOnly!==false)throw fail('Employer reservations require unique, fully integrated plan evidence.')
   seen.add(entry.planId)
   const prior=(await db.query('SELECT calculation=$4::jsonb same FROM payroll_retirement_employer_run_ledger WHERE run_id=$1 AND employee_id=$2 AND plan_id=$3',[runId,employee.employeeId,entry.planId,c])).rows[0]
   if(prior){if(!prior.same)throw fail('Employer reservation differs from the retained approved evidence.');continue}
   const expected=await retirementEmployerApprovedCalculation(db,{facility,runId,employeeId:employee.employeeId,planId:entry.planId})
   if(expected.contribution.status!=='CALCULATED_NOT_AUTHORIZED')throw fail(expected.contribution.issues.join(' '))
   expected.requiresPayrollIntegration=false
   if(hash(expected)!==hash(c))throw fail('Employer contribution sources or annual capacity changed before reservation. Recalculate payroll.')
   const {matchingCents,nonelectiveCents}=c.contribution.proposed
   await db.query('INSERT INTO payroll_retirement_employer_run_ledger(facility_id,run_id,employee_id,plan_id,tax_year,calculation,matching_cents,nonelective_cents) VALUES($1,$2,$3,$4,2026,$5,$6,$7)',[facility,runId,employee.employeeId,entry.planId,c,matchingCents,nonelectiveCents]);retained++
  }
 }
 return retained
}
