import {benefitsDeductionProposal} from '../benefitsDeductionAuthorization.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {hashPayrollToken} from '../employeeAuth.js'
import {automateBenefitsReviews} from '../benefitsReview.js'
for(const structured of [false,true])test(`employee benefits choices bind admin review to current signed terms and retain superseded submissions: plans=${structured}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,employee=false,method=body===undefined?'GET':'POST')=>{const r=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method,headers:{Authorization:`Bearer ${employee?'benefits-session':'payroll-test-admin'}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'BENEFITS-CHOICE',legalFirstName:'Benefits',legalLastName:'Signer',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('benefits-session')])
 const policy='Synthetic employer benefit package: employer-paid coverage, no employee deductions.'
 await api('/settings',{benefitsText:policy,...(structured?{benefitPlans:[{id:'health',name:'Health',description:'Synthetic employer paid health coverage eligibility.',options:[{id:'health-self',label:'Employee only',employeeCostCents:12500,employerCostCents:45000,taxTreatment:'POSTTAX'}]}],expectedBenefitCatalog:'',benefitsCatalogConfirmed:true,benefitsCatalogEvidence:'Synthetic reviewed plan and rate sheet'}:{})},200,false,'PATCH')
 await h.pool.query("UPDATE payroll_employee SET w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_onboarding_task SET status='COMPLETE',response='{\"method\":\"CHECK\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[e.id])
 await api(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed hiring forms',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},200,false,'PATCH')
 const packet=()=>api('/onboarding',undefined,200,true),task=(await packet()).tasks.find(t=>t.task_key==='PAY_REVIEW')
 const review=async(disposition,status=200,fingerprint)=>(await api(`/employees/${e.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Verified employee choice and carrier or waiver evidence',paySetupFingerprint:fingerprint||(await packet()).paySetup.fingerprint,benefitsReview:{disposition,effectiveOn:'2026-09-01',summary:'Your benefits decision was reviewed by the hiring admin.',evidenceReference:'Private enrollment verification receipt',confirmed:true}},status))
 await review('ENROLLED',400);await review('WAIVED',400)
 const choice={choice:'ENROLL',signature:'Benefits Signer',confirmed:true,displayedTerms:(await packet()).policy.benefitsText,...(structured?{selections:[{planId:'health',optionId:'health-self'}]}:{}),requestKey:'benefits-enrollment-first',onboardingCycle:1}
 await api('/benefits-election',{...choice,displayedTerms:'Old terms'},400,true)
 await api('/benefits-election',{...choice,onboardingCycle:2},409,true)
 const other=await api('/employees',{employeeNumber:'OTHER-BENEFITS',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 const first=await api('/benefits-election',{...choice,employeeId:other.id},200,true)
 assert.equal((await h.pool.query("SELECT response->'benefitsElection' AS election FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='PAY_REVIEW'",[other.id])).rows[0].election,null)
 assert.equal(first.benefitsElection.signature,'Benefits Signer')
 assert.deepEqual((await api('/benefits-election',choice,200,true)).benefitsElection,first.benefitsElection)
 await api('/benefits-election',{...choice,signature:'Different Signer'},409,true)
 await review('WAIVED',400);await review('ENROLLED')
 const completed=await packet();assert.equal(completed.paySetup.status,'CURRENT')
 if(structured){
  assert.equal(completed.benefitsDeduction.status,'PENDING');assert.ok(completed.readiness.blockers.includes('Sign the current benefit deduction authorization'))
  const signing={requestKey:'deduction-authorization-first',signature:'Benefits Signer',confirmed:true,onboardingCycle:1,proposalFingerprint:completed.benefitsDeduction.proposal.fingerprint}
  await api('/benefits-deduction-authorization',{...signing,proposalFingerprint:'stale'},400,true)
  await api('/benefits-deduction-authorization',{...signing,confirmed:false},400,true)
  const signed=await api('/benefits-deduction-authorization',signing,200,true)
  assert.equal(signed.benefitsDeduction.status,'CURRENT');assert.equal(signed.benefitsDeduction.saved.proposal.monthlyCents,12500)
  const row=(await h.pool.query('SELECT * FROM payroll_onboarding_task WHERE id=$1',[task.id])).rows[0]
  row.response.benefitsDeductionAuthorization.proposal.monthlyCents=1
  const settings=(await h.pool.query('SELECT * FROM payroll_settings WHERE facility_id=1')).rows[0]
  assert.equal(benefitsDeductionProposal(e,row,settings,'2026-09-10').status,'STALE')
  assert.ok(!signed.readiness.blockers.includes('Sign the current benefit deduction authorization'))
  assert.equal((await api('/benefits-deduction-authorization',signing,200,true)).benefitsDeduction.saved.signedAt,signed.benefitsDeduction.saved.signedAt)
  await api('/benefits-deduction-authorization',{...signing,signature:'Different Person'},409,true)
 }else assert.equal(completed.benefitsDeduction.required,false)
 assert.equal(completed.benefitsReview.evidenceReference,undefined)
 await api('/benefits-election',{...choice,choice:'WAIVE',...(structured?{selections:[{planId:'health',optionId:'WAIVE'}]}:{}),requestKey:'benefits-waiver-second'},200,true)
 assert.equal((await packet()).paySetup.status,'NEEDS_REVIEW')
 await review('WAIVED',409,completed.paySetup.fingerprint)
 await review('ENROLLED',400);await review('WAIVED')
 await api('/benefits-election',choice,409,true)
 const history=await api(`/employees/${e.id}/onboarding/${task.id}/history`)
 assert.ok(history.some(r=>r.snapshot.response.benefitsElection?.submissionId===choice.requestKey))
 if(structured)assert.ok(history.some(r=>r.snapshot.response.benefitsDeductionAuthorization?.requestKey==='deduction-authorization-first'))
 await api('/settings',{benefitsText:'Revised employer benefits package'},200,false,'PATCH')
 assert.equal((await packet()).paySetup.status,'NEEDS_REVIEW')
 await review('WAIVED',400)
 await automateBenefitsReviews(h.pool,1,'2026-09-10')
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key=$1",[`benefits-review-${e.id}`])).rows[0].status,'OPEN')
 const unauth=await fetch(`${h.url}/api/payroll/employee/benefits-election`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(choice)});assert.equal(unauth.status,401)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-09-10' WHERE id=$1",[e.id])
 await api('/benefits-election',{...choice,displayedTerms:'Revised employer benefits package',requestKey:'benefits-former-choice'},403,true)
})
