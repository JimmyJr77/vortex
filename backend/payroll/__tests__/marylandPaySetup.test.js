import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {marylandAgreementPaySetup} from '../marylandAgreementPaySetup.js'
test('hiring pay review requires an agreement covering the planned payment and reopens after suspension',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,employee}=await monthlyBenefitsFixture(h)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING' WHERE id=$1",[employee.id])
 await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed Maryland election',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1,extraWithholdingCents:500}},'PATCH')
 const packet=()=>api(`/employees/${employee.id}/onboarding`),initial=await packet(),task=initial.tasks.find(t=>t.task_key==='PAY_REVIEW')
 assert.ok(initial.paySetup.issues.some(issue=>issue.includes('Maryland additional withholding')))
 assert.equal(initial.paySetup.marylandAgreement.paymentDate,'2026-09-18');assert.equal(initial.readiness.ready,false)
 const review=(p,status=200)=>api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Reviewed signed additional withholding and benefit setup',paySetupFingerprint:p.paySetup.fingerprint,benefitsReview:{...task.response.benefitsReview,confirmed:true}},'POST',status)
 await review(initial,409)
 const path=`/employees/${employee.id}/maryland-agreement-proposals`,preview=await api(`${path}/preview?effectiveOn=2026-09-16`)
 await api(path,{sourceFingerprint:preview.sourceFingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,effectiveOn:'2026-09-16',amountCents:500,electionFingerprint:preview.terms.agreement.electionFingerprint,periodBasis:'PAYMENT_DATE'},'POST',201)
 const p=(await api('/maryland-agreement-proposals',undefined,'GET',200,true)).history[0]
 await api(`/maryland-agreement-proposals/${p.id}/respond`,{requestKey:randomUUID(),decision:'ACCEPT',signature:'Monthly Benefits',confirmed:true,proposalFingerprint:p.fingerprint,displayedTerms:p.terms.employeeTerms},'POST',200,true)
 const signed=await packet();assert.equal(signed.paySetup.marylandAgreement.status,'CURRENT');assert.deepEqual(signed.paySetup.issues,[])
 await review(initial,409);await review(signed)
 assert.equal((await packet()).paySetup.status,'CURRENT')
 const [employeeRow,election,settings,savedReview]=await Promise.all([
  h.pool.query('SELECT * FROM payroll_employee WHERE id=$1',[employee.id]),h.pool.query('SELECT * FROM payroll_tax_election WHERE employee_id=$1',[employee.id]),h.pool.query('SELECT * FROM payroll_settings WHERE facility_id=1'),h.pool.query('SELECT * FROM payroll_onboarding_task WHERE id=$1',[task.id])])
 const later=await marylandAgreementPaySetup(h.pool,{facility:1,employee:employeeRow.rows[0],election:election.rows[0],settings:settings.rows[0],review:savedReview.rows[0],today:'2026-09-25'})
 assert.equal(later.paymentDate,'2026-09-18');assert.equal(later.status,'CURRENT')
 await api(`/employees/${employee.id}/maryland-additional-agreements`,{status:'SUSPENDED',expectedRevision:1,requestKey:randomUUID(),confirmed:true,sourceReference:'Synthetic reviewed suspension of signed instructions',effectiveOn:'2026-09-16'},'POST',201)
 const suspended=await packet();assert.equal(suspended.paySetup.status,'NEEDS_REVIEW');assert.equal(suspended.paySetup.marylandAgreement.status,'NEEDS_REVIEW');await review(suspended,409)
})

test('generated agreement review detects persisted payment-date changes and overlapping periods',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,employee}=await monthlyBenefitsFixture(h)
 await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed Maryland election',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1,extraWithholdingCents:500}},'PATCH')
 const current=await api(`/employees/${employee.id}/maryland-additional-agreements`)
 await api(`/employees/${employee.id}/maryland-additional-agreements`,{status:'ACTIVE',expectedRevision:0,requestKey:randomUUID(),confirmed:true,sourceReference:'Synthetic signed additional withholding agreement',effectiveOn:'2026-09-16',amountCents:500,periodBasis:'PAYMENT_DATE',electionFingerprint:current.currentElectionFingerprint},'POST',201)
 await h.pool.query('DELETE FROM payroll_pay_period WHERE facility_id=1')
 const employeeRow=(await h.pool.query('SELECT * FROM payroll_employee WHERE id=$1',[employee.id])).rows[0],election=(await h.pool.query('SELECT * FROM payroll_tax_election WHERE employee_id=$1',[employee.id])).rows[0],settings=(await h.pool.query('SELECT * FROM payroll_settings WHERE facility_id=1')).rows[0]
 const input={facility:1,employee:employeeRow,election,settings,today:'2026-09-12'},generated=await marylandAgreementPaySetup(h.pool,input)
 assert.equal(generated.status,'CURRENT');assert.equal(generated.paymentDate,'2026-09-18');assert.equal(generated.periodId,null)
 const reviewed={...input,review:{response:{paySetup:{basis:{marylandAgreement:generated}}}}}
 const saved=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-09-01','2026-09-15','2026-09-15','SEMIMONTHLY') RETURNING id")).rows[0]
 const earlier=await marylandAgreementPaySetup(h.pool,reviewed)
 assert.equal(earlier.status,'NEEDS_REVIEW');assert.equal(earlier.paymentDate,'2026-09-15');assert.match(earlier.issue,/active signed/)
 await h.pool.query("UPDATE payroll_pay_period SET pay_date='2026-09-18' WHERE id=$1",[saved.id])
 const persisted=await marylandAgreementPaySetup(h.pool,reviewed)
 assert.equal(persisted.status,'CURRENT');assert.equal(persisted.periodId,String(saved.id));assert.deepEqual(persisted.plannedPeriod,generated.plannedPeriod)
 await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-09-07','2026-09-13','2026-09-18','WEEKLY')")
 const overlapping=await marylandAgreementPaySetup(h.pool,reviewed)
 assert.equal(overlapping.status,'NEEDS_REVIEW');assert.match(overlapping.issue,/overlapping/)
})
