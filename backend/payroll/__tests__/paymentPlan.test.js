import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
test('approved payroll payment plans reconcile check wages and block changed inputs or incomplete deposit enrollment',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201),path=`/runs/${run.id}/payment-plan`
 await api(path,undefined,'GET',409)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 const plan=await api(path);assert.equal(plan.status,'READY_FOR_PAYMENT_REVIEW');assert.equal(plan.executionAvailable,false);assert.equal(plan.payments.length,1);assert.equal(plan.payments[0].method,'CHECK');assert.equal(plan.totals.checkCents,Number(run.net_pay_cents));assert.equal(plan.totals.directDepositCents,0);assert.equal(plan.paymentDate,'2026-09-18');assert.equal((await api(path)).fingerprint,plan.fingerprint)
 const other=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(other.status,404)
 await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"method\":\"DIRECT_DEPOSIT\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
 const deposit=await api(path);assert.equal(deposit.status,'NEEDS_REVIEW');assert.equal(deposit.payments[0].readiness.status,'NO_CONNECTION');assert.notEqual(deposit.fingerprint,plan.fingerprint)
 await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"method\":\"CHECK\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
 await h.pool.query('UPDATE payroll_run SET net_pay_cents=net_pay_cents+1 WHERE id=$1',[run.id]);assert.ok((await api(path)).issues.includes('Employee net payments do not reconcile to the approved run total.'));await h.pool.query('UPDATE payroll_run SET net_pay_cents=net_pay_cents-1 WHERE id=$1',[run.id])
 await h.pool.query("UPDATE payroll_employee SET work_state='VA' WHERE id=$1",[employee.id]);await api(path,undefined,'GET',409)
 assert.equal((await h.pool.query('SELECT * FROM payroll_payment_instruction')).rowCount,0)
})
