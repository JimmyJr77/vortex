import {taxRows,summarizeTaxRows} from '../taxReconciliation.js'
import {loadSupplementalPaymentHistory} from '../supplementalPaymentHistory.js'
import {retirementAnnualReporting} from '../retirementAnnualReporting.js'
import {employeeSummaryCsv} from '../employeeSummary.js'
import {regularRetirementFixture} from '../testing/regularRetirementFixture.js'
import {benefitContributionReport} from '../benefitContributionReport.js'
import {journalEntries,verifyBenefitPosting} from '../quickbooks.js'
import {priorMonthlyBenefitCollection} from '../monthlyBenefits.js'
import {statementLines} from '../payStatement.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {healthElectionFixture} from '../testing/healthElectionFixture.js'
for(const withRetirement of [false,true])test(`signed qualified health premium collects monthly with retained taxable wages; retirement=${withRetirement}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1b'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHistoricalHarness(t,{retirementNow:()=>new Date('2026-09-11T12:00:00Z')},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const fixture=await healthElectionFixture(h),{api,employee,periods,path,electionBody}=fixture
 const unsigned=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview;assert.equal(unsigned.canApprove,false)
 await api(path,electionBody,'POST',200,true)
 if(withRetirement)await regularRetirementFixture(h,{existingFixture:fixture})
 const deferral=withRetirement?1000:0,roth=withRetirement?400:0
 const finish=async p=>{const run=await api('/runs',{payPeriodId:p.id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:new Date(p.pay_date).toISOString().slice(0,10),paymentConfirmationReference:'SYNTHETIC-HEALTH-PREMIUM'});return run}
 const first=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview
 assert.equal(first.canApprove,true,JSON.stringify(first.warnings));assert.equal(first.employees[0].pretaxDeductionCents,12500+deferral);assert.equal(first.employees[0].posttaxDeductionCents,roth)
 assert.equal(first.employees[0].ficaWageBasis.medicareTaxableCents,7500);assert.equal(first.employees[0].benefitCollection.healthEvidence.length,1)
 const stale=await api('/runs',{payPeriodId:periods[1].id},'POST',201)
 await finish(periods[0])
 await api(`/runs/${stale.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${stale.id}/status`,{status:'APPROVED'},'PATCH',409);await api(`/runs/${stale.id}/status`,{status:'VOID'},'PATCH')
 const next=(await api('/runs/preview',{payPeriodId:periods[1].id})).preview
 assert.equal(next.canApprove,true,JSON.stringify(next.warnings));assert.equal(next.employees[0].benefitCollection.status,'ALREADY_COLLECTED');assert.equal(next.employees[0].pretaxDeductionCents,deferral);assert.equal(next.employees[0].ficaWageBasis.ytdTaxWages.medicareWagesCents,7500)
 await finish(periods[1])
 const third=(await api('/runs/preview',{payPeriodId:periods[2].id})).preview
 assert.equal(third.canApprove,true,JSON.stringify(third.warnings));assert.equal(third.employees[0].pretaxDeductionCents,12500+deferral);assert.equal(third.employees[0].ficaWageBasis.ytdTaxWages.medicareWagesCents,27500)
 await finish(periods[2])
 const rows=(await h.pool.query("SELECT re.* FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id WHERE r.status='FINALIZED' AND re.employee_id=$1 ORDER BY r.id",[employee.id])).rows
 assert.deepEqual(rows.map(r=>Number(r.pretax_deduction_cents)),[12500+deferral,deferral,12500+deferral])
 const supplemental=await loadSupplementalPaymentHistory(h.pool,1,employee.id,'2026-10-31')
 assert.equal(supplemental.reconciled,true,JSON.stringify(supplemental.issues));assert.equal(supplemental.ytdSupplementalCents,0)
 const annual=await retirementAnnualReporting(h.pool,1,employee.id)
 if(withRetirement){assert.equal(annual.pretaxDeferrals,'30.00');assert.equal(annual.rothDeferrals,'12.00')}else assert.equal(annual,null)
 const summary=await employeeSummaryCsv(h.pool,1,'2026-01-01','2026-12-31'),get=label=>summary[1][summary[0].indexOf(label)]
 assert.equal(get('Retained federal income-tax wages'),withRetirement?'320.00':'350.00')
 assert.equal(get('Retained Medicare taxable wages'),'350.00')
 const taxes=await taxRows(h.pool,1,2026),totals=summarizeTaxRows(taxes,'2026-01-01','2026-12-31')
 assert.equal(totals.IRS_FUTA,210);assert.equal(totals.MD_UI,910)
 const firstRun=(await h.pool.query("SELECT id FROM payroll_run WHERE status='FINALIZED' ORDER BY id LIMIT 1")).rows[0].id
 await h.pool.query('UPDATE payroll_run_employee SET futa_tax_cents=futa_tax_cents+1 WHERE payroll_run_id=$1',[firstRun])
 await assert.rejects(taxRows(h.pool,1,2026),/employment tax/)
 await h.pool.query('UPDATE payroll_run_employee SET futa_tax_cents=futa_tax_cents-1 WHERE payroll_run_id=$1',[firstRun])
 const report=await benefitContributionReport(h.pool,1,'2026-09-01','2026-10-31')
 assert.deepEqual(report.slice(1).map(row=>[row[1],row[8],row[9]]),[['2026-09','125.00','PRETAX'],['2026-10','125.00','PRETAX']])
 const runs=(await h.pool.query("SELECT r.*,r.payment_date AS pay_date FROM payroll_run r WHERE r.status='FINALIZED' ORDER BY id")).rows
 for(const run of runs){await verifyBenefitPosting(h.pool,run);const lines=journalEntries(run);assert.equal(lines.reduce((n,line)=>n+(line[2]==='Debit'?line[1]:-line[1]),0),0)}
 const proof=(await h.pool.query("SELECT r.id,r.status,r.run_kind,r.payment_date,r.calculation_snapshot,re.pretax_deduction_cents,re.posttax_deduction_cents FROM payroll_run r JOIN payroll_run_employee re ON re.payroll_run_id=r.id WHERE r.status='FINALIZED' ORDER BY r.id LIMIT 1")).rows[0]
 for(const change of [r=>r.pretax_deduction_cents++,r=>{r.calculation_snapshot.employees[0].benefitCollection.healthEvidence[0].election.signature=''},r=>{delete r.calculation_snapshot.employees[0].benefitCollection.healthEvidence[0].electionCreatedAt},r=>{delete r.calculation_snapshot.employees[0].benefitCollection.healthEvidence},r=>{r.calculation_snapshot.employees[0].benefitCollection.healthEvidence[0].election.action='DECLINE'}]){const invalid=structuredClone(proof);change(invalid);assert.throws(()=>priorMonthlyBenefitCollection([invalid],employee.id,'2026-09'))}
 for(const row of rows)assert.equal(statementLines(row).lines.reduce((n,line)=>n+line[2],0),Number(row.net_pay_cents))
})
