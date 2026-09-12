import test from 'node:test'
import assert from 'node:assert/strict'
import {reconcileAllocationPayments as reconcile} from '../allocationPaymentReconciliation.js'
const fixture=()=>({week:'2026-08-03',allocationReview:{status:'CURRENT',fingerprint:'earnings',calculation:{workedMinutes:3000,straightTimePayCents:180000,overtimePremiumCents:18000}},historicalPayments:[],payments:[{runId:1,status:'FINALIZED',periodStart:'2026-07-27',periodEnd:'2026-08-09',workweekPaymentVersion:1,regularMinutes:3600,overtimeMinutes:600,regularPayCents:150000,overtimePayCents:22500,otherTaxablePayCents:0,workweekPayments:[{week:'2026-07-27',workedMinutes:2400,straightTimePayCents:100000,premiumCents:0},{week:'2026-08-03',workedMinutes:1800,straightTimePayCents:65000,premiumCents:7500}]}]})
test('allocation payments use reconciled whole-run evidence but only credit the selected week',()=>{
 const input=fixture(),result=reconcile(input)
 assert.equal(result.status,'EVIDENCE_RECONCILED');assert.equal(result.historyCompletenessVerified,false);assert.equal(result.paymentApplied,false)
 assert.deepEqual(result.totals,{workedMinutes:1800,straightTimePayCents:65000,premiumCents:7500})
 assert.deepEqual(result.differences,{straightTimeCents:115000,premiumCents:10500})
 input.payments[0].workweekPayments[1].runId=999
 assert.equal(reconcile(input).paid[0].runId,1)
 const changed=structuredClone(input);changed.payments[0].workweekPayments[1].premiumCents++
 assert.equal(reconcile(changed).status,'REVIEW_REQUIRED');assert.notEqual(reconcile(changed).fingerprint,result.fingerprint)
 assert.deepEqual(reconcile(changed).paid,[])
})
test('commitments, imported history, unsupported earnings and malformed evidence cannot authorize reconciliation',()=>{
 for(const mutate of [
  r=>r.payments[0].status='APPROVED',
  r=>r.historicalPayments.push({id:2}),
  r=>r.payments[0].workweekPaymentVersion=0,
  r=>r.payments.push(structuredClone(r.payments[0])),
  r=>r.payments[0].otherTaxablePayCents=100,
  r=>r.payments[0].workweekPayments.push(structuredClone(r.payments[0].workweekPayments[0])),
  r=>r.payments[0].workweekPayments[0].week='2026-02-30',
  r=>r.allocationReview.status='STALE',
  r=>r.payments[0].regularMinutes=-1,
 ]){const input=fixture();mutate(input);assert.equal(reconcile(input).status,'REVIEW_REQUIRED')}
})
test('overpaid hours, straight earnings or premiums are review differences, never deductions',()=>{
 for(const mutate of [r=>r.allocationReview.calculation.workedMinutes=60,r=>r.allocationReview.calculation.straightTimePayCents=1,r=>r.allocationReview.calculation.overtimePremiumCents=1]){
  const input=fixture();mutate(input);const result=reconcile(input)
  assert.equal(result.status,'REVIEW_REQUIRED');assert.equal(result.paymentApplied,false)
 }
 const empty=fixture();empty.payments=[]
 assert.equal(reconcile(empty).historyCompletenessVerified,false)
 assert.deepEqual(reconcile(empty).differences,{straightTimeCents:180000,premiumCents:18000})
})
