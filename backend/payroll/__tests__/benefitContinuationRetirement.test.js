import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {regularEmployerRetirementFixture} from '../testing/regularEmployerRetirementFixture.js'

test('separated payroll combines reviewed benefits, employee deferrals and employer contributions without changing net-pay classifications',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee,periods}=await regularEmployerRetirementFixture(h)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-09-12' WHERE id=$1",[employee.id])
 await h.pool.query("UPDATE payroll_employment_period SET ended_on='2026-09-12' WHERE employee_id=$1",[employee.id])
 const eligibilityPath=`/employees/${employee.id}/retirement-employer-eligibility/standard`,eligibility=await api(eligibilityPath)
 await api(eligibilityPath,{sourceFingerprint:eligibility.source.fingerprint,expectedRevision:1,requestKey:randomUUID(),confirmed:true,assessedFrom:'2026-09-09',assessedThrough:'2026-09-12',reference:'Synthetic employer review of the actual ended employment interval',matching:{status:'ELIGIBLE',eligibleOn:'2026-09-09',vestedBps:0},nonelective:{status:'ELIGIBLE',eligibleOn:'2026-09-09',vestedBps:0}})
 const row=(await api('/benefit-coverage?month=2026-09')).rows[0]
 await api('/benefit-coverage',{month:row.month,employeeId:row.employeeId,onboardingCycle:row.onboardingCycle,planId:row.planId,sourceFingerprint:row.sourceFingerprint,expectedRevision:0,disposition:'COVERED',carrier:'Synthetic combined coverage carrier',coverageStart:'2026-09-09',coverageEnd:'2026-09-30',reference:'Carrier confirms continued coverage and full signed monthly premium',confirmed:true,requestKey:randomUUID()})
 const path=`/employees/${employee.id}/benefit-continuation`,state=await api(`${path}?paymentDate=2026-09-18`)
 assert.deepEqual(state.source.issues,[])
 await api(path,{paymentDate:'2026-09-18',sourceFingerprint:state.source.fingerprint,expectedRevision:0,disposition:'COLLECT_SIGNED_MONTHLY',reference:'Synthetic verified continued coverage, full monthly charge, signed authorization and wage deduction requirements',confirmed:true,requestKey:randomUUID()})
 const preview=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview,calculated=preview.employees[0]
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
 assert.equal(calculated.grossPayCents,20000);assert.equal(calculated.pretaxDeductionCents,1000);assert.equal(calculated.posttaxDeductionCents,12900)
 assert.deepEqual(calculated.employerContributionReview.obligation,{matchingCents:600,nonelectiveCents:400,totalCents:1000})
 assert.equal(calculated.benefitCollection.monthlyCents,12500)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-COMBINED-FINAL-PAY'})
 const posted=(await h.pool.query('SELECT net_pay_cents,pretax_deduction_cents,posttax_deduction_cents,statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.equal(Number(posted.net_pay_cents),calculated.netPayCents);assert.equal(Number(posted.pretax_deduction_cents),1000);assert.equal(Number(posted.posttax_deduction_cents),12900)
 assert.equal(posted.statement_snapshot.retirement.employerPlans[0].totalCents,1000)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_employer_run_ledger WHERE run_id=$1',[run.id])).rows[0].n,1)
})
