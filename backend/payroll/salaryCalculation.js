import {fixedSalaryWeeklyHours,fixedSalaryMinimumCents} from './fixedSalaryAgreement.js'
import {exemptLeaveWorkweek} from './exemptWorkweek.js'
const date=value=>{
 const result=value instanceof Date?value.toISOString().slice(0,10):String(value||'').slice(0,10)
 if(!/^\d{4}-\d{2}-\d{2}$/.test(result)||new Date(`${result}T00:00:00Z`).toISOString().slice(0,10)!==result)throw new Error('Salary calculation requires valid employment and pay-period dates.')
 return result
}

export function calculateSalary(employee,period,payFrequency){
 const review=employee.salaryReview,annual=employee.annualSalaryCents
 const exempt=employee.overtimeClassification==='EXEMPT'
 if(!['EXEMPT','NONEXEMPT'].includes(employee.overtimeClassification)||review?.classification!==employee.overtimeClassification||!review.verifiedAt||review.annualSalaryCents!==annual||review.jobTitle!==employee.jobTitle||review.workState!==employee.workState)throw new Error('Complete a current exempt or nonexempt salary classification review before calculating salary.')
 if(employee.workState!=='MD'||!Number.isSafeInteger(annual)||annual<=0)throw new Error('Salary requires a verified Maryland pay configuration.')
 if(exempt&&(!review.salaryBasisVerified||!review.dutiesVerified||!review.stateRulesVerified||annual<3556800))throw new Error('Salary does not meet the verified Maryland standard exemption configuration.')
 const standardWeeklyHours=exempt?null:fixedSalaryWeeklyHours(review)
 if(!exempt&&annual<fixedSalaryMinimumCents(review))throw new Error(`Annual salary must cover ${standardWeeklyHours===40?'2,080':standardWeeklyHours*52} hours at the verified minimum wage.`)
 const periods={WEEKLY:52,BIWEEKLY:26,SEMIMONTHLY:24,MONTHLY:12}[payFrequency]
 if(!periods)throw new Error('Salary requires a supported pay frequency.')
 const start=date(period?.period_start),end=date(period?.period_end),hire=date(employee.hireDate),termination=employee.terminationDate?date(employee.terminationDate):null
 if(start>end||hire>end||(termination&&termination<start))throw new Error('The employee must be employed during this salary pay period.')
 const employmentPeriods=employee.employmentPeriods?.map(p=>({start:date(p.start),end:p.end?date(p.end):null}))??[{start:hire,end:termination}]
 if(!employmentPeriods.length||employmentPeriods.some((p,i)=>p.end&&p.end<p.start||i>0&&(!employmentPeriods[i-1].end||p.start<=employmentPeriods[i-1].end)))throw new Error('Reconcile salary employment periods before calculating pay.')
 // Full scheduled salary is deliberately preserved for initial/final partial periods.
 // Deductions for absences or partial employment require a separate reviewed policy.
 const normalWorkweekMinutes=exempt?exemptLeaveWorkweek(review.normalWorkweekMinutes??undefined):null
 let leaveBasisMinutes=0
 for(let cursor=new Date(`${start}T00:00:00Z`);cursor.toISOString().slice(0,10)<=end;cursor.setUTCDate(cursor.getUTCDate()+1)){
  const day=cursor.toISOString().slice(0,10)
  if(employmentPeriods.some(p=>day>=p.start&&(!p.end||day<=p.end)))leaveBasisMinutes+=normalWorkweekMinutes?.[cursor.getUTCDay()]??0
 }
 return {version:1,standardWeeklyHours,annualSalaryCents:annual,periodsPerYear:periods,regularPayCents:Number((BigInt(annual)*2n+BigInt(periods))/(2n*BigInt(periods))),periodStart:start,periodEnd:end,classification:employee.overtimeClassification,reviewedAt:review.verifiedAt,partialPeriod:hire>start||!!(termination&&termination<end)||employmentPeriods.length>1,paymentPolicy:'FULL_PERIOD_SALARY_NO_ABSENCE_DEDUCTIONS',leaveBasisMinutes:exempt?leaveBasisMinutes:null,normalWorkweekMinutes,leaveBasis:exempt?'REVIEWED_NORMAL_WORKWEEK':'ACTUAL_APPROVED_WORK',regularRateNumerator:exempt?null:annual,regularRateDenominator:exempt?null:standardWeeklyHours*52,minimumWageCents:exempt?null:review.minimumWageCents}
}

export function calculateExemptSalary(employee,period,payFrequency){
 if(employee.overtimeClassification!=='EXEMPT')throw new Error('Complete a current exempt salary classification review before calculating salary.')
 return calculateSalary(employee,period,payFrequency)
}
export function salaryOvertimeCents(salary,minutes){
 if(!Number.isSafeInteger(minutes)||minutes<0)throw new Error('Salary overtime requires valid worked minutes.')
 if(salary.classification!=='NONEXEMPT')return 0
 // Round only the resulting payment, preserving the fractional regular rate.
 const numerator=BigInt(salary.annualSalaryCents)*BigInt(minutes)*3n,denominator=BigInt((salary.standardWeeklyHours??40)*52)*60n*2n
 return Number((2n*numerator+denominator)/(2n*denominator))
}
