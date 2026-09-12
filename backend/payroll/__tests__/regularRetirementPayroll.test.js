import {regularRetirementFixture} from '../testing/regularRetirementFixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementAnnualReporting} from '../retirementAnnualReporting.js'
import {retirementOffCycleWarnings} from '../regularRetirementPayroll.js'
import {loadSupplementalPaymentHistory} from '../supplementalPaymentHistory.js'

test('regular payroll calculates reviewed retirement, retains approval ledger and finalizes separate benefit and retirement deductions',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness({retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const {api,employee,periods,preview,processingPath,processing}=await regularRetirementFixture(h)
 const first=await preview(periods[0]),calculated=first.employees[0]
 assert.equal(first.canApprove,true,JSON.stringify(first.warnings));assert.equal(calculated.pretaxDeductionCents,1000);assert.equal(calculated.posttaxDeductionCents,12900)
 assert.equal(calculated.retirementPlans[0].calculation.requiresPayrollIntegration,false);assert.equal(calculated.incomeTaxWageBasis.federalWagesCents,19000)
 assert.equal(calculated.netPayCents,calculated.grossPayCents+calculated.reimbursementCents-first.employeeTaxCents-calculated.totalDeductionCents)
 const stale=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${stale.id}/status`,{status:'REVIEW'},'PATCH')
 await api(processingPath,{planRevisionId:processing.planRevisionId,expectedRevision:1,requestKey:randomUUID(),review:{disposition:'REVIEWED',catchUpAuthorized:false,confirmed:true,reference:'Synthetic renewed processing review with unchanged amounts',policies:processing.policies}})
 await api(`/runs/${stale.id}/status`,{status:'APPROVED'},'PATCH',409);await api(`/runs/${stale.id}/status`,{status:'VOID'},'PATCH')
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_run_ledger WHERE run_id=$1',[run.id])).rows[0].n,1)
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-REGULAR-RETIREMENT'})
 const posted=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.equal(posted.statement_snapshot.retirement.plans[0].ordinaryPretaxCents,1000);assert.equal(posted.statement_snapshot.retirement.plans[0].ordinaryRothCents,400)
 const annualReport=await retirementAnnualReporting(h.pool,1,employee.id);assert.equal(annualReport.pretaxDeferrals,'10.00');assert.equal(annualReport.rothDeferrals,'4.00')
 const supplementalHistory=await loadSupplementalPaymentHistory(h.pool,1,employee.id,'2026-09-30');assert.equal(supplementalHistory.reconciled,true,JSON.stringify(supplementalHistory.issues));assert.equal(supplementalHistory.evidence[0].grossCents,20000);assert.equal(supplementalHistory.evidence[0].incomeTaxGrossCents,19000);assert.equal(supplementalHistory.ytdSupplementalCents,0)
 const next=await preview(periods[1]);assert.equal(next.canApprove,true,JSON.stringify(next.warnings));assert.equal(next.employees[0].benefitCollection.status,'ALREADY_COLLECTED');assert.equal(next.employees[0].posttaxDeductionCents,400)
 assert.equal((await retirementOffCycleWarnings(h.pool,1,employee.id,'2026-09-30'))[0].blocking,true);assert.deepEqual(await retirementOffCycleWarnings(h.pool,2,employee.id,'2026-09-30'),[])
 await api(processingPath,{planRevisionId:processing.planRevisionId,expectedRevision:2,requestKey:randomUUID(),review:{disposition:'SUSPENDED',catchUpAuthorized:false,confirmed:true,reference:'Synthetic suspension stops regular payroll processing',policies:processing.policies}})
 assert.equal((await preview(periods[1])).canApprove,false)
 await api(processingPath,{planRevisionId:processing.planRevisionId,expectedRevision:3,requestKey:randomUUID(),review:{disposition:'REVIEWED',catchUpAuthorized:false,confirmed:true,reference:'Synthetic restored regular payroll processing',policies:processing.policies}})
 await api('/retirement/standard/elections',{action:'ELECT',method:'PERCENTAGE',pretax:0,roth:10000,signature:'Monthly Benefits',confirmed:true,effectiveOn:'2026-09-19',expectedRevision:1,requestKey:randomUUID(),proposalFingerprint:(await api('/retirement',undefined,'GET',200,true)).plans[0].proposal.fingerprint},'POST',200,true)
 const unaffordable=await preview(periods[1]);assert.equal(unaffordable.canApprove,false);assert.ok(unaffordable.warnings.some(w=>w.code==='RETIREMENT_PAYROLL_REVIEW'))
 await api('/retirement/standard/elections',{action:'DECLINE',pretax:0,roth:0,signature:'Monthly Benefits',confirmed:true,effectiveOn:'2026-09-19',expectedRevision:2,requestKey:randomUUID(),proposalFingerprint:(await api('/retirement',undefined,'GET',200,true)).plans[0].proposal.fingerprint},'POST',200,true)
 const declined=await preview(periods[1]);assert.equal(declined.canApprove,true,JSON.stringify(declined.warnings));assert.equal(declined.employees[0].pretaxDeductionCents,0);assert.equal(declined.employees[0].posttaxDeductionCents,0);assert.equal(declined.employees[0].retirementPlans[0].calculation.notAppliedReason,'DECLINED')
})
