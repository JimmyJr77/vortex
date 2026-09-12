import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {correctionFixture} from '../testing/correctionFixture.js'
test('correction calculations retain atomically with exact retries and current evidence history',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,first,request}=await correctionFixture(h)
 const path=`/requests/${request.id}/payroll-corrections`,preview=await api(`/requests/${request.id}/payroll-correction-preview`,{})
 const body={requestKey:'retain-wage-calculation-001',fingerprint:preview.fingerprint,reason:'Reviewed two added hours and resulting overtime against the original payroll',confirmed:true}
 await api(path,{...body,confirmed:false},'POST',400)
 await api(path,{...body,fingerprint:'0'.repeat(64)},'POST',409)
 const state=async()=>({time:(await h.pool.query('SELECT * FROM payroll_time_entry ORDER BY id')).rows,paid:(await h.pool.query('SELECT * FROM payroll_run_employee ORDER BY id')).rows,leave:(await h.pool.query('SELECT * FROM payroll_leave_transaction ORDER BY id')).rows,requests:(await h.pool.query('SELECT * FROM payroll_employee_request ORDER BY id')).rows})
 const before=await state()
 await h.pool.query("CREATE FUNCTION reject_correction_calculation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='TIME_CORRECTION_CALCULATION_RETAINED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_correction_calculation BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_correction_calculation()')
 await api(path,body,'POST',500)
 await h.pool.query('DROP TRIGGER reject_correction_calculation ON payroll_audit_log')
 assert.deepEqual(await api(path,undefined,'GET'),[])
 const receipts=await Promise.all(Array.from({length:3},async()=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:(await r.json()).data}}))
 assert.deepEqual(receipts.map(r=>r.status).sort(),[200,200,201]);assert.equal(new Set(receipts.map(r=>r.data.id)).size,1)
 assert.deepEqual(await state(),before)
 const history=await api(path,undefined,'GET')
 assert.equal(history.length,1);assert.equal(history[0].status,'CURRENT');assert.equal(history[0].calculation.workedWagesDifferenceCents,7500)
 assert.equal(history[0].calculation.taxesCalculated,false);assert.equal(history[0].paymentApplied,false)
 assert.deepEqual(await state(),before)
 await api(path,{...body,reason:'Changed reason under the original request key'},'POST',409)
 for(const method of ['GET','POST']){
  const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:method==='POST'?JSON.stringify(body):undefined});assert.equal(r.status,404)
 }
 await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=statement_snapshot || $2::jsonb WHERE payroll_run_id=$1',[first.id,{correctionEvidence:'Changed frozen statement without changing gross'}])
 const stale=await api(path,undefined,'GET');assert.equal(stale[0].status,'STALE');assert.match(stale[0].issue,/current payment impact/)
 assert.equal((await api(path,body)).id,history[0].id)
 await api(path,{...body,requestKey:'retain-wage-calculation-stale'},'POST',409)
 await api(`/requests/${request.id}/review`,{status:'DECLINED',note:'Synthetic decline after retained calculation review'})
 assert.equal((await api(path,undefined,'GET'))[0].status,'STALE')
 assert.equal((await api(path,body)).id,history[0].id)
})
