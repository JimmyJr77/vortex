const safe=n=>Number.isSafeInteger(n)&&n>=0
const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s
const fail=()=>{throw Object.assign(new Error('Retained correction workweek amounts do not reconcile to reviewed wages and hours.'),{status:409})}
const totals=(records,key)=>records.reduce((n,r)=>n+BigInt(r[key]),0n)

// These are retained engine results, not a new allocation inferred from current
// timesheets. Preserve exact rounding and weighted-premium decisions.
export function correctionWorkweekCoverage(change,settlementId){
 if(change.workweekPaymentVersion!==1||!Number.isSafeInteger(settlementId)||settlementId<=0||!day(change.periodStart)||!day(change.periodEnd)||change.periodStart>change.periodEnd)fail()
 const sides=[['before','originalWorkweekPayments','originalEntries'],['after','proposedWorkweekPayments','proposedEntries']]
 for(const [side,recordsKey,entriesKey] of sides){
  const state=change[side],records=change[recordsKey],entries=change[entriesKey]
  if(!state||!Array.isArray(records)||!Array.isArray(entries)||!['regularMinutes','overtimeMinutes','regularPayCents','overtimePayCents'].every(k=>safe(state[k])))fail()
  if(!safe(state.regularPayCents+state.overtimePayCents))fail()
  if(records.some(r=>!r||!day(r.week)||r.week>change.periodEnd||new Date(Date.parse(r.week)+6*86400000).toISOString().slice(0,10)<change.periodStart||!safe(r.workedMinutes)||r.workedMinutes>10080||!safe(r.straightTimePayCents)||!safe(r.premiumCents))||new Set(records.map(r=>r.week)).size!==records.length)fail()
  if(entries.some(e=>!day(e.workDate)||e.workDate<change.periodStart||e.workDate>change.periodEnd||!day(e.workweekStart)||e.workDate<e.workweekStart||e.workDate>new Date(Date.parse(e.workweekStart)+6*86400000).toISOString().slice(0,10)||!safe(e.minutes)||!safe(e.regularMinutes)||!safe(e.overtimeMinutes)||e.minutes!==e.regularMinutes+e.overtimeMinutes))fail()
  if(totals(entries,'regularMinutes')!==BigInt(state.regularMinutes)||totals(entries,'overtimeMinutes')!==BigInt(state.overtimeMinutes))fail()
  if(totals(records,'workedMinutes')!==BigInt(state.regularMinutes)+BigInt(state.overtimeMinutes)||totals(records,'straightTimePayCents')+totals(records,'premiumCents')!==BigInt(state.regularPayCents)+BigInt(state.overtimePayCents))fail()
  if(entries.some(e=>!records.some(r=>r.week===e.workweekStart))||records.some(r=>entries.filter(e=>e.workweekStart===r.week).reduce((n,e)=>n+e.minutes,0)!==r.workedMinutes))fail()
 }
 for(const field of ['regularMinutes','overtimeMinutes','regularPayCents','overtimePayCents'])if(change.delta[field]!==change.after[field]-change.before[field])fail()
 if(change.delta.workedWagesCents!==change.delta.regularPayCents+change.delta.overtimePayCents)fail()
 const weeks=[...new Set([...change.originalWorkweekPayments,...change.proposedWorkweekPayments].map(r=>r.week))].sort()
 const deltas=weeks.map(week=>{
  const before=change.originalWorkweekPayments.find(r=>r.week===week)||{workedMinutes:0,straightTimePayCents:0,premiumCents:0},after=change.proposedWorkweekPayments.find(r=>r.week===week)||{workedMinutes:0,straightTimePayCents:0,premiumCents:0}
  return {week,workedMinutes:after.workedMinutes-before.workedMinutes,straightTimePayCents:after.straightTimePayCents-before.straightTimePayCents,premiumCents:after.premiumCents-before.premiumCents}
 })
 return structuredClone({version:1,settlementId,runId:change.runId,original:change.originalWorkweekPayments,corrected:change.proposedWorkweekPayments,deltas})
}
