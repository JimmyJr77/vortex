import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {regularRetirementFixture} from '../testing/regularRetirementFixture.js'
import {loadMarylandAdditionalPeriod} from '../loadMarylandAdditionalPeriod.js'
test('Maryland period loader distinguishes approved reservations, void release and finalized additional withholding',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness({retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const {api,employee,periods}=await regularRetirementFixture(h)
 await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed additional-withholding election',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1,extraWithholdingCents:500}},'PATCH')
 const path=`/employees/${employee.id}/maryland-additional-agreements`,current=await api(path)
 await api(path,{status:'ACTIVE',expectedRevision:0,requestKey:randomUUID(),confirmed:true,sourceReference:'Synthetic signed payment-date additional-withholding agreement',effectiveOn:'2026-09-16',amountCents:500,periodBasis:'PAYMENT_DATE',electionFingerprint:current.currentElectionFingerprint},'POST',201)
 const load=(paymentDate='2026-09-22',excludeRunId=null)=>loadMarylandAdditionalPeriod(h.pool,{facility:1,employeeId:employee.id,paymentDate,excludeRunId})
 assert.equal((await load()).remainingAdditionalCents,500)
 const approve=async()=>{const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');return run}
 const first=await approve(),reserved=await load()
 assert.equal(reserved.committedAdditionalCents,500);assert.equal(reserved.remainingAdditionalCents,0);assert.equal(reserved.applications[0].status,'APPROVED')
 assert.equal((await load('2026-09-18',first.id)).remainingAdditionalCents,500)
 await assert.rejects(()=>load('2026-09-22',first.id),{status:409})
 await api(`/runs/${first.id}/status`,{status:'VOID'},'PATCH')
 assert.equal((await load()).remainingAdditionalCents,500)
 const second=await approve()
 await api(`/runs/${second.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-MARYLAND-ADDITIONAL-PERIOD'})
 const paid=await load();assert.equal(paid.remainingAdditionalCents,0);assert.equal(paid.applications.length,1);assert.equal(paid.applications[0].status,'FINALIZED');assert.equal(paid.applications[0].appliedAdditionalCents,500)
 assert.ok(!JSON.stringify(paid).includes('Monthly Benefits'))
 await assert.rejects(()=>load('2026-09-18',second.id),{status:409})
 const duplicate=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-09-21','2026-09-27','2026-10-01','WEEKLY') RETURNING id")).rows[0]
 await assert.rejects(()=>load(),/unambiguous/)
 await h.pool.query('DELETE FROM payroll_pay_period WHERE id=$1',[duplicate.id])
 assert.equal((await load()).remainingAdditionalCents,0)
})
