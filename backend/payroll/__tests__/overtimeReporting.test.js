import test from 'node:test'
import assert from 'node:assert/strict'
import {paidOvertimeReview} from '../overtimeReporting.js'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
const fixture=()=>{const source={employeeId:1,regularPayCents:100000,overtimePayCents:30000,otherTaxablePayCents:0,workweekPaymentVersion:1,workweekPayments:[{week:'2026-09-07',straightTimePayCents:120000,premiumCents:10000}],payItems:[]};return {employee_id:1,regular_pay_cents:'100000',overtime_pay_cents:'30000',other_taxable_pay_cents:'0',calculation_snapshot:{employees:[source]},statement_snapshot:structuredClone(source)}}
test('paid premium review preserves the premium component and refuses unsupported sources',()=>{
 const row=fixture();assert.deepEqual(paidOvertimeReview(row),{paidPremiumCents:10000,issues:[],qualificationStatus:'REVIEW_REQUIRED'})
 for(const mutate of [r=>r.overtime_pay_cents='30001',r=>r.statement_snapshot.workweekPayments[0].premiumCents++,r=>r.calculation_snapshot.employees.push(r.calculation_snapshot.employees[0]),r=>r.regular_pay_cents=null]){const bad=fixture();mutate(bad);assert.equal(paidOvertimeReview(bad).paidPremiumCents,null)}
 const bonus=fixture();bonus.other_taxable_pay_cents='10500';const s=bonus.calculation_snapshot.employees[0];s.otherTaxablePayCents=10500;s.payItems=[{kind:'BONUS',amountCents:10000,bonusAllocation:{additionalOvertimeCents:500}},{kind:'BONUS_OVERTIME',amountCents:500}];bonus.statement_snapshot=structuredClone(s);assert.equal(paidOvertimeReview(bonus).paidPremiumCents,10500)
 s.payItems[0].amountCents=10001;bonus.statement_snapshot=structuredClone(s);assert.match(paidOvertimeReview(bonus).issues.join(' '),/Other taxable/);s.payItems[0].amountCents=10000;
 s.payItems[1].amountCents=501;bonus.statement_snapshot=structuredClone(s);assert.equal(paidOvertimeReview(bonus).paidPremiumCents,null)
 const correction=fixture();correction.calculation_snapshot.employees[0].payItems=[{kind:'WAGE_CORRECTION',amountCents:1}];correction.statement_snapshot.payItems=structuredClone(correction.calculation_snapshot.employees[0].payItems);assert.match(paidOvertimeReview(correction).issues.join(' '),/Correction premium/)
})
test('overtime source review uses finalized payment year and admin facility',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 assert.deepEqual((await api('/reports/overtime-review?year=2026')).records,[])
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-OVERTIME-SOURCE'})
 const report=await api('/reports/overtime-review?year=2026');assert.equal(report.records.length,1);assert.equal(report.records[0].paidPremiumCents,0);assert.equal(report.records[0].qualificationStatus,'REVIEW_REQUIRED')
 const path=`/runs/${run.id}/employees/${report.records[0].employeeId}/overtime-qualification`,body={sourceFingerprint:report.records[0].sourceFingerprint,expectedReviewId:0,qualifiedPremiumCents:0,flsaStatus:'FLSA_REQUIRED',reference:'Synthetic reviewed FLSA coverage and premium worksheet',confirmed:true}
 await api(path,{...body,qualifiedPremiumCents:1},'POST',400);await api(path,{...body,confirmed:false},'POST',400)
 const saved=await api(path,body,'POST',201);assert.equal((await api(path,body)).reused,true)
 let current=(await api('/reports/overtime-review?year=2026')).records[0];assert.equal(current.qualificationStatus,'REVIEWED');assert.equal(current.qualifiedPremiumCents,0)
 await api(path,{...body,reference:'Another reviewed FLSA coverage source'},'POST',409)
 await api(path,{...body,expectedReviewId:saved.id,flsaStatus:'NOT_FLSA_REQUIRED'},'POST',201)
 current=(await api('/reports/overtime-review?year=2026')).records[0];assert.equal(current.qualificationReview.flsaStatus,'NOT_FLSA_REQUIRED');assert.deepEqual(current.qualificationHistory.map(h=>h.status),['CURRENT','SUPERSEDED'])
 await assert.rejects(h.pool.query('UPDATE payroll_overtime_qualification SET reference=$2 WHERE id=$1',[saved.id,'Replacement source reference']),/append-only/)
 const retained=(await h.pool.query('SELECT id,statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 const changed=structuredClone(retained.statement_snapshot);changed.workweekPayments[0].premiumCents++
 await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=$2 WHERE id=$1',[retained.id,changed])
 current=(await api('/reports/overtime-review?year=2026')).records[0];assert.equal(current.qualificationStatus,'STALE_REVIEW');assert.equal(current.qualifiedPremiumCents,null)
 await api(path,{...body,expectedReviewId:current.reviewId},'POST',409)
 await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=$2 WHERE id=$1',[retained.id,retained.statement_snapshot])
 assert.equal((await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:JSON.stringify(body)})).status,404)
 await assert.rejects(h.pool.query("INSERT INTO payroll_overtime_qualification(facility_id,run_employee_id,source_fingerprint,qualified_premium_cents,flsa_status,reference,created_by) VALUES(2,$1,$2,0,'FLSA_REQUIRED','Synthetic wrong-facility review',99)",[retained.id,body.sourceFingerprint]),/payroll ownership/)
 await api('/reports/overtime-review?year=2027',undefined,'GET',400)
 const response=await fetch(`${h.url}/api/admin/payroll/reports/overtime-review?year=2026`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual((await response.json()).data.records,[])
 assert.equal((await fetch(`${h.url}/api/admin/payroll/reports/overtime-review?year=2026`)).status,401)
})
