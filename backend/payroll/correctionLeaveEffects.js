import {calculateMarylandSickAccrual} from './payrollEngine.js'
const safe=n=>Number.isSafeInteger(n)&&n>=0
const fail=message=>{throw new Error(message)}
export function replayCorrectionLeave(rows,changes){
 if(!rows.length)fail('Finalized leave accrual history is required.')
 const changed=new Map(changes.map(c=>[Number(c.runId),c]))
 let balanceDelta=0,yearDelta=0,remainder=null,previous=null
 const items=[]
 for(const row of rows){
  const s=row.statement_snapshot,policy=s?.sickLeaveAccrualPolicy,fraction=s?.sickLeaveFraction
  if(policy?.version!==1||!['ACCRUAL','FRONTLOAD'].includes(policy.method)||!safe(policy.annualCapMinutes)||!safe(policy.balanceCapMinutes))fail(`Run ${row.run_id} needs its dated leave accrual policy.`)
  if(fraction?.version!==1||!safe(fraction.remainderBefore)||fraction.remainderBefore>=30||!safe(fraction.remainderAfter)||fraction.remainderAfter>=30)fail(`Run ${row.run_id} needs verified fractional leave evidence.`)
  if(previous&&(String(fraction.sourceRunId)!==String(previous.run_id)||fraction.remainderBefore!==previous.statement_snapshot.sickLeaveFraction.remainderAfter))fail(`Run ${row.run_id} has an intervening fractional leave checkpoint.`)
  if(previous&&String(row.payment_date).slice(0,4)!==String(previous.payment_date).slice(0,4))fail('Reconcile year-end carryover before applying this correction across leave years.')
  const worked=Number(row.regular_minutes)+Number(row.overtime_minutes),accrued=Number(row.sick_leave_accrual_minutes)
  if(!safe(worked)||!safe(accrued)||!safe(s.sickLeaveBalanceBeforeMinutes)||!safe(s.sickLeaveYearAccruedBeforeMinutes))fail(`Run ${row.run_id} needs complete original leave balances.`)
  if(Number(row.ledger_minutes)!==accrued)fail(`Run ${row.run_id} does not match its recorded leave credit.`)
  const c=changed.get(Number(row.run_id)),nextWorked=c?c.after.regularMinutes+c.after.overtimeMinutes:worked
  if(c&&c.before.regularMinutes+c.before.overtimeMinutes!==worked)fail(`Run ${row.run_id} has inconsistent worked-time evidence.`)
  const eligibility=s.sickLeaveEligibility,priorChange=changed.get(Number(eligibility?.priorRunId))
  const priorWorked=eligibility?.priorWorkedMinutes,nextPrior=priorChange?priorChange.after.regularMinutes+priorChange.after.overtimeMinutes:priorWorked
  const options={workedMinutes:worked,payFrequency:row.frequency,currentBalanceMinutes:s.sickLeaveBalanceBeforeMinutes,yearAccruedMinutes:s.sickLeaveYearAccruedBeforeMinutes,annualCapMinutes:policy.annualCapMinutes,balanceCapMinutes:policy.balanceCapMinutes,priorRemainder:fraction.remainderBefore,previousPeriodWorkedMinutes:priorWorked}
  const before=policy.method==='FRONTLOAD'?{minutes:0,remainder:fraction.remainderBefore}:calculateMarylandSickAccrual(options)
  if(before.minutes!==accrued||before.remainder!==fraction.remainderAfter)fail(`Run ${row.run_id} does not reproduce its frozen leave accrual.`)
  const nextBalance=options.currentBalanceMinutes+balanceDelta,nextYear=options.yearAccruedMinutes+yearDelta
  if(nextBalance<0||nextYear<0)fail(`Run ${row.run_id} would have insufficient historical leave after this correction.`)
  const after=policy.method==='FRONTLOAD'?{minutes:0,remainder:remainder??fraction.remainderBefore}:calculateMarylandSickAccrual({...options,workedMinutes:nextWorked,currentBalanceMinutes:nextBalance,yearAccruedMinutes:nextYear,priorRemainder:remainder??fraction.remainderBefore,previousPeriodWorkedMinutes:nextPrior})
  const delta=after.minutes-before.minutes;balanceDelta+=delta;yearDelta+=delta;remainder=after.remainder
  items.push({runId:Number(row.run_id),paymentDate:row.payment_date,workedMinutesBefore:worked,workedMinutesAfter:nextWorked,accruedMinutesBefore:before.minutes,accruedMinutesAfter:after.minutes,deltaMinutes:delta,remainderBefore:before.remainder,remainderAfter:after.remainder,policy})
  previous=row
 }
 if(changes.some(c=>!rows.some(r=>Number(r.run_id)===Number(c.runId))))fail('All affected payroll must be finalized before leave correction can be reconciled.')
 return {version:1,status:'LEAVE_DIFFERENCE_CALCULATED',items,creditDifferenceMinutes:balanceDelta,finalRemainder:remainder,throughRunId:Number(previous.run_id),applied:false}
}
export async function correctionLeaveEffects(db,facility,employeeId,changes){
 const all=(await db.query(`SELECT r.id AS run_id,COALESCE(r.payment_date,p.pay_date)::text AS payment_date,p.period_end::text,p.frequency,re.*,
  COALESCE((SELECT SUM(l.minutes) FROM payroll_leave_transaction l WHERE l.facility_id=r.facility_id AND l.employee_id=re.employee_id AND l.source_run_employee_id=re.id AND l.leave_type='MD_SICK_SAFE'),0)::int AS ledger_minutes
  FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id
  WHERE r.facility_id=$1 AND re.employee_id=$2 AND r.run_kind='REGULAR' AND r.status='FINALIZED' ORDER BY COALESCE(r.payment_date,p.pay_date),p.period_end,r.id`,[facility,employeeId])).rows
 const start=all.findIndex(r=>changes.some(c=>c.runId===Number(r.run_id)))
 const rows=start<0?[]:all.slice(start)
 try{
  if(rows.length){
   const special=(await db.query("SELECT id FROM payroll_leave_transaction WHERE facility_id=$1 AND employee_id=$2 AND leave_type='MD_SICK_SAFE' AND transaction_date>=$3 AND transaction_kind IN ('ROLLOVER','RESTORATION') LIMIT 1",[facility,employeeId,rows[0].payment_date])).rows[0]
   if(special)fail('Reconcile intervening leave rollover or restoration before applying the correction.')
   const checkpoint=(await db.query('SELECT id FROM payroll_leave_fraction_reconciliation WHERE facility_id=$1 AND employee_id=$2 AND effective_on>=$3 LIMIT 1',[facility,employeeId,rows[0].payment_date])).rows[0]
   if(checkpoint)fail('Reconcile the intervening fractional leave checkpoint before applying the correction.')
  }
  const ledger=(await db.query("SELECT * FROM payroll_leave_transaction WHERE facility_id=$1 AND employee_id=$2 AND leave_type='MD_SICK_SAFE' ORDER BY transaction_date,id",[facility,employeeId])).rows
  for(let i=0;i<rows.length;i++){
   const row=rows[i],later=new Set(rows.slice(i).map(r=>String(r.id)))
   const prior=ledger.filter(l=>new Date(l.transaction_date).toISOString().slice(0,10)<=row.payment_date&&!later.has(String(l.source_run_employee_id)))
   const balance=prior.reduce((n,l)=>n+Number(l.minutes),0),year=prior.filter(l=>(Number(l.minutes)>0||l.transaction_kind==='CORRECTION_ACCRUAL')&&!['OPENING_BALANCE','RESTORATION','ROLLOVER'].includes(l.transaction_kind)&&new Date(l.transaction_date).getUTCFullYear()===Number(row.payment_date.slice(0,4))).reduce((n,l)=>n+Number(l.minutes),0)
   if(balance!==row.statement_snapshot?.sickLeaveBalanceBeforeMinutes||year!==row.statement_snapshot?.sickLeaveYearAccruedBeforeMinutes)fail(`Run ${row.run_id} no longer reconciles to its original leave ledger context.`)
  }
  const result=replayCorrectionLeave(rows,changes)
  return {...result,ledgerEvidence:ledger.map(l=>({id:Number(l.id),date:new Date(l.transaction_date).toISOString().slice(0,10),minutes:Number(l.minutes),kind:l.transaction_kind,sourceRunEmployeeId:l.source_run_employee_id?Number(l.source_run_employee_id):null}))}
 }catch(e){return {version:1,status:'LEAVE_RECONCILIATION_REQUIRED',issue:e.message,applied:false}}
}
