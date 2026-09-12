// A request debits its complete approved amount on its first date. Reserve that
// amount against the opening balance and every later recorded ledger balance.
export async function leaveAvailabilityAt(db,facility,employee,type,date){
 const row=(await db.query(`WITH dated AS (
  SELECT transaction_date,SUM(minutes)::bigint AS minutes FROM payroll_leave_transaction
  WHERE facility_id=$1 AND employee_id=$2 AND leave_type=$3 GROUP BY transaction_date
 ), opening AS (
  SELECT COALESCE(SUM(minutes),0)::bigint AS minutes FROM dated WHERE transaction_date<=$4::date
 ), later AS (
  SELECT SUM(minutes) OVER (ORDER BY transaction_date) AS change FROM dated WHERE transaction_date>$4::date
 ) SELECT LEAST(opening.minutes,COALESCE((SELECT MIN(opening.minutes+change) FROM later),opening.minutes)) AS minutes FROM opening`,[facility,employee,type,date])).rows[0]
 return Number(row.minutes)
}

// Compute the same dated minimum from the exact evidence frozen in a preview.
export function leaveAvailabilityFromEvidence(evidence,date){
 const byDate=new Map()
 for(const row of evidence)byDate.set(row.date,(byDate.get(row.date)||0)+Number(row.minutes))
 let balance=0
 for(const [day,minutes] of byDate)if(day<=date)balance+=minutes
 let available=balance
 for(const [day,minutes] of [...byDate].sort(([a],[b])=>a.localeCompare(b)))if(day>date){balance+=minutes;available=Math.min(available,balance)}
 return available
}
