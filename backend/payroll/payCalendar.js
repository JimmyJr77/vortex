import {generateSemimonthlyPeriods} from './payrollEngine.js'
import {previousBankBusinessDay} from './bankCalendar.js'
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value||'').slice(0,10)
const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&day(new Date(value))===value
const add=(value,n)=>day(new Date(Date.parse(value+'T00:00:00Z')+n*86400000))
const fail=message=>Object.assign(new Error(message),{status:409})
export function generatePayPeriods(year,month,settings) {
 if(!Number.isInteger(year)||year<2000||year>2200||!Number.isInteger(month)||month<1||month>12)throw Object.assign(new Error('Use a valid year and month.'),{status:400})
 if(settings.pay_frequency==='SEMIMONTHLY')return generateSemimonthlyPeriods(year,month,settings.semimonthly_first_day,settings.semimonthly_second_day)
 const frequency=settings.pay_frequency
 if(!['WEEKLY','BIWEEKLY','MONTHLY'].includes(frequency))throw fail('Configure a supported payroll frequency before generating periods.')
 const lag=settings.pay_period_payment_lag_days
 if(!Number.isInteger(lag)||lag<1||lag>31)throw fail('Verify the calendar-day payment lag after each pay period before generating this schedule.')
 const monthStart=`${year}-${String(month).padStart(2,'0')}-01`,monthEnd=day(new Date(Date.UTC(year,month,0))),periods=[]
 const push=(periodStart,periodEnd)=>{
  const nominalPayDate=add(periodEnd,lag)
  if(nominalPayDate>=monthStart&&nominalPayDate<=monthEnd){
   const payDate=previousBankBusinessDay(nominalPayDate)
   if(payDate<=periodEnd)throw fail('The bank-adjusted payment date must follow the completed pay period. Increase the payment lag for this schedule.')
   periods.push({periodStart,periodEnd,nominalPayDate,payDate,frequency})
  }
 }
 if(frequency==='MONTHLY') {
  // A lag up to 31 days can place two month-end payments in one nominal month.
  for(let offset=-2;offset<=0;offset++)push(day(new Date(Date.UTC(year,month-1+offset,1))),day(new Date(Date.UTC(year,month+offset,0))))
 }else{
  const anchor=day(settings.pay_period_anchor_start)
  if(!valid(anchor))throw fail('Verify the first weekly or biweekly period start before generating this schedule.')
  const length=frequency==='WEEKLY'?7:14
  const earliest=add(monthStart,-lag-length+1)
  const elapsed=Math.floor((Date.parse(earliest)-Date.parse(anchor))/86400000)
  let start=add(anchor,Math.floor(elapsed/length)*length)
  while(start<=monthEnd){push(start,add(start,length-1));start=add(start,length)}
 }
 return periods.sort((a,b)=>a.periodStart.localeCompare(b.periodStart))
}

// Caller must hold the employer settings row lock inside a transaction.
export async function persistPayPeriods(db,facility,periods,{updateExisting=false}={}) {
 const saved=[];let insertedCount=0
 for(const period of periods){
  const values=[facility,period.periodStart,period.periodEnd,period.payDate,period.frequency]
  const overlap=await db.query(`SELECT id FROM payroll_pay_period WHERE facility_id=$1
   AND period_start<=$3::date AND period_end>=$2::date
   AND NOT(period_start=$2::date AND period_end=$3::date AND frequency=$4) LIMIT 1`,[facility,period.periodStart,period.periodEnd,period.frequency])
  if(overlap.rows.length)throw fail('This schedule overlaps an existing pay period. Resolve the schedule transition before generating another frequency.')
  const existing=(await db.query('SELECT * FROM payroll_pay_period WHERE facility_id=$1 AND period_start=$2 AND period_end=$3',[facility,period.periodStart,period.periodEnd])).rows[0]
  if(existing){
   const changed=updateExisting?(await db.query(`UPDATE payroll_pay_period SET pay_date=$4,updated_at=now() WHERE facility_id=$1 AND period_start=$2 AND period_end=$3
    AND status='OPEN' AND NOT EXISTS(SELECT 1 FROM payroll_run r WHERE r.pay_period_id=payroll_pay_period.id AND r.status<>'VOID') RETURNING *`,values.slice(0,4))).rows[0]:null
   saved.push(changed||existing)
  }else{
   const row=(await db.query('INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES($1,$2,$3,$4,$5) RETURNING *',values)).rows[0]
   saved.push(row);insertedCount++
  }
 }
 return {rows:saved,insertedCount}
}

// Schedule versions are effective on period-start boundaries. Historical
// generations must not reinterpret old periods with the newest settings.
export function generateVersionedPayPeriods(year,month,current,versions=[]) {
 if(!versions.length)return generatePayPeriods(year,month,current)
 const ordered=[...versions].sort((a,b)=>day(a.effective_on).localeCompare(day(b.effective_on)))
 if(ordered.some((v,i)=>!valid(day(v.effective_on))||!v.schedule_settings||typeof v.schedule_settings!=='object'||Array.isArray(v.schedule_settings)||i>0&&day(v.effective_on)===day(ordered[i-1].effective_on)))throw fail('Schedule history has an invalid or duplicate effective date.')
 const periods=[]
 for(let i=0;i<ordered.length;i++){
  const effective=day(ordered[i].effective_on),next=ordered[i+1]?day(ordered[i+1].effective_on):null
  if(i>0){
   const schedule=ordered[i].schedule_settings,frequency=schedule.pay_frequency
   const length=frequency==='WEEKLY'?7:14,anchor=day(schedule.pay_period_anchor_start)
   if(['WEEKLY','BIWEEKLY'].includes(frequency)&&(!valid(anchor)||((Date.parse(effective)-Date.parse(anchor))/86400000)%length!==0)||frequency==='SEMIMONTHLY'&&!['01','16'].includes(effective.slice(8))||frequency==='MONTHLY'&&effective.slice(8)!=='01')throw fail('The new schedule must begin exactly on its effective date without a gap.')
  }
  for(const period of generatePayPeriods(year,month,{...current,...ordered[i].schedule_settings})){
   if(period.periodStart<effective||next&&period.periodStart>=next)continue
   if(next&&period.periodEnd>=next)throw fail('The schedule transition splits an existing period. Choose a date after a complete pay period.')
   periods.push(period)
  }
 }
 periods.sort((a,b)=>a.periodStart.localeCompare(b.periodStart))
 for(let i=1;i<periods.length;i++)if(periods[i].periodStart<=periods[i-1].periodEnd)throw fail('Schedule history creates overlapping periods.')
 return periods
}
export async function loadScheduleVersions(db,facility){
 return (await db.query('SELECT id,effective_on,schedule_settings,notice_delivered_on FROM payroll_schedule_version WHERE facility_id=$1 AND cancelled_at IS NULL ORDER BY effective_on',[facility])).rows
}

export async function effectiveScheduleSettings(db,facility,current,asOf){
 const date=asOf||new Intl.DateTimeFormat('en-CA',{timeZone:current.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 const version=(await db.query('SELECT schedule_settings FROM payroll_schedule_version WHERE facility_id=$1 AND cancelled_at IS NULL AND effective_on<=$2::date ORDER BY effective_on DESC LIMIT 1',[facility,date])).rows[0]
 return {...current,...version?.schedule_settings}
}
