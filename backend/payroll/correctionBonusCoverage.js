import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
import {calculateWorkedMinutes} from './payrollEngine.js'
import {correctionWorkweekCoverage} from './correctionWorkweekCoverage.js'
const canonical=v=>JSON.stringify(compensationEvidence(JSON.parse(JSON.stringify(v))))
const fail=message=>{throw Object.assign(new Error(message),{status:409})}
const fields=['regularMinutes','overtimeMinutes','regularPayCents','overtimePayCents']
const clocks=entries=>entries.map(e=>({id:Number(e.id),workDate:e.workDate,clockIn:new Date(e.clockIn).toISOString(),clockOut:new Date(e.clockOut).toISOString(),hourlyRateCents:Number(e.hourlyRateCents),workweekStart:e.workweekStart,minutes:e.minutes,regularMinutes:e.regularMinutes,overtimeMinutes:e.overtimeMinutes})).sort((a,b)=>a.clockIn.localeCompare(b.clockIn)||a.id-b.id)

function validatedCorrection(settlement,employeeId){
 const {calculation,plan}=settlement
  const {fingerprint,...hashed}=calculation
  if(![2,3].includes(calculation.version)||fingerprint!==plan.calculationFingerprint||createHash('sha256').update(canonical(hashed)).digest('hex')!==fingerprint
   ||calculation.requestId!==plan.requestId||calculation.employeeId!==Number(employeeId)
   ||calculation.workedWagesDifferenceCents!==plan.priorWageCorrectionCents)fail('Correction bonus coverage lacks matching retained wage evidence.')
  const paid=settlement.paid_snapshot?.correctionSettlements?.find(s=>s.settlementId===Number(settlement.id))
  const item=settlement.paid_snapshot?.payItems?.find(i=>i.kind==='WAGE_CORRECTION'&&i.correction?.authorizationId===plan.authorizationId)
  if(paid?.paymentApplied!==true||paid.status!=='SETTLED'||paid.effectiveEntryId!==Number(settlement.effective_entry_id)||paid.calculationFingerprint!==fingerprint||paid.requestId!==plan.requestId||!item||item.amountCents!==plan.priorWageCorrectionCents
   ||item.correction?.requestId!==plan.requestId||item.correction?.calculationId!==plan.calculationId||item.correction?.fingerprint!==fingerprint
   ||Number(settlement.paid_gross_cents)!==plan.after.grossPayCents||Number(settlement.paid_net_cents)!==plan.after.netPayCents)fail('The correction wages do not reconcile to their finalized settlement payment.')
 return {id:Number(settlement.id),amountCents:plan.priorWageCorrectionCents,authorizationId:plan.authorizationId,requestId:plan.requestId}
}

// Keep financial history on the original payment. This separate coverage basis
// proves that the revised work was paid by that payment plus linked settlements.
export function correctedBonusCoverage(record,settlements){
 const frozen=record.calculation_snapshot?.employees?.find(e=>Number(e.employeeId)===Number(record.employee_id))
 if(!frozen)return null
 let basis={...Object.fromEntries(fields.map(k=>[k,frozen[k]])),entries:frozen.entries},ids=[],workweekCorrections=[]
 for(const settlement of settlements){
  const calculation=settlement.calculation,plan=settlement.plan
  const change=calculation?.runs?.find(r=>r.runId===Number(record.run_id))
  if(!change)continue
  if(!ids.length&&(frozen.payType!=='HOURLY'||fields.some((k,i)=>Number(record[['regular_minutes','overtime_minutes','regular_pay_cents','overtime_pay_cents'][i]])!==frozen[k])))fail('Original paid wages and hours differ from their frozen correction evidence.')
  validatedCorrection(settlement,record.employee_id)
  if(!Array.isArray(basis.entries)||fields.some(k=>basis[k]!==change.before[k])||canonical(clocks(basis.entries))!==canonical(change.originalEntries))fail('The original bonus work coverage does not match the correction calculation.')
  const entries=change.proposedEntries.map(e=>{
   const amended=Number(e.id)===Number(plan.proposedTime.entryId??0)
   const original=basis.entries.find(before=>Number(before.id)===Number(e.id))
   if(!amended&&!original)fail('Correction coverage introduces an unreviewed time identity.')
   const entry={...original,...e,id:amended?Number(settlement.effective_entry_id):Number(e.id),status:'APPROVED',unpaidBreakMinutes:amended?Number(plan.proposedTime.unpaidBreakMinutes||0):Number(original.unpaidBreakMinutes||0)}
   if(calculateWorkedMinutes(entry.clockIn,entry.clockOut,entry.unpaidBreakMinutes)!==entry.minutes||entry.minutes!==entry.regularMinutes+entry.overtimeMinutes)fail('Corrected bonus work does not reconcile to paid minutes.')
   return entry
  })
  basis={...change.after,entries};ids.push(Number(settlement.id))
  if(calculation.version===3)workweekCorrections.push(correctionWorkweekCoverage(change,Number(settlement.id)))
 }
 return ids.length?{...basis,settlementIds:ids,workweekCorrections}:null
}

export async function loadCorrectionBonusCoverage(db,facility,employeeId,paymentDate,records){
 if(!records.length)return records
 const settlements=(await db.query(`SELECT c.*,r.id AS settlement_run_id,a.after_data->'calculation' AS calculation,re.statement_snapshot AS paid_snapshot,
  re.regular_pay_cents+re.overtime_pay_cents+re.other_taxable_pay_cents AS paid_gross_cents,re.net_pay_cents AS paid_net_cents
  FROM payroll_correction_settlement c JOIN payroll_run_employee re ON re.id=c.run_employee_id
  JOIN payroll_run r ON r.id=re.payroll_run_id JOIN payroll_pay_period p ON p.id=r.pay_period_id
  JOIN payroll_audit_log a ON a.id=(c.plan->>'calculationId')::bigint AND a.facility_id=c.facility_id AND a.entity_type='employee_request' AND a.entity_id=c.request_id::text AND a.action='TIME_CORRECTION_CALCULATION_RETAINED'
  WHERE c.facility_id=$1 AND c.employee_id=$2 AND r.status='FINALIZED' AND ($3::date IS NULL OR COALESCE(r.payment_date,p.pay_date)<=$3::date)
  ORDER BY COALESCE(r.payment_date,p.pay_date),c.id`,[facility,employeeId,paymentDate])).rows
 return records.map(record=>({...record,correctionCoverage:correctedBonusCoverage(record,settlements),correctionPayments:settlements.filter(s=>Number(s.settlement_run_id)===Number(record.run_id)).map(s=>validatedCorrection(s,employeeId))}))
}
