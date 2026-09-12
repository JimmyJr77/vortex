import {fixedSalaryWeeklyHours} from './fixedSalaryAgreement.js'
const safe=n=>Number.isSafeInteger(n)&&n>=0
const round=(n,d)=>{const value=(n*2n+d)/(d*2n);if(value>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Leave pay exceeds safe cent precision.');return Number(value)}

// Leave uses the dated normal rate. Salary leave is a component of the
// administrator's total salary allocation, not an additional salary payment.
export function allocatedLeaveEarnings(review){
 const rows=[...(review.paidLeave||[])].sort((a,b)=>a.leaveDate.localeCompare(b.leaveDate)||a.id-b.id)
 const seen=new Set(),daily=new Map(),entries=[]
 for(const leave of rows){
  if(!safe(leave.id)||!leave.id||seen.has(leave.id)||leave.status!=='APPROVED'||!safe(leave.minutes)||!leave.minutes||leave.leaveDate<review.week||leave.leaveDate>review.end)throw new Error('Review unique approved leave dates and minutes before allocating earnings.')
  seen.add(leave.id)
  const agreements=review.agreements.filter(a=>leave.leaveDate>=a.start&&leave.leaveDate<=a.end)
  if(agreements.length!==1)throw new Error('Every leave date must match exactly one retained compensation agreement.')
  const agreement=agreements[0],salary=agreement.payType==='SALARY'
  let numerator,denominator
  if(salary){
   if(agreement.salaryReview?.classification!=='NONEXEMPT'||!agreement.salaryReview.verifiedAt||!safe(agreement.annualSalaryCents)||!agreement.annualSalaryCents)throw new Error('Verify the dated nonexempt salary agreement before allocating leave pay.')
   numerator=BigInt(agreement.annualSalaryCents)*BigInt(leave.minutes)
   denominator=BigInt(fixedSalaryWeeklyHours(agreement.salaryReview)*60)*52n
  }else{
   if(agreement.payType!=='HOURLY'||!safe(agreement.hourlyRateCents)||!agreement.hourlyRateCents)throw new Error('Verify the dated hourly rate before allocating leave pay.')
   numerator=BigInt(agreement.hourlyRateCents)*BigInt(leave.minutes);denominator=60n
  }
  daily.set(leave.leaveDate,(daily.get(leave.leaveDate)||0)+leave.minutes)
  const worked=review.time.filter(e=>e.workDate===leave.leaveDate).reduce((n,e)=>n+e.minutes,0)
  if(daily.get(leave.leaveDate)+worked>1440)throw new Error('Worked and paid leave hours exceed the available hours on a leave date.')
  entries.push({id:leave.id,requestId:leave.requestId,leaveDate:leave.leaveDate,minutes:leave.minutes,employmentStart:agreement.employmentStart,payType:agreement.payType,includedInSalary:salary,amountCents:round(numerator,denominator),rateNumerator:String(salary?agreement.annualSalaryCents:agreement.hourlyRateCents),rateDenominator:salary?fixedSalaryWeeklyHours(agreement.salaryReview)*52:1})
 }
 const sum=predicate=>{const value=entries.filter(predicate).reduce((n,e)=>n+BigInt(e.amountCents),0n);if(value>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Combined leave pay exceeds safe cent precision.');return Number(value)}
 return {version:1,method:'DATED_NORMAL_RATE_SALARY_INCLUDED_HOURLY_ADDITIONAL',entries,salaryIncludedCents:sum(e=>e.includedInSalary),hourlyAdditionalCents:sum(e=>!e.includedInSalary),totalCents:sum(()=>true)}
}
