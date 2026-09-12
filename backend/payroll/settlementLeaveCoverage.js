import {compensationEvidence} from './employmentCompensation.js'
const same=(a,b)=>JSON.stringify(compensationEvidence(a))===JSON.stringify(compensationEvidence(b))
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s
const safe=n=>Number.isSafeInteger(n)&&n>=0
export function paidSettlementLeave(payment,review){
 for(const w of payment.workweekPayments||[])if(w.leaveCoverage&&(w.leaveCoverage.version!==1||!Array.isArray(w.leaveCoverage.entries)||w.leaveCoverage.entries.some(e=>!e||!validDay(e.leaveDate)||e.leaveDate<w.week||e.leaveDate>new Date(Date.parse(w.week)+6*86400000).toISOString().slice(0,10))))throw new Error('Paid leave coverage must belong to its recorded workweek.')
 const rows=(payment.workweekPayments||[]).flatMap(w=>w.leaveCoverage?.entries||[])
 if(!rows.length){if(payment.otherTaxablePayCents||payment.paidLeaveCents||payment.paidLeaveMinutes)throw new Error(`Run ${payment.runId} has other taxable earnings requiring allocation review.`);return []}
 if(!safe(payment.paidLeaveCents)||!safe(payment.paidLeaveMinutes)||payment.otherTaxablePayCents!==payment.paidLeaveCents)throw new Error('Paid leave does not reconcile to the recorded additional taxable earnings.')
 if(new Set(rows.map(e=>e.id)).size!==rows.length||rows.some(e=>!safe(e.id)||!e.id||!safe(e.minutes)||!safe(e.amountCents)||e.leaveDate<payment.periodStart||e.leaveDate>payment.periodEnd))throw new Error('Paid leave coverage contains invalid or duplicate dated records.')
 if(rows.reduce((n,e)=>n+BigInt(e.amountCents),0n)!==BigInt(payment.paidLeaveCents)||rows.reduce((n,e)=>n+BigInt(e.minutes),0n)!==BigInt(payment.paidLeaveMinutes))throw new Error('Paid leave coverage does not match paid amounts and hours.')
 const record=payment.workweekPayments.find(w=>w.week===review.week),selected=record?.leaveCoverage?.entries||[]
 if(selected.length&&record.leaveCoverage.version!==1)throw new Error('Reconcile the paid leave coverage version before settlement.')
 for(const entry of selected){const current=review.allocationReview?.leaveEarnings?.entries.find(e=>e.id===entry.id);if(!current||!same(current,entry))throw new Error('Previously paid leave no longer matches the retained dated leave allocation.')}
 return selected
}
export function currentSettlementLeave(review,start,end,adjustments){
 const entries=review.allocationReview?.leaveEarnings?.entries||[],paid=new Set()
 for(const payment of review.paymentReconciliation.paid)for(const entry of payment.paidLeaveEntries||[]){
  const current=entries.find(e=>e.id===entry.id)
  if(!current||!same(current,entry)||paid.has(entry.id)||entry.leaveDate>=start)throw new Error('Previously paid leave overlaps this payroll or no longer matches current evidence.')
  paid.add(entry.id)
 }
 if(entries.some(e=>e.leaveDate<start&&!paid.has(e.id)))throw new Error('Settle earlier dated leave before paying this payroll portion.')
 const selected=entries.filter(e=>e.leaveDate>=start&&e.leaveDate<=end)
 for(const entry of selected){
  const matches=adjustments.filter(a=>a.kind==='PAID_LEAVE'&&a.leaveId===entry.id)
  if(matches.length!==1||matches[0].leaveDate!==entry.leaveDate||matches[0].minutes!==entry.minutes||matches[0].sourceRequestId!==entry.requestId||!matches[0].taxTreatmentVerified)throw new Error('Payroll leave no longer matches the authorized dated leave evidence.')
 }
 return selected
}
