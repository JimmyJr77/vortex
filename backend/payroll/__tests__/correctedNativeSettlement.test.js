import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {correctedNativeFixture} from '../testing/correctedNativeFixture.js'
test('salary settlement credits corrected hourly wages and excludes their processing-period earning',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,e,original,period}=await correctedNativeFixture(h)
 const allocationInput={payPeriodId:period.id,week:'2026-08-03',salaryAllocations:[{employmentStart:'2026-08-07',earningsCents:120000,source:'Synthetic reviewed salary allocation for the full workweek'}]}
 const allocation=await api(`/employees/${e.id}/workweek-allocation-preview`,allocationInput)
 await api(`/employees/${e.id}/workweek-allocations`,{...allocationInput,fingerprint:allocation.fingerprint,requestId:'corrected-native-allocation',reason:'Review corrected hourly pay and the later salary agreement',confirmed:true},'POST',201)
 const review=(await api('/runs/preview',{payPeriodId:period.id})).preview.employees[0].employmentWeekReviews[0]
 assert.equal(review.paymentReconciliation.status,'EVIDENCE_RECONCILED',JSON.stringify(review.paymentReconciliation.issues))
 assert.equal(review.paymentReconciliation.totals.workedMinutes,1680)
 assert.equal(review.paymentReconciliation.totals.straightTimePayCents,70000)
 assert.equal(review.paymentReconciliation.totals.premiumCents,0)
 assert.ok(review.paymentReconciliation.paid.some(p=>p.coverageSource==='CORRECTED_NATIVE_HOURLY'))
 await api(`/employees/${e.id}/workweek-settlement-authorizations`,{payPeriodId:period.id,week:allocationInput.week,fingerprint:review.paymentReconciliation.fingerprint,requestId:'corrected-native-payment',reason:'Confirm original and correction wage payments before salary settlement',historyComplete:true,confirmed:true},'POST',201)
 const preview=(await api('/runs/preview',{payPeriodId:period.id})).preview
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
 assert.equal(preview.employees[0].grossPayCents,120000+allocation.calculation.overtimePremiumCents)
 const run=await api('/runs',{payPeriodId:period.id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-CORRECTED-NATIVE-SETTLEMENT'})
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id<>$1 ORDER BY id',[run.id])).rows,original)
})
