import {employmentCompensationAt,compensationEvidence} from './employmentCompensation.js'
import {createHash} from 'node:crypto'
import {calculateWorkedMinutes,workweekStartFor} from './payrollEngine.js'
const valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
const add=(v,n)=>new Date(Date.parse(`${v}T00:00:00Z`)+n*86400000).toISOString().slice(0,10)
const fail=message=>Object.assign(new Error(message),{status:409})
export function allocateEarnedBonus(amountCents,weeks){
 if(!Number.isSafeInteger(amountCents)||amountCents<=0||!Array.isArray(weeks)||!weeks.length)throw fail('Provide a positive bonus and its complete earned-workweek records.')
 const seen=new Set()
 for(const w of weeks){
  if(!w||!valid(w.week)||seen.has(w.week)||!Number.isSafeInteger(w.workedMinutes)||w.workedMinutes<=0||w.workedMinutes>10080||!Number.isSafeInteger(w.earnedMinutes)||w.earnedMinutes<=0||w.earnedMinutes>w.workedMinutes||typeof w.overtimeEligible!=='boolean')throw fail('Bonus workweeks require unique dates, complete worked minutes, earned minutes and reviewed overtime eligibility.')
  seen.add(w.week)
 }
 const sorted=[...weeks].sort((a,b)=>a.week.localeCompare(b.week))
 if(sorted.some((w,i)=>i>0&&(w.week<add(sorted[i-1].week,7)||(Date.parse(w.week)-Date.parse(sorted[0].week))%604800000!==0)))throw fail('Bonus workweeks must not overlap and must use the same weekly boundary.')
 const total=sorted.reduce((sum,w)=>sum+BigInt(w.earnedMinutes),0n),amount=BigInt(amountCents)
 const allocations=sorted.map(w=>{
  const numerator=amount*BigInt(w.earnedMinutes),overtime=w.overtimeEligible?Math.max(0,w.workedMinutes-2400):0
  const premiumNumerator=numerator*BigInt(overtime),premiumDenominator=total*BigInt(w.workedMinutes)*2n
  return {...w,overtimeMinutes:overtime,allocatedBonusCents:Number(numerator/total),allocationNumerator:numerator.toString(),allocationDenominator:total.toString(),additionalOvertimeCents:Number((premiumNumerator*2n+premiumDenominator)/(premiumDenominator*2n)),remainder:numerator%total}
 })
 let remaining=amountCents-allocations.reduce((sum,w)=>sum+w.allocatedBonusCents,0)
 for(const w of [...allocations].sort((a,b)=>a.remainder===b.remainder?a.week.localeCompare(b.week):a.remainder>b.remainder?-1:1)){if(!remaining)break;w.allocatedBonusCents++;remaining--}
 const additionalOvertimeCents=allocations.reduce((sum,w)=>sum+w.additionalOvertimeCents,0)
 if(!Number.isSafeInteger(additionalOvertimeCents))throw fail('Bonus overtime exceeds safe cent precision.')
 return {version:1,method:'PROPORTIONAL_EARNED_HOURS',bonusCents:amountCents,additionalOvertimeCents,weeks:allocations.map(({remainder,...w})=>{void remainder;return w})}
}
export async function previewEarnedBonus(db,facility,employeeId,body){
 if(!valid(body.earnedStart)||!valid(body.earnedEnd)||body.earnedStart>body.earnedEnd||(Date.parse(body.earnedEnd)-Date.parse(body.earnedStart))/86400000>731)throw fail('Provide an earning period of no more than two years.')
 const employee=(await db.query('SELECT * FROM payroll_employee WHERE facility_id=$1 AND id=$2',[facility,employeeId])).rows[0]
 if(!employee)throw Object.assign(new Error('Employee not found.'),{status:404})
 const settings=(await db.query('SELECT *,(now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]
 if(!settings)throw fail('Complete employer payroll settings before allocating a bonus.')
 const start=workweekStartFor(body.earnedStart,settings.workweek_starts_on,settings.timezone),end=add(workweekStartFor(body.earnedEnd,settings.workweek_starts_on,settings.timezone),6)
 if(end>=settings.today)throw fail('Wait until every workweek in the bonus earning period has closed.')
 const entries=(await db.query(`SELECT t.id,t.status,d.day::date::text AS work_date,
  GREATEST(t.clock_in,d.day::timestamp AT TIME ZONE s.timezone) AS clock_in,
  CASE WHEN t.clock_out IS NULL THEN NULL ELSE LEAST(t.clock_out,(d.day::date+1)::timestamp AT TIME ZONE s.timezone) END AS clock_out,
  CASE WHEN (t.clock_in AT TIME ZONE s.timezone)::date=((t.clock_out-interval '1 microsecond') AT TIME ZONE s.timezone)::date THEN t.unpaid_break_minutes ELSE 0 END AS break_minutes,
  t.unpaid_break_minutes>0 AND (t.clock_in AT TIME ZONE s.timezone)::date<>((t.clock_out-interval '1 microsecond') AT TIME ZONE s.timezone)::date AS ambiguous_break
  FROM payroll_effective_time_entry t JOIN payroll_settings s ON s.facility_id=t.facility_id
  CROSS JOIN LATERAL generate_series(GREATEST((t.clock_in AT TIME ZONE s.timezone)::date,$3::date)::timestamp,LEAST(COALESCE(((t.clock_out-interval '1 microsecond') AT TIME ZONE s.timezone)::date,$4::date),$4::date)::timestamp,interval '1 day') d(day)
  WHERE t.facility_id=$1 AND t.employee_id=$2 AND t.status<>'REJECTED'
  AND t.clock_in<(($4::date+1)::timestamp AT TIME ZONE s.timezone) AND COALESCE(t.clock_out,'infinity'::timestamptz)>($3::date::timestamp AT TIME ZONE s.timezone)
  ORDER BY d.day,t.id`,[facility,employeeId,start,end])).rows
 const compensation=(await employmentCompensationAt(db,facility,{period_start:start,period_end:end})).filter(a=>a.employeeId===Number(employeeId))
 if(employee.pay_type==='HOURLY'&&employee.overtime_classification!=='NONEXEMPT')throw fail('Complete the supported hourly overtime classification before reviewing bonus earnings.')
 const weeks=new Map(),evidence=[]
 for(const entry of entries){
  if(entry.status!=='APPROVED'||!entry.clock_out||entry.ambiguous_break)throw fail('Approve and complete all time in the bonus workweeks; resolve overnight break timing.')
  const week=workweekStartFor(entry.work_date,settings.workweek_starts_on,settings.timezone)
  let minutes;try{minutes=calculateWorkedMinutes(entry.clock_in,entry.clock_out,entry.break_minutes)}catch{throw fail('Correct invalid time or breaks in the bonus workweeks.')}
  const agreements=compensation.filter(a=>a.start<=add(week,6)&&a.end>=week)
  if(!agreements.length||agreements.some(a=>a.issue))throw fail('Retain compensation agreements for every bonus workweek.')
  if(agreements.filter(a=>entry.work_date>=a.start&&entry.work_date<=a.end).length!==1)throw fail('Each bonus time segment must belong to one payroll-eligible employment agreement.')
  const classifications=agreements.map(a=>{
   if(a.payType==='HOURLY')return 'NONEXEMPT'
   if(a.payType!=='SALARY'||!a.salaryReview?.verifiedAt||!['EXEMPT','NONEXEMPT'].includes(a.salaryReview.classification))throw fail('Complete dated salary classification review for every bonus workweek.')
   return a.salaryReview.classification
  })
  if(new Set(classifications).size!==1)throw fail('A bonus workweek spans different overtime classifications and requires individual review.')
  const classification=classifications[0]
  const w=weeks.get(week)||{week,workedMinutes:0,earnedMinutes:0,overtimeEligible:classification==='NONEXEMPT'}
  w.workedMinutes+=minutes;if(entry.work_date>=body.earnedStart&&entry.work_date<=body.earnedEnd)w.earnedMinutes+=minutes
  weeks.set(week,w);evidence.push({entryId:Number(entry.id),workDate:entry.work_date,minutes,clockIn:new Date(entry.clock_in).toISOString(),clockOut:new Date(entry.clock_out).toISOString(),breakMinutes:entry.break_minutes})
 }
 const allocation={...allocateEarnedBonus(body.amountCents,[...weeks.values()].filter(w=>w.earnedMinutes>0)),earnedStart:body.earnedStart,earnedEnd:body.earnedEnd,compensationVersion:1,compensation,evidence}
 return {...allocation,fingerprint:createHash('sha256').update(JSON.stringify(compensationEvidence(allocation))).digest('hex')}
}
export function registerEarnedBonusPreviewRoutes(app,pool){
 app.post('/api/admin/payroll/employees/:id/bonus-allocation/preview',async(req,res)=>{
  try{res.json({success:true,data:await previewEarnedBonus(pool,req.canonicalAccess.facilityId,req.params.id,req.body||{})})}
  catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to preview bonus allocation.'})}
 })
}
