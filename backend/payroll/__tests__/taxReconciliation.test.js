import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeTaxRows } from '../taxReconciliation.js'
test('tax reconciliation separates employer FICA, employee withholding, FUTA, and state liabilities by actual payment date',()=>{
 const row={run_id:1,employee_id:2,payment_date:'2026-10-06',gross:200000,federal_income:15917,social_security:12400,medicare:2900,additional_medicare:100,futa:1200,maryland:13714,md_ui:5200}
 const q3=summarizeTaxRows([row],'2026-07-01','2026-09-30');assert.equal(q3.grossCents,0)
 const q4=summarizeTaxRows([row],'2026-10-01','2026-12-31')
 assert.equal(q4.grossCents,200000);assert.equal(q4.IRS_941,46617);assert.equal(q4.EMPLOYEE_FEDERAL,31317)
 assert.equal(q4.IRS_FUTA,1200);assert.equal(q4.MD_WITHHOLDING,13714);assert.equal(q4.MD_UI,5200);assert.equal(q4.employeeCount,1)
})

test('accelerated Maryland return receipts reconcile independently and retain superseded evidence',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const {createHarness}=await import('../testing/harness.js')
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,facility=1)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const receipt={formType:'MD_MW506M',periodStart:'2026-08-01',periodEnd:'2026-08-07',filedOn:'2026-08-12',reportedWagesCents:0,reportedTaxCents:70000,reference:'SYNTHETIC-ACCELERATED-ORIGINAL',confirmed:true}
 await api('/tax-filings',{...receipt,confirmed:false},400)
 await api('/tax-filings',receipt,201)
 let records=await api('/tax-reconciliation?year=2026')
 assert.equal(records.filings[0].status,'TOTALS_DIFFER')
 assert.equal(records.filings[0].currentTaxCents,0)
 await api('/tax-filings',{...receipt,reportedTaxCents:0,reference:'SYNTHETIC-ACCELERATED-CORRECTED'},201)
 records=await api('/tax-reconciliation?year=2026')
 assert.deepEqual(records.filings.map(f=>f.status),['MATCHED','SUPERSEDED'])
 assert.equal(records.deposits.length,0)
 assert.equal((await api('/tax-reconciliation?year=2026',undefined,200,2)).filings.length,0)
 await api('/tax-filings',{...receipt,reportedTaxCents:0,reference:'SYNTHETIC-ACCELERATED-CORRECTED'},409)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='TAX_FILING_RECORDED' AND after_data->>'form_type'='MD_MW506M'")).rows[0].n,2)
 const corrected=records.filings[0],original=records.filings[1]
 const correction={reason:'Incorrectly transcribed local filing receipt',localRecordOnlyConfirmed:true}
 await api(`/tax-filings/${corrected.id}/void`,{...correction,localRecordOnlyConfirmed:false},400)
 await api(`/tax-filings/${corrected.id}/void`,correction,404,2)
 await api(`/tax-filings/${corrected.id}/void`,correction,201)
 records=await api('/tax-reconciliation?year=2026')
 assert.deepEqual(records.filings.map(f=>f.status),['VOID','TOTALS_DIFFER'])
 assert.equal(records.filings[0].void_reason,correction.reason)
 await api(`/tax-filings/${corrected.id}/void`,correction,404)
 await api(`/tax-filings/${original.id}/void`,correction,201)
 assert.ok((await api('/tax-reconciliation?year=2026')).filings.every(f=>f.status==='VOID'))
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='TAX_FILING_RECEIPT_VOIDED'")).rows[0].n,2)

})

test('tax reconciliation rejects missing, invalid and unsafe finalized amounts instead of zeroing them',()=>{
 const row={run_id:1,employee_id:2,payment_date:'2026-10-06',gross:200000,federal_income:15917,social_security:12400,medicare:2900,additional_medicare:100,futa:1200,maryland:13714,md_ui:5200}
 for(const key of ['gross','federal_income','social_security','medicare','additional_medicare','futa','maryland','md_ui'])for(const value of [null,undefined,'',true,[],{},'1e2',-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>summarizeTaxRows([{...row,[key]:value}],'2026-01-01','2026-12-31'),/incomplete or invalid/)
 assert.throws(()=>summarizeTaxRows([{...row,gross:Number.MAX_SAFE_INTEGER},row],'2026-01-01','2026-12-31'),/precision/)
 assert.equal(summarizeTaxRows([{...row,federal_income:'0',maryland:0}],'2026-01-01','2026-12-31').MD_WITHHOLDING,0)
})

test('missing finalized withholding blocks filing receipts without changing payroll or agency records',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const {createHarness}=await import('../testing/harness.js'),{monthlyBenefitsFixture}=await import('../testing/monthlyBenefitsFixture.js')
 const h=await createHarness();t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-TAX-EVIDENCE'})
 const saved=(await h.pool.query('SELECT federal_income_tax_cents,state_income_tax_cents FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 for(const column of ['federal_income_tax_cents','state_income_tax_cents']){
  await h.pool.query(`UPDATE payroll_run_employee SET ${column}=NULL WHERE payroll_run_id=$1`,[run.id])
  await api('/tax-reconciliation?year=2026',undefined,'GET',409)
  await api('/tax-filings',{formType:'MD_MW506',periodStart:'2026-09-01',periodEnd:'2026-09-30',filedOn:'2026-10-01',reportedWagesCents:20000,reportedTaxCents:0,reference:'SYNTHETIC-INCOMPLETE-EVIDENCE',confirmed:true},'POST',409)
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_tax_filing')).rows[0].n,0)
  await h.pool.query(`UPDATE payroll_run_employee SET ${column}=$2 WHERE payroll_run_id=$1`,[run.id,saved[column]])
 }
 const result=await api('/tax-reconciliation?year=2026');assert.equal(result.annual.grossCents,20000)
 assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_audit_log WHERE action='TAX_FILING_RECORDED'")).rows[0].n,0)
})
