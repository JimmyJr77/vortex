import {verifyRetirementPosting} from './retirementJournal.js'
import {retirementStatementSummary,retirementStatementLines} from './retirementStatement.js'
import {compensationEvidence} from './employmentCompensation.js'
const fail=message=>Object.assign(new Error(message),{status:409})
const same=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))
const money=n=>`${n/100n}.${String(n%100n).padStart(2,'0')}`
// Employer's finalized internal payments only. External amounts reviewed for
// contribution limits are not this employer's W-2 contributions.
export async function retirementAnnualReporting(db,facility,employeeId){
 const rows=(await db.query(`SELECT r.*,COALESCE(r.payment_date,p.pay_date)::text AS pay_date,re.statement_snapshot,re.pretax_deduction_cents,re.posttax_deduction_cents,
 (SELECT count(*)::int FROM payroll_retirement_run_ledger l WHERE l.facility_id=r.facility_id AND l.run_id=r.id AND l.employee_id=re.employee_id) AS retirement_ledger_count
 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id
 WHERE r.facility_id=$1 AND re.employee_id=$2 AND r.status='FINALIZED' AND COALESCE(r.payment_date,p.pay_date)>='2026-01-01' AND COALESCE(r.payment_date,p.pay_date)<'2027-01-01' ORDER BY r.id`,[facility,employeeId])).rows
 const records=[];let pretax=0n,roth=0n
 for(const run of rows){
  const employees=(run.calculation_snapshot?.employees||[]).filter(e=>String(e.employeeId)===String(employeeId))
  const hasEvidence=run.retirement_ledger_count>0||run.statement_snapshot?.retirement||employees.some(e=>e.retirementPlans?.length||e.retirement401k||e.payItems?.some(i=>i.kind?.startsWith('RETIREMENT_')))
  if(!hasEvidence)continue
  if(employees.length!==1||!employees[0].retirementPlans?.length)throw fail('Annual retirement amounts require exact employee payroll evidence.')
  const employee=employees[0]
  if(run.retirement_ledger_count!==employee.retirementPlans.length)throw fail('Annual retirement ledger and plan counts do not reconcile.')
  await verifyRetirementPosting(db,run)
  const summary=retirementStatementSummary(employee)
  if(!same(summary,run.statement_snapshot?.retirement))throw fail('Annual retirement amounts differ from the retained employee statement.')
  retirementStatementLines(run)
  for(const entry of employee.retirementPlans){
   const c=entry.calculation
   if(c.payDate!==run.pay_date||c.retirement401k?.planType!=='STANDARD_401K')throw fail('Annual retirement payment date or plan treatment requires reconciliation.')
   pretax+=BigInt(c.pretaxCents);roth+=BigInt(c.rothCents)
   records.push({runId:String(run.id),paymentDate:run.pay_date,planId:entry.planId,planName:c.planName||entry.planId,ordinaryPretaxCents:c.ordinary.pretax,ordinaryRothCents:c.ordinary.roth,catchUpPretaxCents:c.catchUp.pretax,catchUpRothCents:c.catchUp.roth})
  }
 }
 return records.length?{year:2026,status:'RECONCILED',pretaxDeferrals:money(pretax),rothDeferrals:money(roth),hasEmployeeDeferrals:pretax+roth>0n,records}:null
}
