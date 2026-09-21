import {retirementEmployerApprovedCalculation,retainEmployerRetirementRunLedger} from './retirementEmployerLedger.js'
const fail=message=>Object.assign(new Error(message),{status:409})

// Bind reviewable facts, excluding the draft's not-yet-assigned run identity.
export async function employerRetirementApprovalReview(db,facility,employeeId,planId,funding){
 if(funding.employerContributionPeriod!=='PER_PAYROLL'||funding.eligibility?.status!=='REVIEWED_FOR_PAY_PERIOD'||funding.deferralPreview?.status!=='CALCULATED_NOT_APPLIED'||funding.annualCapacityPreview?.status!=='GROSS_OBLIGATION_FITS_REVIEWED_CAPACITY')return null
 const annual=(await db.query('SELECT facts FROM payroll_retirement_annual_source WHERE facility_id=$1 AND employee_id=$2 AND id=$3',[facility,employeeId,funding.source.annualSourceId])).rows[0]?.facts
 if(!annual?.employerFunding)throw fail('Review external employer funding before payroll approval.')
 if(annual.employerFunding.matchingCents||annual.employerFunding.nonelectiveCents)throw fail('Allocate previously funded external employer contributions to payroll obligations before approval.')
 const priorRecords=funding.records.filter(r=>!r.proposed)
 const funded=(await db.query(`SELECT l.run_id FROM payroll_retirement_employer_run_ledger l JOIN payroll_run r ON r.id=l.run_id WHERE l.facility_id=$1 AND l.employee_id=$2 AND l.plan_id=$3 AND r.status IN ('APPROVED','FINALIZED')`,[facility,employeeId,planId])).rows
 if(priorRecords.some(r=>!funded.some(l=>String(l.run_id)===r.runId)))throw fail('Reconcile earlier employer payroll obligations before approving another contribution.')
 return {version:1,planId,planRevisionId:funding.source.planRevisionId,annualSourceId:funding.source.annualSourceId,planFingerprint:funding.planFingerprint,annualSourceFingerprint:funding.annualSourceFingerprint,eligibilityFingerprint:funding.eligibility.fingerprint,eligibleCompensationCents:funding.eligibleCompensationCents,priorRecords,obligation:funding.obligationPreview.obligation,annualAdditionsRemainingCents:funding.annualCapacityPreview.remainingAfterEmployeeDeferralsCents}
}

// Runs after employee reservations in the same locked approval transaction.
export async function integrateEmployerRetirementApproval(db,facility,runId){
 const run=(await db.query('SELECT calculation_snapshot FROM payroll_run WHERE facility_id=$1 AND id=$2 AND status=\'APPROVED\' FOR UPDATE',[facility,runId])).rows[0]
 if(!run)throw fail('Employer integration requires approved payroll in the current transaction.')
 const snapshot=run.calculation_snapshot;let changed=false
 for(const employee of snapshot.employees){
  const review=employee.employerContributionReview
  if(!review)continue
  const c=await retirementEmployerApprovedCalculation(db,{facility,runId,employeeId:employee.employeeId,planId:review.planId})
  if(c.contribution.status!=='CALCULATED_NOT_AUTHORIZED'||c.source.planRevisionId!==review.planRevisionId||c.source.annualSourceId!==review.annualSourceId||c.source.eligibilityFingerprint!==review.eligibilityFingerprint||c.contribution.eligibleCompensationCents!==review.eligibleCompensationCents||c.contribution.annualAdditionsRemainingCents!==review.annualAdditionsRemainingCents||['matchingCents','nonelectiveCents','totalCents'].some(k=>c.contribution.proposed[k]!==review.obligation[k]))throw fail('Employer amounts or sources changed after review. Recalculate payroll before approval.')
  c.requiresPayrollIntegration=false
  employee.employerRetirementPlans=[{planId:review.planId,calculation:c}];changed=true
 }
 if(changed){await db.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2 AND facility_id=$3',[snapshot,runId,facility]);await retainEmployerRetirementRunLedger(db,facility,runId)}
}
