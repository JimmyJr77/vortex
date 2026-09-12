import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {readPayrollPaymentConnection} from '../paymentConnection.js'
test('payment configuration encrypts credentials, isolates employers and retains concurrent revisions',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 let providerStatus=200,liveMode=false,calls=0
 const h=await createHarness({paymentFetcher:async(url,options)=>{calls++;assert.equal(options.method,undefined);assert.equal(options.redirect,'error');assert.equal(url,'https://app.moderntreasury.com/api/internal_accounts/00000000-0000-4000-8000-000000000002');return {ok:providerStatus===200,status:providerStatus,json:async()=>({id:'00000000-0000-4000-8000-000000000002',currency:'USD',live_mode:liveMode,account_number:'synthetic-private-account'})}}});t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const url=`${h.url}/api/admin/payroll/payment-connection`,headers={Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'}
 const body={organizationId:'00000000-0000-4000-8000-000000000001',originatingAccountId:'00000000-0000-4000-8000-000000000002',apiKey:'synthetic-payment-secret',mode:'TEST',reference:'Synthetic employer funding configuration',expectedRevision:0,confirmed:true}
 const save=value=>fetch(url,{method:'POST',headers,body:JSON.stringify(value)})
 assert.equal((await fetch(url)).status,401)
 const initial=await (await fetch(url,{headers})).json();assert.equal(initial.data.status,'NOT_CONFIGURED');assert.equal(initial.data.executionAvailable,false)
 assert.equal((await save({...body,confirmed:false})).status,400)
 const first=await save(body);assert.equal(first.status,201);const revision=(await first.json()).data.revision
 const repeated=await save(body);assert.equal(repeated.status,200);assert.equal((await repeated.json()).data.reused,true)
 const verify=(expectedRevision=revision,extraHeaders={})=>fetch(`${url}/verify`,{method:'POST',headers:{...headers,...extraHeaders},body:JSON.stringify({expectedRevision})})
 assert.equal((await verify(0)).status,400);assert.equal((await verify(revision,{'x-test-facility':'2'})).status,409);assert.equal(calls,0)
 const verified=await verify();assert.equal(verified.status,200);assert.equal((await verified.json()).data.status,'VERIFIED')
 assert.equal((await (await fetch(url,{headers})).json()).data.verification.status,'VERIFIED')
 liveMode=true;assert.equal((await (await verify()).json()).data.status,'FAILED');liveMode=false;providerStatus=503;assert.equal((await (await verify()).json()).data.status,'UNAVAILABLE');providerStatus=200
 const checks=(await h.pool.query('SELECT * FROM payroll_payment_connection_check')).rows;assert.equal(checks.length,3);assert.equal(JSON.stringify(checks).includes('synthetic-private-account'),false)
 await assert.rejects(h.pool.query('DELETE FROM payroll_payment_connection_check'),/append-only/)
 const stored=(await h.pool.query('SELECT * FROM payroll_payment_connection')).rows[0];assert.equal(stored.encrypted_configuration.includes(Buffer.from(body.apiKey)),false)
 assert.equal((await readPayrollPaymentConnection(h.pool,1,revision)).apiKey,body.apiKey)
 await assert.rejects(readPayrollPaymentConnection(h.pool,2,revision),/not found/)
 const wrongEmployer=await (await fetch(url,{headers:{...headers,'x-test-facility':'2'}})).json();assert.equal(wrongEmployer.data.revision,0)
 const publicResponse=await fetch(url,{headers});assert.equal(publicResponse.headers.get('cache-control'),'no-store');const publicText=await publicResponse.text();assert.equal(publicText.includes(body.apiKey),false);assert.equal(publicText.includes(body.organizationId),false)
 const race=await Promise.all(['first','second'].map(suffix=>save({...body,expectedRevision:revision,apiKey:`synthetic-${suffix}-secret`})));
 assert.deepEqual(race.map(r=>r.status).sort(),[201,409])
 assert.equal((await h.pool.query('SELECT * FROM payroll_payment_connection')).rowCount,2)
 assert.equal((await verify()).status,409);assert.equal((await (await fetch(url,{headers})).json()).data.verification,null)
 const audit=(await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='PAYMENT_CONNECTION_RECORDED'")).rows;assert.equal(audit.length,2);assert.equal(JSON.stringify(audit).includes('secret'),false)
 await assert.rejects(h.pool.query('UPDATE payroll_payment_connection SET mode=\'LIVE\''),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_payment_connection'),/append-only/)
 delete process.env.PAYROLL_DOCUMENT_KEY
 assert.equal((await save({...body,expectedRevision:revision,apiKey:'synthetic-new-secret'})).status,503)
 assert.equal((await fetch(url,{headers})).status,200)
})
