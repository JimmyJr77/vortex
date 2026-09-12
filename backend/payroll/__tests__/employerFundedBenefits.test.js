import {employerBenefitFundingReport} from '../employerBenefitFundingReport.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {runWorkforceAutomation} from '../workforceAutomation.js'
for(const {future,authorize,withdraw=true} of [{future:false,authorize:true},{future:true,authorize:true},{future:false,authorize:false},{future:true,authorize:true,withdraw:false}])test(`reviewed employer funding preserves enrollment and dated payroll coverage (${!withdraw?'FUTURE_WITHOUT_WITHDRAWAL':future?'FUTURE':authorize?'CURRENT':'NO_PRIOR_AUTHORIZATION'})`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee,periods}=await monthlyBenefitsFixture(h,{authorize})
 let packet=await api('/onboarding',undefined,'GET',200,true)
 if(authorize&&withdraw)packet=await api('/benefits-deduction-authorization/withdraw',{confirmed:true,requestKey:'employer-funded-withdrawal',authorizationRequestKey:packet.benefitsDeduction.saved.requestKey,onboardingCycle:1},'POST',200,true)
 const task=packet.tasks.find(t=>t.task_key==='PAY_REVIEW'),path=`/employees/${employee.id}/onboarding/${task.id}/review`
 const review={disposition:'ENROLLED_EMPLOYER_FUNDED',effectiveOn:future?'2026-09-20':'2026-09-10',summary:'Employer assumes all selected group medical premiums; coverage continues.',evidenceReference:'Synthetic employer funding and excluded health premium review',confirmed:true,employerFundingConfirmed:true,fundingTreatment:'EXCLUDED_GROUP_HEALTH_PREMIUM'},body={status:'COMPLETE',note:'Verified employer funding after authorization withdrawal',paySetupFingerprint:packet.paySetup.fingerprint,benefitsReview:review}
 await api(path,{...body,benefitsReview:{...review,employerFundingConfirmed:false}},'POST',400)
 await api(path,{...body,benefitsReview:{...review,fundingTreatment:'TAXABLE_FRINGE'}},'POST',400)
 await api(path,body)
 packet=await api('/onboarding',undefined,'GET',200,true);assert.equal(packet.benefitsReview.disposition,'ENROLLED_EMPLOYER_FUNDED');assert.equal(packet.benefitsElection.choice,'ENROLL');assert.equal(packet.benefitsDeduction.required,false)
 const preview=async period=>(await api('/runs/preview',{payPeriodId:period.id})).preview
 const earlier=await preview(periods[0]);assert.equal(earlier.canApprove,!future||!withdraw,JSON.stringify(earlier.warnings))
 if(future&&withdraw)assert.match(earlier.warnings.map(w=>w.message).join(' '),/withdrew/)
 const period=periods[future?1:0],p=await preview(period);assert.equal(p.canApprove,true,JSON.stringify(p.warnings));assert.equal(p.deductionCents,0);assert.equal(p.employees[0].benefitCollection.status,'REVIEWED_EMPLOYER_FUNDED');assert.equal(p.employees[0].benefitCollection.fundingItems[0].employerMonthlyCents,57500);assert.equal(p.employees[0].benefitCollection.fundingItems[0].assumedEmployeeMonthlyCents,12500)
 const run=await api('/runs',{payPeriodId:period.id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:future?'2026-09-30':'2026-09-18',paymentConfirmationReference:'SYNTHETIC-EMPLOYER-FUNDED-WAGES'})
 const saved=(await h.pool.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1',[run.id])).rows[0].calculation_snapshot;assert.equal(saved.employees[0].benefitCollection.review.employerFundingConfirmed,true)
 const fundingPath='/reports/employer-benefit-funding?start=2026-09-01&end=2026-09-30'
 const funding=(await api(fundingPath)).funding;assert.equal(funding.length,1);assert.equal(funding[0].items[0].employerMonthlyCents,57500);assert.equal(funding[0].employeeCollectedCents,0);assert.equal(funding[0].coverageVersions,1);assert.equal(funding[0].payrolls[0].runId,Number(run.id));assert.equal(JSON.stringify(funding).includes('Synthetic employer funding and excluded health premium review'),false)
 assert.equal((await employerBenefitFundingReport(h.pool,2,'2026-09-01','2026-09-30')).length,0)
 assert.equal((await api('/reports/employer-benefit-funding?start=2026-10-01&end=2026-10-31')).funding.length,0)
 await api('/reports/employer-benefit-funding?start=2026-02-30&end=2026-09-30',undefined,'GET',400)
 const csv=await fetch(`${h.url}/api/admin/payroll/reports/employer-benefit-funding.csv?start=2026-09-01&end=2026-09-30`,{headers:{Authorization:'Bearer payroll-test-admin'}});assert.equal(csv.status,200);assert.match(await csv.text(),/575.00/)
 const original=structuredClone(saved),broken=structuredClone(saved);broken.employees[0].benefitCollection.fundingItems[0].employerMonthlyCents++
 await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[broken,run.id]);await api(fundingPath,undefined,'GET',409)
 await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[original,run.id])
 const contributions=await api('/benefit-contributions?start=2026-09-01&end=2026-09-30',undefined,'GET',200,true);assert.equal(contributions.contributions.length,0)
 await runWorkforceAutomation(h.pool,1,{sync:false});assert.notEqual((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`benefit-deduction-authorization-${employee.id}`])).rows[0]?.status,'OPEN')
 assert.equal((await preview(periods[2])).deductionCents,0)
 if(!future){
  const second=await api('/runs',{payPeriodId:periods[1].id},'POST',201);await api(`/runs/${second.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${second.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${second.id}/finalize`,{paymentDate:'2026-09-30',paymentConfirmationReference:'SYNTHETIC-EMPLOYER-FUNDED-SECOND'})
  const combined=(await api(fundingPath)).funding;assert.equal(combined.length,1);assert.equal(combined[0].payrolls.length,2);assert.equal(combined[0].items[0].employerMonthlyCents,57500)
  const narrow=(await api('/reports/employer-benefit-funding?start=2026-09-30&end=2026-09-30')).funding;assert.equal(narrow.length,1);assert.equal(narrow[0].payrolls.length,2)
  const snapshot=(await h.pool.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1',[second.id])).rows[0].calculation_snapshot
  snapshot.employees[0].benefitCollection.review.summary='A second retained funding review in the same coverage month.'
  await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[snapshot,second.id]);const changed=(await api(fundingPath)).funding;assert.equal(changed.length,2);assert.equal(changed.every(g=>g.coverageVersions===2),true)
 }

 if(!withdraw){
  packet=await api('/onboarding',undefined,'GET',200,true)
  await api(path,{...body,paySetupFingerprint:packet.paySetup.fingerprint,benefitsReview:{...review,disposition:'ENROLLED',effectiveOn:'2026-09-01'}})
  packet=await api('/onboarding',undefined,'GET',200,true);assert.equal(packet.benefitsDeduction.status,'STALE');assert.equal((await preview(periods[2])).canApprove,false)
  await api('/benefits-deduction-authorization',{signature:packet.benefitsDeduction.saved.signature,confirmed:true,requestKey:packet.benefitsDeduction.saved.requestKey,onboardingCycle:1,proposalFingerprint:packet.benefitsDeduction.proposal.fingerprint},'POST',409,true)
 }

})
test('employer funding reconciliation retains earlier employee collections without subtracting or duplicating premiums',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee,periods}=await monthlyBenefitsFixture(h)
 const finalize=async(period,paymentDate)=>{const run=await api('/runs',{payPeriodId:period.id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate,paymentConfirmationReference:'SYNTHETIC-FUNDING-RECONCILIATION'});return run}
 const first=await finalize(periods[0],'2026-09-18'),packet=await api('/onboarding',undefined,'GET',200,true),task=packet.tasks.find(t=>t.task_key==='PAY_REVIEW')
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Employer assumes health funding after the first payment',paySetupFingerprint:packet.paySetup.fingerprint,benefitsReview:{disposition:'ENROLLED_EMPLOYER_FUNDED',effectiveOn:'2026-09-20',summary:'Employer funds continued group medical enrollment.',evidenceReference:'Synthetic excluded group health review',confirmed:true,employerFundingConfirmed:true,fundingTreatment:'EXCLUDED_GROUP_HEALTH_PREMIUM'}})
 await finalize(periods[1],'2026-09-30')
 const path='/reports/employer-benefit-funding?start=2026-09-30&end=2026-09-30',funding=(await api(path)).funding
 assert.equal(funding.length,1);assert.equal(funding[0].employeeCollectedCents,12500);assert.equal(funding[0].employeeCollection.runId,Number(first.id));assert.equal(funding[0].items[0].employerMonthlyCents,57500)
 await h.pool.query('UPDATE payroll_run_employee SET posttax_deduction_cents=posttax_deduction_cents+1 WHERE payroll_run_id=$1',[first.id]);await api(path,undefined,'GET',409)
})
