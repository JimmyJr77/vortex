import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {runWorkforceAutomation} from '../workforceAutomation.js'
test('employee withdrawal blocks new collection, rejects old signature replay and allows explicit reauthorization',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee,periods}=await monthlyBenefitsFixture(h)
 const preview=async()=> (await api('/runs/preview',{payPeriodId:periods[0].id})).preview
 assert.equal((await preview()).canApprove,true)
 let packet=await api('/onboarding',undefined,'GET',200,true),saved=packet.benefitsDeduction.saved
 const body={confirmed:true,requestKey:'synthetic-withdrawal-1',authorizationRequestKey:saved.requestKey,onboardingCycle:1},path='/benefits-deduction-authorization/withdraw'
 await api(path,{...body,confirmed:false},'POST',400,true);await api(path,{...body,authorizationRequestKey:'stale-key'},'POST',409,true)
 const unauthorized=await fetch(`${h.url}/api/payroll/employee${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(unauthorized.status,401)
 packet=await api(path,body,'POST',200,true);assert.equal(packet.benefitsDeduction.status,'WITHDRAWN');assert.equal((await api(path,body,'POST',200,true)).benefitsDeduction.status,'WITHDRAWN')
 assert.equal((await preview()).canApprove,false);assert.match((await preview()).warnings.map(w=>w.message).join(' '),/withdrew/)
 await api('/benefits-deduction-authorization',{signature:saved.signature,confirmed:true,requestKey:saved.requestKey,onboardingCycle:1,proposalFingerprint:saved.proposalFingerprint},'POST',409,true)
 await runWorkforceAutomation(h.pool,1,{sync:false});assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`benefit-deduction-authorization-${employee.id}`])).rows[0].status,'OPEN')
 packet=await api('/benefits-deduction-authorization',{signature:'Monthly Benefits',confirmed:true,requestKey:'synthetic-renewed-authorization',onboardingCycle:1,proposalFingerprint:packet.benefitsDeduction.proposal.fingerprint},'POST',200,true)
 assert.equal(packet.benefitsDeduction.status,'CURRENT');assert.equal((await preview()).canApprove,true)
 await api(path,body,'POST',409,true)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(path,{...body,requestKey:'synthetic-withdrawal-2',authorizationRequestKey:packet.benefitsDeduction.saved.requestKey},'POST',200,true)
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-WITHDRAWAL-BLOCKED'},'POST',409)
 assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_audit_log WHERE action='BENEFIT_DEDUCTION_WITHDRAWN'")).rows[0].n,2)
 assert.ok((await h.pool.query("SELECT id FROM payroll_onboarding_revision WHERE employee_id=$1 AND snapshot->'response'->'benefitsDeductionWithdrawal' IS NOT NULL",[employee.id])).rowCount)
 await api(`/runs/${run.id}/status`,{status:'VOID'},'PATCH')
 packet=await api('/onboarding',undefined,'GET',200,true)
 packet=await api('/benefits-election',{choice:'WAIVE',signature:'Monthly Benefits',confirmed:true,displayedTerms:packet.policy.benefitsText,requestKey:'withdrawal-coverage-waiver',selections:[{planId:'medical',optionId:'WAIVE'}],onboardingCycle:1},'POST',200,true)
 assert.equal((await preview()).canApprove,false)
 const task=packet.tasks.find(t=>t.task_key==='PAY_REVIEW')
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Reviewed funding after employee withdrawal',paySetupFingerprint:packet.paySetup.fingerprint,benefitsReview:{disposition:'WAIVED',effectiveOn:'2026-09-10',summary:'Reviewed employee waiver after withdrawal.',evidenceReference:'Synthetic reviewed coverage end',confirmed:true}})
 const waived=await preview();assert.equal(waived.canApprove,true,JSON.stringify(waived.warnings));assert.equal(waived.deductionCents,0)

})

test('a finalized collection before withdrawal covers the month without permitting later deductions',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee,periods}=await monthlyBenefitsFixture(h)
 const finish=async(run,date)=>{await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:date,paymentConfirmationReference:'SYNTHETIC-COLLECTION-BEFORE-WITHDRAWAL'})}
 const first=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await finish(first,'2026-09-18')
 let packet=await api('/onboarding',undefined,'GET',200,true)
 packet=await api('/benefits-deduction-authorization/withdraw',{confirmed:true,requestKey:'after-paid-month-withdrawal',authorizationRequestKey:packet.benefitsDeduction.saved.requestKey,onboardingCycle:1},'POST',200,true)
 const preview=async period=>(await api('/runs/preview',{payPeriodId:period.id})).preview
 let second=await preview(periods[1]);assert.equal(second.canApprove,true,JSON.stringify(second.warnings));assert.equal(second.deductionCents,0);assert.equal(second.employees[0].benefitCollection.status,'ALREADY_COLLECTED');assert.equal(second.employees[0].benefitCollection.withdrawal.authorizationRequestKey,packet.benefitsDeduction.saved.requestKey)
 const before=(await h.pool.query('SELECT finalized_at FROM payroll_run WHERE id=$1',[first.id])).rows[0].finalized_at
 await h.pool.query("UPDATE payroll_run SET finalized_at=$2::timestamptz+interval '1 microsecond' WHERE id=$1",[first.id,packet.benefitsDeduction.withdrawal.recordedAt])
 second=await preview(periods[1]);assert.equal(second.canApprove,false);assert.match(second.warnings.map(w=>w.message).join(' '),/not finalized before withdrawal/)
 await h.pool.query('UPDATE payroll_run SET finalized_at=$2 WHERE id=$1',[first.id,before])
 const run=await api('/runs',{payPeriodId:periods[1].id},'POST',201);await finish(run,'2026-09-30')
 assert.equal(Number((await h.pool.query('SELECT posttax_deduction_cents FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0].posttax_deduction_cents),0)
 const report=await api('/benefit-contributions?start=2026-09-01&end=2026-09-30',undefined,'GET',200,true);assert.equal(report.contributions.length,1);assert.equal(report.contributions[0].amountCents,12500)
 const next=await preview(periods[2]);assert.equal(next.canApprove,false);assert.match(next.warnings.map(w=>w.message).join(' '),/withdrew/)
 await h.pool.query('DELETE FROM payroll_time_entry WHERE employee_id=$1 AND clock_in>=$2',[employee.id,'2026-10-01'])
 const noWages=await preview(periods[2]);assert.equal(noWages.warnings.some(w=>w.code==='BENEFIT_DEDUCTION_REVIEW'),false);assert.equal(noWages.deductionCents,0)
})
