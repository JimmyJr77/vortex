import {priorMonthlyBenefitCollection} from './monthlyBenefits.js'
const date=value=>new Date(value).toISOString().slice(0,10)
export async function benefitContributionReport(db,facility,start,end,employeeId=null){
 const rows=(await db.query(`SELECT r.id,r.status,r.run_kind,r.calculation_snapshot,COALESCE(r.payment_date,p.pay_date) AS payment_date,re.employee_id,re.posttax_deduction_cents
 FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id
 WHERE r.facility_id=$1 AND r.status='FINALIZED' AND ($4::bigint IS NULL OR re.employee_id=$4)
 AND COALESCE(r.payment_date,p.pay_date)>=date_trunc('month',$2::date)
 AND COALESCE(r.payment_date,p.pay_date)<date_trunc('month',$3::date)+interval '1 month'
 ORDER BY COALESCE(r.payment_date,p.pay_date),r.id,re.employee_id`,[facility,start,end,employeeId])).rows
 const groups=new Map()
 for(const row of rows){const key=JSON.stringify([String(row.employee_id),date(row.payment_date).slice(0,7)]);groups.set(key,[...(groups.get(key)||[]),row])}
 const result=[['Payment date','Contribution month','Employee ID','Employee at payment','Plan ID','Plan','Option ID','Coverage option','Employee contribution','Tax treatment','Payroll run','Authorization fingerprint']]
 for(const [key,evidence] of groups){
  const [employeeId,month]=JSON.parse(key)
  let collection
  try{collection=priorMonthlyBenefitCollection(evidence,employeeId,month)}catch(e){throw Object.assign(new Error(`Benefit report needs reconciliation for employee ${employeeId}, ${month}: ${e.message}`),{status:409})}
  if(!collection||collection.paymentDate<start||collection.paymentDate>end)continue
  const row=evidence.find(r=>Number(r.id)===collection.runId),employee=row.calculation_snapshot.employees.find(e=>Number(e.employeeId)===Number(employeeId))
  for(const item of collection.items)result.push([collection.paymentDate,month,employeeId,employee.employeeName,item.planId,item.planName,item.optionId,item.optionLabel,(item.monthlyCents/100).toFixed(2),item.taxTreatment,collection.runId,collection.authorizationFingerprint])
 }
 return result
}
