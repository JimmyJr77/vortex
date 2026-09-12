// Arithmetic for a complete nonexempt workweek whose straight-time earnings
// have already been allocated and reviewed. This does not classify earnings,
// allocate salary to weeks, or authorize a payment.
const safe=value=>Number.isSafeInteger(value)&&value>=0
const gcd=(a,b)=>{while(b){const remainder=a%b;a=b;b=remainder}return a}
const rounded=(n,d)=>{
 const amount=(2n*n+d)/(2n*d)
 if(amount>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Workweek compensation exceeds safe cent precision.')
 return Number(amount)
}
export function calculateAllocatedEarningsWeek(allocations){
 if(!Array.isArray(allocations))throw new Error('Supply the complete reviewed straight-time allocations.')
 let minutes=0n,numerator=0n,denominator=1n
 for(const allocation of allocations){
  if(!allocation||!safe(allocation.minutes)||typeof allocation.earningsNumerator!=='string'||!/^(0|[1-9]\d{0,30})$/.test(allocation.earningsNumerator)||!Number.isSafeInteger(allocation.earningsDenominator)||allocation.earningsDenominator<1||allocation.earningsDenominator>1000000)throw new Error('Provide safe worked minutes and nonnegative rational straight-time earnings.')
  const n=BigInt(allocation.earningsNumerator),d=BigInt(allocation.earningsDenominator)
  if(!allocation.minutes&&n)throw new Error('Straight-time earnings require their associated worked minutes.')
  minutes+=BigInt(allocation.minutes)
  numerator=numerator*d+n*denominator;denominator*=d
  const factor=gcd(numerator,denominator);numerator/=factor;denominator/=factor
 }
 if(minutes>10080n)throw new Error('Worked minutes cannot exceed a seven-day workweek.')
 const overtime=minutes>2400n?minutes-2400n:0n
 const straightTimePayCents=rounded(numerator,denominator)
 const overtimePremiumCents=minutes?rounded(numerator*overtime,denominator*minutes*2n):0
 const totalPayCents=straightTimePayCents+overtimePremiumCents
 if(!Number.isSafeInteger(totalPayCents))throw new Error('Workweek compensation exceeds safe cent precision.')
 return {workedMinutes:Number(minutes),overtimeMinutes:Number(overtime),straightTimePayCents,overtimePremiumCents,totalPayCents,
  earningsNumerator:numerator.toString(),earningsDenominator:denominator.toString(),
  regularRateNumerator:(numerator*60n).toString(),regularRateDenominator:(denominator*minutes).toString()}
}
