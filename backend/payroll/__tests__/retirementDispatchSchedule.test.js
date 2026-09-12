import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementBankProvider} from '../testing/retirementBankProvider.js'
import {createRetirementSftpServer} from '../testing/retirementSftpServer.js'
import {retirementAllocationDeliveryFixture} from '../testing/retirementAllocationDeliveryFixture.js'
import {verifyRetirementSftpConnection,transferRetirementAllocation} from '../retirementSftpTransport.js'
import {runRetirementScheduledDispatches,startRetirementDispatchScheduler} from '../retirementDispatchSchedule.js'
const enabled=!!process.env.PAYROLL_TEST_DATABASE_URL
async function scenario(work){
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const server=await createRetirementSftpServer(),provider=retirementBankProvider();let clock=new Date('2026-09-19T12:00:00Z')
 const now=()=>clock,transfer=(c,file,options)=>transferRetirementAllocation(c,file,{...server.options,...options})
 const h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:now,retirementNow:()=>new Date('2026-09-11T12:00:00Z'),retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:transfer})
 try{const f=await retirementAllocationDeliveryFixture(h,server.config),allocation=await f.api(f.deliveryPath,f.deliveryBody)
  await work({h,f,allocation,server,provider,transfer,setClock:value=>{clock=new Date(value)},sweep:(options={})=>runRetirementScheduledDispatches(h.pool,{facility:1,bankFetcher:provider.fetcher,allocationTransfer:transfer,now,...options})})
 }finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
}
const scheduleBody=()=>({submitAt:'2026-09-19T13:00:00.000Z',reference:'Reviewed exact authorized delivery and no outside instructions before scheduled submission',confirmed:true,outsideActivityReviewed:true,bankInstructionsReviewed:true,requestKey:randomUUID()})
test('scheduled bank and allocation submissions retain one claim each across concurrent workers and lost responses',{skip:!enabled},()=>scenario(async({h,f,allocation,server,provider,setClock,sweep})=>{
 const paths=['BANK/'+f.remittanceId,'FILE/'+allocation.id].map(x=>'/retirement-dispatch-schedules/'+x)
 const ids=[]
 for(const path of paths){const body=scheduleBody(),saved=await f.api(path,body);ids.push(saved.id);assert.equal((await f.api(path,body)).id,saved.id);await f.api(path,{...body,requestKey:randomUUID()},'POST',409)}
 assert.equal((await sweep()).claimed,0)
 await f.api(`${f.deliveryPath}/${allocation.id}/dispatch`,{action:'SUBMIT',confirmed:true,outsideActivityReviewed:true,reference:'Reviewed immediate upload attempt while scheduled dispatch exists'},'POST',409)
 await f.api(`/retirement-remittance-authorizations/${f.remittanceId}/dispatch`,{action:'SUBMIT',confirmed:true,bankInstructionsReviewed:true,outsideActivityReviewed:true,reference:'Reviewed immediate bank attempt while scheduled dispatch exists'},'POST',409)
 provider.loseResponse(true);server.state.loseRename=true
 provider.beforePost(async()=>{const claim=(await h.pool.query('SELECT scheduled_id,created_by FROM payroll_retirement_remittance_claim WHERE authorization_id=$1',[f.remittanceId])).rows[0];assert.equal(claim.scheduled_id,ids[0]);assert.equal(claim.created_by,null)})
 setClock('2026-09-19T13:00:00Z');const results=await Promise.all([sweep(),sweep()]);assert.equal(results.reduce((n,r)=>n+r.claimed,0),2);assert.equal(provider.posts(),1);assert.equal(server.state.created,1)
 assert.equal((await sweep()).claimed,0)
 for(let i=0;i<paths.length;i++){const history=(await f.api(paths[i])).history;assert.equal(history[0].attempt.status,'CLAIMED');await f.api(`${paths[i]}/${ids[i]}/cancel`,{confirmed:true,reference:'Attempt cancellation after a retained scheduled dispatch claim'},'POST',409)}
 const file=(await f.api(f.deliveryPath)).history[0];assert.equal(file.result.automatic,true);assert.equal(file.result.source,'SUBMISSION')
 assert.equal((await h.pool.query('SELECT scheduled_id,created_by FROM payroll_retirement_allocation_claim WHERE authorization_id=$1',[allocation.id])).rows[0].scheduled_id,ids[1])
}))
test('schedule cancellation and renewal preserve retries, expired schedules alert once without transmitting',{skip:!enabled},()=>scenario(async({h,f,allocation,server,provider,setClock,sweep})=>{
 for(const target of ['BANK/'+f.remittanceId,'FILE/'+allocation.id]){
  const path='/retirement-dispatch-schedules/'+target,body=scheduleBody(),saved=await f.api(path,body),cancel={confirmed:true,reference:'Cancel the retained schedule before its dispatch is claimed'}
  await f.api(`${path}/${saved.id}/cancel`,cancel);assert.equal((await f.api(`${path}/${saved.id}/cancel`,cancel)).reused,true)
  assert.equal((await f.api(path,body)).cancelled,true)
  const next=await f.api(path,{...body,requestKey:randomUUID()});assert.notEqual(next.id,saved.id)
 }
 setClock('2026-09-22T12:00:00Z');assert.equal((await sweep()).blocked,2);assert.equal((await sweep()).blocked,0);assert.equal(provider.posts(),0);assert.equal(server.state.created,0)
 assert.equal((await h.pool.query("SELECT count(*)::int AS n FROM payroll_alert WHERE dedupe_key LIKE 'retirement-schedule-%' AND status='OPEN'")).rows[0].n,2)
 assert.equal((await h.pool.query("SELECT count(*)::int AS n FROM payroll_retirement_dispatch_schedule_attempt WHERE status='EXPIRED'")).rows[0].n,2)
}))
test('blocked schedules retry after one minute, remain scoped and cancellation prevents future dispatch',{skip:!enabled},()=>scenario(async({h,f,allocation,server,provider,setClock,sweep})=>{
 const path='/retirement-dispatch-schedules/FILE/'+allocation.id,body=scheduleBody()
 await f.api(path,{...body,submitAt:'2026-09-19T12:00:30.000Z'},'POST',400)
 await f.api(path,{...body,submitAt:'2026-09-21T17:59:00.000Z'},'POST',400)
 const saved=await f.api(path,body)
 const foreign=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreign.status,404)
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_dispatch_schedule SET reference=$1 WHERE id=$2',['Changed historical review',saved.id]),/append-only/i)
 const key=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY
 setClock('2026-09-19T13:00:00Z');assert.equal((await sweep()).blocked,1);assert.equal((await sweep()).blocked,0)
 process.env.PAYROLL_DOCUMENT_KEY=key;setClock('2026-09-19T13:00:59Z');assert.equal((await sweep()).claimed,0)
 setClock('2026-09-19T13:01:00Z');assert.equal((await sweep()).claimed,1);assert.equal(server.state.created,1)
 assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`retirement-schedule-${saved.id}`])).rows[0].status,'DISMISSED')
 const bankPath='/retirement-dispatch-schedules/BANK/'+f.remittanceId,bank=await f.api(bankPath,{...scheduleBody(),submitAt:'2026-09-19T14:00:00.000Z'})
 await f.api(`${bankPath}/${bank.id}/cancel`,{confirmed:true,reference:'Cancel future bank dispatch while reviewing separate allocation outcome'})
 setClock('2026-09-19T14:00:00Z');assert.equal((await sweep()).claimed,0);assert.equal(provider.posts(),0)
}))
test('scheduled file dispatch uses a live cutoff after its durable claim and never resends the held file',{skip:!enabled},()=>scenario(async({h,f,allocation,server,transfer,setClock,sweep})=>{
 await f.api('/retirement-dispatch-schedules/FILE/'+allocation.id,scheduleBody());setClock('2026-09-19T13:00:00Z')
 const result=await sweep({allocationTransfer:async(c,file,options)=>{
  assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_retirement_allocation_claim WHERE authorization_id=$1',[allocation.id])).rows[0].n,1)
  setClock('2026-09-21T18:00:00Z');return transfer(c,file,options)
 }})
 assert.equal(result.claimed,1);assert.equal(server.state.created,0);assert.equal((await f.api(f.deliveryPath)).history[0].result.status,'CLAIM_NOT_CONFIRMED')
 assert.equal((await sweep()).claimed,0);await f.api(`${f.deliveryPath}/${allocation.id}/dispatch`,{action:'RECOVER',confirmed:true});assert.equal(server.state.created,0)
}))
test('explicit disablement and test mode do not start scheduled first submissions',()=>{
 const old=process.env.NODE_ENV,flag=process.env.PAYROLL_RETIREMENT_SCHEDULED_DISPATCH_ENABLED
 try{process.env.NODE_ENV='test';assert.equal(startRetirementDispatchScheduler({}),null);process.env.NODE_ENV='production';process.env.PAYROLL_RETIREMENT_SCHEDULED_DISPATCH_ENABLED='false';assert.equal(startRetirementDispatchScheduler({}),null)}finally{if(old===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=old;if(flag===undefined)delete process.env.PAYROLL_RETIREMENT_SCHEDULED_DISPATCH_ENABLED;else process.env.PAYROLL_RETIREMENT_SCHEDULED_DISPATCH_ENABLED=flag}
})
