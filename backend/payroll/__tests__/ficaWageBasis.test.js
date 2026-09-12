import {employeeSummaryCsv} from '../employeeSummary.js'
import {reconcileFicaWageRows} from '../ficaWageReconciliation.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
test('FICA wage bases are fingerprinted and retained through finalization',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 const snapshot=(await h.pool.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1',[run.id])).rows[0].calculation_snapshot
 const basis=snapshot.employees[0].ficaWageBasis
 assert.equal(basis.socialSecurityTaxableCents,20000);assert.equal(basis.medicareTaxableCents,20000);assert.equal(basis.additionalMedicareTaxableCents,0)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
 const changed=structuredClone(snapshot);changed.employees[0].ficaWageBasis.socialSecurityTaxableCents++
 await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$2 WHERE id=$1',[run.id,changed])
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH',409)
 await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$2 WHERE id=$1',[run.id,snapshot])
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-FICA-BASIS-RETENTION'})
 const paid=(await h.pool.query('SELECT statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.deepEqual(paid.statement_snapshot.ficaWageBasis,basis)
 const summary=await employeeSummaryCsv(h.pool,1,'2026-01-01','2026-12-31')
 assert.deepEqual(summary[1].slice(29,34),['200.00','200.00','0.00',1,'RECONCILED FINALIZED WAGE BASES'])
 assert.equal((await employeeSummaryCsv(h.pool,2,'2026-01-01','2026-12-31')).length,1)
 assert.deepEqual((await h.pool.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1',[run.id])).rows[0].calculation_snapshot.employees[0].ficaWageBasis,basis)
})


test('wage reconciliation detects missing, duplicate and inconsistent source evidence',()=>{
 const basis={version:1,calculationReference:'us-md-2026-preview-v1',grossWagesCents:101,ytdWagesBeforeCents:18449950,socialSecurityWageBaseCents:18450000,additionalMedicareThresholdCents:20000000,socialSecurityTaxableCents:50,medicareTaxableCents:101,additionalMedicareTaxableCents:0}
 const row={run_id:1,run_kind:'REGULAR',payment_date:'2026-09-18',employee_id:1,regular_pay_cents:'101',overtime_pay_cents:'0',other_taxable_pay_cents:'0',social_security_tax_cents:'3',medicare_tax_cents:'1',additional_medicare_tax_cents:'0',calculation_snapshot:{employees:[{employeeId:1,grossPayCents:101,ficaWageBasis:basis}]},statement_snapshot:{ficaWageBasis:basis}}
 const check=rows=>reconcileFicaWageRows(rows).get('1')
 assert.deepEqual(check([row]),{verified:1,issues:[],socialSecurity:50n,medicare:101n,additionalMedicare:0n})
 assert.match(check([row,row]).issues[0],/duplicate/)
 assert.match(check([{...row,statement_snapshot:{}}]).issues[0],/differ/)
 assert.match(check([{...row,calculation_snapshot:{employees:{}}}]).issues[0],/missing/)
 assert.match(check([{...row,calculation_snapshot:{employees:[{employeeId:1}]}}]).issues[0],/missing/)
 assert.match(check([{...row,social_security_tax_cents:'4'}]).issues[0],/posted taxes/)
 assert.match(check([{...row,payment_date:'2027-09-18'}]).issues[0],/unsupported/)
})
