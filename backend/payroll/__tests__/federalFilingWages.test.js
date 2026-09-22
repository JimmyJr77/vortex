import test from 'node:test'
import assert from 'node:assert/strict'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {healthElectionFixture} from '../testing/healthElectionFixture.js'
import {summarizeTaxRows,filingWages} from '../taxReconciliation.js'

test('federal filing comparisons require explicit wages and preserve genuine zero wages',()=>{
 const row={run_id:1,employee_id:1,payment_date:'2026-09-18',gross:20000,federal_income:0,social_security:465,medicare:109,additional_medicare:0,futa:45,maryland:0,md_ui:195}
 const summary=value=>summarizeTaxRows([{...row,federal_wages:value}],'2026-07-01','2026-09-30')
 for(const value of [null,undefined,'',true,20001,1.5,-1])assert.equal(filingWages(summary(value),'IRS_941'),null)
 assert.equal(filingWages(summary('0'),'W2_W3'),0)
 assert.equal(filingWages(summary('7500'),'IRS_941'),7500)
 assert.equal(filingWages(summary('7500'),'MD_MW508'),20000)
})

test('pretax health payroll reconciles federal form wages, preserves old receipts and blocks missing evidence',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1b'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,periods,path,electionBody}=await healthElectionFixture(h);await api(path,electionBody,'POST',200,true)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-FEDERAL-WAGE-RECONCILIATION'})
 t.mock.timers.setTime(Date.parse('2027-01-15T16:00:00Z'))
 let records=await api('/tax-reconciliation?year=2026')
 assert.equal(records.quarters[2].grossCents,20000);assert.equal(records.quarters[2].federalWagesCents,7500)
 const receipt={formType:'IRS_941',periodStart:'2026-07-01',periodEnd:'2026-09-30',filedOn:'2026-10-15',reportedWagesCents:20000,reportedTaxCents:records.quarters[2].agencies.find(a=>a.agency==='IRS_941').liabilityCents,reference:'SYNTHETIC-GROSS-WAGES-ERROR',confirmed:true}
 await api('/tax-filings',receipt,'POST',201)
 assert.equal((await api('/tax-reconciliation?year=2026')).filings[0].status,'TOTALS_DIFFER')
 const saved=await api('/tax-filings',{...receipt,reportedWagesCents:7500,reference:'SYNTHETIC-941-LINE-2'},'POST',201)
 assert.equal((await api('/tax-reconciliation?year=2026')).filings[0].status,'MATCHED')
 await h.pool.query("UPDATE payroll_tax_filing SET payroll_snapshot=payroll_snapshot-'reportingBasisVersion' WHERE id=$1",[saved.id])
 assert.equal((await api('/tax-reconciliation?year=2026')).filings[0].status,'WAGE_BASIS_REVIEW_REQUIRED')
 await api('/tax-filings',{...receipt,formType:'W2_W3',periodStart:'2026-01-01',periodEnd:'2026-12-31',filedOn:'2027-01-15',reportedWagesCents:7500,reportedTaxCents:records.annual.EMPLOYEE_FEDERAL,reference:'SYNTHETIC-W3-BOX-1'},'POST',201)
 records=await api('/tax-reconciliation?year=2026');assert.equal(records.filings[0].status,'MATCHED');assert.equal(records.filings[0].currentWagesCents,7500)
 await h.pool.query("UPDATE payroll_run_employee SET statement_snapshot=statement_snapshot-'incomeTaxWageBasis' WHERE payroll_run_id=$1",[run.id])
 records=await api('/tax-reconciliation?year=2026');assert.equal(records.quarters[2].federalWagesCents,null);assert.equal(records.filings[0].status,'WAGE_BASIS_REVIEW_REQUIRED')
 await api('/tax-filings',{...receipt,reference:'SYNTHETIC-MISSING-BASIS'},'POST',409)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_tax_filing')).rows[0].n,3)
})
