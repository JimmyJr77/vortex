import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementDestinationProvider} from '../testing/retirementDestinationProvider.js'
import {createRetirementSftpServer} from '../testing/retirementSftpServer.js'
import {retirementAllocationDeliveryFixture} from '../testing/retirementAllocationDeliveryFixture.js'
import {transferRetirementAllocation,verifyRetirementSftpConnection} from '../retirementSftpTransport.js'
const review={confirmed:true,outsideActivityReviewed:true,reference:'Renewed independent review of no external allocation and exact approved destination'}
async function fixture(transferHook){
 const server=await createRetirementSftpServer(),provider=retirementDestinationProvider();let clock=new Date('2026-09-19T12:00:00Z'),h
 h=await createHarness({paymentFetcher:provider.fetcher,retirementNow:()=>new Date('2026-09-11T12:00:00Z'),remittanceNow:()=>clock,retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:async(c,file,options)=>{assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_retirement_allocation_claim')).rows[0].n,1);await transferHook?.(()=>{clock=new Date('2026-09-23T12:00:00Z')});return transferRetirementAllocation(c,file,{...server.options,...options})}})
 const f=await retirementAllocationDeliveryFixture(h,server.config);return {...f,h,server,provider,close:async()=>{await h.close();await server.close()}}
}
test('allocation claims precede actual upload, concurrent retries recover read-only and protect parent cancellation',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let f
 try{
  f=await fixture();const {api,deliveryPath:path,deliveryBody:body,server,h}=f
  const [a,b]=await Promise.all([api(path,body),api(path,body)]);assert.equal(a.id,b.id)
  await api(path,{...body,fileName:'changed.csv'},'POST',409)
  const dispatch=`${path}/${a.id}/dispatch`;await api(dispatch,{...review,action:'RECOVER'},'POST',409)
  server.state.loseRename=true
  const [first,second]=await Promise.all([api(dispatch,{...review,action:'SUBMIT'}),api(dispatch,{...review,action:'SUBMIT'})]);assert.ok([first,second].some(x=>x.result.status==='REMOTE_FILE_VERIFIED'));assert.ok([first,second].some(x=>x.result.status==='TRANSPORT_UNCERTAIN'));assert.equal(server.state.created,1);assert.equal(server.state.renames,1)
  assert.equal((await api(path)).history[0].claimed,true)
  await api(`${path}/${a.id}/cancel`,{...review,requestKey:randomUUID()},'POST',409)
  await api(`/retirement-remittance-authorizations/${f.remittanceId}/cancel`,{...review,requestKey:randomUUID()},'POST',409)
  await assert.rejects(h.pool.query('INSERT INTO payroll_retirement_remittance_cancellation(id,facility_id,authorization_id,reference,request_key,request_fingerprint,created_by) VALUES($1,1,$2,$3,$4,$5,99)',[randomUUID(),f.remittanceId,review.reference,randomUUID(),'synthetic']),/Allocation dispatch has been claimed/)
  await api(f.setupPath,{action:'SUSPEND',expectedRevision:1,requestKey:randomUUID(),reference:'Suspend new delivery while preserving historical recovery',confirmed:true})
  assert.equal((await api(dispatch,{...review,action:'RECOVER'})).result.status,'REMOTE_FILE_VERIFIED')
  server.files.clear();assert.equal((await api(dispatch,{...review,action:'SUBMIT'})).result.status,'REMOTE_FILE_NOT_FOUND');assert.equal(server.state.created,1)
  delete process.env.PAYROLL_DOCUMENT_KEY;assert.equal((await api(dispatch,{...review,action:'RECOVER'})).result.status,'RECOVERY_UNAVAILABLE');assert.equal(server.state.created,1)
  const result=await fetch(`${h.url}/api/admin/payroll${dispatch}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify({...review,action:'RECOVER'})});assert.equal(result.status,404)
  await assert.rejects(h.pool.query("UPDATE payroll_retirement_allocation_observation SET result='{}'"),/immutable|append-only/i)
  const audit=JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='RETIREMENT_ALLOCATION_DELIVERY_OBSERVED'")).rows);assert.ok(!audit.includes('PRIVATE-PARTICIPANT'));assert.ok(!audit.includes(server.config.privateKey))
 }finally{await f?.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
test('unclaimed allocation cancellation and renewed authorization preserve history and reject changed configuration',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let f
 try{
  f=await fixture();const {api,deliveryPath:path,deliveryBody:body}=f,a=await api(path,body),cancel={...review,requestKey:randomUUID()}
  const [c,d]=await Promise.all([api(`${path}/${a.id}/cancel`,cancel),api(`${path}/${a.id}/cancel`,cancel)]);assert.ok(c.reused||d.reused)
  await api(`${path}/${a.id}/dispatch`,{...review,action:'SUBMIT'},'POST',409)
  await api(path,{...body,requestKey:randomUUID()},'POST',409)
  const renewed=await api(path,{...body,fileName:'replacement_review.csv',requestKey:randomUUID()})
  await api(f.setupPath,{action:'SUSPEND',expectedRevision:1,requestKey:randomUUID(),reference:'Suspend after a change in provider upload instructions',confirmed:true})
  await api(`${path}/${renewed.id}/dispatch`,{...review,action:'SUBMIT'},'POST',409);assert.equal((await f.h.pool.query('SELECT * FROM payroll_retirement_allocation_claim')).rowCount,0);assert.equal(f.server.state.writes,0)
  delete process.env.PAYROLL_DOCUMENT_KEY;await api(`${path}/${renewed.id}/cancel`,{...review,requestKey:randomUUID()});assert.equal((await api(path)).history.filter(x=>x.cancelled).length,2)
 }finally{await f?.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
test('a cutoff crossed after claim prevents the first remote write and never turns recovery into a resend',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let f
 try{f=await fixture(expire=>expire());const a=await f.api(f.deliveryPath,f.deliveryBody),path=`${f.deliveryPath}/${a.id}/dispatch`;assert.equal((await f.api(path,{...review,action:'SUBMIT'})).result.status,'CLAIM_NOT_CONFIRMED');assert.equal((await f.api(path,{...review,action:'SUBMIT'})).result.status,'REMOTE_FILE_NOT_FOUND');assert.equal(f.server.state.writes,0)}finally{await f?.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
test('database cancellation waits for an in-flight allocation claim and cannot release its contribution reservation',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let f,left,right
 try{
  f=await fixture();const a=await f.api(f.deliveryPath,f.deliveryBody);left=await f.h.pool.connect();right=await f.h.pool.connect();const pid=(await right.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
  await left.query('BEGIN');await left.query('INSERT INTO payroll_retirement_allocation_claim(id,authorization_id,reference,created_by) VALUES($1,$2,$3,99)',[randomUUID(),a.id,review.reference]);await right.query('BEGIN')
  const cancellation=right.query('INSERT INTO payroll_retirement_remittance_cancellation(id,facility_id,authorization_id,reference,request_key,request_fingerprint,created_by) VALUES($1,1,$2,$3,$4,$5,99)',[randomUUID(),f.remittanceId,review.reference,randomUUID(),'synthetic']).then(()=>({error:null}),error=>({error}))
  let waiting=false
  for(let attempt=0;attempt<100;attempt++){if((await f.h.pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){waiting=true;break}await new Promise(resolve=>setTimeout(resolve,5))}
  assert.equal(waiting,true);await left.query('COMMIT');assert.match((await cancellation).error?.message||'',/Allocation dispatch has been claimed/);await right.query('ROLLBACK')
  assert.equal((await f.h.pool.query('SELECT * FROM payroll_retirement_remittance_cancellation WHERE authorization_id=$1',[f.remittanceId])).rowCount,0)
 }finally{await left?.query('ROLLBACK').catch(()=>{});await right?.query('ROLLBACK').catch(()=>{});left?.release();right?.release();await f?.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
