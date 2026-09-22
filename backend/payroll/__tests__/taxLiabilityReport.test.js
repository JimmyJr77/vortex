import test from 'node:test'
import assert from 'node:assert/strict'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {taxLiabilityReport} from '../taxLiabilityReport.js'
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
