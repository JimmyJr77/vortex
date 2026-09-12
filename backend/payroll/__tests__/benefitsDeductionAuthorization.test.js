import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {automateBenefitsDeductionAuthorization} from '../benefitsDeductionAuthorization.js'
test('missing deduction authorization produces a scoped persistent follow-up without creating a deduction',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const response=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'DEDUCTION-FOLLOWUP',legalFirstName:'Deduction',legalLastName:'Fixture',hireDate:'2026-08-03',hourlyRateCents:2500})})
 assert.equal(response.status,201);const e=(await response.json()).data
 // A retained enrollment with paid coverage still needs current signed terms.
 await h.pool.query("UPDATE payroll_onboarding_task SET status='COMPLETE',response=$2 WHERE employee_id=$1 AND task_key='PAY_REVIEW'",[e.id,{benefitsReview:{disposition:'ENROLLED'},benefitsElection:{selections:[{planId:'medical',optionId:'family',employeeCostCents:12500}]}}])
 const alerts=()=>h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`benefit-deduction-authorization-${e.id}`])
 await automateBenefitsDeductionAuthorization(h.pool,1,'2026-09-10');await automateBenefitsDeductionAuthorization(h.pool,1,'2026-09-10')
 assert.deepEqual((await alerts()).rows,[{status:'OPEN'}])
 await automateBenefitsDeductionAuthorization(h.pool,2,'2026-09-10');assert.equal((await alerts()).rows[0].status,'OPEN')
 assert.equal(Number((await h.pool.query('SELECT count(*) FROM payroll_recurring_adjustment WHERE employee_id=$1',[e.id])).rows[0].count),0)
 await h.pool.query("UPDATE payroll_onboarding_task SET response=$2 WHERE employee_id=$1 AND task_key='PAY_REVIEW'",[e.id,{benefitsReview:{disposition:'WAIVED'}}])
 await automateBenefitsDeductionAuthorization(h.pool,1,'2026-09-10');assert.equal((await alerts()).rows[0].status,'DISMISSED')
})
