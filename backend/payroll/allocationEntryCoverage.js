const safe=n=>Number.isSafeInteger(n)&&n>=0
// Distribute whole cents by largest fractional remainder. Equal remainders
// use chronological order, making every period's share reproducible.
function distribute(rows,amount){
 if(!safe(amount))throw new Error('Allocation shares require safe nonnegative whole cents.')
 const shares=rows.map((r,index)=>({index,cents:Number(r.n/r.d),remainder:r.n%r.d,denominator:r.d}))
 let remaining=amount-shares.reduce((n,r)=>n+r.cents,0)
 if(remaining<0||remaining>rows.length)throw new Error('Allocated entry fractions do not reconcile to the reviewed earnings.')
 const ranked=[...shares].sort((a,b)=>{const left=a.remainder*b.denominator,right=b.remainder*a.denominator;return left===right?a.index-b.index:left>right?-1:1})
 for(const row of ranked){if(!remaining)break;row.cents++;remaining--}
 return shares.map(r=>r.cents)
}
export function allocationEntryCoverage(review,inputs,calculation){
 const time=[...review.time].sort((a,b)=>new Date(a.clockIn)-new Date(b.clockIn)||a.workDate.localeCompare(b.workDate)||a.id-b.id)
 const keys=time.map(e=>`${e.id}/${e.workDate}`)
 if(new Set(keys).size!==keys.length)throw new Error('Each dated time segment must appear once in allocation coverage.')
 let running=0
 const coverage=time.map(e=>{
  if(!safe(e.minutes)||e.status!=='APPROVED')throw new Error('Complete and approve allocation time before assigning payroll coverage.')
  const overtimeMinutes=Math.max(0,running+e.minutes-2400)-Math.max(0,running-2400);running+=e.minutes
  return {id:e.id,workDate:e.workDate,clockIn:e.clockIn,clockOut:e.clockOut,minutes:e.minutes,regularMinutes:e.minutes-overtimeMinutes,overtimeMinutes,straightTimePayCents:0,premiumCents:0}
 })
 const hourly=[],used=new Set()
 let salaryTotal=0
 for(const input of inputs){
  const indices=coverage.map((e,i)=>({e,i})).filter(({e})=>e.workDate>=input.start&&e.workDate<=input.end)
  if(indices.reduce((n,{e})=>n+e.minutes,0)!==input.minutes)throw new Error('Agreement hours do not match allocation coverage.')
  for(const {i} of indices){if(used.has(i))throw new Error('Allocation coverage agreements overlap.');used.add(i)}
  if(input.payType==='SALARY'){
   salaryTotal+=input.earningsCents
   const shares=distribute(indices.map(({e})=>({n:BigInt(input.earningsCents)*BigInt(e.minutes),d:BigInt(input.minutes||1)})),input.earningsCents)
   indices.forEach(({i},index)=>{coverage[i].straightTimePayCents=shares[index]})
  }else for(const {e,i} of indices)hourly.push({i,n:BigInt(input.hourlyRateCents)*BigInt(e.minutes),d:60n})
 }
 if(used.size!==coverage.length||running!==calculation.workedMinutes)throw new Error('Allocation coverage must include all reviewed workweek time.')
 hourly.sort((a,b)=>a.i-b.i)
 const hourlyShares=distribute(hourly,calculation.straightTimePayCents-salaryTotal)
 hourly.forEach(({i},index)=>{coverage[i].straightTimePayCents=hourlyShares[index]})
 const premiums=distribute(coverage.map(e=>({n:BigInt(calculation.overtimePremiumCents)*BigInt(e.overtimeMinutes),d:BigInt(calculation.overtimeMinutes||1)})),calculation.overtimePremiumCents)
 coverage.forEach((e,i)=>{e.premiumCents=premiums[i]})
 return {version:1,method:'SALARY_BY_AGREEMENT_WORKED_MINUTES_PREMIUM_BY_OVERTIME_MINUTES',entries:coverage}
}
