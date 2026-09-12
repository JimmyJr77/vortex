import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {correctionPaymentFixture} from '../testing/correctionPaymentFixture.js'
test('payment authorizations retain reviewed evidence with exact retries and one current authorization',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,request,input,e}=await correctionPaymentFixture(h),path=`/requests/${request.id}/payroll-correction-authorizations`,previewPath=`/requests/${request.id}/payroll-correction-payment-preview`
 const preview=await api(previewPath,input),body={...input,fingerprint:preview.fingerprint,requestKey:'authorize-correction-001',reason:'Reviewed current tax and leave results for the correction payment',confirmed:true}
 const state=async()=>({runs:(await h.pool.query('SELECT * FROM payroll_run ORDER BY id')).rows,time:(await h.pool.query('SELECT * FROM payroll_time_entry ORDER BY id')).rows,leave:(await h.pool.query('SELECT * FROM payroll_leave_transaction ORDER BY id')).rows})
 const before=await state()
 await api(path,{...body,requestKey:[body.requestKey]},'POST',400)
 await api(path,{...body,confirmed:false},'POST',400);await api(path,{...body,fingerprint:'0'.repeat(64)},'POST',409)
 await h.pool.query("CREATE FUNCTION reject_payment_authorization() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='CORRECTION_PAYMENT_AUTHORIZED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_payment_authorization BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_payment_authorization()')
 await api(path,body,'POST',500)
 await h.pool.query('DROP TRIGGER reject_payment_authorization ON payroll_audit_log')
 assert.deepEqual(await api(path,undefined,'GET'),[])
 const responses=await Promise.all(Array.from({length:3},async()=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:(await r.json()).data}}))
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,200,201]);assert.equal(new Set(responses.map(r=>r.data.id)).size,1)
 assert.equal((await api(path,undefined,'GET'))[0].status,'CURRENT');assert.deepEqual(await state(),before)
 await api(path,{...body,reason:'A different reason using the original reference'},'POST',409)
 const newer=await api(path,{...body,requestKey:'authorize-correction-002',reason:'Reconfirmed the complete reviewed correction payment evidence'},'POST',201)
 const history=await api(path,undefined,'GET');assert.deepEqual(history.map(r=>r.status),['CURRENT','SUPERSEDED']);assert.equal(newer.supersedesId,responses[0].data.id)
 assert.equal((await api(path,body)).id,responses[0].data.id)
 for(const method of ['GET','POST']){const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:method==='POST'?JSON.stringify(body):undefined});assert.equal(r.status,404)}
 await h.pool.query("UPDATE payroll_time_entry SET clock_out=clock_out+interval '1 hour' WHERE employee_id=$1 AND clock_in='2026-08-17T12:00Z'",[e.id])
 assert.equal((await api(path,undefined,'GET'))[0].status,'STALE')
 await api(path,{...body,requestKey:'authorize-correction-stale'},'POST',409)
})
