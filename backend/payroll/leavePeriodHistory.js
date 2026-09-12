import {loadScheduleVersions} from './payCalendar.js'
const day=v=>v instanceof Date?v.toISOString().slice(0,10):String(v).slice(0,10)
export async function previousLeavePeriodHistory(db,facility,period){
 if(period.frequency!=='WEEKLY')return []
 const start=day(period.period_start),versions=await loadScheduleVersions(db,facility)
 const index=versions.findIndex(v=>day(v.effective_on)===start&&v.schedule_settings.pay_frequency==='WEEKLY')
 const transitionFrequency=index>0?versions[index-1].schedule_settings.pay_frequency:null
 let priorStart=null
 if(transitionFrequency==='BIWEEKLY')priorStart=day(new Date(Date.parse(start)-14*86400000))
 if(transitionFrequency==='SEMIMONTHLY'){
  if(start.slice(8)==='16')priorStart=start.slice(0,8)+'01'
  if(start.slice(8)==='01'){const previous=new Date(Date.parse(start)-86400000);priorStart=day(previous).slice(0,8)+'16'}
 }
 if(transitionFrequency==='MONTHLY'&&start.slice(8)==='01')priorStart=day(new Date(Date.parse(start)-86400000)).slice(0,8)+'01'
 // A documented cutover may have a nonweekly immediately preceding period.
 // Its hours establish eligibility only; they never accrue again in this run.
 return (await db.query(`SELECT re.employee_id,COUNT(*)::int AS count,SUM(COALESCE((re.statement_snapshot->'salaryCalculation'->>'leaveBasisMinutes')::int,re.regular_minutes+re.overtime_minutes))::int AS minutes,
  MIN(p.period_start)::text AS period_start,MIN(p.period_end)::text AS period_end,MIN(p.frequency) AS frequency,MIN(r.id)::text AS run_id
  FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id
  WHERE r.facility_id=$1 AND r.run_kind='REGULAR' AND r.status='FINALIZED' AND p.period_end=$2::date-1
  AND ((p.frequency='WEEKLY' AND p.period_start=$2::date-7) OR ($3::text IS NOT NULL AND p.frequency=$3 AND p.period_start=$4::date AND p.frequency<>'WEEKLY'))
  GROUP BY re.employee_id`,[facility,start,transitionFrequency,priorStart])).rows
}
