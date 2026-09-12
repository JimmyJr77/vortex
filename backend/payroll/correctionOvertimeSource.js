const safe=n=>Number.isSafeInteger(n)&&n>=0
export function correctionPremiumEvidence(runs,workedWagesDifferenceCents){
 const evidence={version:1,status:'REVIEW_REQUIRED',premiumCents:null,workedWagesDifferenceCents,runs:[]}
 try{
  if(!Array.isArray(runs)||!runs.length||!safe(workedWagesDifferenceCents))throw new Error()
  const ids=new Set();let wages=0,premium=0
  for(const run of runs){
   if(!safe(run.runId)||!run.runId||ids.has(run.runId)||run.workweekPaymentVersion!==1)throw new Error();ids.add(run.runId)
   const totals=(weeks,amounts)=>{
    if(!Array.isArray(weeks)||!amounts||!safe(amounts.regularPayCents)||!safe(amounts.overtimePayCents))throw new Error()
    let total=0,premium=0;const seen=new Set()
    for(const week of weeks){if(!/^\d{4}-\d{2}-\d{2}$/.test(week.week)||seen.has(week.week)||!safe(week.straightTimePayCents)||!safe(week.premiumCents))throw new Error();seen.add(week.week);total+=week.straightTimePayCents+week.premiumCents;premium+=week.premiumCents}
    if(!safe(total)||!safe(premium)||total!==amounts.regularPayCents+amounts.overtimePayCents)throw new Error()
    return {total,premium}
   }
   const before=totals(run.originalWorkweekPayments,run.before),after=totals(run.proposedWorkweekPayments,run.after),wageDifference=after.total-before.total,premiumDifference=after.premium-before.premium
   if(!safe(wageDifference)||!safe(premiumDifference)||premiumDifference>wageDifference)throw new Error()
   wages+=wageDifference;premium+=premiumDifference
   evidence.runs.push({runId:run.runId,workweekPaymentVersion:1,before:{regularPayCents:run.before.regularPayCents,overtimePayCents:run.before.overtimePayCents},after:{regularPayCents:run.after.regularPayCents,overtimePayCents:run.after.overtimePayCents},originalWorkweekPayments:structuredClone(run.originalWorkweekPayments),proposedWorkweekPayments:structuredClone(run.proposedWorkweekPayments)})
  }
  if(!safe(wages)||!safe(premium)||wages!==workedWagesDifferenceCents)throw new Error()
  return {...evidence,status:'RECONCILED',premiumCents:premium}
 }catch{return {...evidence,runs:[]}}
}
