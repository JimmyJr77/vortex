import {retirementPtoAssessment} from './retirementPtoEvidence.js'
import {retirementPayrollSource} from './retirementPayrollSource.js'
import {retirementAnnualCapacity} from './retirementAnnualCapacity.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const add=(a,b)=>{if(!Number.isSafeInteger(b)||b<0||!Number.isSafeInteger(a+b))throw fail('Retirement ledger amounts require reconciliation.');return a+b}
export async function retirementInternalBalances(db,facility,employeeId,planId,year,{excludeRunId=null}={}){
 if(year!==2026)throw fail('Review the retirement ledger tax year.')
 const rows=(await db.query(`SELECT l.run_id,l.plan_id,l.calculation FROM payroll_retirement_run_ledger l JOIN payroll_run r ON r.id=l.run_id
 WHERE l.facility_id=$1 AND l.employee_id=$2 AND l.tax_year=$3 AND r.status IN ('APPROVED','FINALIZED') AND ($4::bigint IS NULL OR r.id<>$4) ORDER BY l.run_id,l.plan_id`,[facility,employeeId,year,excludeRunId])).rows
 const totals={ordinaryDeferralsCents:0,catchUpDeferralsCents:0,planOrdinaryDeferralsCents:0,planCatchUpDeferralsCents:0,annualAdditionsCents:0,planCompensationCents:0,compensation415Cents:0},wages=new Map()
 for(const row of rows){
  const c=row.calculation,ordinary=add(c.ordinary.pretax,c.ordinary.roth),catchUp=add(c.catchUp.pretax,c.catchUp.roth)
  totals.ordinaryDeferralsCents=add(totals.ordinaryDeferralsCents,ordinary);totals.catchUpDeferralsCents=add(totals.catchUpDeferralsCents,catchUp);totals.annualAdditionsCents=add(totals.annualAdditionsCents,ordinary)
  if(row.plan_id===planId){totals.planOrdinaryDeferralsCents=add(totals.planOrdinaryDeferralsCents,ordinary);totals.planCatchUpDeferralsCents=add(totals.planCatchUpDeferralsCents,catchUp);totals.planCompensationCents=add(totals.planCompensationCents,c.planCompensationCents)}
  if(wages.has(String(row.run_id))&&wages.get(String(row.run_id))!==c.compensation415Cents)throw fail('Plans disagree on payroll annual-additions compensation. Reconcile the ledger.')
  wages.set(String(row.run_id),c.compensation415Cents)
 }
 for(const amount of wages.values())totals.compensation415Cents=add(totals.compensation415Cents,amount)
 const missing=(await db.query(`SELECT r.id FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee e ON e.payroll_run_id=r.id
 WHERE r.facility_id=$1 AND e.employee_id=$2 AND r.status IN ('APPROVED','FINALIZED') AND EXTRACT(YEAR FROM COALESCE(r.payment_date,p.pay_date))=$3 AND ($4::bigint IS NULL OR r.id<>$4)
 AND r.run_kind<>'OFF_CYCLE_REIMBURSEMENT' AND NOT EXISTS(SELECT 1 FROM payroll_retirement_run_ledger l WHERE l.run_id=r.id AND l.employee_id=e.employee_id AND l.plan_id=$5) ORDER BY r.id`,[facility,employeeId,year,excludeRunId,planId])).rows
 return {totals,unreconciledPayrollIds:missing.map(row=>String(row.id))}
}
// Called within the approval transaction, after its source revalidation. The
// immutable run snapshot is the only source of the entry; no client payload.
export async function retainRetirementRunLedger(db,facility,runId){
 await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
 const run=(await db.query('SELECT r.status,r.run_kind,r.offcycle_context,r.calculation_snapshot,COALESCE(r.payment_date,p.pay_date)::text AS pay_date FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.facility_id=$1 AND r.id=$2 FOR UPDATE OF r',[facility,runId])).rows[0]
 if(!run||!['APPROVED','FINALIZED'].includes(run.status))throw fail('Retirement reservations require an approved payroll run.')
 let retained=0
 for(const employee of run.calculation_snapshot?.employees||[]){
  for(const entry of employee.retirementPlans||[]){
   const c=entry.calculation
   if(!entry.planId||c?.requiresPayrollIntegration!==false)throw fail('Retirement processing must be fully integrated before reserving contributions.')
   if(c.payDate!==run.pay_date)throw fail('Retirement calculation pay date differs from the approved payroll.')
   for(const value of [c.ordinary?.pretax,c.ordinary?.roth,c.catchUp?.pretax,c.catchUp?.roth,c.planCompensationCents,c.compensation415Cents])add(0,value)
   const total=add(add(c.ordinary.pretax,c.ordinary.roth),add(c.catchUp.pretax,c.catchUp.roth))
   if(c.totalCents!==total||c.pretaxCents!==add(c.ordinary.pretax,c.catchUp.pretax)||c.rothCents!==add(c.ordinary.roth,c.catchUp.roth))throw fail('Retirement payroll amounts do not reconcile.')
   const evidence=c.availablePayEvidence
   const taxes=add(add(add(employee.socialSecurityTaxCents,employee.medicareTaxCents),employee.additionalMedicareTaxCents),add(employee.federalIncomeTaxCents,employee.stateIncomeTaxCents))
   if(!evidence||evidence.grossPayCents!==employee.grossPayCents||evidence.reimbursementCents!==employee.reimbursementCents||evidence.netPayAfterRetirementCents!==employee.netPayCents||evidence.totalDeductionCents!==employee.totalDeductionCents||evidence.employeeTaxCents!==taxes||evidence.wageNetAfterRetirementCents!==employee.netPayCents-employee.reimbursementCents||evidence.wageNetAfterRetirementCents<0||employee.netPayCents!==employee.grossPayCents+employee.reimbursementCents-taxes-employee.totalDeductionCents)throw fail('Retirement available-pay evidence differs from approved payroll.')
   if(c.retirement401k?.pretaxCents!==c.pretaxCents||c.retirement401k?.rothCents!==c.rothCents||(c.unusedPto?c.wageSource?.grossWagesCents!==employee.grossPayCents||c.wageSource?.compensation415Cents!==c.compensation415Cents:c.wageSource?.compensation415Cents!==employee.grossPayCents)||['planType','pretaxCents','rothCents','pretaxAnnualBonusCents'].some(key=>c.retirement401k?.[key]!==employee.retirement401k?.[key]))throw fail('Retirement wage treatment differs from approved payroll.')
   const prior=(await db.query('SELECT calculation FROM payroll_retirement_run_ledger WHERE run_id=$1 AND employee_id=$2 AND plan_id=$3',[runId,employee.employeeId,entry.planId])).rows[0]
   if(prior){if(JSON.stringify(prior.calculation)!==JSON.stringify(c)){
    // PostgreSQL JSONB key order differs from application insertion order.
    const same=(await db.query('SELECT calculation=$4::jsonb AS same FROM payroll_retirement_run_ledger WHERE run_id=$1 AND employee_id=$2 AND plan_id=$3',[runId,employee.employeeId,entry.planId,c])).rows[0]?.same
    if(!same)throw fail('Retained retirement payroll evidence differs from the approved snapshot.')
   }continue}
   if(c.unusedPto){
    if(run.run_kind!=='OFF_CYCLE_PTO')throw fail('Unused PTO retirement evidence requires its standalone payout run.')
    const assessment=await retirementPtoAssessment(db,{facility,employeeId:employee.employeeId,planId:entry.planId,payoutId:run.offcycle_context?.payoutId,paymentDate:run.pay_date,evidence:run.offcycle_context?.retirementPtoEvidence})
    if(assessment.status!=='EVIDENCE_READY'||assessment.fingerprint!==c.source?.assessmentFingerprint||assessment.fingerprint!==c.unusedPto.assessmentFingerprint||assessment.compensation415Cents!==c.compensation415Cents||Number(assessment.source.payout.amount_cents)!==employee.grossPayCents||c.unusedPto.grossCents!==employee.grossPayCents||c.unusedPto.eligibleCents!==(assessment.deferralTreatment==='INCLUDED'?employee.grossPayCents:0))throw fail('PTO retirement compensation evidence changed before approval.')
   }
   const current=await retirementPayrollSource(db,facility,employee.employeeId,entry.planId,c.payDate)
   const {plan,annual,election:elected}=current
   if(['processingReviewId','planRevisionId','annualSourceId','eligibilityRevisionId','electionId','eligibilitySourceFingerprint'].some(key=>c.source?.[key]!==current[key]))throw fail('Retirement source revisions changed. Recalculate this payroll.')
   if(plan.fingerprint!==c.planFingerprint||annual.fingerprint!==c.annualSourceFingerprint)throw fail('Current retirement plan or annual sources differ from payroll.')
   if(elected.requestKey!==c.electionRequestKey||total>0&&elected.action!=='ELECT')throw fail('Current participant election differs from payroll.')
   const ledger=await retirementInternalBalances(db,facility,employee.employeeId,entry.planId,2026)
   if(ledger.unreconciledPayrollIds.some(id=>id!==String(runId)))throw fail('Earlier payroll needs retirement compensation reconciliation before reserving contributions.')
   const sameRun=(await db.query('SELECT calculation FROM payroll_retirement_run_ledger WHERE run_id=$1 AND employee_id=$2 LIMIT 1',[runId,employee.employeeId])).rows[0]?.calculation
   if(sameRun&&sameRun.compensation415Cents!==c.compensation415Cents)throw fail('Current plans disagree on payroll annual-additions compensation.')
   const internal={...ledger.totals,compensation415Cents:sameRun?ledger.totals.compensation415Cents:add(ledger.totals.compensation415Cents,c.compensation415Cents)}
   const capacity=retirementAnnualCapacity({plan,annual,internal})
   const matches=(await db.query('SELECT $1::jsonb=$2::jsonb AS same',[capacity,c.capacity])).rows[0]?.same
   if(!matches||add(c.ordinary.pretax,c.ordinary.roth)>capacity.ordinaryRemainingCents||add(c.catchUp.pretax,c.catchUp.roth)>capacity.catchUpRemainingCents)throw fail('Retirement allowance changed or was reserved by another payroll. Recalculate this run.')
   if(add(c.catchUp.pretax,c.catchUp.roth)>0&&(!c.catchUpAuthorized||!capacity.limits.catchUpTreatmentReady||capacity.limits.rothCatchUpRequired&&c.catchUp.pretax>0))throw fail('Catch-up authorization or Roth treatment requires review.')
   await db.query('INSERT INTO payroll_retirement_run_ledger(facility_id,run_id,employee_id,plan_id,tax_year,calculation) VALUES($1,$2,$3,$4,2026,$5)',[facility,runId,employee.employeeId,entry.planId,c]);retained++
  }
 }
 return retained
}
