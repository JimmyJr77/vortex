import {allocateEarnedBonus} from './earnedBonusAllocation.js'
const safe=n=>Number.isSafeInteger(n)&&n>0
export function reviewedDiscretionaryBonus(adjustment,payPeriodId){
 const r=adjustment.bonusReview
 if(!safe(adjustment.adjustmentId)||!safe(adjustment.amountCents)||!safe(payPeriodId)||adjustment.bonusPayPeriodId!==payPeriodId||!adjustment.taxTreatmentVerified||r?.version!==1||r.classification!=='DISCRETIONARY'||r.paymentType!=='ANNUAL_LUMP_SUM'||r.amountDiscretionVerified!==true||r.paymentDiscretionVerified!==true||r.noPriorPromiseVerified!==true||!r.verifiedAt||!Number.isFinite(Date.parse(r.verifiedAt))||String(r.source||'').trim().length<20)throw new Error('Allocated payroll requires a verified discretionary annual bonus with its original payment-period and review evidence.')
 return {version:1,adjustmentId:adjustment.adjustmentId,payPeriodId,amountCents:adjustment.amountCents,bonusReview:r}
}
export function paidSettlementBonuses(payment,review){
 const items=(payment.payItems||[]).filter(i=>i.kind==='BONUS')
 const records=items.map(item=>{
  const c=item.allocatedBonus
  if(![1,2].includes(c?.version)||c.amountCents!==item.amountCents||c.payPeriodId!==payment.payPeriodId)throw new Error('Prior bonus payments require retained classification and payment evidence.')
  return reviewedSettlementBonus({bonusAllocation:c.bonusAllocation,adjustmentId:c.adjustmentId,amountCents:c.amountCents,bonusPayPeriodId:c.payPeriodId,taxTreatmentVerified:true,bonusReview:c.bonusReview},c.payPeriodId)
 })
 if(new Set(records.map(r=>r.adjustmentId)).size!==records.length)throw new Error('Prior payroll contains duplicate bonus payment references.')
 verifyBonusOvertime(records,payment.payItems||[])
 for(const r of records){const week=r.bonusAllocation?.weeks.find(w=>w.week===review?.week);if(week&&(week.workedMinutes!==review.allocationReview?.calculation?.workedMinutes||week.overtimeEligible!==true))throw new Error('Paid bonus workweek hours or overtime treatment changed. Reconcile prior bonus premiums before settlement.')}
 const total=records.reduce((n,r)=>n+BigInt(r.amountCents)+BigInt(r.bonusAllocation?.additionalOvertimeCents||0),0n)
 if(total>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Paid bonus records exceed safe cent precision.')
 return {records,totalCents:Number(total)}
}

export function reviewedSettlementBonus(adjustment,payPeriodId){
 if(adjustment.bonusReview?.classification!=='NONDISCRETIONARY')return reviewedDiscretionaryBonus(adjustment,payPeriodId)
 const r=adjustment.bonusReview,a=adjustment.bonusAllocation
 if(!safe(adjustment.adjustmentId)||!safe(adjustment.amountCents)||!safe(payPeriodId)||adjustment.bonusPayPeriodId!==payPeriodId||!adjustment.taxTreatmentVerified||r.version!==1||r.paymentType!=='ANNUAL_LUMP_SUM'||!r.verifiedAt||!Number.isFinite(Date.parse(r.verifiedAt))||String(r.source||'').trim().length<20||r.allocationMethod!=='PROPORTIONAL_EARNED_HOURS'||r.allocationMethodVerified!==true||a?.version!==1||a.method!==r.allocationMethod||a.bonusCents!==adjustment.amountCents||a.earnedStart!==r.earnedStart||a.earnedEnd!==r.earnedEnd||a.fingerprint!==r.allocationFingerprint||!/^[a-f0-9]{64}$/.test(a.fingerprint||'')||a.coverage?.version!==1||(!Array.isArray(a.coverage.evidence)||!a.coverage.evidence.length))throw new Error('Retain the earned bonus allocation and reconciled underlying wage coverage before allocated settlement.')
 const calculated=allocateEarnedBonus(adjustment.amountCents,a.weeks)
 if(calculated.additionalOvertimeCents!==a.additionalOvertimeCents||calculated.weeks.some((w,i)=>['week','workedMinutes','earnedMinutes','overtimeEligible','overtimeMinutes','allocatedBonusCents','additionalOvertimeCents','allocationNumerator','allocationDenominator'].some(k=>w[k]!==a.weeks[i][k])))throw new Error('Earned bonus cents or overtime no longer reconcile to their workweek allocation.')
 return {version:2,adjustmentId:adjustment.adjustmentId,payPeriodId,amountCents:adjustment.amountCents,bonusReview:r,bonusAllocation:a}
}
export function verifyBonusOvertime(records,items){
 const overtime=items.filter(i=>i.kind==='BONUS_OVERTIME'),used=new Set()
 for(const record of records){
  const amount=record.bonusAllocation?.additionalOvertimeCents||0
  const matches=overtime.filter(i=>i.bonusAdjustmentId===record.adjustmentId)
  if(amount===0&&matches.length||amount>0&&(matches.length!==1||matches[0].amountCents!==amount))throw new Error('Earned bonus overtime must match its reviewed bonus exactly once.')
  matches.forEach(i=>used.add(i))
 }
 if(used.size!==overtime.length)throw new Error('Payroll contains bonus overtime without a matching reviewed bonus.')
}
