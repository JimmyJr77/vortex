import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {retirementAnnualInput,retirementAnnualAmounts} from '../retirementAnnualInput.js'
import {retirementAnnualFixture} from '../testing/retirementAnnualFixture.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import {createHarness} from '../testing/harness.js'
test('annual retirement evidence requires explicit balances, aggregate consistency and participant caps',()=>{
 const body=retirementAnnualFixture(),facts=retirementAnnualInput(body)
 assert.equal(facts.externalOrdinaryDeferralsCents,0);assert.equal(facts.participantOrdinaryCapCents,null)
 for(const field of retirementAnnualAmounts)for(const value of [undefined,null,-1,0.2,'0',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>retirementAnnualInput({...body,[field]:value}),{status:400})
 for(const patch of [{ageAtYearEnd:null},{ageAtYearEnd:121},{asOfDate:'2026-02-30'},{participantOrdinaryCapCents:undefined},{compensationCapTreatment:'UNKNOWN'},{externalPlanOrdinaryDeferralsCents:100},{externalPlanCatchUpDeferralsCents:100},{confirmed:false}])assert.throws(()=>retirementAnnualInput({...body,...patch}),{status:400})
 const revised=retirementAnnualInput({...body,externalOrdinaryDeferralsCents:100000,externalPlanOrdinaryDeferralsCents:50000,externalAnnualAdditionsCents:75000,balanceReference:'Different retained annual source evidence.'});assert.notEqual(facts.fingerprint,revised.fingerprint)
 assert.equal(retirementAnnualInput({...body,enabled:true}).fingerprint,facts.fingerprint)
})
test('annual source revisions preserve employer scope, current plan binding and exact retries',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness({payrollNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const api=async(path,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data.data}
 const employee=await api('/employees',{employeeNumber:'ANNUAL-RETIREMENT',legalFirstName:'Synthetic',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},201),plan=retirementPlanFixture()
 await api('/retirement-plans',{plan,expectedRevision:0,requestKey:randomUUID()})
 const path=`/employees/${employee.id}/retirement-annual-sources/standard`,initial=await api(path),body={planRevisionId:initial.planRevisionId,expectedRevision:0,requestKey:randomUUID(),facts:retirementAnnualFixture()}
 assert.equal(initial.status,'REVIEW_REQUIRED')
 const [a,b]=await Promise.all([api(path,body),api(path,body)]);assert.equal(a.id,b.id);assert.equal((await api(path)).history.length,1)
 await api(path,undefined,404,2)
 await api(path,{...body,facts:{...body.facts,ageAtYearEnd:50}},409)
 await api(path,{...body,requestKey:randomUUID()},409)
 await api(path,{...body,expectedRevision:1,requestKey:randomUUID(),facts:{...body.facts,asOfDate:'2026-09-12'}},400)
 await api('/retirement-plans',{plan:{...plan,employeeTerms:'Changed current plan contribution terms.'},expectedRevision:1,requestKey:randomUUID()})
 const current=await api(path);assert.equal(current.status,'REVIEW_REQUIRED')
 await api(path,{...body,expectedRevision:1,requestKey:randomUUID()},409)
 await api(path,{...body,planRevisionId:current.planRevisionId,expectedRevision:1,requestKey:randomUUID(),facts:{...body.facts,externalOrdinaryDeferralsCents:100000}})
 assert.equal((await api(path)).status,'REVIEW_RETAINED');assert.equal((await api(path)).history.length,2)
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_annual_source SET revision=9'),/append-only/);await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_annual_source'),/append-only/)
 assert.equal((await api(path,body)).id,a.id)
})
