import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
test('participant eligibility binds current employment and plan terms while retaining retries and history',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json.data}
 const e=await api('/employees',{employeeNumber:'RETIREMENT',legalFirstName:'Synthetic',legalLastName:'Participant',hireDate:'2026-09-01',hourlyRateCents:2500},201)
 const plan=retirementPlanFixture();await api('/retirement-plans',{plan,expectedRevision:0,requestKey:randomUUID()})
 const path=`/employees/${e.id}/retirement-eligibility/standard`,initial=await api(path)
 assert.equal(initial.currentStatus,'REVIEW_REQUIRED')
 const body={sourceFingerprint:initial.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,disposition:'ELIGIBLE',eligibleOn:'2026-09-01',methods:['PERCENTAGE'],reference:'Reviewed service and plan entry requirements.',employeeExplanation:'You may elect contributions from the reviewed entry date.'}
 const [a,b]=await Promise.all([api(path,body),api(path,body)]);assert.equal(a.id,b.id)
 await api(path,{...body,eligibleOn:'2026-10-01'},409)
 let data=await api(path);assert.equal(data.currentStatus,'ELIGIBLE');assert.equal(data.history.length,1)
 await api(path,undefined,404,2)
 await api(path,{...body,requestKey:randomUUID()},409)
 for(const patch of [{eligibleOn:'2026-02-30'},{eligibleOn:'2026-08-31'},{methods:[]},{methods:['UNKNOWN']},{confirmed:false},{disposition:'NOT_ELIGIBLE'}])await api(path,{...body,expectedRevision:1,requestKey:randomUUID(),...patch},400)
 await api('/retirement-plans',{plan:{...plan,employeeTerms:'New reviewed employee election terms.'},expectedRevision:1,requestKey:randomUUID()})
 data=await api(path);assert.equal(data.currentStatus,'REVIEW_REQUIRED');assert.notEqual(data.source.fingerprint,initial.source.fingerprint)
 await api(path,{...body,expectedRevision:1,requestKey:randomUUID()},409)
 await api(path,{...body,sourceFingerprint:data.source.fingerprint,expectedRevision:1,requestKey:randomUUID(),disposition:'NOT_ELIGIBLE',eligibleOn:null,methods:[]})
 assert.equal((await api(path)).currentStatus,'NOT_ELIGIBLE')
 await h.pool.query('UPDATE payroll_onboarding_task SET onboarding_cycle=onboarding_cycle+1 WHERE employee_id=$1',[e.id])
 data=await api(path);assert.equal(data.currentStatus,'REVIEW_REQUIRED');assert.equal(data.source.onboardingCycle,2);assert.equal(data.history.length,2)
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_eligibility SET revision=9'),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_eligibility'),/append-only/)
 assert.equal((await api(path,body)).id,a.id)
})
