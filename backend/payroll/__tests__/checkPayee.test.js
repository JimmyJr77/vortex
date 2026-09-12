import {runCheckPayeeRecoverySweep} from '../checkPayeeRecoveryScheduler.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
test('check recipients commit claims before creation, recover loss without duplicates, and preserve employer/history boundaries',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
 let h,posts=0,missing=false;const records={}
 let providerFetcher
 h=await createHarness({paymentFetcher:providerFetcher=async(url,options={})=>{
  const u=new URL(url),collection=u.pathname.split('/').pop()
  if(collection===uuid(2))return {ok:true,status:200,json:async()=>({id:uuid(2),currency:'USD',live_mode:false})}
  assert.ok(['counterparties','external_accounts'].includes(collection))
  if(options.method==='POST'){
   const stage=collection==='counterparties'?'COUNTERPARTY':'ACCOUNT'
   assert.equal((await h.pool.query('SELECT * FROM payroll_check_payee_operation WHERE stage=$1',[stage])).rowCount,1)
   const b=JSON.parse(options.body);posts++;records[collection]={...b,id:uuid(collection==='counterparties'?3:4),live_mode:false,...(stage==='ACCOUNT'?{account_details:[],routing_details:[]}: {})}
   throw new Error('Synthetic lost provider response')
  }
  assert.equal(options.method,undefined)
  const record=records[collection];return {ok:true,status:200,json:async()=>missing?[]:record?[record]:[]}
 }})
 t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const employee=Number((await h.pool.query("INSERT INTO payroll_employee(facility_id,employee_number,legal_first_name,legal_last_name,job_title,hire_date,work_state,residence_state) VALUES(1,'CHECK-1','Check','Person','Coach','2026-01-01','MD','MD') RETURNING id")).rows[0].id)
 const headers={Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'}
 const api=async(path,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll/${path}`,{method:body?'POST':'GET',headers:{...headers,'x-test-facility':String(facility)},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const connection=await api('payment-connection',{organizationId:uuid(1),originatingAccountId:uuid(2),apiKey:'synthetic-check-secret',mode:'TEST',reference:'Synthetic employer connection',expectedRevision:0,confirmed:true},201)
 const route=`employees/${employee}/check-payee`,body={connectionId:connection.revision,expectedRevision:0,payeeName:'Check Person',reference:'Synthetic check recipient review',confirmed:true}
 await api(route,body,409);await api('payment-connection/verify',{expectedRevision:connection.revision})
 const setup=await api('check-configuration',{connectionId:connection.revision,expectedRevision:0,enabled:true,expiryDays:90,activationReference:'Synthetic enabled check funding',confirmed:true},201)
 assert.equal((await api(route)).payeeName,'Check Person');await api(route,undefined,404,2)
 const first=await api(route,body,201);assert.equal((await api(route,body)).id,first.id)
 const step=(stage,action='CONTINUE',facility=1,status=200)=>api(`${route}/${first.id}/advance`,{stage,action,confirmed:true},status,facility)
 await step('COUNTERPARTY','RECOVER',1,409);await step('ACCOUNT','CONTINUE',1,409)
 await step('COUNTERPARTY','CONTINUE',2,404)
 const race=await Promise.all([step('COUNTERPARTY'),step('COUNTERPARTY')]);assert.deepEqual(race.map(r=>r.status).sort(),['RECORDED','UNCERTAIN']);assert.equal(posts,1)
 assert.equal((await step('ACCOUNT')).status,'UNCERTAIN');assert.equal(posts,2)
 assert.equal((await step('ACCOUNT','RECOVER')).status,'RECORDED');assert.equal(posts,2)
 const state=await api(route);assert.equal(state.progress.ACCOUNT.status,'RECORDED');assert.equal(JSON.stringify(state).includes(uuid(4)),false)
 const stored=(await h.pool.query('SELECT encrypted_input FROM payroll_check_payee')).rows[0];assert.equal(stored.encrypted_input.includes(Buffer.from('Check Person')),false)
 for(const table of ['payroll_check_payee','payroll_check_payee_operation','payroll_check_payee_observation'])await assert.rejects(h.pool.query(`DELETE FROM ${table}`),/append-only/)
 missing=true;assert.equal((await step('ACCOUNT')).status,'NOT_FOUND');assert.equal(posts,2);missing=false
 const second=await api(route,{...body,expectedRevision:first.revision,payeeName:'Check Person Updated'},201)
 await api('check-configuration',{connectionId:connection.revision,expectedRevision:setup.revision,enabled:false,expiryDays:90,activationReference:'Synthetic disabled check funding',confirmed:true},201)
 await api(`${route}/${second.id}/advance`,{stage:'COUNTERPARTY',action:'CONTINUE',confirmed:true},409)
 assert.equal((await step('COUNTERPARTY','RECOVER')).status,'RECORDED');assert.equal((await step('ACCOUNT','RECOVER')).status,'RECORDED');assert.equal(posts,2)

 const clock=new Date(Date.now()+2*86400000),sweep=(extra={})=>runCheckPayeeRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>clock,...extra})
 await assert.rejects(sweep({limit:0}),/limit/)
 const lock=await h.pool.connect();await lock.query("SELECT pg_advisory_lock(hashtextextended('payroll-check-payee-recovery-sweep',0))")
 try{assert.equal((await sweep()).skipped,true)}finally{await lock.query("SELECT pg_advisory_unlock(hashtextextended('payroll-check-payee-recovery-sweep',0))");lock.release()}
 assert.deepEqual(await sweep({limit:1}),{skipped:false,checked:1,failed:0})
 assert.deepEqual(await sweep({limit:1}),{skipped:false,checked:1,failed:0})
 assert.equal((await sweep()).checked,0);assert.equal(posts,2)
 assert.equal((await h.pool.query('SELECT * FROM payroll_check_payee_recovery_check')).rowCount,2)
 await assert.rejects(h.pool.query('DELETE FROM payroll_check_payee_recovery_check'),/append-only/)
 const key=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY;clock.setDate(clock.getDate()+2)
 assert.deepEqual(await sweep(),{skipped:false,checked:0,failed:2})
 process.env.PAYROLL_DOCUMENT_KEY=key
 assert.equal((await sweep()).checked,0)
 clock.setMinutes(clock.getMinutes()+11)
 assert.deepEqual(await sweep(),{skipped:false,checked:2,failed:0});assert.equal(posts,2)
 assert.equal((await h.pool.query("SELECT * FROM payroll_alert WHERE dedupe_key LIKE 'check-payee-%' AND status='OPEN'")).rowCount,0)
 assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='CHECK_PAYEE_OBSERVED' AND after_data->>'automatic'='true'")).rowCount,4)
 assert.equal((await api(route)).history.length,2)
 assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='CHECK_PAYEE_RETAINED'")).rowCount,2)
})
