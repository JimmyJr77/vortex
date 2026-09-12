import test from 'node:test'
import assert from 'node:assert/strict'
import {previewHistoricalAllocation} from '../historicalAllocationPreview.js'
import {revalidateHistoricalAllocationCoverage} from '../historicalAllocationCoverage.js'
test('imported coverage revalidates the entire saved period when current payroll touches only its last week',async()=>{
 const payment={id:1,employee_id:2,period_start:'2026-08-03',period_end:'2026-08-11',payment_date:'2026-08-14',gross_amount_cents:80000,employee_tax_withheld_cents:10000,net_amount_cents:70000,evidence_note:'Complete wage source'}
 const weeks=['2026-08-03','2026-08-10'].map((week,i)=>({employeeId:2,week,end:i?'2026-08-16':'2026-08-09',payments:[],historicalPayments:[{id:1}],allocationReview:{id:10+i,status:'CURRENT',fingerprint:`week-${i}`,coverage:{version:1,method:'TEST',entries:[{id:i+1,workDate:week,minutes:960,straightTimePayCents:40000,premiumCents:0}]}}}))
 const period={period_start:'2026-08-03',period_end:'2026-08-16'},saved=previewHistoricalAllocation(payment,weeks,period,'2026-09-10')
 const record={id:20,entity_id:'2',after_data:{input:{paymentId:1,payPeriodId:77,fingerprint:saved.fingerprint,sourceConfirmed:true,confirmed:true},result:{...saved,sourceConfirmed:true}}}
 const db={query:async sql=>({rows:sql.includes('FROM payroll_historical_payment')?[payment]:sql.includes('FROM payroll_audit_log')?[record]:[{today:'2026-09-10'}]})}
 const current=[{employeeId:2,week:'2026-08-10',historicalPayments:[{id:1}]}]
 let calls=0
 const load=async id=>{calls++;assert.equal(id,77);return {period,preview:{employees:[{employeeId:2,employmentWeekReviews:weeks}]}}}
 await revalidateHistoricalAllocationCoverage(db,1,current,load)
 assert.equal(current[0].historicalPayments[0].allocationReview.status,'CURRENT');assert.equal(calls,1)
 await revalidateHistoricalAllocationCoverage(db,1,current,load,'2026-08-13')
 assert.equal(current[0].historicalPayments[0].allocationReview.status,'STALE')
 assert.match(current[0].historicalPayments[0].allocationReview.issues[0],/payment chronology/)
 weeks[0].allocationReview.fingerprint='changed-outside-current-payroll'
 await revalidateHistoricalAllocationCoverage(db,1,current,load)
 assert.equal(current[0].historicalPayments[0].allocationReview.status,'STALE')
 assert.match(current[0].historicalPayments[0].allocationReview.issues[0],/evidence changed/)
 weeks[0].allocationReview.status='STALE'
 await revalidateHistoricalAllocationCoverage(db,1,current,load)
 assert.equal(current[0].historicalPayments[0].allocationReview.status,'STALE')
})
