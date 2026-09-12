import {benefitsTerms} from './benefitCatalog.js'
import {effectiveScheduleSettings} from './payCalendar.js'
const day=value=>value instanceof Date?value.toISOString().slice(0,10):String(value||'').slice(0,10)
export function hiringScheduleDescription(settings){
 const frequency=settings.pay_frequency,lag=Number(settings.pay_period_payment_lag_days)
 const bank='Paydays falling on weekends or bank holidays move to the preceding bank business day.'
 if(frequency==='SEMIMONTHLY')return `Semimonthly; nominal paydays are day ${settings.semimonthly_first_day} and day ${settings.semimonthly_second_day} of each month. ${bank}`
 if(frequency==='MONTHLY')return `Monthly calendar periods; nominal payday is ${lag} calendar days after the period ends. ${bank}`
 if(['WEEKLY','BIWEEKLY'].includes(frequency))return `${frequency==='WEEKLY'?'Weekly':'Biweekly'}; ${frequency==='WEEKLY'?7:14}-day pay periods anchored on ${day(settings.pay_period_anchor_start)}. Nominal payday is ${lag} calendar days after the period ends. ${bank}`
 throw new Error('Configure the employer pay schedule before issuing hiring terms.')
}
export async function hiringPolicy(db,facility,employee,now=new Date()){
 const current=(await db.query('SELECT * FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]
 if(!current)throw new Error('Employer payroll settings are required.')
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:current.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
 const hire=day(employee.hire_date),effectiveOn=hire>today?hire:today
 const settings=await effectiveScheduleSettings(db,facility,current,effectiveOn)
 return {...current.onboarding_policy,benefitsText:benefitsTerms(current.onboarding_policy),paySchedule:hiringScheduleDescription(settings),payScheduleSnapshot:{
  frequency:settings.pay_frequency,
  anchorStart:['WEEKLY','BIWEEKLY'].includes(settings.pay_frequency)?day(settings.pay_period_anchor_start):null,
  paymentLagDays:settings.pay_frequency==='SEMIMONTHLY'?null:Number(settings.pay_period_payment_lag_days),
  firstPayDay:settings.pay_frequency==='SEMIMONTHLY'?Number(settings.semimonthly_first_day):null,
  secondPayDay:settings.pay_frequency==='SEMIMONTHLY'?Number(settings.semimonthly_second_day):null,
  bankAdjustment:'PRECEDING_BANK_BUSINESS_DAY',
 }}
}
