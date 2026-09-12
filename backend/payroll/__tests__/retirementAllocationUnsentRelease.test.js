import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {createRetirementSftpServer} from '../testing/retirementSftpServer.js'
import {retirementDestinationProvider} from '../testing/retirementDestinationProvider.js'
import {retirementAllocationDeliveryFixture} from '../testing/retirementAllocationDeliveryFixture.js'
import {transferRetirementAllocation,verifyRetirementSftpConnection} from '../retirementSftpTransport.js'
const enabled=!!process.env.PAYROLL_TEST_DATABASE_URL
async function scenario(work){
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const server=await createRetirementSftpServer(),provider=retirementDestinationProvider();let mode='BLOCK',hook=async()=>{}
 const transfer=async(c,file,options)=>{await hook(options);if(mode==='THROW'&&options.mode==='SUBMIT')throw new Error('Synthetic unknown transport outcome');return transferRetirementAllocation(c,file,{...server.options,...options,...(mode==='BLOCK'&&options.mode==='SUBMIT'?{beforeWrite:async()=>false}:{})})}
 const h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T12:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:transfer})
 try{const f=await retirementAllocationDeliveryFixture(h,server.config),allocation=await f.api(f.deliveryPath,f.deliveryBody),path=`${f.deliveryPath}/${allocation.id}`,dispatch=()=>f.api(path+'/dispatch',{action:'SUBMIT',confirmed:true,outsideActivityReviewed:true,reference:'Reviewed original exact allocation without duplicate outside delivery'})
 await work({h,f,allocation,path,dispatch,server,setMode:m=>{mode=m},setHook:fn=>{hook=fn}})
 }finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
}
const body=preview=>({fingerprint:preview.fingerprint,requestKey:randomUUID(),reference:'Verified no outside file activity and both paths absent before releasing the unsent allocation',confirmed:true,outsideActivityReviewed:true})
test('affirmative no-write release rechecks absence, preserves exact retries and permits a new reviewed filename',{skip:!enabled},()=>scenario(async({h,f,allocation,path,dispatch,server,setMode})=>{
 const result=await dispatch();assert.equal(result.result.noWriteProof,true);assert.equal(server.state.created,0)
 const preview=await f.api(path+'/release-unsent/preview',{});assert.equal(preview.eligible,true);assert.equal(preview.remoteStatus,'REMOTE_PATHS_ABSENT')
 const b=body(preview),[released,retry]=await Promise.all([f.api(path+'/release-unsent',b),f.api(path+'/release-unsent',b)]);assert.equal(released.id,retry.id)
 const key=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY;assert.equal((await f.api(path+'/release-unsent',b)).id,released.id);process.env.PAYROLL_DOCUMENT_KEY=key
 const row=(await f.api(f.deliveryPath)).history[0];assert.equal(row.cancelled,true);assert.equal(row.unsent_release.id,released.id)
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_allocation_unsent_release SET reference=$1 WHERE id=$2',['Changed proof',released.id]),/append-only/)
 await f.api(path+'/dispatch',{action:'SUBMIT',confirmed:true,outsideActivityReviewed:true,reference:'Attempt to reuse a released file authorization without a new review'},'POST',409)
 const fresh=await f.api(f.deliveryPath,{...f.deliveryBody,fileName:'renewed_'+allocation.id+'.csv',requestKey:randomUUID()});setMode('SEND')
 assert.equal((await f.api(`${f.deliveryPath}/${fresh.id}/dispatch`,{action:'SUBMIT',confirmed:true,outsideActivityReviewed:true,reference:'Renewed exact authorization and unique filename without outside duplicates'})).result.status,'REMOTE_FILE_VERIFIED');assert.equal(server.state.created,1)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_allocation_unsent_release')).rows[0].n,1)
}))
test('unknown send outcomes cannot fabricate release evidence',{skip:!enabled},()=>scenario(async({h,f,path,allocation,dispatch,server,setMode})=>{
 setMode('THROW');assert.equal((await dispatch()).result.noWriteProof,false)
 const preview=await f.api(path+'/release-unsent/preview',{});assert.equal(preview.eligible,false);assert.match(preview.reasons.join(' '),/explicit retained proof/)
 await f.api(path+'/release-unsent',body(preview),'POST',409)
 await assert.rejects(h.pool.query("INSERT INTO payroll_retirement_allocation_unsent_release(id,authorization_id,facility_id,submission_observation_id,evidence,reference,request_key,request_fingerprint,created_by) SELECT $1,$2,1,id,'{\"remoteStatus\":\"REMOTE_PATHS_ABSENT\"}','Forged absence',$3,'bad',99 FROM payroll_retirement_allocation_observation WHERE authorization_id=$2 LIMIT 1",[randomUUID(),allocation.id,randomUUID()]),/affirmative non-write/)
 assert.equal(server.state.created,0)
}))
test('release rejects fresh staged activity, changed observations and foreign employer access; released-only claims permit parent cancellation',{skip:!enabled},()=>scenario(async({h,f,path,allocation,dispatch,server,setHook})=>{
 await dispatch();const preview=await f.api(path+'/release-unsent/preview',{}),b=body(preview)
 server.files.set('/staging/'+f.deliveryBody.fileName+'.part',Buffer.from('outside staging activity'))
 await f.api(path+'/release-unsent',b,'POST',409);server.files.clear()
 const foreign=await fetch(`${h.url}/api/admin/payroll${path}/release-unsent/preview`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:'{}'});assert.equal(foreign.status,404)
 let changed=false;setHook(async options=>{if(options.mode==='VERIFY_ABSENCE'&&!changed){changed=true;await h.pool.query("INSERT INTO payroll_retirement_allocation_observation(authorization_id,source,result,created_by) VALUES($1,'RECOVERY','{\"status\":\"REMOTE_FILE_NOT_FOUND\"}',99)",[allocation.id])}})
 await f.api(path+'/release-unsent',b,'POST',409);setHook(async()=>{})
 const next=await f.api(path+'/release-unsent/preview',{});await f.api(path+'/release-unsent',body(next))
 await f.api(`/retirement-remittance-authorizations/${f.remittanceId}/cancel`,{requestKey:randomUUID(),confirmed:true,reference:'Cancel contribution reservation after verified unsent allocation release'})
 assert.equal((await f.api(f.path)).history[0].status,'CANCELLED');assert.equal(server.state.created,0)
}))
test('a consumed file after a lost transmission response remains reserved and cannot be released',{skip:!enabled},()=>scenario(async({f,path,dispatch,server,setMode})=>{
 setMode('SEND');server.state.loseRename=true;const sent=await dispatch();assert.equal(sent.result.status,'TRANSPORT_UNCERTAIN');assert.equal(sent.result.noWriteProof,false);assert.equal(server.state.created,1)
 server.files.clear();await f.api(path+'/dispatch',{action:'RECOVER',confirmed:true});const preview=await f.api(path+'/release-unsent/preview',{});assert.equal(preview.eligible,false)
 await f.api(path+'/release-unsent',body(preview),'POST',409);assert.equal((await f.api(f.deliveryPath)).history[0].cancelled,false);assert.equal(server.state.created,1)
}))
