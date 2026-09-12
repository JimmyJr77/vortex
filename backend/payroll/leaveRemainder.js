// Remainders are thirtieths of one leave minute, represented as integers 0..29.
const fail=message=>Object.assign(new Error(message),{code:'LEAVE_FRACTION_HISTORY_REQUIRED'})
export function legacyLeaveFraction(row){
 const worked=Number(row.regular_minutes)+Number(row.overtime_minutes),accrued=Number(row.sick_leave_accrual_minutes),snapshot=row.statement_snapshot
 if(accrued<=0||accrued!==Math.floor(worked/30))return 0
 if(typeof snapshot?.sickLeaveYearAccruedBeforeMinutes==='number'&&snapshot.sickLeaveYearAccruedBeforeMinutes+accrued>=2400)return 0
 if(typeof snapshot?.sickLeaveBalanceBeforeMinutes==='number'&&snapshot.sickLeaveBalanceBeforeMinutes+accrued>=3840)return 0
 return worked%30
}
export async function loadLeaveRemainder(db,facility,employee,periodId,paymentDate){
 const rows=(await db.query(`SELECT r.id,re.regular_minutes,re.overtime_minutes,re.sick_leave_accrual_minutes,re.statement_snapshot
  FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id JOIN payroll_pay_period p ON p.id=r.pay_period_id
  WHERE r.facility_id=$1 AND re.employee_id=$2 AND r.run_kind='REGULAR' AND r.status='FINALIZED' AND r.pay_period_id<>$3
   AND COALESCE(r.payment_date,p.pay_date)<=$4::date
  ORDER BY COALESCE(r.payment_date,p.pay_date) DESC,p.period_end DESC,r.id DESC`,[facility,employee,periodId,paymentDate])).rows
 const checkpoints=(await db.query('SELECT through_run_id,remainder FROM payroll_leave_fraction_reconciliation WHERE facility_id=$1 AND employee_id=$2 AND effective_on<=$3::date ORDER BY id DESC',[facility,employee,paymentDate])).rows
 for(const row of rows){
  const checkpoint=checkpoints.find(c=>String(c.through_run_id)===String(row.id))
  if(checkpoint)return {remainder:checkpoint.remainder,sourceRunId:String(row.id),source:'RECONCILED_FRACTION'}
  const state=row.statement_snapshot?.sickLeaveFraction
  if(state?.version===1){
   if(!Number.isInteger(state.remainderAfter)||state.remainderAfter<0||state.remainderAfter>=30)throw fail('The prior finalized sick-leave fraction is invalid. Reconcile that payroll record.')
   return {remainder:state.remainderAfter,sourceRunId:String(row.id),source:'FINALIZED_FRACTION'}
  }
  if(legacyLeaveFraction(row))throw fail('Earlier payroll contains untracked fractional sick leave. Reconcile those earned fractions before calculating another accrual.')
 }
 return {remainder:0,sourceRunId:null,source:rows.length?'LEGACY_WHOLE_MINUTES':'OPENING_ZERO'}
}
