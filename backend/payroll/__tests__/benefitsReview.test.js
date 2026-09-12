import test from 'node:test'
import assert from 'node:assert/strict'
import {validateBenefitsReview,benefitsReviewCurrent,benefitsReviewForEmployee,automateBenefitsReviews} from '../benefitsReview.js'
import {createHarness} from '../testing/harness.js'
const decision={disposition:'WAITING_PERIOD',effectiveOn:'2026-10-01',summary:'Coverage eligibility starts after the waiting period.',evidenceReference:'Private synthetic plan eligibility worksheet',confirmed:true}
test('benefits review retains verified disposition, policy and effective date without exposing private evidence',()=>{
 for(const disposition of ['NOT_OFFERED','NOT_ELIGIBLE','WAIVED','ENROLLED','WAITING_PERIOD']){
  const election={version:1,choice:disposition==='WAIVED'?'WAIVE':'ENROLL',signature:'Synthetic Employee',submissionId:'synthetic-benefits-choice',policyTerms:'Current benefits policy'}
  const saved=validateBenefitsReview({...decision,disposition},'Current benefits policy','2026-09-10',election)
  assert.equal(saved.disposition,disposition);assert.equal(saved.policyTerms,'Current benefits policy')
  assert.equal(benefitsReviewCurrent(saved,'Current benefits policy','2026-09-10',election),true)
  assert.equal(benefitsReviewCurrent(saved,'Revised benefits policy','2026-09-10',election),false)
  assert.deepEqual(Object.keys(benefitsReviewForEmployee(saved)).sort(),['disposition','effectiveOn','summary'])
 }
 for(const input of [null,{}, {...decision,confirmed:false},{...decision,summary:''},{...decision,evidenceReference:''},{...decision,effectiveOn:'2026-02-30'},{...decision,effectiveOn:'2026-09-10'}])assert.throws(()=>validateBenefitsReview(input,'policy','2026-09-10'))
 const saved=validateBenefitsReview(decision,'policy','2026-09-10')
 assert.equal(benefitsReviewCurrent(saved,'policy','2026-10-01'),false)
})
test('benefits follow-up survives activation, deduplicates at eligibility and closes after renewed review',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const response=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'BENEFITS-FOLLOWUP',legalFirstName:'Benefits',legalLastName:'Fixture',hireDate:'2026-08-03',hourlyRateCents:2500})})
 assert.equal(response.status,201);const e=(await response.json()).data
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 const save=review=>h.pool.query("UPDATE payroll_onboarding_task SET status='COMPLETE',response=$2 WHERE employee_id=$1 AND task_key='PAY_REVIEW'",[e.id,{benefitsReview:review}])
 await save(validateBenefitsReview(decision,'','2026-09-10'))
 const alerts=()=>h.pool.query("SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1",[`benefits-review-${e.id}`])
 await automateBenefitsReviews(h.pool,1,'2026-09-30');assert.equal((await alerts()).rows.length,0)
 await automateBenefitsReviews(h.pool,1,'2026-10-01');await automateBenefitsReviews(h.pool,1,'2026-10-01')
 assert.deepEqual((await alerts()).rows,[{status:'OPEN'}])
 await automateBenefitsReviews(h.pool,2,'2026-10-01');assert.equal((await alerts()).rows[0].status,'OPEN')
 await h.pool.query("UPDATE payroll_onboarding_task SET status='CHANGES_REQUESTED' WHERE employee_id=$1 AND task_key='PAY_REVIEW'",[e.id])
 await automateBenefitsReviews(h.pool,1,'2026-10-01');assert.equal((await alerts()).rows[0].status,'OPEN')
 await save(validateBenefitsReview({...decision,disposition:'NOT_ELIGIBLE'},'','2026-10-01'))
 await automateBenefitsReviews(h.pool,1,'2026-10-01');assert.equal((await alerts()).rows[0].status,'DISMISSED')
 await h.pool.query("UPDATE payroll_settings SET onboarding_policy=onboarding_policy||'{\"benefitsText\":\"Updated coverage policy\"}' WHERE facility_id=1")
 await automateBenefitsReviews(h.pool,1,'2026-10-01');assert.equal((await alerts()).rows[0].status,'OPEN')
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-10-01' WHERE id=$1",[e.id])
 await automateBenefitsReviews(h.pool,1,'2026-10-01');assert.equal((await alerts()).rows[0].status,'DISMISSED')
})
