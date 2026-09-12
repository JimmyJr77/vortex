import {loadCorrectionBonusCoverage} from './correctionBonusCoverage.js'
import {workweekStartFor,calculateWorkedMinutes} from './payrollEngine.js'
import {employmentCompensationAt} from './employmentCompensation.js'
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10)
const addDays=(value,n)=>new Date(Date.parse(`${value}T00:00:00Z`)+n*86400000).toISOString().slice(0,10)

export function employmentWorkweekReviewScopes(boundaries,period,settings){
 const employees=[...new Set(boundaries.map(b=>b.employeeId))]
 if(!employees.length)return []
 const first=workweekStartFor(day(period.period_start),settings.workweekStartsOn,settings.timezone)
 const last=workweekStartFor(day(period.period_end),settings.workweekStartsOn,settings.timezone)
 const scopes=[]
 for(const employeeId of employees)for(let week=first;week<=last;week=addDays(week,7))scopes.push({employeeId,week})
 return scopes
}

export async function employmentWorkweekBoundaries(db,facility,employeeIds,period,settings){
 if(!employeeIds.length)return []
 const firstWeek=workweekStartFor(day(period.period_start),settings.workweekStartsOn,settings.timezone)
 const lastWeek=workweekStartFor(day(period.period_end),settings.workweekStartsOn,settings.timezone)
 const records=(await db.query(`SELECT employee_id,started_on,ended_on,pay_type FROM payroll_employment_period
  WHERE facility_id=$1 AND employee_id=ANY($2::bigint[]) AND started_on<=$4 AND (ended_on IS NULL OR ended_on>=$3)
  ORDER BY employee_id,started_on`,[facility,employeeIds,firstWeek,addDays(lastWeek,6)])).rows
 const boundaries=[]
 for(let i=1;i<records.length;i++){
  const before=records[i-1],after=records[i]
  if(String(before.employee_id)!==String(after.employee_id)||!before.ended_on||before.pay_type==='HOURLY'&&after.pay_type==='HOURLY')continue
  const week=workweekStartFor(day(before.ended_on),settings.workweekStartsOn,settings.timezone)
  if(week!==workweekStartFor(day(after.started_on),settings.workweekStartsOn,settings.timezone))continue
  boundaries.push({employeeId:Number(after.employee_id),week,beforeEmploymentStart:day(before.started_on),beforeEmploymentEnd:day(before.ended_on),beforePayType:before.pay_type,afterEmploymentStart:day(after.started_on),afterPayType:after.pay_type})
 }
 return boundaries
}

