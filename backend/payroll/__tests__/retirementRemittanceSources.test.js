import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {regularRetirementFixture} from '../testing/regularRetirementFixture.js'
test('remittance sources reconcile finalized deductions, paginate and reject changed evidence',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness({databaseNow:'2026-09-11T12:00:00.000Z',retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const {api,periods}=await regularRetirementFixture(h)
 const path='/retirement-remittance-sources'
 assert.deepEqual((await api(path)).items,[])
 const first=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${first.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${first.id}/status`,{status:'APPROVED'},'PATCH')
 assert.deepEqual((await api(path)).items,[])
 await api(`/runs/${first.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-RETIREMENT-SOURCES'})
 const page=await api(path),item=page.items[0]
 assert.equal(item.status,'DELIVERY_UNVERIFIED');assert.equal(item.totalCents,1400);assert.equal(item.allocations[0].ordinaryPretaxCents,1000);assert.equal(item.allocations[0].ordinaryRothCents,400);assert.match(item.sourceFingerprint,/^[a-f0-9]{64}$/)
 assert.equal((await api(path)).items[0].sourceFingerprint,item.sourceFingerprint)
 assert.equal(JSON.stringify(item).includes('balanceReference'),false)
 await api(path+'?limit=0',undefined,'GET',400);await api(path+'?beforeRunId=1.5',undefined,'GET',400)
 const foreign=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreign.status,200);assert.deepEqual((await foreign.json()).data.items,[])
 assert.equal((await fetch(`${h.url}/api/admin/payroll${path}`)).status,401)
 const original=(await h.pool.query('SELECT statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[first.id])).rows[0].statement_snapshot
 await h.pool.query("UPDATE payroll_run_employee SET statement_snapshot=jsonb_set(statement_snapshot,'{retirement,plans,0,ordinaryPretaxCents}','999') WHERE payroll_run_id=$1",[first.id])
 const changed=(await api(path)).items[0];assert.equal(changed.status,'RECONCILIATION_REQUIRED');assert.equal(changed.totalCents,null);assert.equal(changed.sourceFingerprint,null);assert.deepEqual(changed.allocations,[])
 await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=$2 WHERE payroll_run_id=$1',[first.id,original])
 assert.equal((await api(path)).items[0].sourceFingerprint,item.sourceFingerprint)
 const second=await api('/runs',{payPeriodId:periods[1].id},'POST',201)
 await api(`/runs/${second.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${second.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${second.id}/finalize`,{paymentDate:'2026-09-30',paymentConfirmationReference:'SYNTHETIC-RETIREMENT-SOURCES-SECOND'})
 const newest=await api(path+'?limit=1');assert.equal(newest.items[0].runId,String(second.id));assert.equal(newest.nextCursor,String(second.id))
 const older=await api(path+'?limit=1&beforeRunId='+newest.nextCursor);assert.equal(older.items[0].runId,String(first.id));assert.equal(older.nextCursor,null)
 await h.pool.query('UPDATE payroll_run_employee SET pretax_deduction_cents=pretax_deduction_cents+1 WHERE payroll_run_id=$1',[first.id])
 const mixed=await api(path);assert.equal(mixed.items[0].status,'DELIVERY_UNVERIFIED');assert.equal(mixed.items[1].status,'RECONCILIATION_REQUIRED')
})
