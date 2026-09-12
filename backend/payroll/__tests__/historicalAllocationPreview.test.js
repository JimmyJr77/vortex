import test from 'node:test'
import assert from 'node:assert/strict'
import {previewHistoricalAllocation as preview} from '../historicalAllocationPreview.js'
const fixture=()=>({payment:{id:1,employee_id:2,period_start:'2026-08-03',period_end:'2026-08-05',payment_date:'2026-08-14',gross_amount_cents:60000,employee_tax_withheld_cents:12000,net_amount_cents:48000,reference:'SOURCE',evidence_note:'Source wage register and payment evidence'},period:{period_start:'2026-08-03',period_end:'2026-08-09'},reviews:[{employeeId:2,week:'2026-08-03',end:'2026-08-09',payments:[],historicalPayments:[{id:1,periodStart:'2026-08-03',periodEnd:'2026-08-05'}],allocationReview:{id:7,status:'CURRENT',fingerprint:'earned',coverage:{version:1,method:'TEST',entries:[{id:1,workDate:'2026-08-03',minutes:1440,straightTimePayCents:60000,premiumCents:0},{id:2,workDate:'2026-08-07',minutes:1560,straightTimePayCents:120000,premiumCents:18000}]}}}]})
const run=f=>preview(f.payment,f.reviews,f.period,'2026-09-01')
test('imported allocation matches only its work dates and preserves original source and earnings',()=>{
 const input=fixture(),before=structuredClone(input),result=run(input)
 assert.equal(result.weeks[0].workedMinutes,1440);assert.equal(result.weeks[0].straightTimePayCents,60000)
 assert.equal(result.weeks[0].coverage.entries.length,1);assert.equal(result.paymentApplied,false);assert.equal(result.requiresSourceConfirmation,true)
 assert.deepEqual(input,before);assert.equal(run(input).fingerprint,result.fingerprint)
 input.payment.evidence_note='Updated source evidence';assert.notEqual(run(input).fingerprint,result.fingerprint)
})
test('imported allocation refuses unmatched amounts, missing reviews and duplicate payment evidence',()=>{
 for(const mutate of [
  f=>f.payment.net_amount_cents=48001,
  f=>{f.payment.gross_amount_cents=60001;f.payment.net_amount_cents=48001},
  f=>f.period.period_start='2026-08-04',
  f=>f.reviews=[],
  f=>f.reviews[0].allocationReview.status='STALE',
  f=>f.reviews[0].payments.push({runKind:'REGULAR',periodStart:'2026-08-03',periodEnd:'2026-08-05'}),
  f=>f.reviews[0].historicalPayments.push({id:2,periodStart:'2026-08-03',periodEnd:'2026-08-05'}),
 ]){const input=fixture();mutate(input);assert.throws(()=>run(input))}
})
test('an imported payment spanning multiple workweeks requires and reconciles every retained week',()=>{
 const input=fixture()
 input.payment.period_end='2026-08-16';input.payment.payment_date='2026-08-21';input.period.period_end='2026-08-16'
 input.payment.gross_amount_cents=318000;input.payment.employee_tax_withheld_cents=20000;input.payment.net_amount_cents=298000
 input.reviews.push({employeeId:2,week:'2026-08-10',end:'2026-08-16',payments:[],historicalPayments:[],allocationReview:{id:8,status:'CURRENT',fingerprint:'second-week',coverage:{version:1,method:'TEST',entries:[{id:3,workDate:'2026-08-10',minutes:2400,straightTimePayCents:120000,premiumCents:0}]}}})
 const result=run(input)
 assert.equal(result.weeks.length,2)
 assert.equal(result.weeks.reduce((n,w)=>n+w.straightTimePayCents+w.premiumCents,0),318000)
 input.reviews[1].allocationReview.fingerprint='changed-second-week'
 assert.notEqual(run(input).fingerprint,result.fingerprint)
 input.reviews.pop();assert.throws(()=>run(input),/every workweek/)
})
