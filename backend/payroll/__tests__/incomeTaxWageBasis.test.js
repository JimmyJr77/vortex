import {employeeSummaryCsv} from '../employeeSummary.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
for(const manual of [false,true])test(`income-tax wage basis retention follows finalized withholding: manual=${manual}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 const snapshot=(await h.pool.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1',[run.id])).rows[0].calculation_snapshot
 const frozen=snapshot.employees[0],basis=frozen.incomeTaxWageBasis
 assert.equal(basis.federalWagesCents,20000);assert.equal(basis.marylandWagesCents,20000)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
 const changed=structuredClone(snapshot);changed.employees[0].incomeTaxWageBasis.federalWagesCents++
 await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$2 WHERE id=$1',[run.id,changed])
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH',409)
 await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$2 WHERE id=$1',[run.id,snapshot])
 if(manual)await api(`/runs/${run.id}/employees/${employee.id}/withholding`,{federalIncomeTaxCents:frozen.federalIncomeTaxCents+1,stateIncomeTaxCents:frozen.stateIncomeTaxCents+1,sourceNote:'Synthetic independently reviewed withholding adjustment',professionalConfirmed:true},'PATCH')
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-INCOME-BASIS-RETENTION'})
 const paid=(await h.pool.query('SELECT statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.deepEqual(paid.statement_snapshot.incomeTaxWageBasis,manual?null:basis)
 assert.deepEqual(paid.statement_snapshot.ficaWageBasis,frozen.ficaWageBasis)
 if(manual){
  const path=`/runs/${run.id}/employees/${employee.id}/income-tax-basis`,proposal=await api(path)
  const body={sourceFingerprint:proposal.sourceFingerprint,federalWagesCents:20000,marylandWagesCents:20000,evidenceReference:'Synthetic signed wage-basis reconciliation worksheet',confirmed:true,requestKey:'income-tax-basis-review-test'}
  await api(path,{...body,confirmed:false},'POST',400)
  await api(path,{...body,federalWagesCents:20001},'POST',400)
  const saved=await api(path,body,'POST',201);assert.equal((await api(path,body)).reused,true)
  await api(path,{...body,marylandWagesCents:19999},'POST',409)
  const history=await api(path);assert.equal(history.reviews.length,1);assert.equal(history.reviews[0].current,true)
  assert.deepEqual((await employeeSummaryCsv(h.pool,1,'2026-01-01','2026-12-31'))[1].slice(-4),['200.00','200.00',1,'RECONCILED INCOME-TAX WAGE BASES (1 reviewed record)'])
  assert.equal((await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}})).status,404)
  assert.equal((await fetch(`${h.url}/api/admin/payroll${path}`)).status,401)
  await assert.rejects(h.pool.query('UPDATE payroll_income_tax_basis_review SET federal_wages_cents=0 WHERE id=$1',[saved.id]),/append-only/)
  await h.pool.query('UPDATE payroll_run_employee SET federal_income_tax_cents=federal_income_tax_cents+1 WHERE payroll_run_id=$1',[run.id])
  assert.equal((await api(path)).reviews[0].current,false)
  const staleSummary=(await employeeSummaryCsv(h.pool,1,'2026-01-01','2026-12-31'))[1].slice(-4);assert.deepEqual(staleSummary.slice(0,3),['','',0]);assert.match(staleSummary[3],/stale or inconsistent/)
  await api(path,body,'POST',409)
  await h.pool.query('UPDATE payroll_run_employee SET federal_income_tax_cents=federal_income_tax_cents-1 WHERE payroll_run_id=$1',[run.id])
  await api(path,{...body,requestKey:'income-tax-basis-review-next',marylandWagesCents:19999},'POST',201)
  assert.deepEqual((await api(path)).reviews.map(r=>r.status),['CURRENT','SUPERSEDED'])
  await api(path,body,'POST',409)
  await assert.rejects(h.pool.query("INSERT INTO payroll_income_tax_basis_review(facility_id,run_employee_id,request_key,source_fingerprint,source_snapshot,federal_wages_cents,maryland_wages_cents,evidence_reference,created_by) SELECT 2,run_employee_id,'cross-facility-review',source_fingerprint,source_snapshot,federal_wages_cents,maryland_wages_cents,evidence_reference,created_by FROM payroll_income_tax_basis_review WHERE id=$1",[saved.id]),/match finalized payroll and facility/)
  assert.deepEqual((await h.pool.query('SELECT statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0].statement_snapshot,paid.statement_snapshot)
  assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_audit_log WHERE action='INCOME_TAX_BASIS_REVIEWED'")).rows[0].n,2)
 }

 const summary=await employeeSummaryCsv(h.pool,1,'2026-01-01','2026-12-31'),columns=summary[1].slice(-4)
 assert.deepEqual(columns.slice(0,3),manual?['200.00','199.99',1]:['200.00','200.00',1])
 assert.match(columns[3],/RECONCILED INCOME-TAX/)
})
