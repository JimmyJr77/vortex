import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {retirementPlanInput} from './retirementPlanInput.js'
import {retirementAnnualInput} from './retirementAnnualInput.js'
import {retirementEmployerPayrollSource} from './retirementEmployerPayrollSource.js'
const fail=message=>Object.assign(new Error(message),{status:409})
const amount=value=>Number.isSafeInteger(value)&&value>=0
const add=(a,b)=>{if(!amount(a)||!amount(b)||!Number.isSafeInteger(a+b))throw fail('Employer compensation requires complete safe integer cents.');return a+b}
const kinds=['REGULAR','OVERTIME','BONUS','PAID_LEAVE']
const day=value=>typeof value==='string'&&/^2026-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const hash=value=>createHash('sha256').update(JSON.stringify(compensationEvidence(value))).digest('hex')

// Internal reducer: records must come from retirementEmployerPayrollSource,
// with complete annual coverage supplied by the service below. This does not
// establish eligibility or authorize contributions, reservations or remittance.
export function employerCompensationAllocation({plan,annual,payrollSources,facility,employeeId,runId}){
 const p=retirementPlanInput({...plan,confirmed:true}),a=retirementAnnualInput({...annual,confirmed:true})
 if(p.fingerprint!==plan.fingerprint||a.fingerprint!==annual.fingerprint||!p.employerFormula||!a.employerFunding)throw fail('Retain current employer formula and explicit external employer compensation evidence.')
 if(p.unusedPto&&p.unusedPto.limitationYear!=='CALENDAR_YEAR')throw fail('Reconcile the employer contribution limitation year before allocating annual compensation.')
 if(!Array.isArray(payrollSources)||!payrollSources.length)throw fail('Retain the complete annual employer payroll source coverage.')
 const seen=new Set(),definition=p.employerFormula.compensation
 const records=payrollSources.map(source=>{
  if(!source||source.status!=='RECONCILED_PAYROLL_INPUTS'||String(source.facilityId)!==String(facility)||String(source.employeeId)!==String(employeeId)||source.planId!==p.planId||source.planFingerprint!==p.fingerprint||!['APPROVED','FINALIZED'].includes(source.runStatus)||!day(source.paymentDate)||source.paymentDate<p.effectiveOn||!/^[1-9]\d*$/.test(String(source.runId))||!/^[a-f0-9]{64}$/.test(source.fingerprint))throw fail('Employer compensation sources must belong to this employee, workplace, plan and payment year.')
  if(seen.has(String(source.runId)))throw fail('An employer compensation payroll source was supplied more than once.')
  seen.add(String(source.runId))
  if(!source.compensation||Object.keys(source.compensation).length!==kinds.length||kinds.some(key=>!amount(source.compensation[key]))||typeof source.salaryCoveredLeave!=='boolean')throw fail('Review every employer compensation category explicitly.')
  if(source.salaryCoveredLeave&&definition.REGULAR!==definition.PAID_LEAVE)throw fail('Allocate salary-covered leave before applying the employer compensation definition.')
  if(kinds.reduce((sum,key)=>add(sum,source.compensation[key]),0)!==source.compensation415Cents)throw fail('Employer compensation categories do not reconcile to retained payroll wages.')
  return {runId:String(source.runId),paymentDate:source.paymentDate,sourceFingerprint:source.fingerprint,compensationCents:kinds.reduce((sum,key)=>add(sum,definition[key]?source.compensation[key]:0),0)}
 }).sort((a,b)=>a.paymentDate.localeCompare(b.paymentDate)||(BigInt(a.runId)<BigInt(b.runId)?-1:1))
 const target=records.find(record=>record.runId===String(runId))
 if(!target||a.asOfDate>target.paymentDate)throw fail('Use an included payroll with applicable annual evidence.')
 // Inserting an earlier payroll could change compensation already assigned to
 // a later approved run. Reconcile those reservations before recalculating it.
 if(records.at(-1)!==target)throw fail('Later approved payroll exists. Reconcile compensation allocations before backdating employer funding.')
 const compensationLimitCents=36000000
 let used=a.employerFunding.compensationCents
 for(const record of records){
  record.priorCompensationCents=used
  record.eligibleCompensationCents=Math.min(record.compensationCents,Math.max(0,compensationLimitCents-used))
  used=add(used,record.compensationCents)
 }
 const basis={version:1,facilityId:String(facility),employeeId:String(employeeId),planId:p.planId,runId:String(runId),planFingerprint:p.fingerprint,annualSourceFingerprint:a.fingerprint,compensationLimitCents,externalCompensationCents:a.employerFunding.compensationCents,allocationPolicy:'PAYMENT_DATE_THEN_RUN_ID',records,eligibleCompensationCents:target.eligibleCompensationCents,annualCompensationCents:used,annualEligibleCompensationCents:Math.min(compensationLimitCents,used)}
 return {...basis,fingerprint:hash(basis),requiresEmployerEligibilityReview:true,requiresPayrollIntegration:true}
}

// Caller holds the employer settings lock for writes, or uses repeatable-read
// for previews. Identifiers only: client-supplied wages/balances are ignored.
export async function retirementEmployerCompensationSource(db,{facility,employeeId,planId,runId}){
 const planRow=(await db.query('SELECT id,plan FROM payroll_retirement_plan_revision WHERE facility_id=$1 AND plan_id=$2 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,planId])).rows[0]
 const annualRow=(await db.query('SELECT id,plan_revision_id,facts FROM payroll_retirement_annual_source WHERE facility_id=$1 AND employee_id=$2 AND plan_id=$3 AND tax_year=2026 ORDER BY revision DESC LIMIT 1',[facility,employeeId,planId])).rows[0]
 if(!planRow||!annualRow||annualRow.plan_revision_id!==planRow.id)throw fail('Review current employer plan and annual sources before allocating compensation.')
 const rows=(await db.query(`SELECT r.id FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id
 JOIN payroll_run_employee re ON re.payroll_run_id=r.id
 JOIN payroll_employee e ON e.id=re.employee_id AND e.facility_id=r.facility_id
 WHERE r.facility_id=$1 AND re.employee_id=$2 AND r.status IN ('APPROVED','FINALIZED')
 AND EXTRACT(YEAR FROM COALESCE(r.payment_date,p.pay_date))=2026
 AND r.run_kind<>'OFF_CYCLE_REIMBURSEMENT' ORDER BY COALESCE(r.payment_date,p.pay_date),r.id`,[facility,employeeId])).rows
 const payrollSources=[]
 for(const row of rows)payrollSources.push(await retirementEmployerPayrollSource(db,{facility,employeeId,planId,runId:row.id}))
 const allocation=employerCompensationAllocation({plan:planRow.plan,annual:annualRow.facts,payrollSources,facility,employeeId,runId})
 const source={planRevisionId:planRow.id,annualSourceId:annualRow.id,allocationFingerprint:allocation.fingerprint}
 return {...allocation,source,sourceFingerprint:hash(source)}
}
