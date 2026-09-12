import {calculateWorkedMinutes} from './payrollEngine.js'
import {loadCorrectionBonusCoverage} from './correctionBonusCoverage.js'
const day=v=>v instanceof Date?v.toISOString().slice(0,10):String(v).slice(0,10)
const key=e=>JSON.stringify([String(e.entryId??e.id),new Date(e.clockIn).toISOString(),new Date(e.clockOut).toISOString(),Number(e.breakMinutes??e.unpaidBreakMinutes??0)])
const fail=message=>Object.assign(new Error(message),{status:409})
export function reconcileBonusCoverage(allocation,period,records,{requireFinalized=false}={}){
 const start=day(period.period_start),end=day(period.period_end),paid=new Map()
 for(const row of records){
  const matches=row.calculation_snapshot?.employees?.filter(e=>Number(e.employeeId)===Number(row.employee_id))
  const snapshot=matches?.length===1?matches[0]:null
  if(!snapshot||!Array.isArray(snapshot.entries)||Number(snapshot.grossPayCents)!==Number(row.gross_pay_cents))throw fail('Historical bonus workweeks lack reconciled finalized wage snapshots.')
  let minutes=0
  const basis=row.correctionCoverage||{entries:snapshot.entries,regularMinutes:Number(row.regular_minutes),overtimeMinutes:Number(row.overtime_minutes)}
  for(const entry of basis.entries){
   if(entry.status!=='APPROVED')throw fail('Historical bonus workweeks contain unverified paid time.')
   minutes+=calculateWorkedMinutes(entry.clockIn,entry.clockOut,entry.unpaidBreakMinutes)
   const k=key(entry);paid.set(k,[...(paid.get(k)||[]),{runId:Number(row.run_id),...(basis.settlementIds?{correctionSettlementIds:basis.settlementIds}:{})}])
  }
  if(minutes!==basis.regularMinutes+basis.overtimeMinutes)throw fail('Historical paid hours do not reconcile to the finalized wage record.')
 }
 const evidence=allocation.evidence.map(entry=>{
  if(!requireFinalized&&entry.workDate>=start&&entry.workDate<=end)return {entryId:entry.entryId,workDate:entry.workDate,source:'CURRENT_PAYROLL'}
  if(!requireFinalized&&entry.workDate>end)throw fail('The bonus workweeks include time after this payroll period. Pay those wages before settling the bonus.')
  const matches=paid.get(key(entry))||[]
  if(matches.length!==1)throw fail('Each historical bonus time record must match exactly one finalized wage payment. Reconcile missing or duplicate historical coverage.')
  return {entryId:entry.entryId,workDate:entry.workDate,source:'FINALIZED_PAYROLL',...matches[0]}
 })
 return {version:1,evidence}
}
export async function loadBonusPaymentCoverage(db,facility,employeeId,allocation,period,{requireFinalized=false}={}){
 const dates=allocation.evidence.map(e=>e.workDate).sort(),start=day(period.period_start)
 const historical=dates.filter(d=>requireFinalized||d<start)
 if(!historical.length)return reconcileBonusCoverage(allocation,period,[],{requireFinalized})
 const legacy=await db.query('SELECT id FROM payroll_historical_payment WHERE facility_id=$1 AND employee_id=$2 AND period_end>=$3::date AND period_start<=$4::date',[facility,employeeId,historical[0],historical.at(-1)])
 if(legacy.rows.length)throw fail('Imported historical wages need time-record reconciliation before settling earned-bonus overtime.')
 const rows=(await db.query(`SELECT r.id AS run_id,r.calculation_snapshot,re.employee_id,(re.regular_pay_cents+re.overtime_pay_cents+re.other_taxable_pay_cents) AS gross_pay_cents,re.regular_minutes,re.overtime_minutes,re.regular_pay_cents,re.overtime_pay_cents
 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id
 WHERE r.facility_id=$1 AND re.employee_id=$2 AND r.status='FINALIZED' AND r.run_kind='REGULAR' AND (p.period_end<$3::date OR $7::boolean)
 AND p.period_end>=$4::date AND p.period_start<=$5::date AND COALESCE(r.payment_date,p.pay_date)<=$6::date ORDER BY r.id`,[facility,employeeId,start,historical[0],historical.at(-1),period.pay_date,requireFinalized])).rows
 return reconcileBonusCoverage(allocation,period,await loadCorrectionBonusCoverage(db,facility,employeeId,period.pay_date,rows),{requireFinalized})
}
