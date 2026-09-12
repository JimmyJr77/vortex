import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {encryptDocument} from '../onboarding.js'
import {settlementAccounts} from '../paymentAccountingMapping.js'
const bank={Id:'7',Name:'Payroll Bank',Active:true,AccountType:'Bank',CurrencyRef:{value:'USD'}},clearing={Id:'6',Name:'Payroll Clearing',Active:true,AccountType:'Other Current Liability'},preferences={CurrencyPrefs:{HomeCurrency:{value:'USD'}}}
test('settlement mapping validates distinct active bank/liability accounts and USD currency',()=>{
 assert.equal(settlementAccounts(bank,clearing,preferences).clearing.currency,'USD')
 for(const [b,c,p] of [[{...bank,Active:false},clearing,preferences],[bank,{...clearing,AccountType:'Bank'},preferences],[{...bank,CurrencyRef:{value:'CAD'}},clearing,preferences],[bank,clearing,{}],[bank,{...clearing,Id:'7'},preferences]])assert.throws(()=>settlementAccounts(b,c,p))
})
test('settlement mapping is verified, versioned, scoped and invalidated by company/funding changes',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let calls=0,bad=false
 const h=await createHarness({quickbooksFetcher:async(url,options)=>{calls++;assert.equal(options.method,'GET');assert.ok(url.startsWith('https://sandbox-quickbooks.api.intuit.com/v3/company/123/'));return {ok:true,json:async()=>url.endsWith('/preferences')?{Preferences:preferences}:{Account:url.endsWith('/7')?{...bank,AccountType:bad?'Expense':'Bank'}:clearing}}}})
 t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const api=async(path,body,status=200)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const encrypted=encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic-mapping-token',refresh_token:'synthetic-refresh',expiresAt:Date.now()+3600000})),'quickbooks:1')
 await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,encrypted_tokens,environment,account_ids) VALUES(1,'123',$1,'sandbox',$2)",[encrypted,{clearing:'6'}])
 const configuration={organizationId:randomUUID(),originatingAccountId:randomUUID(),apiKey:'synthetic-mapping-key',mode:'LIVE',reference:'Synthetic funding account mapping',confirmed:true,expectedRevision:0}
 const payment=await api('/payment-connection',configuration,201),path='/quickbooks/payment-mapping',initial=await api(path)
 const body={expectedRevision:0,paymentConnectionId:payment.revision,connectionGeneration:initial.connection.generation,realmId:'123',environment:'sandbox',bankAccountId:'7',clearingAccountId:'6',reference:'Synthetic bookkeeper approved mapping',confirmed:true}
 await api(path,{...body,realmId:'999'},409);await api(path,{...body,clearingAccountId:'5'},409);assert.equal(calls,0)
 bad=true;await api(path,body,409);assert.equal((await h.pool.query('SELECT * FROM payroll_payment_accounting_mapping')).rowCount,0);bad=false
 const saved=await api(path,body,201);assert.equal((await api(path)).status,'CURRENT')
 await api(path,body,409)
 assert.equal((await api(path,{...body,expectedRevision:saved.revision})).reused,true)
 assert.equal((await h.pool.query('SELECT * FROM payroll_payment_accounting_mapping')).rowCount,1)
 await assert.rejects(h.pool.query('DELETE FROM payroll_payment_accounting_mapping'),/append-only/)
 const scope=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal((await scope.json()).data.history.length,0)
 await h.pool.query("UPDATE payroll_quickbooks_connection SET account_ids='{\"clearing\":\"9\"}' WHERE facility_id=1");assert.equal((await api(path)).status,'CHANGED')
 await h.pool.query("UPDATE payroll_quickbooks_connection SET account_ids='{\"clearing\":\"6\"}' WHERE facility_id=1")
 await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='999' WHERE facility_id=1");assert.equal((await api(path)).status,'CHANGED');await api(path,{...body,expectedRevision:saved.revision},409);await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='123' WHERE facility_id=1")
 await h.pool.query('UPDATE payroll_settings SET quickbooks_connection_generation=quickbooks_connection_generation+1 WHERE facility_id=1');assert.equal((await api(path)).status,'CHANGED');await api(path,{...body,expectedRevision:saved.revision},409)
 await api('/payment-connection',{...configuration,expectedRevision:payment.revision,apiKey:'changed-synthetic-mapping-key'},201);assert.equal((await api(path)).status,'CHANGED');await api(path,{...body,connectionGeneration:body.connectionGeneration+1,expectedRevision:saved.revision},409)
 const history=JSON.stringify(await api(path));assert.equal(history.includes('synthetic-mapping-token'),false);assert.equal(history.includes('synthetic-mapping-key'),false)
 assert.equal((await h.pool.query('SELECT * FROM payroll_quickbooks_sync')).rowCount,0)
})
