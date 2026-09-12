import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {encryptDocument} from '../onboarding.js'
test('retirement settlement mappings retain scoped historical funding, distinct liabilities and current company evidence',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let calls=0,bad=false,wrong=false
 const h=await createHarness({quickbooksFetcher:async(url,options)=>{calls++;assert.equal(options.method,'GET');assert.ok(url.startsWith('https://sandbox-quickbooks.api.intuit.com/v3/company/123/'));const id=url.split('/').pop();return {ok:true,json:async()=>id==='preferences'?{Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}}}}:{Account:{Id:wrong?'99':id,Name:`Account ${id}`,Active:!bad,AccountType:['7','8'].includes(id)?'Bank':'Other Current Liability',CurrencyRef:{value:'USD'}}}}}})
 t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const path='/retirement-plans/standard/settlement-mapping',api=async(p,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${p}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 await api('/retirement-plans',{plan:retirementPlanFixture(),expectedRevision:0,requestKey:randomUUID()})
 const encrypted=encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic-retirement-mapping-token',refresh_token:'synthetic-refresh',expiresAt:Date.now()+3600000})),'quickbooks:1')
 await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,encrypted_tokens,environment,account_ids) VALUES(1,'123',$1,'sandbox',$2)",[encrypted,{clearing:'6'}])
 const config={organizationId:randomUUID(),originatingAccountId:randomUUID(),apiKey:'synthetic-retirement-mapping-key',mode:'TEST',reference:'Synthetic funding account mapping',confirmed:true,expectedRevision:0}
 const first=await api('/payment-connection',config,201),initial=await api(path)
 const body={requestKey:randomUUID(),confirmed:true,expectedRevision:0,fundingRevisionId:first.revision,connectionGeneration:initial.connection.generation,realmId:'123',environment:'sandbox',bankAccountId:'7',liabilityAccountId:'9',reference:'Reviewed bank and retirement liability association'}
 await api(path,{...body,confirmed:false},400);await api(path,{...body,fundingRevisionId:999},409);await api(path,{...body,environment:'production'},409);assert.equal(calls,0)
 bad=true;await api(path,body,409);bad=false;wrong=true;await api(path,body,409);wrong=false
 const saved=await api(path,body,201);assert.equal((await api(path,body)).reused,true)
 let state=await api(path);assert.equal(state.history.length,1);assert.equal(state.history[0].status,'CURRENT');assert.equal(state.history[0].details.liability.id,'9');assert.equal(state.history[0].details.fundingAccountId,config.originatingAccountId)
 assert.equal((await api(path,undefined,200,2)).history.length,0);await api(path,{...body,expectedRevision:saved.revision},404,2)
 // Replacing current credentials does not invalidate evidence of an older bank.
 const second=await api('/payment-connection',{...config,expectedRevision:first.revision,originatingAccountId:randomUUID()},201)
 assert.equal((await api(path)).history[0].status,'CURRENT')
 const remapped=await api(path,{...body,requestKey:randomUUID(),expectedRevision:saved.revision,bankAccountId:'8'},201)
 state=await api(path);assert.deepEqual(state.history.map(r=>r.status),['CURRENT','SUPERSEDED']);assert.equal(state.history[0].payment_connection_id,first.revision)
 // A different liability keeps an independent mapping for the same funding.
 const separate=await api(path,{...body,requestKey:randomUUID(),expectedRevision:remapped.revision,liabilityAccountId:'10'},201)
 assert.deepEqual((await api(path)).history.map(r=>r.status),['CURRENT','CURRENT','SUPERSEDED'])
 // Concurrent changed reviews serialize: only one can use the saved revision.
 const request={...body,requestKey:randomUUID(),expectedRevision:separate.revision,fundingRevisionId:second.revision}
 const results=await Promise.all([request,{...request,bankAccountId:'8'}].map(body=>fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)})))
 assert.deepEqual(results.map(r=>r.status).sort(),[201,409])
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_settlement_mapping'),/append-only/)
 await assert.rejects(h.pool.query("INSERT INTO payroll_retirement_settlement_mapping(facility_id,payment_connection_id,connection_generation,realm_id,environment,details,reference,created_by,plan_id,request_key,request_fingerprint) SELECT facility_id,payment_connection_id,connection_generation,realm_id,environment,'{}',reference,created_by,plan_id,gen_random_uuid(),request_fingerprint FROM payroll_retirement_settlement_mapping LIMIT 1"),/exact funding/)
 await assert.rejects(h.pool.query("INSERT INTO payroll_retirement_settlement_mapping(facility_id,payment_connection_id,connection_generation,realm_id,environment,details,reference,created_by,plan_id,request_key,request_fingerprint) SELECT 2,payment_connection_id,connection_generation,realm_id,environment,details,reference,created_by,plan_id,gen_random_uuid(),request_fingerprint FROM payroll_retirement_settlement_mapping LIMIT 1"),/matching employer/)
 await h.pool.query('UPDATE payroll_settings SET quickbooks_connection_generation=quickbooks_connection_generation+1 WHERE facility_id=1')
 state=await api(path);assert.equal(state.history.filter(r=>r.status==='CURRENT').length,0)
 await api(path,{...body,expectedRevision:state.revision},409)
 assert.equal(JSON.stringify(state).includes('synthetic-retirement-mapping-token'),false);assert.equal(JSON.stringify(state).includes(config.apiKey),false)
 assert.equal((await h.pool.query('SELECT * FROM payroll_quickbooks_sync')).rowCount,0)
})