export async function employmentWorkweekReviews(db,facility,boundaries,entries,excludedRunId=null){
 const reviews=[]
 const keys=[...new Set(boundaries.map(b=>`${b.employeeId}/${b.week}`))]
 for(const key of keys){
  const boundary=boundaries.find(b=>`${b.employeeId}/${b.week}`===key),end=addDays(boundary.week,6)
  const [agreements,payments,historical,leave]=await Promise.all([
   employmentCompensationAt(db,facility,{period_start:boundary.week,period_end:end}),
   db.query(`SELECT r.id AS run_id,r.calculation_snapshot,re.employee_id,r.status,r.run_kind,p.id AS pay_period_id,p.period_start,p.period_end,COALESCE(r.payment_date,p.pay_date) AS payment_date,
    re.paid_leave_cents,re.paid_leave_minutes,re.regular_minutes,re.overtime_minutes,re.regular_pay_cents,re.overtime_pay_cents,re.other_taxable_pay_cents,re.statement_snapshot->'workweekPaymentVersion' AS payment_version,re.statement_snapshot->'workweekPayments' AS workweek_payments,re.statement_snapshot->'payItems' AS pay_items,
    (SELECT employee FROM jsonb_array_elements(CASE WHEN jsonb_typeof(r.calculation_snapshot->'employees')='array' THEN r.calculation_snapshot->'employees' ELSE '[]'::jsonb END) employee WHERE employee->>'employeeId'=re.employee_id::text) AS frozen_calculation
    FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id JOIN payroll_run_employee re ON re.payroll_run_id=r.id
    WHERE r.facility_id=$1 AND re.employee_id=$2 AND r.id<>COALESCE($5::bigint,0) AND r.status IN ('APPROVED','FINALIZED')
     AND ((p.period_start<=$4 AND p.period_end>=$3) OR jsonb_path_exists(COALESCE(re.statement_snapshot->'payItems','[]'::jsonb),'$[*].bonusAllocation.weeks[*] ? (@.week == $week)',jsonb_build_object('week',$3::text))) ORDER BY p.period_start,r.id`,[facility,boundary.employeeId,boundary.week,end,excludedRunId]),
   db.query(`SELECT id,period_start,period_end FROM payroll_historical_payment WHERE facility_id=$1 AND employee_id=$2 AND period_start<=$4 AND period_end>=$3 ORDER BY id`,[facility,boundary.employeeId,boundary.week,end]),
   db.query(`SELECT l.id,l.request_id,l.leave_date::text,l.minutes,l.hourly_rate_cents,l.included_in_salary,q.status,q.payload->>'leaveType' AS leave_type
    FROM payroll_paid_leave l JOIN payroll_employee_request q ON q.id=l.request_id AND q.facility_id=l.facility_id AND q.employee_id=l.employee_id
    WHERE l.facility_id=$1 AND l.employee_id=$2 AND l.leave_date BETWEEN $3 AND $4 AND q.status<>'CANCELLED' ORDER BY l.leave_date,l.id`,[facility,boundary.employeeId,boundary.week,end]),
  ])
  const correctedPayments=await loadCorrectionBonusCoverage(db,facility,boundary.employeeId,null,payments.rows)
  const issues=[]
  const time=entries.filter(e=>Number(e.employeeId)===boundary.employeeId&&e.workDate>=boundary.week&&e.workDate<=end).map(e=>{
   let minutes=null
   try{if(e.ambiguousBreak)throw new Error('Ambiguous break');minutes=calculateWorkedMinutes(e.clockIn,e.clockOut,e.unpaidBreakMinutes)}catch{issues.push(`Time entry ${e.id} needs complete clock and break information.`)}
   if(e.status!=='APPROVED')issues.push(`Time entry ${e.id} is not approved.`)
   return {id:Number(e.id),workDate:e.workDate,clockIn:new Date(e.clockIn).toISOString(),clockOut:e.clockOut?new Date(e.clockOut).toISOString():null,minutes,status:e.status,hourlyRateCents:e.hourlyRateCents}
  })
  const terms=agreements.filter(a=>a.employeeId===boundary.employeeId)
  for(const term of terms)if(term.issue)issues.push(`${term.start}: ${term.issue}`)
  for(const e of time)if(!terms.some(a=>e.workDate>=a.start&&e.workDate<=a.end))issues.push(`Time entry ${e.id} is outside a payroll-eligible hiring agreement.`)
  const paidLeave=leave.rows.map(l=>({id:Number(l.id),requestId:Number(l.request_id),leaveDate:l.leave_date,minutes:Number(l.minutes),hourlyRateCents:l.hourly_rate_cents===null?null:Number(l.hourly_rate_cents),includedInSalary:l.included_in_salary===true,status:l.status,leaveType:l.leave_type}))
  for(const l of paidLeave){
   if(l.status!=='APPROVED')issues.push(`Paid leave ${l.id} needs an approved source request.`)
   if(!terms.some(a=>l.leaveDate>=a.start&&l.leaveDate<=a.end))issues.push(`Paid leave ${l.id} is outside a payroll-eligible hiring agreement.`)
  }
  reviews.push({employeeId:boundary.employeeId,week:boundary.week,end,agreements:terms,time,paidLeave,
   approvedMinutes:time.filter(e=>e.status==='APPROVED'&&e.minutes!==null).reduce((sum,e)=>sum+e.minutes,0),
   payments:correctedPayments.map(p=>({...(p.correctionCoverage?{correctionCoverage:p.correctionCoverage}:{}),...(p.correctionPayments?.length?{correctionPayments:p.correctionPayments}:{}),runId:Number(p.run_id),payPeriodId:Number(p.pay_period_id),status:p.status,runKind:p.run_kind,periodStart:day(p.period_start),periodEnd:day(p.period_end),paymentDate:day(p.payment_date),payItems:p.pay_items||[],paidLeaveCents:Number(p.paid_leave_cents),paidLeaveMinutes:Number(p.paid_leave_minutes),regularMinutes:Number(p.regular_minutes),overtimeMinutes:Number(p.overtime_minutes),workweekPaymentVersion:p.payment_version,regularPayCents:Number(p.regular_pay_cents),overtimePayCents:Number(p.overtime_pay_cents),otherTaxablePayCents:Number(p.other_taxable_pay_cents),workweekPayments:p.workweek_payments||[],frozenCalculation:p.frozen_calculation||null})),
   historicalPayments:historical.rows.map(p=>({id:Number(p.id),periodStart:day(p.period_start),periodEnd:day(p.period_end)})),
   issues:[...new Set(issues)],status:'REGULAR_RATE_RECONCILIATION_REQUIRED'})
 }
 return reviews
}
