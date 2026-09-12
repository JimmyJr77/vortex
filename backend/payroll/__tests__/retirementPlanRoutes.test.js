import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {createHarness} from '../testing/harness.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
test('retirement plan reviews preserve exact retries, scope, revisions and immutable terms',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(body,expected=200,facility=1)=>{const response=await fetch(`${h.url}/api/admin/payroll/retirement-plans`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const json=await response.json();assert.equal(response.status,expected,JSON.stringify(json));return json.data}
 assert.deepEqual((await api()).history,[])
 const body={plan:retirementPlanFixture(),expectedRevision:0,requestKey:randomUUID()}
 const [a,b]=await Promise.all([api(body),api(body)]);assert.equal(a.id,b.id)
 await api({...body,plan:{...body.plan,name:'Changed terms using the same key'}},409)
 await api({...body,requestKey:randomUUID()},409)
 assert.deepEqual((await api(undefined,200,2)).history,[])
 let rows=(await api()).history;assert.equal(rows.length,1);assert.equal(rows[0].revision,1);assert.equal(rows[0].plan.employeeTerms,body.plan.employeeTerms)
 const unusedPto={inServiceDeferrals:'INCLUDED',postSeveranceDeferrals:'REVIEW_REQUIRED',postSeverance415:'REVIEW_REQUIRED',limitationYear:'CALENDAR_YEAR',terms:'Actual retained plan unused-leave cashout and limitation year terms.'}
 await api({plan:{...body.plan,unusedPto,effectiveOn:'2026-10-01',employeeTerms:'New employee election terms for the revised plan.'},expectedRevision:1,requestKey:randomUUID()})
 rows=(await api()).history;assert.equal(rows.length,2);assert.equal(rows[0].revision,2);assert.notEqual(rows[0].plan.fingerprint,rows[1].plan.fingerprint);assert.equal(rows[1].plan.employeeTerms,body.plan.employeeTerms);assert.deepEqual(rows[0].plan.unusedPto,unusedPto);assert.equal(rows[1].plan.unusedPto,undefined)
 await api({...body,plan:{...body.plan,effectiveOn:'2026-02-30'},requestKey:randomUUID()},400)
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_plan_revision SET revision=9'),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_plan_revision'),/append-only/)
 await assert.rejects(h.pool.query("INSERT INTO payroll_retirement_plan_revision(id,facility_id,tax_year,plan_id,revision,effective_on,plan,plan_fingerprint,request_key,request_fingerprint,created_by) SELECT $1,facility_id,tax_year,plan_id,99,effective_on,plan,plan_fingerprint,$2,request_fingerprint,created_by FROM payroll_retirement_plan_revision LIMIT 1",[randomUUID(),randomUUID()]),/revision changed/)
 await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.equal((await api()).history.length,2)
 const unauth=await fetch(`${h.url}/api/admin/payroll/retirement-plans`);assert.equal(unauth.status,401)
})
