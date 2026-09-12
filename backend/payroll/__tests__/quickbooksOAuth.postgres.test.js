import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash,randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {decryptDocument} from '../onboarding.js'

test('QuickBooks authorization consumes state, binds configuration, preserves reconnect mappings, and honors disconnect during exchange',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const config={PAYROLL_DOCUMENT_KEY:randomBytes(32).toString('hex'),QUICKBOOKS_CLIENT_ID:'test-intuit-client',QUICKBOOKS_CLIENT_SECRET:'test-intuit-secret',QUICKBOOKS_REDIRECT_URI:'https://api.example.test/api/payroll/quickbooks/callback',QUICKBOOKS_ENVIRONMENT:'sandbox'}
 const previous=Object.fromEntries(Object.keys(config).map(key=>[key,process.env[key]]));Object.assign(process.env,config)
 t.after(()=>{for(const key of Object.keys(config))if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key]})
 let calls=0,exchange=async()=>({ok:true,json:async()=>({access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',expires_in:3600})})
 const h=await createHarness({quickbooksFetcher:async(url,options)=>{calls++;assert.equal(url,'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer');assert.equal(new URLSearchParams(options.body).get('redirect_uri'),config.QUICKBOOKS_REDIRECT_URI);return exchange()}});t.after(()=>h.close())
 const admin=async(path,body={},method='POST')=>{
  const res=await fetch(`${h.url}/api/admin/payroll/quickbooks${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body)})
  const data=await res.json();assert.equal(res.status,200,JSON.stringify(data));return data.data
 }
 const authorize=async()=>new URL((await admin('/authorize')).url).searchParams.get('state')
 const callback=(state,extra={code:'synthetic-code',realmId:'111'})=>fetch(`${h.url}/api/payroll/quickbooks/callback?${new URLSearchParams({state,...extra})}`,{redirect:'manual'})
 const expired=await authorize();await h.pool.query("UPDATE payroll_quickbooks_oauth_state SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[createHash('sha256').update(expired).digest('hex')])
 assert.equal((await callback(expired)).status,400);assert.equal(calls,0)
 const cancelled=await authorize();assert.equal((await callback(cancelled,{error:'access_denied'})).status,400);assert.equal((await callback(cancelled)).status,400);assert.equal(calls,0)
 const first=await authorize();const connected=await callback(first);assert.equal(connected.status,302);assert.match(connected.headers.get('location'),/payrollQuickbooks=connected/);assert.equal(connected.headers.get('cache-control'),'no-store')
 assert.equal((await callback(first)).status,400);assert.equal(calls,1)
 const privateRow=(await h.pool.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=1')).rows[0]
 assert.equal(privateRow.encrypted_tokens.includes(Buffer.from('synthetic-access-token')),false)
 assert.equal(JSON.parse(decryptDocument(privateRow.encrypted_tokens,'quickbooks:1')).access_token,'synthetic-access-token')
 const accountIds={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6'}
 await admin('/mapping',{accountIds,autoSync:true,verified:true},'PATCH')
 assert.equal((await callback(await authorize())).status,302)
 let state=await admin('',undefined,'GET');assert.deepEqual(state.connection.account_ids,accountIds);assert.equal(state.connection.auto_sync,true)
 exchange=async()=>({ok:false,json:async()=>({})})
 const failed=await authorize();assert.equal((await callback(failed)).status,502);const failedCalls=calls;assert.equal((await callback(failed)).status,400);assert.equal(calls,failedCalls)
 assert.equal((await admin('',undefined,'GET')).connection.realm_id,'111')
 exchange=async()=>({ok:true,json:async()=>({access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',expires_in:3600})})
 const wrongEnvironment=await authorize();process.env.QUICKBOOKS_ENVIRONMENT='production';assert.equal((await callback(wrongEnvironment)).status,409);process.env.QUICKBOOKS_ENVIRONMENT='sandbox'
 assert.equal((await callback(await authorize(),{code:'synthetic-code',realmId:'222'})).status,302)
 state=await admin('',undefined,'GET');assert.deepEqual(state.connection.account_ids,{});assert.equal(state.connection.auto_sync,false)
 const oneUse=await authorize(),beforeCalls=calls;const duplicates=await Promise.all([callback(oneUse,{code:'synthetic-code',realmId:'222'}),callback(oneUse,{code:'synthetic-code',realmId:'222'})]);assert.deepEqual(duplicates.map(r=>r.status).sort(),[302,400]);assert.equal(calls,beforeCalls+1)
 let release,entered;const inExchange=new Promise(resolve=>{entered=resolve});const resume=new Promise(resolve=>{release=resolve})
 exchange=async()=>{entered();await resume;return {ok:true,json:async()=>({access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',expires_in:3600})}}
 const inflight=callback(await authorize());await inExchange;await admin('/disconnect');release();assert.equal((await inflight).status,409)
 assert.equal((await admin('',undefined,'GET')).connection,null)
 const audits=(await h.pool.query("SELECT action,after_data FROM payroll_audit_log WHERE entity_type='quickbooks_connection'")).rows
 assert.ok(audits.some(a=>a.action==='QUICKBOOKS_MAPPING_VERIFIED'));assert.ok(audits.some(a=>a.action==='QUICKBOOKS_DISCONNECTED'))
 assert.equal(JSON.stringify(audits).includes('synthetic-access-token'),false)
})
