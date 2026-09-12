import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementDestinationProvider} from '../testing/retirementDestinationProvider.js'
import {createRetirementSftpServer} from '../testing/retirementSftpServer.js'
import {retirementAllocationDeliveryFixture} from '../testing/retirementAllocationDeliveryFixture.js'
import {verifyRetirementSftpConnection,transferRetirementAllocation} from '../retirementSftpTransport.js'
import {recoverRetirementAllocations,startRetirementAllocationRecoveryScheduler} from '../retirementAllocationRecovery.js'
test('automatic allocation recovery serializes duplicate sweeps, uses historical credentials and never resends missing files',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY,key=randomBytes(32).toString('hex');process.env.PAYROLL_DOCUMENT_KEY=key
 const server=await createRetirementSftpServer(),provider=retirementDestinationProvider(),transfer=(c,file,options)=>transferRetirementAllocation(c,file,{...server.options,...options})
 const h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T12:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:transfer})
 try{
  const f=await retirementAllocationDeliveryFixture(h,server.config),a=await f.api(f.deliveryPath,f.deliveryBody),now=new Date(Date.now()+6*60000)
  assert.deepEqual(await recoverRetirementAllocations(h.pool,1,{transfer,now}),{checked:0,remoteVerified:0,failed:0})
  server.state.loseRename=true;const sent=await f.api(`${f.deliveryPath}/${a.id}/dispatch`,{action:'SUBMIT',confirmed:true,outsideActivityReviewed:true,reference:'Renewed review before exact allocation delivery without outside duplicates'});assert.equal(sent.result.status,'TRANSPORT_UNCERTAIN')
  const [one,two]=await Promise.all([recoverRetirementAllocations(h.pool,1,{transfer,now}),recoverRetirementAllocations(h.pool,1,{transfer,now})]);assert.equal(one.checked+two.checked,1);assert.equal(one.remoteVerified+two.remoteVerified,1);assert.equal(one.failed+two.failed,0)
  const history=(await f.api(f.deliveryPath)).history[0];assert.equal(history.result.automatic,true);assert.equal(history.result.status,'REMOTE_FILE_VERIFIED')
  const observation=(await h.pool.query('SELECT * FROM payroll_retirement_allocation_observation WHERE automatic=true')).rows;assert.equal(observation.length,1);assert.equal(observation[0].created_by,null)
  await assert.rejects(h.pool.query("INSERT INTO payroll_retirement_allocation_observation(authorization_id,source,result,created_by,automatic) VALUES($1,'RECOVERY','{}',99,true)",[a.id]),/automatic_actor/)
  assert.equal((await recoverRetirementAllocations(h.pool,1,{transfer,now:new Date(+now+86399999)})).checked,0)
  await f.api(f.setupPath,{action:'SUSPEND',expectedRevision:1,requestKey:randomUUID(),reference:'Suspend future uploads while retaining historical recovery instructions',confirmed:true})
  server.files.clear();const later=new Date(+now+86400001);assert.equal((await recoverRetirementAllocations(h.pool,1,{transfer,now:later})).checked,1);assert.equal((await f.api(f.deliveryPath)).history[0].result.status,'REMOTE_FILE_NOT_FOUND')
  assert.equal((await recoverRetirementAllocations(h.pool,2,{transfer,now:new Date(+later+300001)})).checked,0)
  delete process.env.PAYROLL_DOCUMENT_KEY;assert.equal((await recoverRetirementAllocations(h.pool,1,{transfer,now:new Date(+later+300001)})).checked,1);assert.equal((await f.api(f.deliveryPath)).history[0].result.status,'RECOVERY_UNAVAILABLE')
  process.env.PAYROLL_DOCUMENT_KEY=key;assert.equal((await recoverRetirementAllocations(h.pool,1,{transfer,now:new Date(+later+600002)})).checked,1)
  assert.equal(server.state.created,1);assert.equal(server.state.renames,1)
  assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`retirement-allocation-${a.id}`])).rows[0].status,'OPEN')
 }finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
test('recovery bounds candidates and continues after a failed claim lookup',async()=>{
 let attempted=0
 const pool={query:async sql=>{assert.match(sql,/LIMIT 10/);assert.match(sql,/ORDER BY COALESCE/);return {rows:[1,2].map(n=>({id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,facility_id:1,remittance_id:'00000000-0000-4000-8000-000000000010'}))}},connect:async()=>{attempted++;throw new Error('Synthetic connection failure')}}
 assert.deepEqual(await recoverRetirementAllocations(pool),{checked:0,remoteVerified:0,failed:2});assert.equal(attempted,2)
})
test('test mode and explicit scheduler disablement never start background allocation work',()=>{
 const env=process.env.NODE_ENV,flag=process.env.PAYROLL_RETIREMENT_ALLOCATION_RECOVERY_ENABLED
 try{process.env.NODE_ENV='test';assert.equal(startRetirementAllocationRecoveryScheduler({}),null);process.env.NODE_ENV='production';process.env.PAYROLL_RETIREMENT_ALLOCATION_RECOVERY_ENABLED='false';assert.equal(startRetirementAllocationRecoveryScheduler({}),null)}finally{if(env===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=env;if(flag===undefined)delete process.env.PAYROLL_RETIREMENT_ALLOCATION_RECOVERY_ENABLED;else process.env.PAYROLL_RETIREMENT_ALLOCATION_RECOVERY_ENABLED=flag}
})
