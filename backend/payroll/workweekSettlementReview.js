import {settleWeightedHourlyWeek} from './weightedOvertime.js'
export function reviewWorkweekSettlements(employee,priorSegmentsByWeek,today) {
 return employee.workweekEarnings.map(observed=>{
  const week=observed.week,history=employee.workweekPaidHistory.find(w=>w.week===week)
  const current=employee.entries.filter(e=>e.workweekStart===week)
  const following=employee.followingWorkweekEntries.filter(e=>e.week===week)
  const prior=priorSegmentsByWeek[week]??[]
  const requiresWeighted=new Set([...prior.map(e=>e.hourlyRateCents),...current.map(e=>e.hourlyRateCents??employee.hourlyRateCents),...following.map(e=>e.hourlyRateCents)]).size>1
  const issues=[...(history?.issues??[])]
  if(current.some(e=>e.status!=='APPROVED')||following.some(e=>e.status!=='APPROVED'||e.minutes===null||e.ambiguousBreak))issues.push('Complete and approve all workweek time before settling its weighted premium.')
  if(issues.length)return {week,requiresWeighted,status:'CONTEXT_REVIEW_REQUIRED',issues,premiumDueCents:0}
  const segments=[...prior,...current.map(e=>({minutes:e.minutes,hourlyRateCents:e.hourlyRateCents??employee.hourlyRateCents})),...following.map(e=>({minutes:e.minutes,hourlyRateCents:e.hourlyRateCents}))]
  const minutesThroughPeriod=prior.reduce((n,e)=>n+e.minutes,0)+current.reduce((n,e)=>n+e.minutes,0)
  const end=new Date(Date.parse(week+'T00:00:00Z')+6*86400000).toISOString().slice(0,10)
  try{return {week,requiresWeighted,issues,appliedToPayroll:false,...settleWeightedHourlyWeek({segments,priorPremiums:history?.premiums??[],historyVerified:history?.historyVerified===true,workweekClosed:end<today,payableOvertimeMinutes:Math.max(0,minutesThroughPeriod-2400)})}}
  catch(error){return {week,requiresWeighted,status:'CONTEXT_REVIEW_REQUIRED',issues:[error.message],premiumDueCents:0}}
 })
}
