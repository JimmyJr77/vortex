import {calculateAllocatedEarningsWeek} from './regularRateWeek.js'
// Standard FLSA weighted-average method for a complete hourly workweek.
// Callers must supply all worked minutes and all applicable straight-time rates.
// Bonuses, salary, commissions and other regular-rate inclusions require separate allocation.
// https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay
const safe=value=>Number.isSafeInteger(value)&&value>=0
function rounded(numerator,denominator) {
 const value=(numerator+denominator/2n)/denominator
 if(value>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Workweek compensation exceeds safe cent precision.')
 return Number(value)
}
export function calculateWeightedHourlyWeek(segments) {
 if(!Array.isArray(segments))throw new Error('Supply the complete hourly workweek segments.')
 let minutes=0n,earningsNumerator=0n
 for(const segment of segments) {
  if(!segment||!safe(segment.minutes)||!safe(segment.hourlyRateCents)||segment.hourlyRateCents===0)throw new Error('Workweek minutes and positive hourly rates must be safe whole numbers.')
  minutes+=BigInt(segment.minutes)
  earningsNumerator+=BigInt(segment.minutes)*BigInt(segment.hourlyRateCents)
 }
 if(minutes>10080n)throw new Error('Worked minutes cannot exceed a seven-day workweek.')
 const calculated=calculateAllocatedEarningsWeek(segments.map(segment=>({minutes:segment.minutes,earningsNumerator:(BigInt(segment.minutes)*BigInt(segment.hourlyRateCents)).toString(),earningsDenominator:60})))
 return {
  workedMinutes:calculated.workedMinutes,overtimeMinutes:calculated.overtimeMinutes,
  straightTimePayCents:calculated.straightTimePayCents,overtimePremiumCents:calculated.overtimePremiumCents,totalPayCents:calculated.totalPayCents,
  // Keep the existing hourly evidence representation stable for saved payroll.
  regularRateNumerator:earningsNumerator.toString(),regularRateDenominator:Number(minutes),
 }
}

// Settle only a closed workweek against independently verified finalized payroll.
// A negative difference is a review item, never an automatic wage deduction.
export function settleWeightedHourlyWeek({segments,...context}) {
 return settleWorkweekCalculation(calculateWeightedHourlyWeek(segments),context)
}
export function settleAllocatedEarningsWeek({allocations,...context}) {
 return settleWorkweekCalculation(calculateAllocatedEarningsWeek(allocations),context)
}
function settleWorkweekCalculation(calculated,{priorPremiums,historyVerified,workweekClosed,payableOvertimeMinutes}) {
 if(!Array.isArray(priorPremiums)||typeof historyVerified!=='boolean'||typeof workweekClosed!=='boolean')throw new Error('Verify workweek closure and provide the finalized premium history.')
 const runs=new Set()
 let paid=0n
 for(const payment of priorPremiums) {
  if(!payment||!safe(payment.runId)||payment.runId===0||!safe(payment.premiumCents)||runs.has(payment.runId))throw new Error('Prior premiums require unique finalized run IDs and safe nonnegative cent amounts.')
  runs.add(payment.runId);paid+=BigInt(payment.premiumCents)
 }
 if(paid>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Prior premium total exceeds safe cent precision.')
 const throughPeriodMinutes=payableOvertimeMinutes??calculated.overtimeMinutes
 if(!safe(throughPeriodMinutes)||throughPeriodMinutes>calculated.overtimeMinutes)throw new Error('Payable overtime minutes must fall within the complete workweek overtime.')
 const earnedPremiumThroughPeriodCents=calculated.workedMinutes?rounded(BigInt(calculated.regularRateNumerator)*BigInt(throughPeriodMinutes),BigInt(calculated.regularRateDenominator)*120n):0
 const previouslyPaidPremiumCents=Number(paid)
 const differenceCents=earnedPremiumThroughPeriodCents-previouslyPaidPremiumCents
 const status=!historyVerified?'HISTORY_REVIEW_REQUIRED':!workweekClosed?'WORKWEEK_OPEN':differenceCents<0?'OVERPAYMENT_REVIEW_REQUIRED':differenceCents===0?'SETTLED':'PREMIUM_DUE'
 return {...calculated,status,previouslyPaidPremiumCents,differenceCents,payableOvertimeMinutes:throughPeriodMinutes,earnedPremiumThroughPeriodCents,
  premiumDueCents:status==='PREMIUM_DUE'?differenceCents:0,
  priorRunIds:[...runs].sort((a,b)=>a-b),
 }
}

// Allocate actual period pay across workweeks without losing or creating cents.
// Largest remainders go to the earliest week for a deterministic audit trail.
function apportion(amount,weights) {
 const total=weights.reduce((sum,w)=>sum+BigInt(w.minutes),0n)
 if(!total){if(amount!==0)throw new Error('Pay has no matching worked minutes.');return weights.map(w=>({...w,cents:0}))}
 const rows=weights.map(w=>({...w,cents:Number(BigInt(amount)*BigInt(w.minutes)/total),remainder:BigInt(amount)*BigInt(w.minutes)%total}))
 let remaining=amount-rows.reduce((sum,w)=>sum+w.cents,0)
 const ranked=[...rows].sort((a,b)=>a.remainder===b.remainder?a.week.localeCompare(b.week):a.remainder>b.remainder?-1:1)
 for(const row of ranked){if(!remaining)break;row.cents++;remaining--}
 return rows
}
export function allocateWorkweekPayments(segments,rateBreakdown) {
 const weeks=new Map(),rates=new Set()
 for(const segment of segments) {
  if(!segment||!/^\d{4}-\d{2}-\d{2}$/.test(segment.week)||!safe(segment.hourlyRateCents)||!segment.hourlyRateCents||!safe(segment.regularMinutes)||!safe(segment.overtimeMinutes))throw new Error('Invalid workweek payment segment.')
  const week=weeks.get(segment.week)||{week:segment.week,workedMinutes:0,straightTimePayCents:0,premiumCents:0}
  week.workedMinutes+=segment.regularMinutes+segment.overtimeMinutes;if(week.workedMinutes>10080)throw new Error('Worked minutes exceed a seven-day workweek.');weeks.set(segment.week,week)
 }
 for(const rate of rateBreakdown) {
  if(!rate||!safe(rate.hourlyRateCents)||!rate.hourlyRateCents||rates.has(rate.hourlyRateCents)||!safe(rate.regularPayCents)||!safe(rate.overtimePayCents))throw new Error('Invalid or duplicate paid rate group.')
  rates.add(rate.hourlyRateCents)
  const eligible=segments.filter(s=>s.hourlyRateCents===rate.hourlyRateCents)
  const weights=key=>[...new Set(eligible.map(s=>s.week))].sort().map(week=>({week,minutes:eligible.filter(s=>s.week===week).reduce((sum,s)=>sum+s[key],0)}))
  const regular=weights('regularMinutes'),overtime=weights('overtimeMinutes')
  if(regular.reduce((n,w)=>n+w.minutes,0)!==rate.regularMinutes||overtime.reduce((n,w)=>n+w.minutes,0)!==rate.overtimeMinutes)throw new Error('Paid rate hours differ from the workweek segments.')
  const overtimeBase=rounded(BigInt(rate.hourlyRateCents)*BigInt(rate.overtimeMinutes),60n)
  const premium=rate.overtimePayCents-overtimeBase
  if(premium<0)throw new Error('Overtime pay is below its straight-time earnings.')
  for(const allocation of [...apportion(rate.regularPayCents,regular),...apportion(overtimeBase,overtime)])weeks.get(allocation.week).straightTimePayCents+=allocation.cents
  for(const allocation of apportion(premium,overtime))weeks.get(allocation.week).premiumCents+=allocation.cents
 }
 if(segments.some(s=>!rates.has(s.hourlyRateCents)))throw new Error('A workweek rate has no corresponding payment group.')
 if([...weeks.values()].some(w=>!safe(w.straightTimePayCents)||!safe(w.premiumCents)||!safe(w.straightTimePayCents+w.premiumCents)))throw new Error('Allocated workweek pay exceeds safe cent precision.')
 return [...weeks.values()].sort((a,b)=>a.week.localeCompare(b.week))
}

export function applyWeightedWorkweekPremiums(segments,rateBreakdown,settlements) {
 const workweekPayments=allocateWorkweekPayments(segments,rateBreakdown)
 const decisions=new Map()
 for(const settlement of settlements) {
  if(!settlement||decisions.has(settlement.week)||!['SETTLED','PREMIUM_DUE'].includes(settlement.status)||!safe(settlement.premiumDueCents)||settlement.premiumDueCents!==settlement.earnedPremiumThroughPeriodCents-settlement.previouslyPaidPremiumCents)throw new Error('Every workweek requires a verified payable settlement without duplicate weeks.')
  decisions.set(settlement.week,settlement)
 }
 if(!decisions.size||[...decisions.keys()].some(week=>!workweekPayments.some(w=>w.week===week)))throw new Error('Settlement weeks must match the current payroll workweeks.')
 const groups=new Map(rateBreakdown.map(rate=>[rate.hourlyRateCents,{...rate,overtimePremiumCents:rate.overtimePayCents-rounded(BigInt(rate.hourlyRateCents)*BigInt(rate.overtimeMinutes),60n)}]))
 const originalShares=new Map()
 for(const rate of groups.values()) {
  const weights=workweekPayments.map(w=>({week:w.week,minutes:segments.filter(s=>s.week===w.week&&s.hourlyRateCents===rate.hourlyRateCents).reduce((n,s)=>n+s.overtimeMinutes,0)}))
  for(const share of apportion(rate.overtimePremiumCents,weights))originalShares.set(`${rate.hourlyRateCents}:${share.week}`,share.cents)
 }
 for(const payment of workweekPayments) {
  const decision=decisions.get(payment.week)
  if(!decision)continue
  payment.weightedPremiumApplied=true
  const weights=[...groups.keys()].sort((a,b)=>a-b).map(rate=>({week:String(rate).padStart(16,'0'),rate,minutes:segments.filter(s=>s.week===payment.week&&s.hourlyRateCents===rate).reduce((n,s)=>n+s.overtimeMinutes,0)}))
  for(const share of apportion(decision.premiumDueCents,weights)) {
   const group=groups.get(share.rate),delta=share.cents-originalShares.get(`${share.rate}:${payment.week}`);group.overtimePayCents+=delta;group.overtimePremiumCents+=delta;group.overtimeMethod='WEIGHTED'
  }
  payment.premiumCents=decision.premiumDueCents
 }
 const updatedRates=[...groups.values()]
 const total=updatedRates.reduce((n,r)=>n+BigInt(r.regularPayCents)+BigInt(r.overtimePayCents),0n)
 if(total>BigInt(Number.MAX_SAFE_INTEGER)||total!==workweekPayments.reduce((n,w)=>n+BigInt(w.straightTimePayCents)+BigInt(w.premiumCents),0n))throw new Error('Weighted payment allocations do not reconcile safely.')
 return {rateBreakdown:updatedRates,workweekPayments,regularPayCents:updatedRates.reduce((n,r)=>n+r.regularPayCents,0),overtimePayCents:updatedRates.reduce((n,r)=>n+r.overtimePayCents,0)}
}
