import {employeeRetirementContributions} from '../employeeRetirementContributions.js'
import {retirementRemittanceSources} from '../retirementRemittanceSources.js'
import {refreshRetirementTimingAlerts} from '../retirementTimingAlerts.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {regularEmployerRetirementFixture} from '../testing/regularEmployerRetirementFixture.js'
import {retirementInternalBalances} from '../retirementLedger.js'

for(const declined of [false,true])test(`second ${declined?'employer-only':'combined'} payroll preserves capacity, avoids duplicate benefits and releases voided reservations`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee,periods}=await regularEmployerRetirementFixture(h,{declined})
 const approve=async period=>{
  const run=await api('/runs',{payPeriodId:period.id},'POST',201)
  await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
  return api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 }
 const total=declined?400:2400,employerTotal=declined?400:1000
 const balances=()=>retirementInternalBalances(h.pool,1,employee.id,'standard',2026)
 const first=await approve(periods[0])
 await api(`/runs/${first.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-FIRST-EMPLOYER-PAYROLL'})
 assert.equal((await balances()).totals.annualAdditionsCents,total)
 const contribution=(await employeeRetirementContributions(h.pool,1,employee.id)).items[0].contributions[0]
 assert.equal(contribution.employeeAmountCents,declined?0:1400)
 assert.equal(contribution.employerMatchingCents,declined?0:600)
 assert.equal(contribution.employerNonelectiveCents,400)
 assert.equal(contribution.amountCents,total)
 t.mock.timers.setTime(Date.parse('2026-09-30T16:00:00.000Z'))
 await h.pool.query("CREATE OR REPLACE FUNCTION now() RETURNS timestamptz LANGUAGE sql STABLE AS $$ SELECT '2026-09-30T16:00:00Z'::timestamptz $$; CREATE OR REPLACE FUNCTION clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$ SELECT '2026-09-30T16:00:00Z'::timestamptz $$")
 const eligibilityPath=`/employees/${employee.id}/retirement-employer-eligibility/standard`,eligibility=await api(eligibilityPath)
 await api(eligibilityPath,{sourceFingerprint:eligibility.source.fingerprint,expectedRevision:1,requestKey:randomUUID(),confirmed:true,assessedFrom:'2026-09-09',assessedThrough:'2026-09-30',reference:'Synthetic reviewed continued eligibility across the second payroll period',matching:{status:'ELIGIBLE',eligibleOn:'2026-09-09',vestedBps:0},nonelective:{status:'ELIGIBLE',eligibleOn:'2026-09-09',vestedBps:0}})
 const preview=(await api('/runs/preview',{payPeriodId:periods[1].id})).preview
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
 const calculated=preview.employees[0]
 assert.equal(calculated.posttaxDeductionCents,declined?0:400)
 assert.equal(calculated.pretaxDeductionCents,declined?0:1000)
 assert.equal(calculated.employerContributionReview.priorRecords.length,1)
 assert.equal(calculated.employerContributionReview.priorRecords[0].runId,String(first.id))
 assert.deepEqual(calculated.employerContributionReview.obligation,{matchingCents:declined?0:600,nonelectiveCents:400,totalCents:employerTotal})
 const second=await approve(periods[1])
 assert.equal((await balances()).totals.annualAdditionsCents,total*2)
 await api(`/runs/${second.id}/status`,{status:'VOID'},'PATCH')
 assert.equal((await balances()).totals.annualAdditionsCents,total)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_employer_run_ledger')).rows[0].n,2)
 const replacement=await approve(periods[1])
 await api(`/runs/${replacement.id}/finalize`,{paymentDate:'2026-09-30',paymentConfirmationReference:'SYNTHETIC-SECOND-EMPLOYER-PAYROLL'})
 assert.equal((await balances()).totals.annualAdditionsCents,total*2)
 const statement=(await h.pool.query('SELECT statement_snapshot,posttax_deduction_cents FROM payroll_run_employee WHERE payroll_run_id=$1 AND employee_id=$2',[replacement.id,employee.id])).rows[0]
 assert.equal(Number(statement.posttax_deduction_cents),declined?0:400)
 assert.equal(statement.statement_snapshot.retirement.employerPlans[0].totalCents,employerTotal)
 const source=(await retirementRemittanceSources(h.pool,1,{runId:replacement.id})).items[0]
 assert.equal(source.status,'DELIVERY_UNVERIFIED');assert.equal(source.totalCents,total)
 assert.equal(source.allocations[0].employeeTotalCents,declined?0:1400)
 assert.equal(source.allocations[0].employerNonelectiveCents,400)
 assert.equal((await refreshRetirementTimingAlerts(h.pool,1)).checked,2)
 assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_alert WHERE dedupe_key LIKE 'retirement-timing-%' AND status='OPEN'")).rows[0].n,2)
})
