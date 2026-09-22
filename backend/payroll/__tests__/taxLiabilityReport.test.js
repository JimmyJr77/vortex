import test from 'node:test'
import assert from 'node:assert/strict'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {taxLiabilityReport,taxLiabilityCsvRows} from '../taxLiabilityReport.js'
import {taxRows} from '../taxReconciliation.js'

test('liability export distinguishes approved reservations, finalized payments and voided runs',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,periods}=await monthlyBenefitsFixture(h)
 const create=async()=>{const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');return run}
 const run=await create()
 assert.equal((await taxLiabilityReport(h.pool,1)).length,1)
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 const approved=await taxLiabilityReport(h.pool,1)
 assert.equal(approved.length,2);assert.equal(approved[1][4],'APPROVED');assert.match(approved[1][16],/unpaid reservation/)
 assert.equal((await taxRows(h.pool,1,2026)).length,0)
 assert.equal((await taxLiabilityReport(h.pool,1,{start:'2026-09-19',end:'2026-12-31'})).length,1)
 await api(`/runs/${run.id}/status`,{status:'VOID'},'PATCH')
 assert.equal((await taxLiabilityReport(h.pool,1)).length,1)
 const replacement=await create();await api(`/runs/${replacement.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${replacement.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-LIABILITY-EXPORT-PAYMENT'})
 const paid=await taxLiabilityReport(h.pool,1)
 assert.equal(paid.length,2);assert.equal(String(paid[1][1]),String(replacement.id));assert.equal(paid[1][4],'FINALIZED')
 assert.match(paid[1][16],/Reconcile separately/);assert.deepEqual(paid[1].slice(5,14),approved[1].slice(5,14))
 assert.equal((await taxRows(h.pool,1,2026)).length,1)
})


test('tax export retains distinct Medicare and employer amounts without changing totals',()=>{
 const rows=taxLiabilityCsvRows([{run_id:3,employee_id:7,payment_date:'2026-09-18',status:'FINALIZED',federal_income:'1234',maryland:'234',social_security:'620',employer_social_security:'621',medicare:'145',employer_medicare:'146',additional_medicare:'90',futa:'60',md_ui:'260'}])
 const item=Object.fromEntries(rows[0].map((key,i)=>[key,rows[1][i]]))
 assert.equal(item['Employee Social Security withholding'],'6.20')
 assert.equal(item['Employer Social Security tax'],'6.21')
 assert.equal(item['Employee regular Medicare withholding'],'1.45')
 assert.equal(item['Employer Medicare tax'],'1.46')
 assert.equal(item['Employee Additional Medicare withholding'],'0.90')
 assert.equal(item['Social Security employee and employer'],'12.41')
 assert.equal(item['Medicare employee and employer'],'3.81')
 assert.equal(item['Employee taxes'],'23.23');assert.equal(item['Employer taxes'],'10.87');assert.equal(item['Total calculated tax liability'],'34.10')
 assert.equal(rows[0].length,rows[1].length)
 const zero=taxLiabilityCsvRows([{run_id:4,employee_id:8,payment_date:'2026-09-18',status:'APPROVED',federal_income:0,maryland:0,social_security:0,medicare:0,additional_medicare:0,futa:0,md_ui:0}])
 assert.deepEqual(zero[1].slice(-5),Array(5).fill('0.00'));assert.match(zero[1][16],/unpaid reservation/)
})
