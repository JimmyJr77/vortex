import {reconcileAllocationPayments} from '../allocationPaymentReconciliation.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {paidSettlementLeave,currentSettlementLeave} from '../settlementLeaveCoverage.js'
const fixture=()=>{
 const entry={id:1,requestId:2,leaveDate:'2026-08-04',minutes:60,amountCents:2500,includedInSalary:false}
 return {entry,review:{week:'2026-08-03',allocationReview:{leaveEarnings:{entries:[entry]}},paymentReconciliation:{paid:[]}},payment:{runId:1,periodStart:'2026-08-03',periodEnd:'2026-08-05',paidLeaveCents:2500,paidLeaveMinutes:60,otherTaxablePayCents:2500,workweekPayments:[{week:'2026-08-03',leaveCoverage:{version:1,entries:[entry]}}]}}
}
test('paid leave requires matching whole-payment totals and current dated evidence',()=>{
 const f=fixture();assert.deepEqual(paidSettlementLeave(f.payment,f.review),[f.entry])
 for(const mutate of [
  f=>f.payment.paidLeaveCents=2499,
  f=>f.payment.paidLeaveMinutes=61,
  f=>f.payment.otherTaxablePayCents=3000,
  f=>f.payment.workweekPayments[0].leaveCoverage.version=2,
  f=>f.payment.workweekPayments[0].leaveCoverage.entries.push({...f.entry}),
  f=>f.payment.workweekPayments[0].week='2026-08-10',
  f=>f.review.allocationReview.leaveEarnings.entries=[{...f.entry,amountCents:2600}],
  f=>f.payment.workweekPayments[0].leaveCoverage.entries=[],
 ]){const input=fixture();mutate(input);assert.throws(()=>paidSettlementLeave(input.payment,input.review))}
})
test('current leave must match source adjustments and previous periods must have settled earlier leave once',()=>{
 const f=fixture(),adjustment={kind:'PAID_LEAVE',leaveId:1,sourceRequestId:2,leaveDate:'2026-08-04',minutes:60,taxTreatmentVerified:true}
 assert.deepEqual(currentSettlementLeave(f.review,'2026-08-03','2026-08-05',[adjustment]),[f.entry])
 assert.throws(()=>currentSettlementLeave(f.review,'2026-08-03','2026-08-05',[{...adjustment,minutes:59}]))
 assert.throws(()=>currentSettlementLeave(f.review,'2026-08-03','2026-08-05',[adjustment,adjustment]))
 assert.throws(()=>currentSettlementLeave(f.review,'2026-08-07','2026-08-09',[]))
 f.review.paymentReconciliation.paid=[{paidLeaveEntries:[f.entry]}]
 assert.deepEqual(currentSettlementLeave(f.review,'2026-08-07','2026-08-09',[]),[])
 assert.throws(()=>currentSettlementLeave(f.review,'2026-08-03','2026-08-05',[adjustment]))
 f.review.paymentReconciliation.paid.push({paidLeaveEntries:[f.entry]})
 assert.throws(()=>currentSettlementLeave(f.review,'2026-08-07','2026-08-09',[]))
})

test('reconciliation rejects separate payroll runs claiming the same leave record',()=>{
 const f=fixture()
 Object.assign(f.payment,{status:'FINALIZED',runKind:'REGULAR',workweekPaymentVersion:1,regularMinutes:0,overtimeMinutes:0,regularPayCents:0,overtimePayCents:0})
 Object.assign(f.payment.workweekPayments[0],{workedMinutes:0,straightTimePayCents:0,premiumCents:0,coverage:{version:1,entries:[]}})
 Object.assign(f.review.allocationReview,{status:'CURRENT',fingerprint:'current',calculation:{workedMinutes:0,straightTimePayCents:0,overtimePremiumCents:0}})
 f.review.payments=[f.payment,{...f.payment,runId:2}]
 const result=reconcileAllocationPayments(f.review)
 assert.equal(result.status,'REVIEW_REQUIRED')
 assert.ok(result.issues.some(i=>i.includes('same paid leave')))
})
