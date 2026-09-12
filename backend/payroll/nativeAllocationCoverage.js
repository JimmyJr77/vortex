const safe=n=>Number.isSafeInteger(n)&&n>=0
const key=e=>`${e.id}/${e.workDate}`
const instant=value=>value?new Date(value).valueOf():NaN

// Recover dated coverage from an immutable native hourly calculation, never
// from today's timesheet alone. Credit only when saved paid totals agree.
export function nativeAllocationCoverage(payment,record,coverage){
 const frozen=payment.frozenCalculation
 if(!frozen||frozen.payType!=='HOURLY'||!Array.isArray(frozen.entries))throw new Error(`Run ${payment.runId} needs a retained native hourly calculation to recover dated payment coverage.`)
 for(const [field,total] of [['regularMinutes','regularMinutes'],['overtimeMinutes','overtimeMinutes'],['regularPayCents','regularPayCents'],['overtimePayCents','overtimePayCents']])if(!safe(frozen[field])||frozen[field]!==payment[total])throw new Error(`Run ${payment.runId} has inconsistent frozen payroll totals.`)
 const all=frozen.entries
 if(all.some(e=>!e||!safe(e.minutes)||!safe(e.regularMinutes)||!safe(e.overtimeMinutes)||e.minutes!==e.regularMinutes+e.overtimeMinutes||e.status!=='APPROVED'||e.workDate<payment.periodStart||e.workDate>payment.periodEnd)||new Set(all.map(key)).size!==all.length||all.reduce((n,e)=>n+e.regularMinutes,0)!==payment.regularMinutes||all.reduce((n,e)=>n+e.overtimeMinutes,0)!==payment.overtimeMinutes)throw new Error(`Run ${payment.runId} has incomplete or duplicate frozen time coverage.`)
 const selected=all.filter(e=>e.workweekStart===record.week),entries=[]
 for(const entry of selected){
  const current=coverage.entries.find(e=>key(e)===key(entry))
  if(!current||!Number.isFinite(instant(entry.clockIn))||!Number.isFinite(instant(entry.clockOut))||instant(current.clockIn)!==instant(entry.clockIn)||instant(current.clockOut)!==instant(entry.clockOut)||entry.minutes!==current.minutes||entry.regularMinutes!==current.regularMinutes||entry.overtimeMinutes!==current.overtimeMinutes)throw new Error(`Run ${payment.runId} paid time that differs from current workweek coverage.`)
  entries.push({...current})
 }
 if(entries.reduce((n,e)=>n+e.minutes,0)!==record.workedMinutes||entries.reduce((n,e)=>n+e.straightTimePayCents,0)!==record.straightTimePayCents||entries.reduce((n,e)=>n+e.premiumCents,0)!==record.premiumCents)throw new Error(`Run ${payment.runId} paid earnings that differ from current dated allocation shares.`)
 return {version:1,method:coverage.method,entries}
}
