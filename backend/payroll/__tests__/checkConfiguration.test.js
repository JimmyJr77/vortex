import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
test('check activation is scoped, current-connection bound, verified, concurrent-safe and append-only',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 let calls=0
 const account='00000000-0000-4000-8000-000000000002'
 const h=await createHarness({paymentFetcher:async(url,options)=>{calls++;assert.equal(options.method,undefined);assert.ok(url.endsWith(account));return {ok:true,status:200,json:async()=>({id:account,currency:'USD',live_mode:false})}}})
 t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const headers={Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'}
 const request=(path,body,facility=1)=>fetch(`${h.url}/api/admin/payroll/${path}`,{method:body?'POST':'GET',headers:{...headers,'x-test-facility':String(facility)},...(body?{body:JSON.stringify(body)}:{})})
 assert.equal((await fetch(`${h.url}/api/admin/payroll/check-configuration`)).status,401)
 assert.equal((await (await request('check-configuration')).json()).data.status,'NOT_CONFIGURED')
 const connectionBody={organizationId:'00000000-0000-4000-8000-000000000001',originatingAccountId:account,apiKey:'synthetic-check-secret',mode:'TEST',reference:'Synthetic check funding connection',expectedRevision:0,confirmed:true}
 const connection=(await (await request('payment-connection',connectionBody)).json()).data.revision
 const body={connectionId:connection,enabled:true,expiryDays:90,activationReference:'Synthetic provider activation record',expectedRevision:0,confirmed:true}
 for(const changed of [{confirmed:false},{expiryDays:181},{expiryDays:0},{expiryDays:1.5},{enabled:'true'},{activationReference:'short'},{expectedRevision:-1}])assert.equal((await request('check-configuration',{...body,...changed})).status,400)
 assert.equal((await request('check-configuration',body,2)).status,409)
 assert.equal((await request('check-configuration',body)).status,409)
 assert.equal(calls,0)
 assert.equal((await request('payment-connection/verify',{expectedRevision:connection})).status,200)
 const race=await Promise.all([body,{...body,expiryDays:100}].map(b=>request('check-configuration',b)))
 assert.deepEqual(race.map(r=>r.status).sort(),[201,409])
 const response=await request('check-configuration');assert.equal(response.headers.get('cache-control'),'no-store')
 let state=(await response.json()).data
 assert.equal(state.status,'ACTIVATION_RECORDED');assert.equal(state.history.length,1)
 const same={...body,expiryDays:state.current.expiry_days}
 assert.equal((await (await request('check-configuration',same)).json()).data.reused,true)
 assert.equal(calls,1)
 assert.equal((await (await request('check-configuration',undefined,2)).json()).data.history.length,0)
 await assert.rejects(h.pool.query('UPDATE payroll_check_configuration SET enabled=false'),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_check_configuration'),/append-only/)
 await assert.rejects(h.pool.query('INSERT INTO payroll_check_configuration(facility_id,connection_id,enabled,expiry_days,activation_reference) VALUES(2,$1,true,90,$2)',[connection,body.activationReference]),/employer funding connection/)
 await h.pool.query("INSERT INTO payroll_payment_connection_check(connection_id,status,reason,created_at,created_by) VALUES($1,'VERIFIED','FUNDING_ACCOUNT_MATCHED',now()-interval '16 minutes',99)",[connection])
 assert.equal((await request('check-configuration',{...body,expiryDays:120,expectedRevision:state.revision})).status,409)
 const disabled=await request('check-configuration',{...body,enabled:false,expectedRevision:state.revision});assert.equal(disabled.status,201)
 state=(await (await request('check-configuration')).json()).data;assert.equal(state.status,'DISABLED')
 assert.equal((await request('payment-connection/verify',{expectedRevision:connection})).status,200)
 assert.equal((await request('check-configuration',{...body,expectedRevision:state.revision})).status,201)
 const next=(await (await request('payment-connection',{...connectionBody,apiKey:'new-synthetic-check-secret',expectedRevision:connection})).json()).data.revision
 state=(await (await request('check-configuration')).json()).data
 assert.equal(state.status,'CONNECTION_CHANGED');assert.equal(state.connectionId,next);assert.equal(state.history.length,3)
 assert.equal((await request('check-configuration',{...body,expectedRevision:state.revision})).status,409)
 assert.equal((await request('check-configuration',{...body,connectionId:next,expectedRevision:state.revision})).status,409)
 assert.equal(calls,2)
 assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='CHECK_CONFIGURATION_RECORDED'")).rowCount,3)
})
