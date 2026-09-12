import {reviewedSettlementBonus,verifyBonusOvertime} from './settlementBonusCoverage.js'
import {currentSettlementLeave} from './settlementLeaveCoverage.js'
import {compensationEvidence} from './employmentCompensation.js'
const day=value=>new Date(value).toISOString().slice(0,10)
const nextWeek=value=>new Date(Date.parse(value+'T00:00:00Z')+7*86400000).toISOString().slice(0,10)
const safe=n=>Number.isSafeInteger(n)&&n>=0
const key=e=>`${e.id}/${e.workDate}`
const same=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))

export function authorizedSettlementEarnings({reviews,entries,payPeriod,adjustments,minutesFor}){
 if(!reviews?.some(r=>r.settlementAuthorization?.status==='CURRENT'))return null
 const ordered=[...reviews].sort((a,b)=>a.week.localeCompare(b.week))
 const start=payPeriod?day(payPeriod.period_start):'',end=payPeriod?day(payPeriod.period_end):''
 if(!payPeriod||start<ordered[0].week||start>ordered[0].end||end<ordered.at(-1).week||end>ordered.at(-1).end||ordered.some((r,i)=>i>0&&r.week!==nextWeek(ordered[i-1].week)))throw new Error('Authorized allocations must cover every workweek touched by this payroll period.')
 if(adjustments.some(a=>!['BONUS_OVERTIME','BONUS','PAID_LEAVE','REIMBURSEMENT','PRETAX_DEDUCTION','POSTTAX_DEDUCTION','GARNISHMENT'].includes(a.kind)))throw new Error('Reconcile paid leave and additional taxable earnings before applying these workweek allocations.')
 const bonusPayments=adjustments.filter(a=>a.kind==='BONUS').map(a=>reviewedSettlementBonus(a,Number(payPeriod.id)))
 verifyBonusOvertime(bonusPayments,adjustments)
 if(adjustments.some(a=>a.kind==='BONUS_OVERTIME'&&!a.taxTreatmentVerified))throw new Error('Verify the bonus overtime tax treatment before settlement.')
 if(new Set(bonusPayments.map(b=>b.adjustmentId)).size!==bonusPayments.length)throw new Error('Payroll contains duplicate bonus adjustments.')
 const payments=[],evidence=[],selected=[],leaveEntries=[],seen=new Set()
 for(const review of ordered){
  const authorization=review.settlementAuthorization,reconciliation=review.paymentReconciliation,calculation=review.allocationReview?.calculation,coverage=review.allocationReview?.coverage
  if(authorization?.status!=='CURRENT'||authorization.historyCompletenessVerified!==true||reconciliation?.status!=='EVIDENCE_RECONCILED'||authorization.fingerprint!==reconciliation.fingerprint||review.allocationReview?.status!=='CURRENT')throw new Error('Every workweek requires current authorized earnings and reconciled payment evidence.')
  if(!calculation||![calculation.workedMinutes,calculation.overtimeMinutes,calculation.straightTimePayCents,calculation.overtimePremiumCents].every(safe)||calculation.overtimeMinutes!==Math.max(0,calculation.workedMinutes-2400)||coverage?.version!==1||!Array.isArray(coverage.entries))throw new Error('Recalculate the allocation with dated payment coverage before settling payroll.')
  for(const [total,field] of [['workedMinutes','workedMinutes'],['straightTimePayCents','straightTimePayCents'],['premiumCents','premiumCents']])if(!reconciliation.totals||reconciliation.paid.reduce((n,p)=>n+p[field],0)!==reconciliation.totals[total])throw new Error('Paid workweek totals do not match their payment records.')
  if(coverage.entries.length!==review.time.length||new Set(coverage.entries.map(key)).size!==coverage.entries.length||coverage.entries.reduce((n,e)=>n+e.minutes,0)!==calculation.workedMinutes||coverage.entries.reduce((n,e)=>n+e.straightTimePayCents,0)!==calculation.straightTimePayCents||coverage.entries.reduce((n,e)=>n+e.premiumCents,0)!==calculation.overtimePremiumCents)throw new Error('Dated coverage does not reconcile to the reviewed workweek.')
  const covered=new Set()
  for(const paid of reconciliation.paid){
   if(paid.coverage?.version!==1||!Array.isArray(paid.coverage.entries)||paid.coverage.method!==coverage.method)throw new Error('Previously paid workweek portions need matching dated earnings coverage before settlement.')
   let minutes=0,straight=0,premium=0
   for(const entry of paid.coverage.entries){
    const original=coverage.entries.find(e=>key(e)===key(entry))
    if(!original||!same(original,entry)||covered.has(key(entry))||entry.workDate>=start||entry.workDate<paid.periodStart||entry.workDate>paid.periodEnd)throw new Error('Previously paid time or earnings no longer match the current workweek coverage.')
    covered.add(key(entry));minutes+=entry.minutes;straight+=entry.straightTimePayCents;premium+=entry.premiumCents
   }
   if(minutes!==paid.workedMinutes||straight!==paid.straightTimePayCents||premium!==paid.premiumCents)throw new Error('Prior payment coverage does not reconcile to its paid hours and earnings.')
  }
  if(coverage.entries.some(e=>e.workDate<start&&!covered.has(key(e))))throw new Error('Settle the earlier payroll portion of this workweek before paying the selected period.')
  const current=coverage.entries.filter(e=>e.workDate>=start&&e.workDate<=end)
  for(const original of current){
   const matches=entries.filter(e=>key(e)===key(original)),entry=matches[0]
   if(matches.length!==1||seen.has(key(original))||entry.status!=='APPROVED'||minutesFor(entry)!==original.minutes||new Date(original.clockIn).valueOf()!==new Date(entry.clockIn).valueOf()||new Date(original.clockOut).valueOf()!==new Date(entry.clockOut).valueOf())throw new Error('Payroll time no longer matches the authorized dated workweek coverage.')
   seen.add(key(original));selected.push({...entry,minutes:original.minutes,regularMinutes:original.regularMinutes,overtimeMinutes:original.overtimeMinutes,workweekStart:review.week})
  }
  const sumCurrent=k=>current.reduce((n,e)=>n+e[k],0)
  const workedMinutes=sumCurrent('minutes'),overtimeMinutes=sumCurrent('overtimeMinutes'),straightTimePayCents=sumCurrent('straightTimePayCents'),premiumCents=sumCurrent('premiumCents')
  if(straightTimePayCents>reconciliation.differences.straightTimeCents||premiumCents>reconciliation.differences.premiumCents)throw new Error('Selected earnings exceed the authorized unpaid balance.')
  const leave=currentSettlementLeave(review,start,end,adjustments);leaveEntries.push(...leave)
  payments.push({leaveCoverage:{version:1,entries:leave},week:review.week,workedMinutes,straightTimePayCents,premiumCents,coverage:{...coverage,entries:current}})
  evidence.push({...calculation,week:review.week,end:review.end,periodStart:start>review.week?start:review.week,periodEnd:end<review.end?end:review.end,authorizationId:authorization.id,allocationReviewId:review.allocationReview.id,fingerprint:authorization.fingerprint,fullWorkweekCalculation:calculation,workedMinutes,overtimeMinutes,straightTimePayCents,overtimePremiumCents:premiumCents,totalPayCents:straightTimePayCents+premiumCents,priorRunIds:reconciliation.paid.filter(p=>p.runId).map(p=>p.runId),priorHistoricalPaymentIds:reconciliation.paid.filter(p=>p.historicalPaymentId).map(p=>p.historicalPaymentId)})
 }
 if(new Set(leaveEntries.map(e=>e.id)).size!==leaveEntries.length||leaveEntries.length!==adjustments.filter(a=>a.kind==='PAID_LEAVE').length)throw new Error('Payroll includes leave outside the authorized allocation.')
 if(seen.size!==entries.length)throw new Error('Payroll includes work outside the authorized allocations.')
 const sum=key=>{const value=evidence.reduce((n,e)=>n+BigInt(e[key]),0n);if(value>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Authorized earnings exceed safe whole-number precision.');return Number(value)}
 if(BigInt(sum('straightTimePayCents'))+BigInt(sum('overtimePremiumCents'))>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Authorized total earnings exceed safe cent precision.')
 return {version:4,bonusPayments,leaveEntries,evidence,entries:selected,workweekPayments:payments,regularPayCents:sum('straightTimePayCents'),overtimePayCents:sum('overtimePremiumCents'),regularMinutes:sum('workedMinutes')-sum('overtimeMinutes'),overtimeMinutes:sum('overtimeMinutes'),leaveBasisMinutes:sum('workedMinutes')}
}
