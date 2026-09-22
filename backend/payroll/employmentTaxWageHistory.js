import {verifyEmploymentTaxEvidence} from './employmentTaxEvidence.js'
import {reconcileFicaWageRows,reconcileApprovedFicaWageRows} from './ficaWageReconciliation.js'
import {reconcileIncomeTaxWageRows,reconcileApprovedIncomeTaxWageRows} from './incomeTaxWageReconciliation.js'
import {healthPremiumWageEvidence} from './healthPremiumWageEvidence.js'
const keys=['socialSecurityWagesCents','medicareWagesCents','futaWagesCents','marylandUnemploymentWagesCents']
// Inputs must include every nonvoid committed payroll for the employee/year.
// Approved amounts reserve wage bases but do not represent paid statements.
export function employmentTaxWageHistory(rows,{employeeId,year,paymentDate,excludedRunId=null}){
 const fail=message=>{throw new Error(`Reconcile employment taxable-wage history: ${message}`)}
 if(year!==2026||!/^2026-\d{2}-\d{2}$/.test(paymentDate)||!Number.isFinite(Date.parse(paymentDate))||new Date(paymentDate).toISOString().slice(0,10)!==paymentDate)fail('use a valid supported payroll date.')
 const sums=Object.fromEntries(keys.map(key=>[key,0n])),seen=new Set(),evidence=[]
 const ordered=[...rows].sort((a,b)=>new Date(a.payment_date)-new Date(b.payment_date)||(BigInt(a.run_id)<BigInt(b.run_id)?-1:BigInt(a.run_id)>BigInt(b.run_id)?1:0))
 for(const row of ordered){
  if(String(row.employee_id)!==String(employeeId))fail('history contains another employee.')
  if(excludedRunId!==null&&String(row.run_id)===String(excludedRunId))continue
  if(!['APPROVED','FINALIZED'].includes(row.status))fail('history contains an uncommitted or void payroll.')
  const date=new Date(row.payment_date);if(!Number.isFinite(date.getTime()))fail('payment date is missing or invalid.')
  const day=date.toISOString().slice(0,10)
  if(date.getUTCFullYear()!==year||day>paymentDate)fail('history falls outside the current payment order or year.')
  if(seen.has(String(row.run_id)))fail('duplicate payroll evidence.');seen.add(String(row.run_id))
  const approved=row.status==='APPROVED'
  const fica=(approved?reconcileApprovedFicaWageRows:reconcileFicaWageRows)([row]).get(String(employeeId))
  const income=(approved?reconcileApprovedIncomeTaxWageRows:reconcileIncomeTaxWageRows)([row]).get(String(employeeId))
  if(fica?.verified!==1||income?.verified!==1)fail([...(fica?.issues||[]),...(income?.issues||[])].join(' ')||'missing retained wage evidence.')
  const frozen=row.calculation_snapshot.employees.find(e=>String(e.employeeId)===String(employeeId)),health=healthPremiumWageEvidence(frozen)
  verifyEmploymentTaxEvidence(row)
  const retained=frozen.ficaWageBasis.ytdTaxWages
  if(retained){if(keys.some(key=>BigInt(retained[key])!==sums[key]))fail('retained prior taxable wages do not match the complete committed history.')}
  else if(row.run_kind!=='OFF_CYCLE_REIMBURSEMENT'&&keys.some(key=>sums[key]!==BigInt(frozen.ficaWageBasis.ytdWagesBeforeCents)))fail('legacy prior gross history differs from reconciled taxable wages.')
  // Ordinary qualified 401(k) deferrals do not reduce these employment bases.
  // Gross is used only after native Maryland wage evidence reconciles; health
  // premiums supply their separately verified uncapped bases.
  const wages=Object.fromEntries(keys.map(key=>[key,health?health[key]:frozen.grossPayCents]))
  for(const key of keys){if(!Number.isSafeInteger(wages[key])||wages[key]<0)fail('invalid uncapped wage amount.');sums[key]+=BigInt(wages[key]);if(sums[key]>BigInt(Number.MAX_SAFE_INTEGER))fail('taxable wage totals exceed supported precision.')}
  evidence.push({runId:String(row.run_id),paymentDate:day,status:row.status,wages})
 }
 return {ytd:Object.fromEntries(keys.map(key=>[key,Number(sums[key])])),evidence:evidence.sort((a,b)=>a.paymentDate.localeCompare(b.paymentDate)||a.runId.localeCompare(b.runId))}
}

// The caller uses its payroll transaction so approval revalidation reads the
// same committed history as the remainder of the preview.
export async function loadEmploymentTaxWageHistory(db,facilityId,employeeIds,paymentDate,excludedRunId=null,requiredEmployeeIds=[]){
 const day=new Date(paymentDate).toISOString().slice(0,10),year=Number(day.slice(0,4))
 const rows=(await db.query(`SELECT re.*,r.id AS run_id,r.status,r.run_kind,r.calculation_snapshot,
   COALESCE(r.payment_date,p.pay_date) AS payment_date
   FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id
   JOIN payroll_pay_period p ON p.id=r.pay_period_id AND p.facility_id=r.facility_id
   WHERE r.facility_id=$1 AND re.employee_id=ANY($2::bigint[])
   AND r.status IN ('APPROVED','FINALIZED') AND ($4::bigint IS NULL OR r.id<>$4)
   AND COALESCE(r.payment_date,p.pay_date)<=$3::date
   AND EXTRACT(YEAR FROM COALESCE(r.payment_date,p.pay_date))=EXTRACT(YEAR FROM $3::date)
   ORDER BY COALESCE(r.payment_date,p.pay_date),r.id`,[facilityId,employeeIds,day,excludedRunId])).rows
 const required=new Set(requiredEmployeeIds.map(String))
 for(const row of rows){
  const frozen=row.calculation_snapshot?.employees?.find(e=>String(e.employeeId)===String(row.employee_id))
  if(frozen?.health125||frozen?.ficaWageBasis?.employmentWageMode==='SEPARATE_YTD'||row.statement_snapshot?.ficaWageBasis?.employmentWageMode==='SEPARATE_YTD')required.add(String(row.employee_id))
 }
 const ytdTaxWagesByEmployee={},evidenceByEmployee={},warnings=[]
 const external=required.size?(await db.query(`SELECT DISTINCT employee_id FROM payroll_historical_payment
   WHERE facility_id=$1 AND employee_id=ANY($2::bigint[]) AND payment_date<=$3::date
   AND EXTRACT(YEAR FROM payment_date)=EXTRACT(YEAR FROM $3::date)`,[facilityId,[...required],day])).rows:[]
 for(const id of employeeIds.map(String).filter(id=>required.has(id))){
  try{
   if(external.some(row=>String(row.employee_id)===id))throw new Error('Review separate employment taxable-wage opening balances for imported payroll before approval.')
   const history=employmentTaxWageHistory(rows.filter(row=>String(row.employee_id)===id),{employeeId:id,year,paymentDate:day})
   ytdTaxWagesByEmployee[id]=history.ytd;evidenceByEmployee[id]=history.evidence
  }catch(error){
   // Invalid explicit history prevents the engine from silently using gross.
   ytdTaxWagesByEmployee[id]=null
   warnings.push({employeeId:Number(id),code:'EMPLOYMENT_TAX_WAGE_HISTORY_REVIEW',severity:'critical',blocking:true,message:error.message})
  }
 }
 return {ytdTaxWagesByEmployee,evidenceByEmployee,warnings}
}
