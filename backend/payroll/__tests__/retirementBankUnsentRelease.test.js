import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementBankProvider} from '../testing/retirementBankProvider.js'
import {retirementRemittanceAuthorizationFixture} from '../testing/retirementRemittanceAuthorizationFixture.js'
const enabled=!!process.env.PAYROLL_TEST_DATABASE_URL
const bank={action:'SUBMIT',confirmed:true,bankInstructionsReviewed:true,outsideActivityReviewed:true,reference:'Reviewed trustee bank credit and separate allocation without outside duplicate activity'}
const releaseBody=p=>({fingerprint:p.fingerprint,requestKey:randomUUID(),reference:'Independent outside activity review and original provider absence before unsent contribution release',confirmed:true,outsideActivityReviewed:true})
async function scenario(work){
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 let clock=new Date('2026-09-19T12:00:00Z'),block=false,hook=async()=>{}
 const provider=retirementBankProvider(),fetcher=async(url,options)=>{await hook(url,options);if(block&&url.includes('/payment_orders/'))clock=new Date('2026-09-21T18:00:00Z');return provider.fetcher(url,options)}
 const h=await createHarness({paymentFetcher:fetcher,remittanceNow:()=>clock,retirementNow:()=>new Date('2026-09-11T12:00:00Z')})
 try{const f=await retirementRemittanceAuthorizationFixture(h),a=await f.api(f.path,f.body),path=`/retirement-remittance-authorizations/${a.id}`;await work({h,f,a,path,provider,block:value=>{block=value},resetClock:()=>{clock=new Date('2026-09-19T12:00:00Z')},setHook:fn=>{hook=fn}})}finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
}
test('confirmed pre-send bank release cancels the reservation once and permits renewed current authorization',{skip:!enabled},()=>scenario(async({h,f,a,path,provider,block,resetClock})=>{
 block(true);const sent=await f.api(path+'/dispatch',bank);assert.equal(sent.result.status,'BLOCKED_CUTOFF');assert.equal(sent.result.noSendProof,true);assert.equal(provider.posts(),0);block(false);resetClock()
 const preview=await f.api(path+'/release-unsent/preview',{});assert.equal(preview.eligible,true)
 const body=releaseBody(preview),[one,two]=await Promise.all([f.api(path+'/release-unsent',body),f.api(path+'/release-unsent',body)]);assert.equal(one.id,two.id)
 const key=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY;assert.equal((await f.api(path+'/release-unsent',body)).id,one.id);process.env.PAYROLL_DOCUMENT_KEY=key
 const row=(await f.api(f.path)).history[0];assert.equal(row.status,'CANCELLED');assert.equal(row.bank_unsent_release.id,one.id)
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_bank_unsent_release SET reference=$1 WHERE id=$2',['Changed evidence',one.id]),/append-only/)
 await f.api(path+'/dispatch',bank,'POST',409)
 const next=await f.api(f.path,{...f.body,requestKey:randomUUID()});assert.notEqual(next.id,a.id);await f.api(`/retirement-remittance-authorizations/${next.id}/dispatch`,bank);assert.equal(provider.posts(),1)
}))
test('missing payment after lost POST response never authorizes a bank release',{skip:!enabled},()=>scenario(async({h,f,a,path,provider})=>{
 provider.loseResponse(true);assert.equal((await f.api(path+'/dispatch',bank)).result.noSendProof,false);assert.equal(provider.posts(),1);provider.missing(true)
 await f.api(path+'/dispatch',{action:'RECOVER',confirmed:true});const preview=await f.api(path+'/release-unsent/preview',{});assert.equal(preview.eligible,false);await f.api(path+'/release-unsent',releaseBody(preview),'POST',409)
 await assert.rejects(h.pool.query("INSERT INTO payroll_retirement_bank_unsent_release(id,authorization_id,facility_id,submission_observation_id,evidence,reference,request_key,request_fingerprint,created_by) SELECT $1,$2,1,id,'{\"remoteStatus\":\"NOT_FOUND\"}','Forged absence',$3,'bad',99 FROM payroll_retirement_remittance_observation WHERE authorization_id=$2 LIMIT 1",[randomUUID(),a.id,randomUUID()]),/affirmative non-send/)
}))
test('bank release is scoped, rechecks provider absence and rejects evidence changes during network lookup',{skip:!enabled},()=>scenario(async({h,f,a,path,provider,block,resetClock,setHook})=>{
 block(true);await f.api(path+'/dispatch',bank);block(false);resetClock()
 const preview=await f.api(path+'/release-unsent/preview',{}),body=releaseBody(preview)
 const foreign=await fetch(`${h.url}/api/admin/payroll${path}/release-unsent/preview`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:'{}'});assert.equal(foreign.status,404)
 let changed=false;setHook(async url=>{if(url.includes('/payment_orders/')&&!changed){changed=true;await h.pool.query("INSERT INTO payroll_retirement_remittance_observation(authorization_id,source,result,created_by) VALUES($1,'RECOVERY','{\"status\":\"NOT_FOUND\"}',99)",[a.id])}})
 await f.api(path+'/release-unsent',body,'POST',409);setHook(async()=>{})
 const fresh=await f.api(path+'/release-unsent/preview',{});assert.equal(fresh.eligible,true)
 setHook(async url=>{if(url.includes('/payment_orders/'))throw new Error('Synthetic unavailable original provider')});await f.api(path+'/release-unsent',releaseBody(fresh),'POST',409);setHook(async()=>{})
 await f.api(path+'/release-unsent',releaseBody(fresh));assert.equal(provider.posts(),0)
}))
test('bank reservation stays held until the separately claimed file has an affirmative non-send release',{skip:!enabled},async()=>{
 const {createRetirementSftpServer}=await import('../testing/retirementSftpServer.js'),{retirementAllocationDeliveryFixture}=await import('../testing/retirementAllocationDeliveryFixture.js'),{transferRetirementAllocation,verifyRetirementSftpConnection}=await import('../retirementSftpTransport.js')
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const server=await createRetirementSftpServer(),provider=retirementBankProvider();let clock=new Date('2026-09-19T12:00:00Z'),blocked=false
 const fetcher=async(url,options)=>{if(blocked&&url.includes('/payment_orders/'))clock=new Date('2026-09-21T18:00:00Z');return provider.fetcher(url,options)}
 const h=await createHarness({paymentFetcher:fetcher,remittanceNow:()=>clock,retirementNow:()=>new Date('2026-09-11T12:00:00Z'),retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:(c,file,options)=>transferRetirementAllocation(c,file,{...server.options,...options,beforeWrite:async()=>false})})
 try{
  const f=await retirementAllocationDeliveryFixture(h,server.config),a=await f.api(f.deliveryPath,f.deliveryBody),filePath=`${f.deliveryPath}/${a.id}`,path=`/retirement-remittance-authorizations/${f.remittanceId}`
  await f.api(filePath+'/dispatch',{action:'SUBMIT',confirmed:true,outsideActivityReviewed:true,reference:'Original file review before a prevented write with no outside activity'})
  blocked=true;await f.api(path+'/dispatch',bank);blocked=false;clock=new Date('2026-09-19T12:00:00Z')
  const preview=await f.api(path+'/release-unsent/preview',{});assert.equal(preview.eligible,false);assert.match(preview.reasons.join(' '),/allocation file has an unresolved claim/);await f.api(path+'/release-unsent',releaseBody(preview),'POST',409)
  const filePreview=await f.api(filePath+'/release-unsent/preview',{});await f.api(filePath+'/release-unsent',releaseBody(filePreview))
  const eligible=await f.api(path+'/release-unsent/preview',{});assert.equal(eligible.eligible,true);await f.api(path+'/release-unsent',releaseBody(eligible))
  assert.equal((await f.api(f.path)).history[0].status,'CANCELLED');assert.equal(server.state.created,0);assert.equal(provider.posts(),0)
 }finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
