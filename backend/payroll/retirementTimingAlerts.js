import {retirementTimingAssessment} from './retirementTiming.js'
export async function refreshRetirementTimingAlerts(pool,facility=null,{now=new Date()}={}){
 const rows=(await pool.query(`SELECT DISTINCT l.facility_id,l.run_id,l.plan_id,r.payment_date::text AS payment_date,c.checked_at
 FROM payroll_retirement_run_ledger l JOIN payroll_run r ON r.id=l.run_id AND r.facility_id=l.facility_id
 LEFT JOIN payroll_retirement_timing_check c ON c.facility_id=l.facility_id AND c.run_id=l.run_id AND c.plan_id=l.plan_id
 WHERE r.status='FINALIZED' AND r.payment_date>='2026-01-01' AND r.payment_date<'2027-01-01' AND (l.calculation->>'totalCents')::bigint>0
 AND ($1::bigint IS NULL OR l.facility_id=$1) AND (c.checked_at IS NULL OR c.checked_at<=$2::timestamptz-interval '5 minutes')
 ORDER BY c.checked_at NULLS FIRST,l.facility_id,l.run_id,l.plan_id LIMIT 50`,[facility,new Date(now).toISOString()])).rows
 let checked=0
 for(const row of rows){const db=await pool.connect();try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[row.facility_id])
  const assessment=await retirementTimingAssessment(db,row.facility_id,row.plan_id,row.payment_date,{now}),key=`retirement-timing-${row.run_id}-${row.plan_id}`
  if(assessment.status==='UPCOMING')await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[row.facility_id,key])
  else await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Retirement contribution timing needs attention',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[row.facility_id,key,`Payroll ${row.run_id}, plan ${row.plan_id}: ${assessment.status.replaceAll('_',' ').toLowerCase()}. ${assessment.depositDate?`Reviewed deposit target ${assessment.depositDate}; submission cutoff ${assessment.submissionAt}. `:''}Review Employer setup. Contribution delivery remains unverified.`])
  await db.query('INSERT INTO payroll_retirement_timing_check(facility_id,run_id,plan_id,checked_at) VALUES($1,$2,$3,$4) ON CONFLICT(facility_id,run_id,plan_id) DO UPDATE SET checked_at=EXCLUDED.checked_at',[row.facility_id,row.run_id,row.plan_id,new Date(now).toISOString()])
  await db.query('COMMIT');checked++
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}}
 return {checked}
}
