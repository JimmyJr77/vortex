import { taxReconciliation, taxRows, summarizeTaxRows } from './taxReconciliation.js'
const day=v=>v instanceof Date?v.toISOString().slice(0,10):String(v||'').slice(0,10)
// Comptroller's published 2026 state holiday calendar; January 2027 covers year-end deadlines.
const holidays=new Set(['2026-01-01','2026-01-19','2026-02-16','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-10-12','2026-11-03','2026-11-11','2026-11-26','2026-11-27','2026-12-25','2027-01-01','2027-01-18'])
const businessDay=value=>{let d=value;while([0,6].includes(new Date(d+'T00:00:00Z').getUTCDay())||holidays.has(d))d=day(new Date(Date.parse(d+'T00:00:00Z')+86400000));return d}
const date=(year,month,date)=>day(new Date(Date.UTC(year,month-1,date)))
const status=(due,today)=>due<today?'OVERDUE':due===today?'DUE_TODAY':'UPCOMING'
function filingStatus(taxes,form,start,end,due,today) {
 const filing=taxes.filings.find(f=>f.form_type===form&&day(f.period_start)===start&&day(f.period_end)===end&&!['SUPERSEDED','VOID'].includes(f.status)&&day(f.filed_on)<=today)
 return {filingStatus:filing?(filing.status==='MATCHED'?(day(filing.filed_on)>due?'RECORDED_LATE':'RECORDED'):'REVIEW_REQUIRED'):status(due,today),filingReference:filing?.reference||null}
}
// Tax-General §10-822 and Comptroller withholding instructions: aggregate payroll
// by actual pay date; $700 triggers three business days, residual tax stays monthly.
export function acceleratedWithholdingWindows(rows,year,months) {
 const windows=[]
 for(const month of [...months].sort((a,b)=>a-b)) {
  const monthStart=date(year,month,1),monthEnd=date(year,month+1,0)
  const payDates=[...new Set(rows.map(row=>day(row.payment_date)).filter(d=>d>=monthStart&&d<=monthEnd))].sort()
  let start=monthStart,accumulated=0n,triggered=false
  for(const payDate of payDates) {
   for(const row of rows.filter(row=>day(row.payment_date)===payDate)) {
    const cents=Number(row.maryland)
    if(!Number.isSafeInteger(cents)||cents<0)throw new Error('Accelerated withholding requires nonnegative safe cent amounts.')
    accumulated+=BigInt(cents)
   }
   if(accumulated>=70000n) {
    let dueOn=payDate
    for(let count=0;count<3;count++)dueOn=businessDay(day(new Date(Date.parse(dueOn+'T00:00:00Z')+86400000)))
    windows.push({start,end:payDate,dueOn,reason:'THRESHOLD',formType:'MD_MW506M'})
    start=day(new Date(Date.parse(payDate+'T00:00:00Z')+86400000));accumulated=0n;triggered=true
   }
  }
  // An accelerated return already satisfies the month's minimum filing when
  // no withholding remains. Otherwise retain the residual or zero return.
  if(accumulated>0n||!triggered||payDates.some(d=>d>=start))windows.push({start,end:monthEnd,dueOn:businessDay(date(year,month+1,15)),reason:accumulated>0n?'MONTH_END':'NO_ACTIVITY',formType:'MD_MW506M'})
 }
 return windows
}
export function calculateMarylandWithholdingCalendar(rows,taxes,config,today) {
 if(taxes.year!==2026||!config||!['MONTHLY','QUARTERLY','ANNUAL','SEASONAL','ACCELERATED'].includes(config.schedule))return {periods:[],annual:null}
 const year=taxes.year,months=config.months,periods=[]
 const windows=config.schedule==='ACCELERATED'?acceleratedWithholdingWindows(rows,year,months):(config.schedule==='ANNUAL'?[[1,12]]:config.schedule==='QUARTERLY'?months.map(m=>[m,m+2]):months.map(m=>[m,m])).map(([first,last])=>({start:date(year,first,1),end:date(year,last+1,0),dueOn:businessDay(config.schedule==='ANNUAL'?date(year+1,1,31):date(year,last+1,15)),formType:'MD_MW506'}))
 const receipts=taxes.deposits.filter(d=>d.agency==='MD_WITHHOLDING'&&d.status==='RECORDED'&&day(d.paid_on)<=today).sort((a,b)=>day(a.paid_on).localeCompare(day(b.paid_on))||Number(a.id)-Number(b.id)).map(d=>({...d,remaining:Number(d.amount_cents)}))
 for(const window of windows) {
  const {start,end,dueOn,formType}=window
  const totals=summarizeTaxRows(rows,start,end),liabilityCents=totals.MD_WITHHOLDING,quarter=Math.ceil(Number(start.slice(5,7))/3)
  let balanceCents=liabilityCents,coveredCents=0,lateCoveredCents=0
  for(const receipt of receipts) {
   if(config.schedule!=='ANNUAL'&&Number(receipt.tax_quarter)!==quarter)continue
   const amount=Math.min(balanceCents,receipt.remaining);receipt.remaining-=amount;balanceCents-=amount;coveredCents+=amount
   if(day(receipt.paid_on)>dueOn)lateCoveredCents+=amount
  }
  periods.push({...window,start,end,dueOn,quarter,grossCents:totals.grossCents,liabilityCents,balanceCents,coveredCents,lateCoveredCents,projected:end>today,paymentStatus:liabilityCents===0?'NO_TAX_DUE':balanceCents===0?(lateCoveredCents?'COVERED_LATE':'COVERED'):status(dueOn,today),...filingStatus(taxes,formType,start,end,dueOn,today)})
 }
 const start=date(year,1,1),end=date(year,12,31),dueOn=businessDay(date(year+1,1,31))
 return {periods,annual:{start,end,dueOn,...filingStatus(taxes,'MD_MW508',start,end,dueOn,today)},unappliedCents:receipts.reduce((sum,r)=>sum+r.remaining,0)}
}
export async function marylandWithholdingCalendar(db,facility,year) {
 const [taxes,rows,configuration,settings]=await Promise.all([taxReconciliation(db,facility,year),taxRows(db,facility,year),db.query('SELECT * FROM payroll_md_withholding_config WHERE facility_id=$1 AND tax_year=$2',[facility,year]),db.query('SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[facility])])
 const config=configuration.rows[0]||null,today=settings.rows[0]?.today,issues=[]
 if(year!==2026)issues.push('Maryland withholding deadlines are currently verified for 2026 only.')
 if(!config)issues.push('Verify the Maryland withholding filing category and required reporting periods from the employer account notice.')
 if(taxes.legacyPayments)issues.push('Complete the historical wage and withholding reconciliation before relying on this calendar.')
 const calculated=calculateMarylandWithholdingCalendar(rows,taxes,config,today)
 if(config?.schedule==='ACCELERATED'&&taxes.filings.some(f=>f.form_type==='MD_MW506M'&&!['SUPERSEDED','VOID'].includes(f.status)&&!calculated.periods.some(p=>p.start===day(f.period_start)&&p.end===day(f.period_end))))issues.push('An accelerated return covers a different interval from the calculated threshold or monthly periods. Reconcile voluntary early returns and agency allocations before relying on these deadlines.')
 if(config&&rows.some(r=>!calculated.periods.some(p=>day(r.payment_date)>=p.start&&day(r.payment_date)<=p.end)))issues.push('Finalized payroll exists outside the verified reporting periods. Review the account schedule.')
 return {year,today,config,issues,reliable:issues.length===0,...calculated}
}
export function registerMarylandWithholdingCalendarRoutes(app,pool) {
 app.get('/api/admin/payroll/maryland-withholding-calendar',async(req,res)=>{
  const year=Number(req.query.year);if(!Number.isInteger(year)||year<2000||year>2200)return res.status(400).json({success:false,message:'Choose a valid tax year.'})
  try{res.json({success:true,data:await marylandWithholdingCalendar(pool,req.canonicalAccess.facilityId,year)})}catch{res.status(500).json({success:false,message:'Unable to load Maryland withholding calendar.'})}
 })
 app.post('/api/admin/payroll/maryland-withholding-schedule',async(req,res)=>{
  const b=req.body||{},months=b.months
  if(b.year!==2026||!['MONTHLY','QUARTERLY','ANNUAL','SEASONAL','ACCELERATED'].includes(b.schedule)||!Array.isArray(months)||!months.length||months.some(m=>!Number.isInteger(m)||m<1||m>12)||new Set(months).size!==months.length||b.schedule==='QUARTERLY'&&months.some(m=>![1,4,7,10].includes(m))||b.schedule==='ANNUAL'&&(months.length!==1||months[0]!==1)||b.confirmed!==true||b.standardScheduleConfirmed!==true||String(b.source||'').trim().length<12)return res.status(400).json({success:false,message:'Verify the 2026 filing category, required periods, complete payroll history and employer account source.'})
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId
  try {
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
   const before=(await db.query('SELECT * FROM payroll_md_withholding_config WHERE facility_id=$1 AND tax_year=$2',[facility,b.year])).rows[0]||null
   const row=(await db.query(`INSERT INTO payroll_md_withholding_config(facility_id,tax_year,schedule,months,source,verified_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(facility_id,tax_year) DO UPDATE SET schedule=EXCLUDED.schedule,months=EXCLUDED.months,source=EXCLUDED.source,verified_by=EXCLUDED.verified_by,verified_at=now() RETURNING *`,[facility,b.year,b.schedule,[...months].sort((a,b)=>a-b),String(b.source).trim().slice(0,2000),req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'MD_WITHHOLDING_SCHEDULE_VERIFIED','md_withholding_schedule',$3,$4,$5)",[facility,req.adminId,String(b.year),before,row])
   await db.query('COMMIT');res.json({success:true,data:row})
  }catch{await db.query('ROLLBACK').catch(()=>{});res.status(500).json({success:false,message:'Unable to save Maryland withholding schedule.'})}finally{db.release()}
 })
}
