import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {createHarness} from '../testing/harness.js'
import {refreshBenefitCoverageAlerts} from '../benefitCoverageAutomation.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
test('monthly coverage includes enrollment without finalized wages and binds carrier invoice evidence',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee,periods}=await monthlyBenefitsFixture(h)
 const path='/benefit-coverage',get=()=>api(`${path}?month=2026-09`)
 let ledger=await get();assert.equal(ledger.rows.length,1);let row=ledger.rows[0];assert.equal(row.employeeId,String(employee.id));assert.equal(row.status,'NEEDS_REVIEW');assert.equal(row.payrolls.length,0);assert.equal(row.employeeCollectedCents,0)
 await api(`${path}?month=2026-99`,undefined,'GET',400)
 await refreshBenefitCoverageAlerts(h.pool,1,'2026-09-30');const alertKey=`benefit-coverage:2026-09:${row.employeeId}:${row.onboardingCycle}:${row.planId}`;assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[alertKey])).rows[0].status,'OPEN')
 const body={month:'2026-09',employeeId:row.employeeId,onboardingCycle:row.onboardingCycle,planId:row.planId,sourceFingerprint:row.sourceFingerprint,expectedRevision:0,disposition:'COVERED',carrier:'Synthetic Coverage Carrier',coverageStart:'2026-09-01',coverageEnd:'2026-09-30',reference:'Carrier confirmed coverage before the first finalized wages',confirmed:true,requestKey:randomUUID()}
 await api(path,{...body,coverageStart:'2026-08-31'},'POST',400)
 const saved=await Promise.all([api(path,body),api(path,body)]);assert.equal(saved[0].id,saved[1].id)
 await api(path,{...body,reference:'Changed reference using the same request key'},'POST',409)
 await api(path,{...body,requestKey:randomUUID()},'POST',409)
 ledger=await get();row=ledger.rows[0];assert.equal(row.status,'REVIEWED');assert.equal(row.history.length,1)
 await refreshBenefitCoverageAlerts(h.pool,1,'2026-09-30');assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[alertKey])).rows[0].status,'DISMISSED')
 const invoices=await api('/benefit-carrier-invoices?month=2026-09');assert.equal(invoices.source.coverage[0].current.id,saved[0].id)
 const invoice=await api('/benefit-carrier-invoices',{month:'2026-09',carrier:body.carrier,invoiceNumber:'NO-PAY-SEP',invoiceDate:'2026-09-01',dueDate:'2026-09-30',amountCents:57500,reference:'Synthetic actual carrier invoice before first payroll',reconciliation:'Reviewed coverage and employer funding separately from uncollected employee contributions',confirmed:true,fingerprint:invoices.source.fingerprint,coverageReviewIds:[saved[0].id]})
 assert.ok(invoice.id)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-COVERAGE-WAGES'})
 row=(await get()).rows[0];assert.equal(row.status,'REVIEWED');assert.equal(row.payrolls.length,1);assert.equal(row.employeeCollectedCents,12500)
 assert.equal((await api('/benefit-carrier-invoices?month=2026-09')).history[0].current,false)
 const packet=await api('/onboarding',undefined,'GET',200,true),task=packet.tasks.find(row=>row.task_key==='PAY_REVIEW')
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Review employer funded continuation for the rest of the month',paySetupFingerprint:packet.paySetup.fingerprint,benefitsReview:{disposition:'ENROLLED_EMPLOYER_FUNDED',effectiveOn:'2026-09-20',summary:'Employer assumes the employee share for continued health coverage.',evidenceReference:'Synthetic excluded group health funding change',confirmed:true,employerFundingConfirmed:true,fundingTreatment:'EXCLUDED_GROUP_HEALTH_PREMIUM'}})
 row=(await get()).rows[0];assert.equal(row.status,'STALE');assert.equal(row.decisions.length,2)
 await api(path,{...body,expectedRevision:1,requestKey:randomUUID()},'POST',409)
 await api(path,{...body,sourceFingerprint:row.sourceFingerprint,expectedRevision:1,requestKey:randomUUID(),reference:'Reverified actual carrier coverage after employer funding change'})
 await api(path,{...body,sourceFingerprint:row.sourceFingerprint,expectedRevision:2,disposition:'RETRACTED',requestKey:randomUUID(),reference:'Retract incorrect carrier confirmation while preserving original evidence'})
 row=(await get()).rows[0];assert.equal(row.status,'NEEDS_REVIEW');assert.equal(row.history.length,3);assert.equal(row.history[2].review.reference,body.reference)
 await refreshBenefitCoverageAlerts(h.pool,1,'2026-09-30');assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[alertKey])).rows[0].status,'OPEN')
 const october=await api(`${path}?month=2026-10`);assert.equal(october.rows.length,1);assert.equal(october.rows[0].payrolls.length,0);assert.equal(october.rows[0].decisions[0].disposition,'ENROLLED_EMPLOYER_FUNDED')
 await h.pool.query('UPDATE payroll_run_employee SET posttax_deduction_cents=posttax_deduction_cents+1 WHERE payroll_run_id=$1',[run.id]);const failure=await refreshBenefitCoverageAlerts(h.pool,1,'2026-09-30');assert.equal(failure.failed,1);assert.equal(failure.checked,1);assert.equal((await h.pool.query("SELECT last_status FROM payroll_benefit_coverage_check WHERE facility_id=1 AND coverage_month='2026-09'")).rows[0].last_status,'FAILED')
 await h.pool.query('UPDATE payroll_run_employee SET posttax_deduction_cents=posttax_deduction_cents-1 WHERE payroll_run_id=$1',[run.id]);assert.equal((await refreshBenefitCoverageAlerts(h.pool,1,'2026-09-30')).failed,0)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED' WHERE id=$1",[employee.id]);const continuation=(await api(`${path}?month=2026-10`)).rows[0];assert.equal(continuation.employmentStatus,'TERMINATED');assert.equal(continuation.payrolls.length,0)
 const catchup=await refreshBenefitCoverageAlerts(h.pool,1,'2027-01-15');assert.equal(catchup.failed,0);assert.equal(catchup.checked,5);assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`benefit-coverage:2026-10:${row.employeeId}:${row.onboardingCycle}:${row.planId}`])).rows[0].status,'OPEN')
 const foreign=await fetch(`${h.url}/api/admin/payroll${path}?month=2026-09`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.deepEqual((await foreign.json()).data.rows,[])
 await assert.rejects(h.pool.query('DELETE FROM payroll_benefit_coverage_review'),/append-only/)
 await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.equal((await get()).rows[0].history.length,3)
})
test('removed enrollment preserves monthly evidence and allows explicit retraction',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee}=await monthlyBenefitsFixture(h)
 const row=(await api('/benefit-coverage?month=2026-09')).rows[0],body={month:'2026-09',employeeId:row.employeeId,onboardingCycle:row.onboardingCycle,planId:row.planId,sourceFingerprint:row.sourceFingerprint,expectedRevision:0,disposition:'COVERED',carrier:'Synthetic Coverage Carrier',coverageStart:'2026-09-01',coverageEnd:'2026-09-30',reference:'Original retained coverage review before corrected hiring evidence',confirmed:true,requestKey:randomUUID()}
 await api('/benefit-coverage',body)
 let packet=await api('/onboarding',undefined,'GET',200,true)
 packet=await api('/benefits-election',{choice:'WAIVE',signature:'Monthly Benefits',confirmed:true,displayedTerms:packet.policy.benefitsText,requestKey:'coverage-ledger-waived-election',selections:[{planId:'medical',optionId:'WAIVE'}],onboardingCycle:1},'POST',200,true)
 const task=packet.tasks.find(row=>row.task_key==='PAY_REVIEW')
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Corrected benefits disposition with retained employee waiver',paySetupFingerprint:packet.paySetup.fingerprint,benefitsReview:{disposition:'WAIVED',effectiveOn:'2026-09-01',summary:'Employee waived offered coverage for this period.',evidenceReference:'Reviewed corrected waiver and carrier records',confirmed:true}})
 const changed=(await api('/benefit-coverage?month=2026-09')).rows[0];assert.equal(changed.status,'SOURCE_CHANGED');assert.equal(changed.sourceFingerprint,null);assert.equal(changed.history[0].review.reference,body.reference)
 await api('/benefit-coverage',{...body,expectedRevision:1,sourceFingerprint:null,requestKey:randomUUID()},'POST',409)
 await api('/benefit-coverage',{...body,expectedRevision:1,sourceFingerprint:null,disposition:'RETRACTED',reference:'Retracted monthly review after corrected employee waiver evidence',requestKey:randomUUID()})
 assert.equal((await api('/benefit-coverage?month=2026-09')).rows[0].status,'RETRACTED')
 await refreshBenefitCoverageAlerts(h.pool,1,'2026-09-30');assert.equal((await h.pool.query("SELECT 1 FROM payroll_alert WHERE facility_id=1 AND dedupe_key LIKE 'benefit-coverage:2026-09:%' AND status='OPEN'")).rowCount,0)
})
