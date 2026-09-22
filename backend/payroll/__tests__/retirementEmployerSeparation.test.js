import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {regularEmployerRetirementFixture} from '../testing/regularEmployerRetirementFixture.js'
import {employerPayrollEligibilityCoverage} from '../retirementEmployerEligibilityPeriod.js'

test('separation coverage uses only complete dated earnings within the recorded employment interval',()=>{
 const source={employeeId:'7',hireDate:'2026-09-09',terminationDate:'2026-09-12',employmentPeriods:[{id:'3',started_on:'2026-09-09',ended_on:'2026-09-12'}]}
 const segment={employeeId:7,employmentStart:source.hireDate,start:source.hireDate,end:source.terminationDate}
 const preview={employmentCompensation:[segment],payItems:[{kind:'REGULAR'}]}
 const result=employerPayrollEligibilityCoverage(source,preview,'2026-09-01','2026-09-15')
 assert.equal(result.periodStart,'2026-09-09');assert.equal(result.periodEnd,'2026-09-12')
 assert.equal(result.payrollPeriodEnd,'2026-09-15');assert.equal(result.clippedForSeparation,true)
 assert.equal(employerPayrollEligibilityCoverage({...source,terminationDate:'2027-01-01',employmentPeriods:[{...source.employmentPeriods[0],ended_on:'2027-01-01'}]},{...preview,employmentCompensation:[{...segment,end:'2026-09-15'}]},'2026-09-01','2026-09-15').periodEnd,'2026-09-15')
 const prior={...source,hireDate:'2026-08-01',employmentPeriods:[{id:'3',started_on:'2026-08-01',ended_on:source.terminationDate}]}
 assert.equal(employerPayrollEligibilityCoverage(prior,{...preview,employmentCompensation:[{...segment,employmentStart:prior.hireDate,start:'2026-09-01'}]},'2026-09-01','2026-09-15').periodEnd,'2026-09-12')
 for(const patch of [{employmentCompensation:[{...segment,end:'2026-09-15'}]},{employmentCompensation:[{...segment,end:'2026-09-11'}]},{employmentCompensation:[segment,segment]},{payItems:[{kind:'BONUS'}]},{authorizedSettlement:{id:1}}])assert.throws(()=>employerPayrollEligibilityCoverage(source,{...preview,...patch},'2026-09-01','2026-09-15'),{status:409})
 for(const patch of [{terminationDate:'2026-09-08'},{terminationDate:'2026-02-30'},{employmentPeriods:[{...source.employmentPeriods[0],ended_on:null}]},{employmentPeriods:[{...source.employmentPeriods[0],ended_on:'2026-09-11'}]}])assert.throws(()=>employerPayrollEligibilityCoverage({...source,...patch},preview,'2026-09-01','2026-09-15'),{status:409})
})

for(const declined of [false,true])test(`separated employee completes regular ${declined?'employer-only':'combined'} retirement payroll using employment-period review`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee,periods}=await regularEmployerRetirementFixture(h,{declined})
 // This scenario has no benefit deductions; continuation premiums need their own review.
 let packet=await api('/onboarding',undefined,'GET',200,true)
 packet=await api('/benefits-election',{choice:'WAIVE',signature:'Monthly Benefits',confirmed:true,displayedTerms:packet.policy.benefitsText,requestKey:'separation-benefit-waiver',selections:[{planId:'medical',optionId:'WAIVE'}],onboardingCycle:1},'POST',200,true)
 const payReview=packet.tasks.find(task=>task.task_key==='PAY_REVIEW')
 await api(`/employees/${employee.id}/onboarding/${payReview.id}/review`,{status:'COMPLETE',note:'Reviewed waiver before separation payroll',paySetupFingerprint:packet.paySetup.fingerprint,benefitsReview:{disposition:'WAIVED',effectiveOn:'2026-09-09',summary:'Reviewed signed waiver of synthetic coverage.',evidenceReference:'Synthetic reviewed coverage waiver',confirmed:true}})
 // Seed the separated employment state; all contribution reviews and payroll actions use public APIs.
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-09-12' WHERE id=$1",[employee.id])
 await h.pool.query("UPDATE payroll_employment_period SET ended_on='2026-09-12' WHERE employee_id=$1",[employee.id])
 const path=`/employees/${employee.id}/retirement-employer-eligibility/standard`,state=await api(path)
 await api(path,{sourceFingerprint:state.source.fingerprint,expectedRevision:1,requestKey:randomUUID(),confirmed:true,assessedFrom:'2026-09-09',assessedThrough:'2026-09-12',reference:'Synthetic review covers the actual ended employment interval',matching:{status:'ELIGIBLE',eligibleOn:'2026-09-09',vestedBps:0},nonelective:{status:'ELIGIBLE',eligibleOn:'2026-09-09',vestedBps:0}})
 const preview=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
 const employeePreview=preview.employees.find(e=>String(e.employeeId)===String(employee.id))
 assert.deepEqual(employeePreview.employerContributionReview.obligation,{matchingCents:declined?0:600,nonelectiveCents:400,totalCents:declined?400:1000})
 assert.equal(employeePreview.employerCompensationPreview.eligibility.coverage.periodEnd,'2026-09-12')
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-SEPARATED-EMPLOYER-PAYROLL'})
 const ledger=(await h.pool.query('SELECT matching_cents,nonelective_cents FROM payroll_retirement_employer_run_ledger WHERE run_id=$1',[run.id])).rows[0]
 assert.equal(Number(ledger.matching_cents),declined?0:600);assert.equal(Number(ledger.nonelective_cents),400)
 const posted=(await h.pool.query('SELECT statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.equal(posted.statement_snapshot.retirement.employerPlans[0].totalCents,declined?400:1000)
})
