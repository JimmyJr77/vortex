import {allocationCorrectionPayment} from './allocationCorrectionPayment.js'
import {paidSettlementBonuses} from './settlementBonusCoverage.js'
import {paidSettlementLeave} from './settlementLeaveCoverage.js'
import {nativeAllocationCoverage} from './nativeAllocationCoverage.js'
import {createHash} from 'node:crypto'
import {compensationEvidence} from './employmentCompensation.js'
const safe=n=>Number.isSafeInteger(n)&&n>=0
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s
const end=s=>new Date(Date.parse(s+'T00:00:00Z')+6*86400000).toISOString().slice(0,10)

// Reconcile stored evidence only. Completeness attestation and settlement
// authorization remain separate; an empty ledger does not prove no prior pay.
export function reconcileAllocationPayments(review){
 const issues=[],paid=[],seen=new Set()
 const allocation=review.allocationReview
 if(allocation?.status!=='CURRENT')issues.push('Retain an allocation matching current earnings before reconciling payments.')
 for(const originalPayment of review.payments||[]){
  let payment=originalPayment
  if(!safe(payment.runId)||!payment.runId||seen.has(payment.runId)){issues.push('Payment history contains an invalid or duplicate run reference.');continue}
  seen.add(payment.runId)
  if(payment.status!=='FINALIZED'){issues.push(`Run ${payment.runId} is committed but not finalized. Resolve it before settlement.`);continue}
  if(payment.runKind&&payment.runKind!=='REGULAR'){issues.push(`Run ${payment.runId} has supplemental payments requiring workweek allocation review.`);continue}
  let records=payment.workweekPayments
  let valid=payment.workweekPaymentVersion===1&&Array.isArray(records)&&validDay(payment.periodStart)&&validDay(payment.periodEnd)
  valid=valid&&[payment.regularMinutes,payment.overtimeMinutes,payment.regularPayCents,payment.overtimePayCents,payment.otherTaxablePayCents].every(safe)
  if(valid)valid=records.every(w=>w&&validDay(w.week)&&safe(w.workedMinutes)&&w.workedMinutes<=10080&&safe(w.straightTimePayCents)&&safe(w.premiumCents)&&w.week<=payment.periodEnd&&end(w.week)>=payment.periodStart)&&new Set(records.map(w=>w.week)).size===records.length
  if(valid)valid=records.reduce((n,w)=>n+BigInt(w.workedMinutes),0n)===BigInt(payment.regularMinutes)+BigInt(payment.overtimeMinutes)&&records.reduce((n,w)=>n+BigInt(w.straightTimePayCents)+BigInt(w.premiumCents),0n)===BigInt(payment.regularPayCents)+BigInt(payment.overtimePayCents)
  if(!valid){issues.push(`Finalized run ${payment.runId} lacks reconciled workweek payment records.`);continue}
  try{payment=allocationCorrectionPayment(payment);records=payment.workweekPayments}catch(error){issues.push(error.message);continue}
  let leaveCoverage=[],bonusPayments=[]
  try{const bonus=paidSettlementBonuses(payment,review);bonusPayments=bonus.records;leaveCoverage=paidSettlementLeave({...payment,otherTaxablePayCents:payment.otherTaxablePayCents-bonus.totalCents},review)}catch(error){issues.push(error.message)}
  const record=records.find(w=>w.week===review.week)
  let datedCoverage=record?.coverage,coverageSource=datedCoverage?'RETAINED_PAYMENT':null
  if(record&&!datedCoverage&&allocation?.coverage?.version===1)try{datedCoverage=nativeAllocationCoverage(payment,record,allocation.coverage);coverageSource=payment.correctionSettlementIds?.length?'CORRECTED_NATIVE_HOURLY':'FROZEN_NATIVE_HOURLY'}catch(error){issues.push(error.message)}
  if(record)paid.push({runId:payment.runId,...(payment.correctionSettlementIds?.length?{correctionSettlementIds:payment.correctionSettlementIds}:{}),...(payment.correctionPaymentExclusions?.length?{correctionPaymentExclusions:payment.correctionPaymentExclusions}:{}),paidLeaveEntries:leaveCoverage,bonusPayments,week:record.week,workedMinutes:record.workedMinutes,straightTimePayCents:record.straightTimePayCents,premiumCents:record.premiumCents,...(datedCoverage?{coverage:datedCoverage,coverageSource,periodStart:payment.periodStart,periodEnd:payment.periodEnd}:{})})
 }
 const importedSeen=new Set()
 for(const p of review.historicalPayments||[]){
  const retained=p.allocationReview,record=retained?.weeks?.find(w=>w.week===review.week)
  if(!safe(p.id)||!p.id||importedSeen.has(p.id)){issues.push('Imported payment history contains an invalid or duplicate reference.');continue}
  importedSeen.add(p.id)
  if(retained?.status!=='CURRENT'||!record||record.allocationFingerprint!==allocation?.fingerprint){issues.push(`Historical payment ${p.id} requires documented workweek earnings and premium reconciliation.`);issues.push(...(retained?.issues||[]));continue}
  paid.push({historicalPaymentId:p.id,importedReviewId:retained.reviewId,week:record.week,workedMinutes:record.workedMinutes,straightTimePayCents:record.straightTimePayCents,premiumCents:record.premiumCents,coverage:record.coverage,coverageSource:'RETAINED_IMPORTED_WAGES',periodStart:p.periodStart,periodEnd:p.periodEnd})
 }
 const bonusIds=paid.flatMap(p=>(p.bonusPayments||[]).map(b=>b.adjustmentId))
 if(new Set(bonusIds).size!==bonusIds.length)issues.push('Multiple payroll records claim the same bonus. Resolve duplicate payment evidence before settlement.')
 const leaveIds=paid.flatMap(p=>(p.paidLeaveEntries||[]).map(l=>l.id))
 if(new Set(leaveIds).size!==leaveIds.length)issues.push('Multiple payroll records cover the same paid leave. Resolve duplicate payment evidence before settlement.')
 const total=field=>paid.reduce((n,w)=>n+BigInt(w[field]),0n)
 const amounts=[total('workedMinutes'),total('straightTimePayCents'),total('premiumCents')]
 if(amounts.some(n=>n>BigInt(Number.MAX_SAFE_INTEGER)))issues.push('Payment history exceeds safe whole-number precision.')
 const totals=amounts.every(n=>n<=BigInt(Number.MAX_SAFE_INTEGER))?{workedMinutes:Number(amounts[0]),straightTimePayCents:Number(amounts[1]),premiumCents:Number(amounts[2])}:null
 const earned=allocation?.status==='CURRENT'?allocation.calculation:null
 if(earned&&totals&&totals.workedMinutes>earned.workedMinutes)issues.push('Paid workweek hours exceed the currently reviewed hours.')
 const differences=earned&&totals?{straightTimeCents:earned.straightTimePayCents-totals.straightTimePayCents,premiumCents:earned.overtimePremiumCents-totals.premiumCents}:null
 if(differences&&(differences.straightTimeCents<0||differences.premiumCents<0))issues.push('Previously paid earnings or premiums exceed reviewed earnings; resolve the difference without an automatic deduction.')
 const fingerprint=createHash('sha256').update(JSON.stringify(compensationEvidence({version:1,employeeId:review.employeeId,week:review.week,allocationFingerprint:allocation?.fingerprint,payments:review.payments,historicalPayments:review.historicalPayments}))).digest('hex')
 return {version:1,status:issues.length?'REVIEW_REQUIRED':'EVIDENCE_RECONCILED',fingerprint,paid,totals,differences,issues,paymentApplied:false,historyCompletenessVerified:false}
}
