export function fixedSalaryWeeklyHours(review){
 const hours=review.standardWeeklyHours??40
 if(!Number.isFinite(hours)||hours<=0||hours>40||!Number.isInteger(hours*4)||!(review.fixedHoursVerified===true||(hours===40&&review.fixed40Verified===true)))throw new Error('Verify the fixed salary workweek in quarter-hour increments up to 40 hours; legacy 40-hour agreements require their original confirmation.')
 return hours
}
export function fixedSalaryMinimumCents(review){
 const hours=fixedSalaryWeeklyHours(review)
 if(!review.minimumWageVerified||!Number.isSafeInteger(review.minimumWageCents)||review.minimumWageCents<1500)throw new Error('Verify the applicable minimum wage for this salary agreement.')
 return review.minimumWageCents*52*hours
}
export function salaryExtraStraightTime(salary,entries,priorByWeek={}){
 if(salary.classification!=='NONEXEMPT')return {minutes:0,amountCents:0}
 const contract=salary.standardWeeklyHours*60,weeks=new Map()
 for(const entry of entries)weeks.set(entry.workweekStart,(weeks.get(entry.workweekStart)||0)+entry.regularMinutes+entry.overtimeMinutes)
 let minutes=0
 for(const [week,current] of weeks){
  const prior=Number(priorByWeek[week]??0)
  if(!Number.isSafeInteger(prior)||prior<0||!Number.isSafeInteger(current)||current<0)throw new Error('Verify carried workweek hours before calculating additional salary wages.')
  minutes+=Math.max(0,Math.min(prior+current,2400)-contract)-Math.max(0,Math.min(prior,2400)-contract)
 }
 const numerator=BigInt(salary.annualSalaryCents)*BigInt(minutes),denominator=BigInt(salary.standardWeeklyHours*52)*60n
 return {minutes,amountCents:Number((numerator*2n+denominator)/(denominator*2n))}
}
export function fixedSalaryRateDecreased(beforeAnnual,beforeReview,afterAnnual,afterReview){
 if(beforeReview?.classification!=='NONEXEMPT'||afterReview?.classification!=='NONEXEMPT')return false
 return BigInt(afterAnnual)*BigInt(fixedSalaryWeeklyHours(beforeReview)*4)<BigInt(beforeAnnual)*BigInt(fixedSalaryWeeklyHours(afterReview)*4)
}
