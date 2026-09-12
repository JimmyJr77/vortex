import {loadCorrectionBonusCoverage} from './correctionBonusCoverage.js'
import {allocationCorrectionPayment} from './allocationCorrectionPayment.js'
const day=v=>v instanceof Date?v.toISOString().slice(0,10):String(v||'').slice(0,10)
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
const weekEnd=v=>new Date(Date.parse(v+'T00:00:00Z')+6*86400000).toISOString().slice(0,10)
const safe=v=>Number.isSafeInteger(v)&&v>=0
export async function loadWorkweekPaymentHistory(db,facility,employeeId,weeks,beforeDate) {
 if(!validDate(beforeDate)||!Array.isArray(weeks)||weeks.some(w=>!validDate(w)))throw new Error('Valid workweek and payroll boundary dates are required.')
 const selected=[...new Set(weeks)].sort()
 if(!selected.length)return []
 const history=new Map(selected.map(week=>[week,{week,paidWorkedMinutes:0,premiums:[],issues:[]}]))
 const [paid,legacy]=await Promise.all([
  db.query(`SELECT r.id AS run_id,p.period_start,p.period_end,re.regular_minutes,re.overtime_minutes,re.regular_pay_cents,re.overtime_pay_cents,re.statement_snapshot,r.calculation_snapshot,re.employee_id
   FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id
   WHERE r.facility_id=$1 AND re.employee_id=$2 AND r.run_kind='REGULAR' AND r.status='FINALIZED' AND p.period_end<$5::date
    AND p.period_end>=$3::date AND p.period_start<=$4::date ORDER BY r.id`,[facility,employeeId,selected[0],weekEnd(selected.at(-1)),beforeDate]),
  db.query(`SELECT id,period_start,period_end FROM payroll_historical_payment WHERE facility_id=$1 AND employee_id=$2
   AND period_end<$5::date AND period_end>=$3::date AND period_start<=$4::date ORDER BY id`,[facility,employeeId,selected[0],weekEnd(selected.at(-1)),beforeDate]),
 ])
 const overlapping=row=>selected.filter(week=>week<=day(row.period_end)&&weekEnd(week)>=day(row.period_start))
 const corrected=await loadCorrectionBonusCoverage(db,facility,employeeId,null,paid.rows)
 for(const row of corrected) {
  const snapshot=row.statement_snapshot
  let records=snapshot?.workweekPayments
  let valid=snapshot?.workweekPaymentVersion===1&&Array.isArray(records)
  if(valid)valid=records.every(w=>w&&validDate(w.week)&&safe(w.workedMinutes)&&w.workedMinutes<=10080&&safe(w.straightTimePayCents)&&safe(w.premiumCents)&&w.week<=day(row.period_end)&&weekEnd(w.week)>=day(row.period_start))&&new Set(records.map(w=>w.week)).size===records.length
  if(valid)valid=records.reduce((n,w)=>n+BigInt(w.workedMinutes),0n)===BigInt(row.regular_minutes)+BigInt(row.overtime_minutes)&&records.reduce((n,w)=>n+BigInt(w.straightTimePayCents)+BigInt(w.premiumCents),0n)===BigInt(row.regular_pay_cents)+BigInt(row.overtime_pay_cents)
  if(!valid){for(const week of overlapping(row))history.get(week).issues.push(`Finalized run ${row.run_id} lacks reconciled workweek payment records.`);continue}
  let settlementIds=[]
  if(row.correctionCoverage){
   try{
    const adjusted=allocationCorrectionPayment({runId:Number(row.run_id),workweekPayments:records,correctionCoverage:row.correctionCoverage,otherTaxablePayCents:0,payItems:[]})
    records=adjusted.workweekPayments;settlementIds=adjusted.correctionSettlementIds
   }catch{for(const week of overlapping(row))history.get(week).issues.push(`Finalized run ${row.run_id} lacks reconciled correction workweek payment records.`);continue}
  }
  for(const record of records)if(history.has(record.week)) {
   const target=history.get(record.week);target.paidWorkedMinutes+=record.workedMinutes
   target.premiums.push({runId:Number(row.run_id),premiumCents:record.premiumCents,...(settlementIds.length?{correctionSettlementIds:settlementIds}:{})})
  }
 }
 for(const row of legacy.rows)for(const week of overlapping(row))history.get(week).issues.push(`Historical payment ${row.id} requires workweek premium reconciliation.`)
 return [...history.values()]
}
