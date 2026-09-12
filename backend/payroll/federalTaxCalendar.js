import { nextFederalTaxBusinessDay } from './federalTaxDates.js'
export { federalTaxHolidays,nextFederalTaxBusinessDay } from './federalTaxDates.js'
import { calculateFutaDeposits } from './futaTaxCalendar.js'
import { taxRows } from './taxReconciliation.js'
const day=v=>v instanceof Date?v.toISOString().slice(0,10):String(v).slice(0,10)
const add=(value,n)=>day(new Date(Date.parse(`${value}T00:00:00Z`)+n*86400000))
const quarter=value=>Math.ceil(Number(value.slice(5,7))/3)
const semiEnd=value=>add(value,({0:2,1:1,2:0,3:2,4:1,5:0,6:3})[new Date(`${value}T00:00:00Z`).getUTCDay()])
const semiDue=end=>{let date=end;for(let i=0;i<3;i++)date=nextFederalTaxBusinessDay(date);return date}
export function calculateFederalDeposits(rows,{schedule,priorYearNextDay=false},deposits=[],today) {
 let mode=priorYearNextDay?'SEMIWEEKLY':schedule,group=null,triggered=false
 const daily=new Map(),obligations=[]
 for(const row of rows){const date=day(row.payment_date),amount=Number(row.federal_income)+2*Number(row.social_security)+2*Number(row.medicare)+Number(row.additional_medicare);daily.set(date,(daily.get(date)||0)+amount)}
 const flush=(dueOn,rule)=>{
  if(!group)return
  for(const [q,part] of group.parts)if(part.amount>0)obligations.push({key:`${part.first}:${part.last}:${dueOn}`,quarter:q,firstPayDate:part.first,lastPayDate:part.last,dueOn,rule,liabilityCents:part.amount,coveredCents:0,lateCoveredCents:0})
  group=null
 }
 for(const [date,amount] of [...daily].sort(([a],[b])=>a.localeCompare(b))) {
  if(!amount)continue
  const end=mode==='MONTHLY'?day(new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7)),0))):semiEnd(date)
  if(group&&group.end!==end)flush(group.due,group.mode)
  if(!group){const due=mode==='MONTHLY'?nextFederalTaxBusinessDay(day(new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7)),15))),true):semiDue(end);group={end,due,mode,amount:0,parts:new Map()}}
  const q=quarter(date),part=group.parts.get(q)||{first:date,last:date,amount:0};part.last=date;part.amount+=amount;group.parts.set(q,part);group.amount+=amount
  if(group.amount>=10000000){flush(nextFederalTaxBusinessDay(date),'NEXT_DAY_100K');mode='SEMIWEEKLY';triggered=true}
 }
 if(group)flush(group.due,group.mode)
 obligations.sort((a,b)=>a.dueOn.localeCompare(b.dueOn)||a.firstPayDate.localeCompare(b.firstPayDate))
 for(const receipt of [...deposits].filter(d=>d.agency==='IRS_941'&&d.status==='RECORDED'&&day(d.paid_on)<=today).sort((a,b)=>day(a.paid_on).localeCompare(day(b.paid_on))||Number(a.id)-Number(b.id))) {
  let remaining=Number(receipt.amount_cents)
  for(const obligation of obligations.filter(o=>o.quarter===Number(receipt.tax_quarter))) {
   const allocated=Math.min(remaining,obligation.liabilityCents-obligation.coveredCents);obligation.coveredCents+=allocated
   if(day(receipt.paid_on)>obligation.dueOn)obligation.lateCoveredCents+=allocated
   remaining-=allocated;if(!remaining)break
  }
 }
 return {effectiveSchedule:mode,nextYearSemiweeklyRequired:triggered,obligations:obligations.map(o=>({...o,balanceCents:o.liabilityCents-o.coveredCents,status:o.coveredCents===o.liabilityCents?(o.lateCoveredCents?'COVERED_LATE':'COVERED'):o.dueOn<today?'OVERDUE':o.dueOn===today?'DUE_TODAY':'UPCOMING'}))}
}
export async function federalTaxCalendar(db,facility,year) {
 const [settings,config,rows,deposits,legacy]=await Promise.all([
  db.query('SELECT employer_tax_config,(now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=$1',[facility]),
  db.query('SELECT * FROM payroll_federal_deposit_schedule WHERE facility_id=$1 AND tax_year=$2',[facility,year]),taxRows(db,facility,year),
  db.query("SELECT * FROM payroll_tax_deposit WHERE facility_id=$1 AND tax_year=$2 AND agency IN ('IRS_941','IRS_FUTA')",[facility,year]),
  db.query('SELECT COUNT(*)::int AS count FROM payroll_historical_payment WHERE facility_id=$1 AND EXTRACT(YEAR FROM payment_date)=$2',[facility,year])
 ])
 const record=config.rows[0]||null,today=settings.rows[0]?.today
 const issues=[]
 if(year!==2026)issues.push('Federal deposit rules are currently verified for 2026. Verify the new tax year before using automated deadlines.')
 if(!record)issues.push('Verify the employer’s Form 941 deposit schedule and complete payroll history for this year.')
 if(legacy.rows[0].count)issues.push('Historical payments exist without complete daily federal tax liabilities. Resolve those tax records before relying on these deadlines.')
 const calculated=record&&year===2026?calculateFederalDeposits(rows,{schedule:record.schedule,priorYearNextDay:record.prior_year_next_day},deposits.rows,today):{obligations:[],effectiveSchedule:null,nextYearSemiweeklyRequired:false}
 const futaIssues=[...issues]
 const employer=settings.rows[0]?.employer_tax_config
 if(employer?.verified!==true||employer?.year!==year)futaIssues.push('Verify employer unemployment rates and FUTA credit treatment in Employer setup.')
 const futa=year===2026?calculateFutaDeposits(rows,year,deposits.rows,today):{quarters:[],obligations:[],liabilityCents:0,coveredCents:0,unappliedCents:0}
 return {year,today,config:record,issues,reliable:issues.length===0,...calculated,futa:{...futa,issues:futaIssues,reliable:futaIssues.length===0}}
}
export function registerFederalTaxCalendarRoutes(app,pool) {
 app.get('/api/admin/payroll/federal-deposit-calendar',async(req,res)=>{
  const year=Number(req.query.year);if(!Number.isInteger(year)||year<2000||year>2200)return res.status(400).json({success:false,message:'Choose a valid tax year.'})
  try{res.json({success:true,data:await federalTaxCalendar(pool,req.canonicalAccess.facilityId,year)})}catch{res.status(500).json({success:false,message:'Unable to load federal deposit calendar.'})}
 })
 app.post('/api/admin/payroll/federal-deposit-schedule',async(req,res)=>{
  const b=req.body||{}
  if(b.year!==2026||!['MONTHLY','SEMIWEEKLY'].includes(b.schedule)||typeof b.priorYearNextDay!=='boolean'||b.confirmed!==true||String(b.source||'').trim().length<12)return res.status(400).json({success:false,message:'Verify the 2026 Form 941 schedule, prior-year next-day rule, complete payroll history, and supporting source.'})
  const db=await pool.connect()
  try {
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])
   const before=(await db.query('SELECT * FROM payroll_federal_deposit_schedule WHERE facility_id=$1 AND tax_year=$2',[req.canonicalAccess.facilityId,b.year])).rows[0]||null
   const row=(await db.query(`INSERT INTO payroll_federal_deposit_schedule(facility_id,tax_year,schedule,prior_year_next_day,source,verified_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(facility_id,tax_year) DO UPDATE SET schedule=EXCLUDED.schedule,prior_year_next_day=EXCLUDED.prior_year_next_day,source=EXCLUDED.source,verified_by=EXCLUDED.verified_by,verified_at=now() RETURNING *`,[req.canonicalAccess.facilityId,b.year,b.schedule,b.priorYearNextDay,String(b.source).trim().slice(0,2000),req.adminId])).rows[0]
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'FEDERAL_DEPOSIT_SCHEDULE_VERIFIED','federal_deposit_schedule',$3,$4,$5)",[req.canonicalAccess.facilityId,req.adminId,`${b.year}`,before,row])
   await db.query('COMMIT');res.json({success:true,data:row})
  }catch{await db.query('ROLLBACK').catch(()=>{});res.status(500).json({success:false,message:'Unable to save federal deposit schedule.'})}finally{db.release()}
 })
}
